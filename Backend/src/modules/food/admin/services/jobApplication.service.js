import { JobApplication } from '../models/jobApplication.model.js';
import { Job } from '../models/job.model.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { uploadBufferDetailed, signApplicationUrls } from '../../../../services/upload.service.js';
import { sendJobApplicationAcknowledgementEmail } from '../../../../utils/email.js';

const uploadToCloudinary = async (file, folder = 'careers/applications') => {
    if (!file || !file.buffer) return null;
    const result = await uploadBufferDetailed(file.buffer, { folder, resourceType: 'raw' });
    return result.secure_url;
};

export const submitApplicationService = async (data, files = {}) => {
    const {
        applicantName,
        email,
        mobile,
        alternateMobile,
        dob,
        gender,
        address,
        city,
        state,
        country,
        qualification,
        college,
        passingYear,
        company,
        designation,
        experience,
        currentCTC,
        expectedCTC,
        noticePeriod,
        preferredLocation,
        skills,
        certifications,
        languages,
        linkedin,
        github,
        portfolio,
        whyJoin,
        about,
        jobId,
        declaration
    } = data;

    // Validate required fields
    if (!applicantName || !email || !mobile || !qualification || !jobId) {
        throw new ValidationError('Missing required fields: applicantName, email, mobile, qualification, and jobId are required.');
    }

    if (declaration !== 'true' && declaration !== true) {
        throw new ValidationError('You must accept the declaration to submit the application.');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new ValidationError('Invalid email format.');
    }

    // Check if Job exists and is active
    const job = await Job.findById(jobId);
    if (!job || job.status !== 'Active') {
        throw new ValidationError('Job position is inactive or not found.');
    }

    // Check duplicate applications (5 minutes window)
    const duplicateWindow = new Date(Date.now() - 5 * 60 * 1000);
    const existingApplication = await JobApplication.findOne({
        jobId,
        email: email.trim().toLowerCase(),
        createdAt: { $gte: duplicateWindow }
    });

    if (existingApplication) {
        throw new ValidationError('You have already applied for this job recently. Please wait a few minutes before trying again.');
    }

    // Parse skills, certifications, and languages if sent as string/JSON
    let parsedSkills = [];
    let parsedCertifications = [];
    let parsedLanguages = [];

    try {
        parsedSkills = typeof skills === 'string' ? JSON.parse(skills) : (skills || []);
    } catch (e) {
        parsedSkills = typeof skills === 'string' ? skills.split(',').map(s => s.trim()).filter(Boolean) : [];
    }

    try {
        parsedCertifications = typeof certifications === 'string' ? JSON.parse(certifications) : (certifications || []);
    } catch (e) {
        parsedCertifications = typeof certifications === 'string' ? certifications.split(',').map(c => c.trim()).filter(Boolean) : [];
    }

    try {
        parsedLanguages = typeof languages === 'string' ? JSON.parse(languages) : (languages || []);
    } catch (e) {
        parsedLanguages = typeof languages === 'string' ? languages.split(',').map(l => l.trim()).filter(Boolean) : [];
    }

    // Handle files upload
    const resumeFile = files.resume ? files.resume[0] : null;
    const coverLetterFile = files.coverLetter ? files.coverLetter[0] : null;
    const additionalFilesList = files.additionalFiles || [];

    if (!resumeFile) {
        throw new ValidationError('Resume file is required.');
    }

    // Validate Resume file extension
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const fileExtension = resumeFile.originalname.substring(resumeFile.originalname.lastIndexOf('.')).toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
        throw new ValidationError('Invalid resume file type. Only PDF, DOC, and DOCX are allowed.');
    }

    // Validate file size (10 MB = 10 * 1024 * 1024 bytes)
    const maxSizeBytes = 10 * 1024 * 1024;
    if (resumeFile.size > maxSizeBytes) {
        throw new ValidationError('Resume file size must be 10 MB or less.');
    }

    // Upload files to Cloudinary
    const resumeUrl = await uploadToCloudinary(resumeFile, 'careers/resumes');
    
    let coverLetterUrl = '';
    if (coverLetterFile) {
        if (coverLetterFile.size > maxSizeBytes) {
            throw new ValidationError('Cover letter size must be 10 MB or less.');
        }
        coverLetterUrl = await uploadToCloudinary(coverLetterFile, 'careers/cover_letters') || '';
    }

    const additionalFiles = [];
    for (const file of additionalFilesList) {
        if (file.size > maxSizeBytes) {
            throw new ValidationError('Additional files size must be 10 MB or less.');
        }
        const fileUrl = await uploadToCloudinary(file, 'careers/additional_files');
        if (fileUrl) additionalFiles.push(fileUrl);
    }

    // Create Application
    const jobApplication = new JobApplication({
        applicantName: applicantName.trim(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim(),
        alternateMobile: alternateMobile ? alternateMobile.trim() : '',
        dob: dob ? new Date(dob) : null,
        gender: gender || '',
        address: address ? address.trim() : '',
        city: city.trim(),
        state: state.trim(),
        country: country || '',
        qualification: qualification.trim(),
        college: college ? college.trim() : '',
        passingYear: passingYear || '',
        company: company ? company.trim() : '',
        designation: designation ? designation.trim() : '',
        experience: experience || '',
        currentCTC: currentCTC || '',
        expectedCTC: expectedCTC || '',
        noticePeriod: noticePeriod || '',
        preferredLocation: preferredLocation || '',
        skills: parsedSkills,
        certifications: parsedCertifications,
        languages: parsedLanguages,
        linkedin: linkedin ? linkedin.trim() : '',
        github: github ? github.trim() : '',
        portfolio: portfolio ? portfolio.trim() : '',
        whyJoin: whyJoin ? whyJoin.trim() : '',
        about: about ? about.trim() : '',
        resumeUrl,
        coverLetterUrl,
        additionalFiles,
        jobId,
        jobTitle: job.title,
        department: job.department,
        status: 'Applied'
    });

    await jobApplication.save();

    // Send acknowledgement email in background
    sendJobApplicationAcknowledgementEmail(jobApplication.email, jobApplication.applicantName, job.title)
        .catch(err => console.error(`Error sending email to ${jobApplication.email}:`, err));

    return jobApplication;
};

export const getAllApplicationsService = async (query = {}) => {
    const {
        search,
        status,
        department,
        experience,
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
            { applicantName: searchRegex },
            { email: searchRegex },
            { mobile: searchRegex },
            { jobTitle: searchRegex },
            { department: searchRegex }
        ];
    }

    if (status) {
        filters.status = status;
    }

    if (department) {
        filters.department = department;
    }

    if (experience) {
        filters.experience = { $regex: experience, $options: 'i' };
    }

    if (startDate || endDate) {
        filters.appliedAt = {};
        if (startDate) filters.appliedAt.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filters.appliedAt.$lte = end;
        }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let sort = { appliedAt: -1 };
    if (sortBy === 'oldest') {
        sort = { appliedAt: 1 };
    } else if (sortBy === 'alphabetical') {
        sort = { applicantName: 1 };
    }

    const applications = await JobApplication.find(filters)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit));

    const total = await JobApplication.countDocuments(filters);
    const signedApplications = applications.map(app => signApplicationUrls(app));

    return {
        applications: signedApplications,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
    };
};

export const getApplicationByIdService = async (id) => {
    const application = await JobApplication.findById(id).populate('reviewedBy', 'name email');
    if (!application) {
        throw new NotFoundError('Job application not found.');
    }
    return signApplicationUrls(application);
};

export const updateApplicationStatusService = async (id, status, remarks, adminId) => {
    const application = await JobApplication.findById(id);
    if (!application) {
        throw new NotFoundError('Job application not found.');
    }

    const validStatuses = ['Applied', 'Shortlisted', 'Interview Scheduled', 'Rejected', 'Hired'];
    if (!validStatuses.includes(status)) {
        throw new ValidationError('Invalid application status.');
    }

    application.status = status;
    if (remarks !== undefined) {
        application.remarks = remarks;
    }
    application.reviewedAt = new Date();
    application.reviewedBy = adminId;

    await application.save();
    return signApplicationUrls(application);
};

export const deleteApplicationService = async (id) => {
    const result = await JobApplication.findByIdAndDelete(id);
    if (!result) {
        throw new NotFoundError('Job application not found.');
    }
    return true;
};

export const getApplicationStatsService = async () => {
    const total = await JobApplication.countDocuments();
    
    // Today's Applications
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = await JobApplication.countDocuments({
        appliedAt: { $gte: todayStart }
    });

    const pending = await JobApplication.countDocuments({ status: 'Applied' });
    const shortlisted = await JobApplication.countDocuments({ status: 'Shortlisted' });
    const rejected = await JobApplication.countDocuments({ status: 'Rejected' });
    const hired = await JobApplication.countDocuments({ status: 'Hired' });

    return {
        total,
        today: todayCount,
        pending,
        shortlisted,
        rejected,
        hired
    };
};
