import mongoose from 'mongoose';
import { FoodDeliveryPartner } from '../models/deliveryPartner.model.js';
import { FoodDeliveryCashDeposit } from '../models/foodDeliveryCashDeposit.model.js';
import { DeliverySupportTicket } from '../models/supportTicket.model.js';
import { DeliveryBonusTransaction } from '../../admin/models/deliveryBonusTransaction.model.js';
import { FoodEarningAddon } from '../../admin/models/earningAddon.model.js';
import { FoodEarningAddonHistory } from '../../admin/models/earningAddonHistory.model.js';
import { FoodOrder } from '../../orders/models/order.model.js';
import { Transaction } from '../../../../core/payments/models/transaction.model.js';
import { SellerReturn } from '../../../quick-commerce/seller/models/sellerReturn.model.js';
import { resolveReturnPickupCharge } from '../../../quick-commerce/utils/return.helpers.js';
import { calculateRiderEarningBreakdown, getActiveFeeSettings } from '../../../quick-commerce/admin/services/billing.service.js';
import { uploadImageBuffer } from '../../../../services/cloudinary.service.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { getDeliveryCashLimitSettings } from '../../admin/services/admin.service.js';
import { ensureDailyPassEligibility, activateDailyPass } from '../../subscriptions/services/wallet.service.js';
import { isSubscriptionEnforced } from '../../../common/services/subscriptionEnforcement.service.js';
import { verifyAndConsumeOnboardingPayment } from '../../../common/services/onboardingFee.service.js';
import { OnboardingPaymentLog } from '../../../common/models/onboardingPaymentLog.model.js';
import { notifyAdminsSafely, mergeDeviceToken } from '../../../../core/notifications/firebase.service.js';
import {
    parseSignupVehiclesPayload,
    uploadPartnerDocumentImages,
    uploadSignupVehicleDocuments,
    mergeVehicleDocumentUploads,
} from '../utils/deliveryPartnerUpload.helper.js';
import {
    createOnboardingSubmission,
    ensureLegacySubmission,
    getLatestSubmissionForPartner,
    getLastRejectedSubmission,
    syncLegacyVehicleFieldsFromDriverVehicles,
} from './deliveryPartnerSubmission.service.js';
import { FoodDeliveryPartnerSubmission } from '../models/deliveryPartnerSubmission.model.js';

export const validateUniqueDocuments = async (payload, excludeUserId = null) => {
    const { drivingLicenseNumber, panNumber, aadharNumber } = payload;
    
    const orConditions = [];
    const normalizedDL = drivingLicenseNumber ? String(drivingLicenseNumber).replace(/\s+/g, '').toUpperCase() : null;
    const normalizedPAN = panNumber ? String(panNumber).trim().toUpperCase() : null;
    const normalizedAadhar = aadharNumber ? String(aadharNumber).replace(/\D/g, '') : null;

    if (normalizedDL) orConditions.push({ drivingLicenseNumber: normalizedDL });
    if (normalizedPAN) orConditions.push({ panNumber: normalizedPAN });
    if (normalizedAadhar) orConditions.push({ aadharNumber: normalizedAadhar });

    if (orConditions.length === 0) return { isValid: true, errors: {} };

    const query = { $or: orConditions };
    if (excludeUserId && mongoose.Types.ObjectId.isValid(String(excludeUserId))) {
        query._id = { $ne: new mongoose.Types.ObjectId(String(excludeUserId)) };
    }

    const duplicates = await FoodDeliveryPartner.find(query).lean();
    
    if (duplicates.length === 0) return { isValid: true, errors: {} };

    const errors = {};
    for (const duplicate of duplicates) {
        if (normalizedDL && duplicate.drivingLicenseNumber === normalizedDL) {
            errors.drivingLicenseNumber = 'Driving License Number already registered.';
        }
        if (normalizedPAN && duplicate.panNumber === normalizedPAN) {
            errors.panNumber = 'PAN Number already registered.';
        }
        if (normalizedAadhar && duplicate.aadharNumber === normalizedAadhar) {
            errors.aadharNumber = 'Aadhaar Number already registered.';
        }
    }

    if (Object.keys(errors).length > 0) {
        const error = new Error(Object.values(errors).join('\n'));
        error.statusCode = 409;
        error.errors = errors;
        throw error;
    }

    return { isValid: true, errors: {} };
};

/**
 * For public document validation during rejected reapply (Edit Existing / Create New),
 *  partner so they can reuse their own PAN/Aadhaar/DL.
 * Never excludes approved partners via the public path (auth path uses req.user).
 */
export const resolveDocumentValidationExcludePartnerId = async (body = {}) => {
    const phoneDigits = String(body?.phone || '')
        .replace(/\D/g, '')
        .slice(-10);
    const rawPartnerId = body?.partnerId || body?.excludePartnerId || null;

    let partner = null;
    if (rawPartnerId && mongoose.Types.ObjectId.isValid(String(rawPartnerId))) {
        partner = await FoodDeliveryPartner.findById(rawPartnerId)
            .select('_id phone status')
            .lean();
        if (partner && phoneDigits) {
            const partnerPhone = String(partner.phone || '')
                .replace(/\D/g, '')
                .slice(-10);
            if (partnerPhone && partnerPhone !== phoneDigits) {
                // Prevent excluding an unrelated partner by forging partnerId.
                partner = null;
            }
        }
    }

    if (!partner && phoneDigits) {
        partner = await FoodDeliveryPartner.findOne({
            $or: [
                { phone: phoneDigits },
                { phone: { $regex: `${phoneDigits}$` } }
            ]
        })
            .select('_id phone status')
            .lean();
    }

    if (!partner) return null;

    const status = String(partner.status || '').toLowerCase();
    // Reapply / in-flight onboarding only — not approved accounts via public API.
    if (status === 'rejected' || status === 'pending') {
        return partner._id;
    }
    return null;
};

export const registerDeliveryPartner = async (payload, files, options = {}) => {
    const adminCreated = Boolean(options?.adminCreated);
    const {
        name, phone, email, countryCode, address, city, state,
        vehicleType, vehicleName, vehicleNumber, drivingLicenseNumber, panNumber, aadharNumber,
        fcmToken, platform, razorpayOrderId, razorpayPaymentId, razorpaySignature
    } = payload;
    const requestedType = String(payload?.submissionType || '').trim().toLowerCase();

    let partner;
    let claimedReapply = false;
    let claimSnapshot = null;
    let createdSubmissionId = null;
    const signupVehicles = parseSignupVehiclesPayload(payload);

    const existing = await FoodDeliveryPartner.findOne({ phone });
    if (existing) {
        if (existing.status === 'approved') {
            throw new ValidationError('Approved delivery partners cannot re-submit onboarding');
        }
        if (existing.status === 'pending') {
            throw new ValidationError('Delivery partner with this phone already exists and is pending approval');
        }
        if (existing.status !== 'rejected') {
            throw new ValidationError('Delivery partner with this phone already exists');
        }

        claimSnapshot = {
            rejectionReason: existing.rejectionReason,
            rejectedAt: existing.rejectedAt,
            rejectedBy: existing.rejectedBy
        };

        // Atomic claim: only one concurrent reapply may transition rejected → pending.
        const claimed = await FoodDeliveryPartner.findOneAndUpdate(
            { _id: existing._id, status: 'rejected' },
            {
                $set: {
                    status: 'pending',
                    isActive: false,
                    availabilityStatus: 'offline'
                }
            },
            { new: true }
        );
        if (!claimed) {
            throw new ValidationError(
                'This application is already being resubmitted or is no longer rejected. Please try again.'
            );
        }
        partner = claimed;
        claimedReapply = true;
        await ensureLegacySubmission(partner);
    }

    const releaseReapplyClaim = async () => {
        if (!claimedReapply || !partner?._id) return;
        await FoodDeliveryPartner.updateOne(
            { _id: partner._id, status: 'pending' },
            {
                $set: {
                    status: 'rejected',
                    isActive: false,
                    rejectionReason: claimSnapshot?.rejectionReason,
                    rejectedAt: claimSnapshot?.rejectedAt,
                    rejectedBy: claimSnapshot?.rejectedBy
                }
            }
        ).catch(() => {});
    };

    try {
    let submissionType = 'initial';
    if (partner) {
        if (requestedType === 'edit_existing' || requestedType === 'new_onboarding') {
            submissionType = requestedType;
        } else {
            submissionType = 'new_onboarding';
        }
    } else if (requestedType === 'edit_existing' || requestedType === 'new_onboarding') {
        throw new ValidationError('Cannot use edit/new onboarding without an existing rejected application');
    }

    const previousSubmission = partner
        ? await getLatestSubmissionForPartner(partner._id)
        : null;
    // Prefer last REJECTED submission snapshot for edit_existing (immutable history source).
    const rejectedSubmissionForEdit =
        partner && submissionType === 'edit_existing'
            ? (await getLastRejectedSubmission(partner._id)) || previousSubmission
            : null;

    const excludeUserId = partner?._id;
    const vNumbers = [
        vehicleNumber,
        ...signupVehicles.map((v) => v.registrationNumber || v.vehicleNumber),
    ]
        .filter(Boolean)
        .map((n) => String(n).trim().toUpperCase());

    const duplicateOrConditions = [];
    if (email && String(email).trim()) {
        duplicateOrConditions.push({ email: String(email).trim().toLowerCase() });
    }
    if (vNumbers.length > 0) {
        duplicateOrConditions.push({ vehicleNumber: { $in: vNumbers } });
        duplicateOrConditions.push({ 'driverVehicles.vehicleNumber': { $in: vNumbers } });
    }

    const duplicateCheckPromise = duplicateOrConditions.length > 0
        ? FoodDeliveryPartner.findOne({ $or: duplicateOrConditions }).select('_id email').lean()
        : Promise.resolve(null);

    // Skip paid onboarding fee for rejected reapply and admin-created partners.
    const skipFee = Boolean(partner) || adminCreated;
    const [, duplicate, images, vehicleUploadMap] = await Promise.all([
        validateUniqueDocuments({ drivingLicenseNumber, panNumber, aadharNumber }, excludeUserId),
        duplicateCheckPromise,
        uploadPartnerDocumentImages(files),
        uploadSignupVehicleDocuments(files, signupVehicles),
        skipFee
            ? Promise.resolve(null)
            : verifyAndConsumeOnboardingPayment({
                role: 'DELIVERY_PARTNER',
                paymentDetails: { razorpayOrderId, razorpayPaymentId, razorpaySignature },
                userDetails: { name, phone, email },
                entityId: partner?._id,
            }),
    ]);

    if (duplicate && String(duplicate._id) !== String(partner?._id)) {
        if (email && String(email).trim().toLowerCase() === duplicate.email) {
            throw new ValidationError('Delivery partner with this email already exists');
        }
        throw new ValidationError('Delivery partner with this Vehicle Number already exists');
    }

    // For edit_existing, reuse prior document URLs from the last rejected submission.
    const priorSnap =
        submissionType === 'edit_existing'
            ? rejectedSubmissionForEdit?.snapshot || previousSubmission?.snapshot || {}
            : {};
    const mergedImages = {
        profilePhoto: images.profilePhoto || priorSnap.profilePhoto || partner?.profilePhoto,
        aadharPhoto: images.aadharPhoto || priorSnap.aadharPhoto || partner?.aadharPhoto,
        panPhoto: images.panPhoto || priorSnap.panPhoto || partner?.panPhoto,
        drivingLicensePhoto:
            images.drivingLicensePhoto || priorSnap.drivingLicensePhoto || partner?.drivingLicensePhoto,
        vehicleImage: images.vehicleImage || priorSnap.vehicleImage || partner?.vehicleImage
    };

    if (
        !mergedImages.profilePhoto ||
        !mergedImages.aadharPhoto ||
        !mergedImages.panPhoto ||
        !mergedImages.drivingLicensePhoto
    ) {
        throw new ValidationError(
            'Missing required document photos: profilePhoto, aadharPhoto, panPhoto, drivingLicensePhoto'
        );
    }

    const partnerData = {
        name,
        phone,
        email: email && String(email).trim() ? String(email).trim() : undefined,
        countryCode,
        address,
        city,
        state,
        vehicleType,
        vehicleName,
        vehicleNumber,
        drivingLicenseNumber,
        panNumber,
        aadharNumber,
        status: 'pending',
        isActive: false,
        rejectionReason: undefined,
        rejectedAt: undefined,
        rejectedBy: undefined,
        approvedAt: undefined,
        approvedBy: undefined,
        ...mergedImages
    };

    if (partner) {
        Object.assign(partner, partnerData);
        partner.rejectionReason = undefined;
        partner.rejectedAt = undefined;
        partner.rejectedBy = undefined;
        partner.approvedAt = undefined;
        partner.approvedBy = undefined;
        partner.isActive = false;
    } else {
        partner = await FoodDeliveryPartner.create(partnerData);
    }

    // Update FCM token if provided (single-device seed on registration)
    if (fcmToken) {
        const field = platform === 'mobile' ? 'fcmTokenMobile' : 'fcmTokens';
        const { tokens } = mergeDeviceToken([], fcmToken);
        partner[field] = tokens;
    }

    // Ensure referralCode exists for sharing.
    if (!partner.referralCode) {
        partner.referralCode = String(partner._id);
    }

    if ((signupVehicles || []).length) {
        try {
            let vehicles = mergeVehicleDocumentUploads(signupVehicles, vehicleUploadMap).map((vehicle) => {
                const stableId = new mongoose.Types.ObjectId().toString();
                return {
                    ...vehicle,
                    _id: stableId,
                    id: stableId,
                };
            });

            // edit_existing: preserve prior vehicle document URLs when not re-uploaded.
            if (submissionType === 'edit_existing' && Array.isArray(priorSnap.driverVehicles)) {
                const priorByNumber = new Map(
                    priorSnap.driverVehicles
                        .map((v) => [String(v?.vehicleNumber || '').toUpperCase(), v])
                        .filter(([num]) => Boolean(num))
                );
                vehicles = vehicles.map((vehicle) => {
                    const prior = priorByNumber.get(String(vehicle.vehicleNumber || '').toUpperCase());
                    if (!prior) return vehicle;
                    return {
                        ...vehicle,
                        vehiclePhoto: vehicle.vehiclePhoto || prior.vehiclePhoto || '',
                        rcPhoto: vehicle.rcPhoto || prior.rcPhoto || '',
                        insurancePhoto: vehicle.insurancePhoto || prior.insurancePhoto || '',
                        fitnessPhoto: vehicle.fitnessPhoto || prior.fitnessPhoto || '',
                        pollutionPhoto: vehicle.pollutionPhoto || prior.pollutionPhoto || '',
                        permitPhoto: vehicle.permitPhoto || prior.permitPhoto || ''
                    };
                });
            }

            partner.driverVehicles = vehicles;
            const defaultVeh = vehicles.find((v) => v.isDefault) || vehicles[0];
            partner.activeVehicleId = defaultVeh?.id || null;
        } catch (vehErr) {
            // eslint-disable-next-line no-console
            console.warn('Failed to persist driver vehicles on signup:', vehErr.message);
        }
    } else if (submissionType === 'edit_existing' && Array.isArray(priorSnap.driverVehicles) && priorSnap.driverVehicles.length) {
        // Keep prior vehicles when edit did not send a new vehicle payload.
        partner.driverVehicles = priorSnap.driverVehicles;
        partner.activeVehicleId = priorSnap.activeVehicleId || partner.activeVehicleId;
    }

    // Keep legacy top-level vehicle fields aligned with driverVehicles (source of truth).
    syncLegacyVehicleFieldsFromDriverVehicles(partner);

    // Immutable history: always create a NEW submission document.
    const createdSubmission = await createOnboardingSubmission({
        partner,
        submissionType,
        previousSubmissionId: previousSubmission?._id || null
    });
    createdSubmissionId = createdSubmission?._id || null;
    await partner.save();

    if (razorpayOrderId) {
        void OnboardingPaymentLog.updateOne(
            { razorpayOrderId },
            { $set: { entityId: partner._id } },
        );
    }

    if (!adminCreated) {
        void notifyAdminsSafely({
            title: previousSubmission
                ? 'Delivery Partner Reapplied 🚲'
                : 'New Delivery Partner Registration 🚲',
            body: previousSubmission
                ? `"${partner.name}" resubmitted onboarding (${submissionType}) and is pending approval.`
                : `A new delivery partner "${partner.name}" has signed up and is pending approval.`,
            data: {
                type: 'new_registration',
                subType: 'delivery_partner',
                id: String(partner._id),
                submissionType,
            },
        });
    }

    return partner;
    } catch (err) {
        await releaseReapplyClaim();
        // If partner.save failed after insert, remove the orphan pending submission.
        if (createdSubmissionId) {
            await FoodDeliveryPartnerSubmission.deleteOne({
                _id: createdSubmissionId,
                status: 'pending'
            }).catch(() => {});
        }
        throw err;
    }
};

export const updateDeliveryPartnerProfile = async (userId, payload, files) => {
    const partner = await FoodDeliveryPartner.findById(userId);
    if (!partner) {
        throw new ValidationError('Delivery partner not found');
    }

    const {
        name, countryCode, address, city, state,
        vehicleType, vehicleName, vehicleNumber, drivingLicenseNumber, panNumber, aadharNumber,
        fcmToken, platform
    } = payload;

    // Run the new unique validation for documents
    await validateUniqueDocuments({ drivingLicenseNumber, panNumber, aadharNumber }, userId);

    if (name) partner.name = name;
    if (countryCode !== undefined) partner.countryCode = countryCode;
    if (address !== undefined) partner.address = address;
    if (city !== undefined) partner.city = city;
    if (state !== undefined) partner.state = state;
    if (vehicleType !== undefined) partner.vehicleType = vehicleType;
    if (vehicleName !== undefined) partner.vehicleName = vehicleName;
    if (vehicleNumber !== undefined) partner.vehicleNumber = vehicleNumber;
    if (drivingLicenseNumber !== undefined) partner.drivingLicenseNumber = drivingLicenseNumber;

    if (fcmToken) {
        const field = platform === 'mobile' ? 'fcmTokenMobile' : 'fcmTokens';
        const { tokens, changed } = mergeDeviceToken(partner[field], fcmToken);
        if (changed) {
            partner[field] = tokens;
        }
    }

    if (files?.profilePhoto?.[0]) {
        partner.profilePhoto = await uploadImageBuffer(files.profilePhoto[0].buffer, 'food/delivery/profile');
    }
    if (files?.aadharPhoto?.[0]) {
        partner.aadharPhoto = await uploadImageBuffer(files.aadharPhoto[0].buffer, 'food/delivery/aadhar');
    }
    if (files?.panPhoto?.[0]) {
        partner.panPhoto = await uploadImageBuffer(files.panPhoto[0].buffer, 'food/delivery/pan');
    }
    if (files?.drivingLicensePhoto?.[0]) {
        partner.drivingLicensePhoto = await uploadImageBuffer(
            files.drivingLicensePhoto[0].buffer,
            'food/delivery/license'
        );
    }
    if (files?.vehicleImage?.[0]) {
        partner.vehicleImage = await uploadImageBuffer(
            files.vehicleImage[0].buffer,
            'food/delivery/vehicle'
        );
    }

    if (aadharNumber !== undefined) partner.aadharNumber = aadharNumber;
    if (panNumber !== undefined) partner.panNumber = panNumber;

    await partner.save();
    const partnerObj = partner.toObject();

    try {
        if (partnerObj.driverVehicles && partnerObj.driverVehicles.length > 0) {
            const activeId = partnerObj.activeVehicleId ? String(partnerObj.activeVehicleId) : null;
            const activeVeh = activeId 
                ? partnerObj.driverVehicles.find(v => String(v._id) === activeId || String(v.id) === activeId) 
                : partnerObj.driverVehicles.find(v => v.isDefault) || partnerObj.driverVehicles[0];
            
            if (activeVeh) {
                partnerObj.vehicleNumber = activeVeh.vehicleNumber;
                partnerObj.vehicleType = activeVeh.vehicleCode;
                partnerObj.vehicleName = activeVeh.vehicleName;
                partnerObj.supportedServices = activeVeh.supportedServices;
            }
        }
    } catch(e) {}

    return {
        partner: partnerObj,
        requiresReapproval: false
    };
};

export const updateDeliveryPartnerDetails = async (userId, payload) => {
    const partner = await FoodDeliveryPartner.findById(userId);
    if (!partner) {
        throw new ValidationError('Delivery partner not found');
    }

    const vehicle = payload?.vehicle;
    if (vehicle && typeof vehicle === 'object') {
        if (vehicle.number !== undefined) partner.vehicleNumber = String(vehicle.number || '').trim();
        if (vehicle.type !== undefined) partner.vehicleType = String(vehicle.type || '').trim();
        if (vehicle.brand !== undefined) partner.vehicleName = String(vehicle.brand || '').trim();
        if (vehicle.model !== undefined) partner.vehicleName = String(vehicle.model || '').trim();
    }

    if (payload?.profilePhoto !== undefined) {
        partner.profilePhoto = payload.profilePhoto ? String(payload.profilePhoto).trim() : '';
    }

    await partner.save();
    return partner.toObject();
};

export const updateDeliveryPartnerProfilePhotoBase64 = async (userId, payload) => {
    const partner = await FoodDeliveryPartner.findById(userId);
    if (!partner) {
        throw new ValidationError('Delivery partner not found');
    }
    const base64 = payload?.base64;
    const mimeType = payload?.mimeType || 'image/jpeg';
    if (!base64 || typeof base64 !== 'string') {
        throw new ValidationError('base64 is required');
    }
    const buffer = Buffer.from(base64, 'base64');
    if (!buffer || !buffer.length) {
        throw new ValidationError('Invalid base64 image');
    }
    if (buffer.length > 8 * 1024 * 1024) {
        throw new ValidationError('Image too large (max 8MB)');
    }
    // uploadImageBuffer expects raw bytes; mimeType is ignored by current implementation, but buffer is valid.
    partner.profilePhoto = await uploadImageBuffer(buffer, 'food/delivery/profile');
    await partner.save();
    return partner.toObject();
};

export const updateDeliveryPartnerBankDetails = async (userId, payload, files) => {
    const partner = await FoodDeliveryPartner.findById(userId);
    if (!partner) {
        throw new ValidationError('Delivery partner not found');
    }

    // Handle both nested JSON and flat FormData from multer
    let bankDetails = payload?.documents?.bankDetails;
    let panDetails = payload?.documents?.pan;

    // Multer flattens FormData keys like 'documents[bankDetails][accountNumber]'
    if (!bankDetails && payload) {
        const b = {};
        if (payload['documents[bankDetails][accountHolderName]'] !== undefined) b.accountHolderName = payload['documents[bankDetails][accountHolderName]'];
        if (payload['documents[bankDetails][accountNumber]'] !== undefined) b.accountNumber = payload['documents[bankDetails][accountNumber]'];
        if (payload['documents[bankDetails][ifscCode]'] !== undefined) b.ifscCode = payload['documents[bankDetails][ifscCode]'];
        if (payload['documents[bankDetails][bankName]'] !== undefined) b.bankName = payload['documents[bankDetails][bankName]'];
        if (payload['documents[bankDetails][upiId]'] !== undefined) b.upiId = payload['documents[bankDetails][upiId]'];
        if (Object.keys(b).length > 0) bankDetails = b;
    }

    if (!panDetails && payload?.['documents[pan][number]'] !== undefined) {
        panDetails = { number: payload['documents[pan][number]'] };
    }

    if (bankDetails) {
        const b = bankDetails;
        if (b.accountHolderName !== undefined) partner.bankAccountHolderName = b.accountHolderName ? String(b.accountHolderName).trim() : '';
        if (b.accountNumber !== undefined) partner.bankAccountNumber = b.accountNumber ? String(b.accountNumber).trim() : '';
        if (b.ifscCode !== undefined) partner.bankIfscCode = b.ifscCode ? String(b.ifscCode).trim().toUpperCase() : '';
        if (b.bankName !== undefined) partner.bankName = b.bankName ? String(b.bankName).trim() : '';
        if (b.upiId !== undefined) partner.upiId = b.upiId ? String(b.upiId).trim() : '';
    }

    if (panDetails?.number !== undefined) {
        const panNumber = panDetails.number ? String(panDetails.number).trim().toUpperCase() : '';
        if (panNumber) {
            await validateUniqueDocuments({ panNumber }, userId);
        }
        partner.panNumber = panNumber;
    }

    if (files?.upiQrCode?.[0]) {
        partner.upiQrCode = await uploadImageBuffer(files.upiQrCode[0].buffer, 'food/delivery/upi');
    } else if (payload.removeUpiQrCode === 'true' || payload.removeUpiQrCode === true) {
        partner.upiQrCode = null;
    }

    await partner.save();
    return partner.toObject();
};

function generateTicketId() {
    const n = Date.now().toString(36).slice(-6).toUpperCase();
    const r = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `TKT-${n}${r}`;
}

export const listSupportTicketsByPartner = async (deliveryPartnerId) => {
    const list = await DeliverySupportTicket.find({ deliveryPartnerId })
        .sort({ createdAt: -1 })
        .lean();
    return list;
};

export const createSupportTicket = async (deliveryPartnerId, payload) => {
    const { subject, description, category = 'other', priority = 'medium' } = payload;
    if (!subject || !description || subject.trim().length < 3) {
        throw new ValidationError('Subject is required (min 3 characters)');
    }
    if (description.trim().length < 10) {
        throw new ValidationError('Description must be at least 10 characters');
    }
    let ticketId = generateTicketId();
    let exists = await DeliverySupportTicket.findOne({ ticketId }).lean();
    while (exists) {
        ticketId = generateTicketId();
        exists = await DeliverySupportTicket.findOne({ ticketId }).lean();
    }
    const ticket = await DeliverySupportTicket.create({
        deliveryPartnerId,
        ticketId,
        subject: subject.trim(),
        description: description.trim(),
        category: ['payment', 'account', 'technical', 'order', 'other'].includes(category) ? category : 'other',
        priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
        status: 'open'
    });
    try {
        void notifyAdminsSafely({
            title: 'Delivery support ticket',
            body: subject.trim(),
            data: {
                type: 'support_ticket',
                ticketId: String(ticket._id),
                link: '/food/admin/delivery/support-tickets',
            },
        });
    } catch (_) { /* non-blocking */ }
    return ticket.toObject();
};

export const getSupportTicketByIdAndPartner = async (ticketId, deliveryPartnerId) => {
    const ticket = await DeliverySupportTicket.findOne({
        _id: ticketId,
        deliveryPartnerId
    }).lean();
    return ticket;
};

export const updateDeliveryAvailability = async (userId, payload) => {
    const partner = await FoodDeliveryPartner.findById(userId);
    if (!partner) {
        throw new ValidationError('Delivery partner not found');
    }
    const { status, latitude, longitude } = payload || {};
    const hasLocation = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
    const hasExplicitStatus = Object.prototype.hasOwnProperty.call(payload || {}, 'status');
    let validStatus = partner.availabilityStatus === 'online' ? 'online' : 'offline';
    // Location heartbeats must never change online/offline — only explicit toggles without coords.
    if (hasExplicitStatus && !hasLocation) {
        if (status === 'online' || status === true) validStatus = 'online';
        else if (status === 'offline' || status === false) validStatus = 'offline';
        else validStatus = 'offline';
    }

    // PHASE 3C-1: SUBSCRIPTION TRIGGER (OFFLINE -> ONLINE ONLY)
    if (partner.availabilityStatus === 'offline' && validStatus === 'online' && await isSubscriptionEnforced('DELIVERY_PARTNER')) {
        const eligibility = await ensureDailyPassEligibility(userId, 'DELIVERY_PARTNER');

        if (!eligibility.eligible) {
            throw new ValidationError(eligibility.reason === 'LOW_BALANCE'
                ? 'Insufficient subscription balance. Minimum ₹1000 required to go online.'
                : 'Subscription access blocked.');
        }

        if (eligibility.shouldDeduct) {
            const result = await activateDailyPass(userId, 'DELIVERY_PARTNER');
            if (!result.success) {
                throw new ValidationError(result.reason === 'LOW_BALANCE'
                    ? 'Insufficient subscription balance for daily pass.'
                    : 'Failed to activate daily pass.');
            }
        }
    }
    // CASH LIMIT ENFORCEMENT — only when deliberately going online (not GPS pings)
    if (hasExplicitStatus && !hasLocation && partner.availabilityStatus === 'offline' && validStatus === 'online') {
        if (partner.status !== 'approved') {
            throw new ValidationError('Only approved delivery partners can go online');
        }

        const { getDeliveryPartnerWalletEnhanced } = await import('./deliveryFinance.service.js');
        const wallet = await getDeliveryPartnerWalletEnhanced(userId);
        const cashLimitHit = wallet.totalCashLimit === 0 || wallet.availableCashLimit <= 0;
        if (cashLimitHit) {
            throw new ValidationError('CASH_LIMIT_EXCEEDED');
        }

        const vehicles = partner.driverVehicles || [];
        if (!partner.activeVehicleId && vehicles.length) {
            partner.activeVehicleId = String(vehicles[0].id || vehicles[0]._id);
        }
    }

    if (hasExplicitStatus && !hasLocation) {
        partner.availabilityStatus = validStatus;
    }
    if (typeof latitude === 'number' && typeof longitude === 'number') {
        partner.lastLocation = {
            type: 'Point',
            coordinates: [longitude, latitude]
        };
        partner.lastLat = latitude;
        partner.lastLng = longitude;
        partner.lastLocationAt = new Date();
    }
    await partner.save();
    return {
        availabilityStatus: partner.availabilityStatus,
        activeVehicleId: partner.activeVehicleId || null,
    };
};

export const getDeliveryPartnerVehicles = async (userId) => {
    const partner = await FoodDeliveryPartner.findById(userId);
    if (!partner) throw new ValidationError('Delivery partner not found');

    return { vehicles: partner.driverVehicles || [], activeVehicleId: partner.activeVehicleId || null };
};

/** Public catalog for delivery signup. Vehicle is a plain field — no catalog dependency. */
export const getSignupVehicleCatalog = async () => {
    return [];
};

export const setDeliveryPartnerActiveVehicle = async (userId, vehicleId) => {
    let partner = await FoodDeliveryPartner.findById(userId);
    if (!partner) throw new ValidationError('Delivery partner not found');

    const requestedId = String(vehicleId || '').trim();
    const vehicles = partner.driverVehicles || [];
    const match = vehicles.find(
        (v) => String(v.id) === requestedId || String(v._id) === requestedId,
    );
    if (!match) throw new ValidationError('Vehicle not found on profile');
    if (String(match.status || '').toLowerCase() === 'rejected') {
        throw new ValidationError('Vehicle is not approved for dispatch');
    }

    const currentId = partner.activeVehicleId ? String(partner.activeVehicleId) : '';
    const nextId = String(match.id || match._id || requestedId);
    const alreadyActive = Boolean(currentId) && (currentId === nextId || currentId === requestedId);

    if (!alreadyActive) {
        await FoodDeliveryPartner.findByIdAndUpdate(userId, {
            $set: {
                activeVehicleId: nextId,
                availabilityStatus: 'offline',
            },
        });
    } else if (currentId !== nextId) {
        await FoodDeliveryPartner.findByIdAndUpdate(userId, {
            $set: { activeVehicleId: nextId },
        });
    }

    partner = await FoodDeliveryPartner.findById(userId);
    const mapContext = await getDriverMapContext(userId);

    return {
        activeVehicleId: partner.activeVehicleId,
        availabilityStatus: partner.availabilityStatus,
        vehicle: match,
        vehicles,
        driverVehicles: vehicles,
        ...mapContext,
    };
};

export const getDriverMapContext = async (userId) => {
    const partner = await FoodDeliveryPartner.findById(userId);
    if (!partner) throw new ValidationError('Delivery partner not found');

    const supportedServices = ['food', 'quick'];
    let activeVehicleId = partner.activeVehicleId ? String(partner.activeVehicleId) : null;
    let activeVehicle = null;

    if (partner.driverVehicles && partner.driverVehicles.length > 0) {
        activeVehicle = activeVehicleId
            ? partner.driverVehicles.find(v => String(v._id) === activeVehicleId || String(v.id) === activeVehicleId)
            : partner.driverVehicles.find(v => v.isDefault) || partner.driverVehicles[0];

        if (activeVehicle) {
            activeVehicleId = activeVehicle.id || String(activeVehicle._id);
            activeVehicle = {
                id: activeVehicleId,
                vehicleName: activeVehicle.vehicleName || activeVehicle.model || '',
                supportedServices
            };
        }
    }

    const { resolveActiveZones } = await import('../../../../core/zones/zone-resolution.service.js');
    const visibleZones = await resolveActiveZones(supportedServices);

    return {
        activeVehicleId,
        activeVehicle,
        supportedServices,
        visibleZones,
    };
};

// ----- Delivery partner wallet (Pocket / requests page) -----
const sumReturnPickupEarnings = async (partnerId, range = null) => {
    const match = {
        'dispatch.deliveryPartnerId': partnerId,
        'dispatch.status': 'completed',
    };
    if (range) {
        match['deliveryState.completedAt'] = { $gte: range.start, $lte: range.end };
    }

    const agg = await SellerReturn.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalEarnings: { $sum: { $ifNull: ['$riderEarning', 0] } },
                totalTrips: { $sum: 1 },
            },
        },
    ]);

    return {
        totalEarnings: Number(agg?.[0]?.totalEarnings) || 0,
        totalTrips: Number(agg?.[0]?.totalTrips) || 0,
    };
};

const listReturnPickupWalletTransactions = async (partnerId, limit = 2000) => {
    const returns = await SellerReturn.find({
        'dispatch.deliveryPartnerId': partnerId,
        'dispatch.status': 'completed',
    })
        .sort({ 'deliveryState.completedAt': -1, updatedAt: -1 })
        .select('orderId riderEarning deliveryState dispatch createdAt')
        .limit(limit)
        .lean();

    return (returns || []).map((row) => {
        const completedAt =
            row?.deliveryState?.completedAt || row?.dispatch?.completedAt || row?.updatedAt || row?.createdAt;
        const date = completedAt || new Date();
        return {
            _id: row._id,
            type: 'payment',
            amount: Number(row.riderEarning) || 0,
            status: 'Completed',
            date,
            createdAt: date,
            orderId: row.orderId || String(row._id),
            paymentMethod: 'prepaid',
            metadata: {
                orderId: row.orderId || String(row._id),
                returnId: String(row._id),
                tripType: 'return_pickup',
                documentType: 'seller_return',
            },
            description: `Return pickup earning - ${row.orderId || row._id}`,
        };
    });
};

export const getDeliveryPartnerWallet = async (deliveryPartnerId) => {
    if (!deliveryPartnerId || !mongoose.Types.ObjectId.isValid(deliveryPartnerId)) {
        throw new ValidationError('Delivery partner not found');
    }
    const partner = await FoodDeliveryPartner.findById(deliveryPartnerId).lean();
    if (!partner) {
        throw new ValidationError('Delivery partner not found');
    }

    const cashLimitSettings = await getDeliveryCashLimitSettings();
    const totalCashLimit = Number(cashLimitSettings.deliveryCashLimit) || 0;
    const deliveryWithdrawalLimit = Number(cashLimitSettings.deliveryWithdrawalLimit) || 100;
    const rawMax = cashLimitSettings.deliveryMaxWithdrawalLimit;
    const deliveryMaxWithdrawalLimit =
        rawMax != null && Number(rawMax) > 0 ? Number(rawMax) : null;

    const partnerId = new mongoose.Types.ObjectId(deliveryPartnerId);

    // Earnings paid to rider through completed deliveries
    const [earningsAgg, cashAgg, returnPickupEarnings] = await Promise.all([
        FoodOrder.aggregate([
            {
                $match: {
                    'dispatch.deliveryPartnerId': partnerId,
                    orderStatus: 'delivered',
                }
            },
            {
                $group: {
                    _id: null,
                    totalEarned: { $sum: { $ifNull: ['$riderEarning', 0] } }
                }
            }
        ]),
        FoodOrder.aggregate([
            {
                $match: {
                    'dispatch.deliveryPartnerId': partnerId,
                    orderStatus: 'delivered',
                    'payment.method': 'cash',
                    'payment.status': 'paid'
                }
            },
            {
                $group: {
                    _id: null,
                    cashInHand: { $sum: { $ifNull: ['$payment.amountDue', { $ifNull: ['$pricing.total', 0] }] } }
                }
            }
        ]),
        sumReturnPickupEarnings(partnerId),
    ]);

    const totalEarned =
        (Number(earningsAgg?.[0]?.totalEarned) || 0) +
        (Number(returnPickupEarnings?.totalEarnings) || 0);
    const rawCashInHand = Number(cashAgg?.[0]?.cashInHand) || 0;

    // Subtract deposits already made by this partner (admin records deposit → reduces cashInHand)
    const depositAgg = await FoodDeliveryCashDeposit.aggregate([
        {
            $match: {
                deliveryPartnerId: partnerId,
                status: 'Completed'
            }
        },
        {
            $group: {
                _id: null,
                totalDeposited: { $sum: { $ifNull: ['$amount', 0] } }
            }
        }
    ]);
    const totalDeposited = Number(depositAgg?.[0]?.totalDeposited) || 0;
    const cashInHand = Math.max(0, rawCashInHand - totalDeposited);

    // Admin-set delivery bonuses / earning addons
    const bonusAgg = await DeliveryBonusTransaction.aggregate([
        { $match: { deliveryPartnerId: partnerId } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalBonus = bonusAgg?.[0] ? Number(bonusAgg[0].total) : 0;

    // Keep transactions list reasonably small (UI only needs recent data for charts)
    const [paymentTxList, bonusTxList, returnPickupTxList] = await Promise.all([
        FoodOrder.find({
            'dispatch.deliveryPartnerId': partnerId,
            orderStatus: 'delivered',
        })
            .sort({ 'deliveryState.deliveredAt': -1, createdAt: -1 })
            .select('orderId riderEarning payment orderStatus deliveryState createdAt')
            .limit(2000)
            .lean(),
        DeliveryBonusTransaction.find({ deliveryPartnerId: partnerId })
            .sort({ createdAt: -1 })
            .limit(1000)
            .lean(),
        listReturnPickupWalletTransactions(partnerId, 2000),
    ]);

    const paymentTransactions = (paymentTxList || []).map((o) => {
        const deliveredAt = o?.deliveryState?.deliveredAt || o?.deliveredAt || null;
        const date = deliveredAt || o?.createdAt || new Date();
        return {
            _id: o._id,
            type: 'payment',
            amount: Number(o.riderEarning) || 0,
            status: 'Completed',
            date,
            createdAt: date,
            orderId: o.orderId || String(o._id),
            paymentMethod: o?.payment?.method || '',
            metadata: { orderId: o.orderId || String(o._id) },
            description: o?.payment?.method === 'cash' ? 'COD delivery earning' : 'Online delivery earning'
        };
    });

    // Frontend weekly earnings expects bonus transactions as `earning_addon`.
    const bonusTransactions = (bonusTxList || []).map((t) => ({
        _id: t._id,
        type: 'earning_addon',
        amount: Number(t.amount) || 0,
        status: 'Completed',
        date: t.createdAt,
        createdAt: t.createdAt,
        metadata: { reference: t.reference || '' },
        description: t.reference ? `Bonus - ${t.reference}` : 'Bonus'
    }));

    const totalWithdrawn = 0;
    const totalBalance = totalEarned + totalBonus;
    const availableCashLimit = Math.max(0, totalCashLimit - cashInHand);

    return {
        totalBalance,
        pocketBalance: totalBalance,
        cashInHand,
        totalWithdrawn,
        totalEarned,
        totalCashLimit,
        availableCashLimit,
        deliveryWithdrawalLimit,
        deliveryMaxWithdrawalLimit,
        transactions: [...paymentTransactions, ...returnPickupTxList, ...bonusTransactions].sort((a, b) => {
            const ad = a?.date ? new Date(a.date).getTime() : 0;
            const bd = b?.date ? new Date(b.date).getTime() : 0;
            return bd - ad;
        }),
        joiningBonusClaimed: false,
        joiningBonusAmount: 0
    };
};

// ----- Delivery partner earnings summary (Pocket / requests page) -----
export const getDeliveryPartnerEarnings = async (deliveryPartnerId, query = {}) => {
    if (!deliveryPartnerId || !mongoose.Types.ObjectId.isValid(deliveryPartnerId)) {
        throw new ValidationError('Delivery partner not found');
    }
    const period = String(query.period || 'week').toLowerCase();
    const date = query.date ? new Date(query.date) : new Date();
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 1000);

    const partnerId = new mongoose.Types.ObjectId(deliveryPartnerId);

    let range = null;
    if (period === 'today') {
        range = { start: toStartOfDay(date), end: toEndOfDay(date) };
    } else if (period === 'week') {
        range = getWeekRange(date);
    } else if (period === 'month') {
        range = getMonthRange(date);
    } else if (period === 'all') {
        range = null;
    } else {
        // fallback to week
        range = getWeekRange(date);
    }

    const match = {
        'dispatch.deliveryPartnerId': partnerId,
        orderStatus: 'delivered',
    };
    if (range) {
        match['deliveryState.deliveredAt'] = { $gte: range.start, $lte: range.end };
    }

    const requestedModule = normalizeDeliveryModuleFilter(query.module);
    if (requestedModule === 'food') {
        match.orderType = 'food';
    } else if (requestedModule === 'quick') {
        match.orderType = 'quick';
    }

    const includeFood = shouldIncludeFood(requestedModule);
    const includeSellerReturns =
        requestedModule === '' || requestedModule === 'quick';

    const [totalOrders, agg, returnPickupEarnings, adjustmentTransactions] = await Promise.all([
        includeFood ? FoodOrder.countDocuments(match) : Promise.resolve(0),
        includeFood ? FoodOrder.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    totalEarnings: { $sum: { $ifNull: ['$riderEarning', 0] } }
                }
            }
        ]) : Promise.resolve([]),
        includeSellerReturns ? sumReturnPickupEarnings(partnerId, range) : Promise.resolve({ totalEarnings: 0, totalTrips: 0 }),
        Transaction.aggregate([
            {
                $match: {
                    entityId: partnerId,
                    entityType: 'deliveryBoy',
                    type: 'credit',
                    category: 'adjustment',
                    ...(range ? { createdAt: { $gte: range.start, $lte: range.end } } : {})
                }
            },
            {
                $group: {
                    _id: null,
                    totalAdjustment: { $sum: { $ifNull: ['$amount', 0] } }
                }
            }
        ])
    ]);

    const adjustmentEarnings = Number(adjustmentTransactions?.[0]?.totalAdjustment || 0);

    const totalEarnings =
        (Number(agg?.[0]?.totalEarnings) || 0) +
        (Number(returnPickupEarnings?.totalEarnings) || 0) +
        adjustmentEarnings;
    const combinedOrders =
        totalOrders +
        (Number(returnPickupEarnings?.totalTrips) || 0);

    // Frontend only strongly relies on totalEarnings + totalOrders.
    const summary = {
        totalEarnings,
        totalOrders: combinedOrders,
        totalHours: 0,
        totalMinutes: 0,
        orderEarning: totalEarnings - adjustmentEarnings,
        incentive: adjustmentEarnings,
        otherEarnings: adjustmentEarnings
    };

    return {
        summary,
        period,
        date: date.toISOString(),
        pagination: { page, limit, total: combinedOrders }
    };
};

const normalizeStatusFilter = (status) => {
    if (!status) return null;
    const s = String(status || '').trim();
    if (!s || s.toUpperCase() === 'ALL TRIPS') return null;
    // UI uses Completed/Cancelled/Pending
    return s;
};

const toStartOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

const toEndOfDay = (d) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
};

const getWeekRange = (anchorDate) => {
    const d = new Date(anchorDate);
    const start = toStartOfDay(d);
    start.setDate(start.getDate() - start.getDay()); // Sunday
    const end = toEndOfDay(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
};

const getMonthRange = (anchorDate) => {
    const d = new Date(anchorDate);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
};

const computeRange = (period, date) => {
    const p = String(period || 'daily').toLowerCase();
    const anchor = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    if (p === 'weekly' || p === 'week') return getWeekRange(anchor);
    if (p === 'monthly' || p === 'month') return getMonthRange(anchor);
    // daily
    return { start: toStartOfDay(anchor), end: toEndOfDay(anchor) };
};

const normalizeDeliveryModuleFilter = (moduleValue) => {
    const raw = String(moduleValue || '').trim().toLowerCase();
    if (!raw || raw === 'all') return '';
    if (raw === 'quick_commerce' || raw === 'quick-commerce' || raw === 'qc') return 'quick';
    return raw;
};

const shouldIncludeFood = (requestedModule) => requestedModule === '' || requestedModule === 'food';

const toTripDto = (order) => {
    const createdAt = order?.createdAt || null;
    const deliveredAt = order?.deliveryState?.deliveredAt || order?.deliveredAt || order?.completedAt || null;
    const dateForUi = deliveredAt || createdAt || order?.updatedAt || null;

    const time = dateForUi
        ? new Date(dateForUi).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : '';

    const orderStatus = String(order?.orderStatus || order?.status || '').toLowerCase();
    const isDelivered = orderStatus === 'delivered' || String(order?.deliveryState?.currentPhase || '').toLowerCase() === 'delivered';
    const isCancelled = orderStatus.startsWith('cancelled') || String(order?.deliveryState?.status || '').toLowerCase().includes('cancel');

    const status = isDelivered ? 'Completed' : isCancelled ? 'Cancelled' : 'Pending';

    const restaurantName =
        order?.restaurantId?.restaurantName ||
        order?.restaurantName ||
        order?.restaurant?.restaurantName ||
        order?.storeName ||
        order?.seller?.shopName ||
        '';

    const paymentMethod = order?.payment?.method || order?.paymentMethod || '';
    const pricingTotal = Number(order?.pricing?.total) || Number(order?.totalAmount) || 0;

    const earningAmount = Number(order?.riderEarning ?? order?.deliveryEarning ?? 0) || 0;
    const codAmount = paymentMethod === 'cash' ? Number(order?.payment?.amountDue) || 0 : 0;
    const codCollectedAmount = paymentMethod === 'cash' && order?.payment?.status === 'paid' ? codAmount : 0;
    const rawOrderType = String(order?.orderType || 'food').toLowerCase();
    const moduleType = rawOrderType === 'quick' || rawOrderType === 'mixed' ? 'quick' : 'food';
    return {
        id: order?._id,
        _id: order?._id,
        orderId: order?.orderId || order?._id,
        tripKey: `delivery:${String(order?._id || order?.orderId || '')}`,
        documentType: 'order',
        tripType: 'delivery',
        isReturnPickup: false,
        module: moduleType,
        orderType: rawOrderType || moduleType,
        serviceType: moduleType,
        status,
        restaurantName,
        restaurant: restaurantName,
        items: order?.items || order?.orderItems || [],
        orderItems: order?.orderItems || order?.items || [],
        paymentMethod,
        totalAmount: pricingTotal,
        orderTotal: pricingTotal,
        codAmount: codAmount,
        codCollectedAmount,
        deliveryEarning: earningAmount,
        earningAmount: earningAmount,
        amount: earningAmount, // legacy fallback
        createdAt: order?.createdAt,
        deliveredAt: deliveredAt,
        completedAt: deliveredAt,
        date: dateForUi,
        time
    };
};

const toReturnPickupTripDto = (returnDoc, feeSettings = null) => {
    const completedAt =
        returnDoc?.deliveryState?.completedAt ||
        returnDoc?.dispatch?.completedAt ||
        returnDoc?.updatedAt ||
        null;
    const dateForUi = completedAt || returnDoc?.createdAt || null;
    const time = dateForUi
        ? new Date(dateForUi).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : '';
    const storedBreakdown = returnDoc?.pickupPricingBreakdown || null;
    const earningAmount = resolveReturnPickupCharge(returnDoc);
    const distanceKm = Number(returnDoc?.pickupDistanceKm ?? storedBreakdown?.distanceKm ?? 0);

    let liveBreakdown = null;
    const needsLiveBreakdown =
        distanceKm > 0 &&
        (!storedBreakdown ||
            (!Number(storedBreakdown.basePayout || storedBreakdown.baseFee || 0) &&
                !Number(storedBreakdown.perKmRate || 0)));
    if (needsLiveBreakdown && feeSettings) {
        liveBreakdown = calculateRiderEarningBreakdown(feeSettings, distanceKm);
    }

    const baseFee = Number(
        storedBreakdown?.basePayout ??
        storedBreakdown?.baseFee ??
        liveBreakdown?.basePayout ??
        (Number(storedBreakdown?.perKmRate || liveBreakdown?.perKmRate || 0) <= 0
            ? (storedBreakdown?.earning ?? liveBreakdown?.earning ?? earningAmount)
            : 0) ??
        0,
    );
    const perKmRate = Number(
        storedBreakdown?.perKmRate ??
        storedBreakdown?.deliveryBoyPerKm ??
        liveBreakdown?.perKmRate ??
        0,
    );
    const extraKm = Number(storedBreakdown?.extraKm ?? liveBreakdown?.extraKm ?? 0);
    const baseKm = Number(storedBreakdown?.baseKm ?? liveBreakdown?.baseKm ?? 0);
    const breakdown = {
        ...(storedBreakdown || {}),
        ...(liveBreakdown
            ? {
                basePayout: liveBreakdown.basePayout,
                perKmRate: liveBreakdown.perKmRate,
                baseKm: liveBreakdown.baseKm,
                extraKm: liveBreakdown.extraKm,
                earning: liveBreakdown.earning || earningAmount,
            }
            : {}),
        earning: Number(storedBreakdown?.earning ?? liveBreakdown?.earning ?? earningAmount),
        distanceKm,
        basePayout: baseFee,
        baseFee,
        perKmRate,
        extraKm,
        baseKm,
    };

    return {
        id: returnDoc?._id,
        _id: returnDoc?._id,
        orderId: returnDoc?.orderId,
        returnId: String(returnDoc?._id || ''),
        tripKey: `return:${String(returnDoc?._id || returnDoc?.orderId || '')}`,
        documentType: 'seller_return',
        tripType: 'return_pickup',
        isReturnPickup: true,
        module: 'quick',
        orderType: 'quick',
        serviceType: 'quick',
        countsAsOrder: false,
        status: returnDoc?.dispatch?.status === 'completed' ? 'Completed' : 'Pending',
        restaurantName: 'Return Pickup',
        restaurant: 'Return Pickup',
        items: returnDoc?.returnItems || [],
        paymentMethod: 'prepaid',
        totalAmount: Number(returnDoc?.returnRefundAmount || 0),
        orderTotal: Number(returnDoc?.returnRefundAmount || 0),
        codAmount: 0,
        codCollectedAmount: 0,
        deliveryEarning: earningAmount,
        earningAmount,
        amount: earningAmount,
        distanceKm,
        pickupDistanceKm: distanceKm,
        pickupPricingBreakdown: breakdown,
        baseFee,
        baseKm,
        extraKm,
        perKmRate,
        createdAt: returnDoc?.createdAt,
        deliveredAt: completedAt,
        completedAt,
        date: dateForUi,
        time,
    };
};

export const getDeliveryPartnerTripHistory = async (deliveryPartnerId, query = {}) => {
    if (!deliveryPartnerId || !mongoose.Types.ObjectId.isValid(deliveryPartnerId)) {
        throw new ValidationError('Delivery partner not found');
    }
    const period = query.period || 'daily';
    const date = query.date ? new Date(query.date) : new Date();
    const statusFilter = normalizeStatusFilter(query.status);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 1000);

    const { start, end } = computeRange(period, date);

    const partnerId = new mongoose.Types.ObjectId(deliveryPartnerId);
    const match = { 'dispatch.deliveryPartnerId': partnerId };

    const sf = String(statusFilter || '').toLowerCase();
    if (sf === 'completed') {
        match.orderStatus = 'delivered';
        match.$or = [
            { 'deliveryState.deliveredAt': { $gte: start, $lte: end } },
            { deliveredAt: { $gte: start, $lte: end } },
        ];
    } else if (sf === 'cancelled') {
        match.orderStatus = { $regex: '^cancelled', $options: 'i' };
        match.createdAt = { $gte: start, $lte: end };
    } else if (sf === 'pending') {
        match.createdAt = { $gte: start, $lte: end };
        // Pending = not delivered and not cancelled
        match.$and = [
            { orderStatus: { $ne: 'delivered' } },
            { orderStatus: { $not: { $regex: '^cancelled', $options: 'i' } } },
        ];
    } else {
        // ALL TRIPS: show by delivery day when available, else created day.
        match.$or = [
            { 'deliveryState.deliveredAt': { $gte: start, $lte: end } },
            { deliveredAt: { $gte: start, $lte: end } },
            { createdAt: { $gte: start, $lte: end } },
        ];
    }

    const requestedModule = normalizeDeliveryModuleFilter(query.module);
    const includeFood = shouldIncludeFood(requestedModule);
    // QC return pickups belong under Quick (and All) — never Food or Parcel.
    const includeSellerReturns =
        requestedModule === '' || requestedModule === 'quick';
    if (requestedModule === 'food') {
        match.orderType = 'food';
    } else if (requestedModule === 'quick') {
        match.orderType = 'quick';
    }

    const orders = includeFood
        ? await FoodOrder.find(match)
            .populate({ path: 'restaurantId', select: 'restaurantName' })
            .sort({ 'deliveryState.deliveredAt': -1, createdAt: -1 })
            .limit(limit)
            .lean()
        : [];

    const returnMatch = { 'dispatch.deliveryPartnerId': partnerId };
    if (sf === 'completed') {
        returnMatch['dispatch.status'] = 'completed';
        returnMatch.$or = [
            { 'deliveryState.completedAt': { $gte: start, $lte: end } },
            { 'dispatch.completedAt': { $gte: start, $lte: end } },
        ];
    } else if (sf === 'cancelled') {
        returnMatch.returnStatus = 'return_cancelled';
        returnMatch.createdAt = { $gte: start, $lte: end };
    } else if (sf === 'pending') {
        returnMatch.createdAt = { $gte: start, $lte: end };
        returnMatch['dispatch.status'] = { $ne: 'completed' };
        returnMatch.returnStatus = { $ne: 'return_cancelled' };
    } else {
        // ALL: prefer completion day, fall back to created day.
        returnMatch.$or = [
            { 'deliveryState.completedAt': { $gte: start, $lte: end } },
            { 'dispatch.completedAt': { $gte: start, $lte: end } },
            { createdAt: { $gte: start, $lte: end } },
        ];
    }

    const returnPickups = includeSellerReturns
        ? await SellerReturn.find(returnMatch)
            .sort({ 'deliveryState.completedAt': -1, createdAt: -1 })
            .limit(limit)
            .lean()
        : [];

    const quickFeeSettings = includeSellerReturns && returnPickups.length
        ? await getActiveFeeSettings()
        : null;

    const dedupeByTripKey = (rows = []) => {
        const seen = new Set();
        const out = [];
        for (const row of rows) {
            const key = String(row?.tripKey || row?.returnId || row?._id || row?.id || '');
            if (!key || seen.has(key)) continue;
            seen.add(key);
            out.push(row);
        }
        return out;
    };

    const forwardTrips = (orders || []).map(toTripDto);
    const returnTrips = dedupeByTripKey(
        (returnPickups || []).map((doc) => toReturnPickupTripDto(doc, quickFeeSettings)),
    );
    const mergedTrips = dedupeByTripKey([...forwardTrips, ...returnTrips])
        .sort((a, b) => new Date(b.completedAt || b.deliveredAt || b.createdAt) - new Date(a.completedAt || a.deliveredAt || a.createdAt))
        .slice(0, limit);

    return {
        period,
        date: (date || new Date()).toISOString(),
        range: { start: start.toISOString(), end: end.toISOString() },
        trips: mergedTrips,
    };
};

export const getDeliveryPocketDetails = async (deliveryPartnerId, query = {}) => {
    if (!deliveryPartnerId || !mongoose.Types.ObjectId.isValid(deliveryPartnerId)) {
        throw new ValidationError('Delivery partner not found');
    }
    const date = query.date ? new Date(query.date) : new Date();
    const { start, end } = getWeekRange(date);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 1000, 1), 2000);

    const partnerId = new mongoose.Types.ObjectId(deliveryPartnerId);

    const requestedModule = normalizeDeliveryModuleFilter(query.module);
    const includeFood = shouldIncludeFood(requestedModule);
    const includeSellerReturns =
        requestedModule === '' || requestedModule === 'quick';

    const orderMatch = {
        'dispatch.deliveryPartnerId': partnerId,
        orderStatus: 'delivered',
        $or: [
            { 'deliveryState.deliveredAt': { $gte: start, $lte: end } },
            { deliveredAt: { $gte: start, $lte: end } },
            { completedAt: { $gte: start, $lte: end } },
            { updatedAt: { $gte: start, $lte: end } },
            { createdAt: { $gte: start, $lte: end } }
        ]
    };
    if (requestedModule === 'food') {
        orderMatch.orderType = 'food';
    } else if (requestedModule === 'quick') {
        orderMatch.orderType = 'quick';
    }

    const [orders, returnPickups, bonusTxList, addonTxList, addonHistoryList] = await Promise.all([
        includeFood ? FoodOrder.find(orderMatch)
        .populate({ path: 'restaurantId', select: 'restaurantName' })
        .sort({ 'deliveryState.deliveredAt': -1, deliveredAt: -1, completedAt: -1, updatedAt: -1, createdAt: -1 })
        .limit(limit)
        .lean() : Promise.resolve([]),
        includeSellerReturns ? SellerReturn.find({
            'dispatch.deliveryPartnerId': partnerId,
            'dispatch.status': 'completed',
            'deliveryState.completedAt': { $gte: start, $lte: end },
        })
            .sort({ 'deliveryState.completedAt': -1, updatedAt: -1 })
            .limit(limit)
            .lean() : Promise.resolve([]),
        DeliveryBonusTransaction.find({
        deliveryPartnerId: partnerId,
        createdAt: { $gte: start, $lte: end }
    })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
        // Addon / incentive wallet credits — never mix into order earning
        Transaction.find({
            entityId: partnerId,
            entityType: 'deliveryBoy',
            category: 'adjustment',
            type: 'credit',
            createdAt: { $gte: start, $lte: end },
        }).sort({ createdAt: -1 }).limit(limit).lean(),
        FoodEarningAddonHistory.find({
            deliveryPartnerId: partnerId,
            status: 'credited',
            $or: [
                { creditedAt: { $gte: start, $lte: end } },
                { completedAt: { $gte: start, $lte: end } },
                { updatedAt: { $gte: start, $lte: end } },
            ],
        })
            .populate({ path: 'offerId', select: 'title' })
            .sort({ creditedAt: -1, completedAt: -1, createdAt: -1 })
            .limit(limit)
            .lean(),
    ]);

    const quickFeeSettings = includeSellerReturns && (returnPickups || []).length
        ? await getActiveFeeSettings()
        : null;

    const trips = [
        ...(orders || []).map(toTripDto),
        ...(returnPickups || []).map((doc) => toReturnPickupTripDto(doc, quickFeeSettings)),
    ]
        .sort((a, b) => new Date(b.completedAt || b.deliveredAt || b.createdAt) - new Date(a.completedAt || a.deliveredAt || a.createdAt))
        .slice(0, limit);

    // Pure trip earnings only (orders + returns). Addon/adjustment credits stay out.
    const paymentTransactions = [
        ...(orders || []).map((o) => ({
        _id: o._id,
        type: 'payment',
        amount: Number(o.riderEarning) || 0,
        status: 'Completed',
        date: o?.deliveryState?.deliveredAt || o?.deliveredAt || o?.createdAt,
        createdAt: o?.deliveryState?.deliveredAt || o?.deliveredAt || o?.createdAt,
        orderId: o.orderId || String(o._id),
        metadata: { orderId: o.orderId || String(o._id) },
        description: o?.restaurantId?.restaurantName ? `Order earning - ${o.restaurantId.restaurantName}` : 'Order earning'
    })),
        ...(returnPickups || []).map((row) => ({
            _id: row._id,
            type: 'payment',
            amount: Number(row.riderEarning) || 0,
            status: 'Completed',
            date: row?.deliveryState?.completedAt || row?.dispatch?.completedAt || row?.updatedAt || row?.createdAt,
            createdAt: row?.deliveryState?.completedAt || row?.dispatch?.completedAt || row?.updatedAt || row?.createdAt,
            orderId: row.orderId || String(row._id),
            metadata: {
                orderId: row.orderId || String(row._id),
                returnId: String(row._id),
                tripType: 'return_pickup',
            },
            description: `Return pickup earning - ${row.orderId || row._id}`,
        })),
    ];

    const bonusTransactions = (bonusTxList || []).map((t) => ({
        _id: t._id,
        type: 'bonus',
        amount: Number(t.amount) || 0,
        status: 'Completed',
        date: t.createdAt,
        createdAt: t.createdAt,
        metadata: { reference: t.reference || '' },
        description: t.reference ? `Bonus - ${t.reference}` : 'Bonus'
    }));

    const historyById = new Map(
        (addonHistoryList || []).map((h) => [String(h._id), h]),
    );

    const addonFromTransactions = (addonTxList || []).map((t) => {
        const historyId = t?.metadata?.historyId ? String(t.metadata.historyId) : '';
        const history = historyId ? historyById.get(historyId) : null;
        const title = history?.offerId?.title || t.description || 'Earning Addon';
        return {
            _id: t._id,
            type: 'addon',
            amount: Number(t.amount) || 0,
            status: 'Completed',
            date: t.createdAt,
            createdAt: t.createdAt,
            metadata: {
                ...(t.metadata || {}),
                source: t?.metadata?.source || 'adjustment',
            },
            description: title,
        };
    });

    const coveredHistoryIds = new Set(
        addonFromTransactions
            .map((t) => (t.metadata?.historyId ? String(t.metadata.historyId) : ''))
            .filter(Boolean),
    );
    const addonFromHistoryOnly = (addonHistoryList || [])
        .filter((h) => !coveredHistoryIds.has(String(h._id)))
        .map((h) => ({
            _id: h._id,
            type: 'addon',
            amount: Number(h.earningAmount || h.totalEarning || 0) || 0,
            status: 'Completed',
            date: h.creditedAt || h.completedAt || h.updatedAt || h.createdAt,
            createdAt: h.creditedAt || h.completedAt || h.updatedAt || h.createdAt,
            metadata: {
                source: 'earning_addon_history',
                historyId: String(h._id),
                offerId: h.offerId?._id ? String(h.offerId._id) : undefined,
            },
            description: h.offerId?.title || 'Earning Addon',
        }));

    const addonTransactions = [...addonFromTransactions, ...addonFromHistoryOnly]
        .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

    const totalEarning = paymentTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalBonus = bonusTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalAddon = addonTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    return {
        week: { start: start.toISOString(), end: end.toISOString() },
        summary: { totalEarning, totalBonus, totalAddon, grandTotal: totalEarning + totalBonus + totalAddon },
        trips,
        transactions: {
            payment: paymentTransactions,
            bonus: bonusTransactions,
            addon: addonTransactions
        }
    };
};

export const getActiveEarningAddonsForPartner = async (deliveryPartnerId) => {
    if (!deliveryPartnerId || !mongoose.Types.ObjectId.isValid(deliveryPartnerId)) {
        throw new ValidationError('Delivery partner not found');
    }

    const partnerId = new mongoose.Types.ObjectId(deliveryPartnerId);
    const now = new Date();

    const addons = await FoodEarningAddon.find({
        status: 'active',
        startDate: { $lte: now },
        endDate: { $gte: now }
    })
        .sort({ endDate: 1, createdAt: 1 })
        .lean();

    const liveAddons = (addons || []).filter((addon) => {
        if (!addon) return false;
        const maxRedemptions = Number(addon.maxRedemptions);
        if (!Number.isFinite(maxRedemptions) || maxRedemptions <= 0) return true;
        return Number(addon.currentRedemptions || 0) < maxRedemptions;
    });

    const offers = await Promise.all(
        liveAddons.map(async (addon) => {
            const startDate = addon.startDate ? new Date(addon.startDate) : null;
            const endDate = addon.endDate ? new Date(addon.endDate) : null;

            const baseMatch = {
                'dispatch.deliveryPartnerId': partnerId,
                orderStatus: 'delivered'
            };

            if (startDate && endDate) {
                baseMatch['deliveryState.deliveredAt'] = { $gte: startDate, $lte: endDate };
            }

            const [currentOrders, earningsAgg] = await Promise.all([
                FoodOrder.countDocuments(baseMatch),
                FoodOrder.aggregate([
                    { $match: baseMatch },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: { $ifNull: ['$riderEarning', 0] } }
                        }
                    }
                ])
            ]);

            const currentEarnings = Number(earningsAgg?.[0]?.total) || 0;

            return {
                id: addon._id,
                title: addon.title || 'Earnings Guarantee',
                description: addon.description || '',
                targetAmount: Number(addon.earningAmount) || 0,
                targetOrders: Number(addon.requiredOrders) || 0,
                currentOrders: Number(currentOrders) || 0,
                currentEarnings,
                startDate,
                endDate,
                validTill: endDate ? endDate.toISOString() : null,
                isLive: true
            };
        })
    );

    return {
        activeOffer: offers[0] || null,
        offers
    };
};

export const deleteDeliveryPartnerAccount = async (userId) => {
    const partner = await FoodDeliveryPartner.findById(userId);
    if (!partner) {
        throw new ValidationError('Delivery partner not found');
    }

    // Soft delete
    partner.isDeleted = true;
    partner.accountStatus = 'deleted';
    partner.isActive = false;
    partner.availabilityStatus = 'offline';
    await partner.save();

    // Invalidate refresh tokens
    const { FoodRefreshToken } = await import('../../../../core/refreshTokens/refreshToken.model.js');
    await FoodRefreshToken.deleteMany({ userId });

    return { success: true, message: 'Delivery account soft deleted successfully' };
};

