import { LicensingRequest } from '../models/LicensingRequest.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { uploadBufferDetailed } from '../../../../services/upload.service.js';
import { sendLicensingAcknowledgementEmail } from '../../../../utils/email.js';

const validateAndUpload = async (file, fieldName, folder = 'licensing/documents') => {
    if (!file) return '';
    
    // Validate file type
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const lastDotIndex = file.originalname.lastIndexOf('.');
    if (lastDotIndex === -1) {
        throw new ValidationError(`Invalid file name for ${fieldName}. Missing extension.`);
    }
    const fileExtension = file.originalname.substring(lastDotIndex).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
        throw new ValidationError(`Invalid file type for ${fieldName}. Only PDF, JPG, JPEG, and PNG are allowed.`);
    }

    // Validate size (10MB)
    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        throw new ValidationError(`File size for ${fieldName} must be 10 MB or less.`);
    }

    // Upload using Memory Buffer to Cloudinary as 'raw' resource
    const result = await uploadBufferDetailed(file.buffer, { folder, resourceType: 'raw' });
    return result.secure_url;
};

export const submitLicensingRequestService = async (data, files = {}) => {
    const {
        vendor,
        restaurantName,
        ownerName,
        city,
        address,
        restaurantId,
        gstNumber,
        mobile,
        email,
        selectedLicenses,
        otherLicenseText,
        termsAccepted
    } = data;

    // Validate required text fields
    if (!vendor || !restaurantName || !ownerName || !city || !mobile || !email || !selectedLicenses) {
        throw new ValidationError('Missing required fields: vendor, restaurantName, ownerName, city, mobile, email, and selectedLicenses are required.');
    }

    if (termsAccepted !== 'true' && termsAccepted !== true) {
        throw new ValidationError('You must accept the Terms & Conditions to submit the request.');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new ValidationError('Invalid email format.');
    }

    // Validate mobile number (at least 10-14 digits)
    const normalizedMobile = mobile.replace(/[\s-]/g, '');
    if (!/^\+?\d{10,14}$/.test(normalizedMobile)) {
        throw new ValidationError('Invalid mobile number format. Must be between 10 and 14 digits.');
    }

    // Parse selectedLicenses array from JSON-string or comma-separated string
    let parsedLicenses = [];
    try {
        parsedLicenses = typeof selectedLicenses === 'string' ? JSON.parse(selectedLicenses) : (selectedLicenses || []);
    } catch (e) {
        parsedLicenses = typeof selectedLicenses === 'string' 
            ? selectedLicenses.split(',').map(l => l.trim()).filter(Boolean) 
            : [];
    }

    if (!Array.isArray(parsedLicenses) || parsedLicenses.length === 0) {
        throw new ValidationError('At least one license selection is required.');
    }

    // Prevent duplicate submissions within a short time (5 minutes) for the same email and vendor
    const duplicateWindow = new Date(Date.now() - 5 * 60 * 1000);
    const existingRequest = await LicensingRequest.findOne({
        email: email.trim().toLowerCase(),
        vendor: vendor.trim(),
        createdAt: { $gte: duplicateWindow }
    });

    if (existingRequest) {
        throw new ValidationError('You have already submitted a licensing request for this consultant recently. Please wait a few minutes before trying again.');
    }

    // Upload individual files
    const aadhaarUrl = files.aadhaar ? await validateAndUpload(files.aadhaar[0], 'Aadhaar Document') : '';
    const panUrl = files.pan ? await validateAndUpload(files.pan[0], 'PAN Document') : '';
    const existingFssaiUrl = files.existingFssai ? await validateAndUpload(files.existingFssai[0], 'Existing FSSAI Document') : '';
    const existingGstUrl = files.existingGst ? await validateAndUpload(files.existingGst[0], 'Existing GST Certificate') : '';
    const shopImageUrl = files.shopImage ? await validateAndUpload(files.shopImage[0], 'Shop Image') : '';
    const restaurantPhotoUrl = files.restaurantPhoto ? await validateAndUpload(files.restaurantPhoto[0], 'Restaurant Photo') : '';

    // Upload multiple "otherDocs" (capped at 5 files)
    const otherDocsUrls = [];
    const otherDocsFiles = files.otherDocs || [];
    for (let i = 0; i < Math.min(otherDocsFiles.length, 5); i++) {
        const url = await validateAndUpload(otherDocsFiles[i], `Other Document #${i + 1}`);
        if (url) otherDocsUrls.push(url);
    }

    // Create record
    const licensingRequest = new LicensingRequest({
        vendor: vendor.trim(),
        restaurantName: restaurantName.trim(),
        ownerName: ownerName.trim(),
        city: city.trim(),
        address: address ? address.trim() : '',
        restaurantId: restaurantId ? restaurantId.trim() : '',
        gstNumber: gstNumber ? gstNumber.trim() : '',
        mobile: mobile.trim(),
        email: email.trim().toLowerCase(),
        selectedLicenses: parsedLicenses,
        otherLicenseText: otherLicenseText ? otherLicenseText.trim() : '',
        uploadedDocuments: {
            aadhaar: aadhaarUrl,
            pan: panUrl,
            existingFssai: existingFssaiUrl,
            existingGst: existingGstUrl,
            shopImage: shopImageUrl,
            restaurantPhoto: restaurantPhotoUrl,
            otherDocs: otherDocsUrls
        },
        termsAccepted: true,
        status: 'Pending'
    });

    await licensingRequest.save();

    // Asynchronously send acknowledgement email using existing SMTP setup
    sendLicensingAcknowledgementEmail(
        licensingRequest.email,
        licensingRequest.ownerName,
        licensingRequest.restaurantName,
        licensingRequest.vendor
    ).catch(err => console.error(`Error sending licensing email to ${licensingRequest.email}:`, err));

    return licensingRequest;
};

export const getAllLicensingRequestsService = async (query = {}) => {
    const {
        search,
        status,
        vendor,
        licenseType,
        city,
        startDate,
        endDate,
        sortBy = 'newest',
        page = 1,
        limit = 10
    } = query;

    const filters = {};

    if (search) {
        const searchRegex = { $regex: search, $options: 'i' };
        filters.$or = [
            { restaurantName: searchRegex },
            { ownerName: searchRegex },
            { mobile: searchRegex },
            { email: searchRegex },
            { vendor: searchRegex }
        ];
    }

    if (status) {
        filters.status = status;
    }

    if (vendor) {
        filters.vendor = vendor;
    }

    if (licenseType) {
        filters.selectedLicenses = licenseType;
    }

    if (city) {
        filters.city = { $regex: city, $options: 'i' };
    }

    if (startDate || endDate) {
        filters.createdAt = {};
        if (startDate) filters.createdAt.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filters.createdAt.$lte = end;
        }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let sort = { createdAt: -1 };
    if (sortBy === 'oldest') {
        sort = { createdAt: 1 };
    } else if (sortBy === 'alphabetical') {
        sort = { restaurantName: 1 };
    }

    const requests = await LicensingRequest.find(filters)
        .populate('reviewedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit));

    const total = await LicensingRequest.countDocuments(filters);

    const pending = await LicensingRequest.countDocuments({ status: 'Pending' });
    const contacted = await LicensingRequest.countDocuments({ status: 'Contacted' });
    const inProgress = await LicensingRequest.countDocuments({ status: 'In Progress' });
    const completed = await LicensingRequest.countDocuments({ status: 'Completed' });
    const rejected = await LicensingRequest.countDocuments({ status: 'Rejected' });

    return {
        requests,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
        stats: {
            total,
            pending,
            contacted,
            inProgress,
            completed,
            rejected
        }
    };
};

export const getLicensingRequestByIdService = async (id) => {
    const request = await LicensingRequest.findById(id).populate('reviewedBy', 'name email');
    if (!request) {
        throw new NotFoundError('Licensing request not found.');
    }
    return request;
};

export const updateLicensingStatusService = async (id, status, remarks, adminId) => {
    const request = await LicensingRequest.findById(id);
    if (!request) {
        throw new NotFoundError('Licensing request not found.');
    }

    const validStatuses = ['Pending', 'Contacted', 'In Progress', 'Completed', 'Rejected'];
    if (!validStatuses.includes(status)) {
        throw new ValidationError('Invalid status option.');
    }

    request.status = status;
    if (remarks !== undefined) {
        request.adminRemarks = remarks;
    }
    request.reviewedAt = new Date();
    request.reviewedBy = adminId;

    await request.save();
    
    return LicensingRequest.findById(id).populate('reviewedBy', 'name email');
};

export const deleteLicensingRequestService = async (id) => {
    const result = await LicensingRequest.findByIdAndDelete(id);
    if (!result) {
        throw new NotFoundError('Licensing request not found.');
    }
    return true;
};
