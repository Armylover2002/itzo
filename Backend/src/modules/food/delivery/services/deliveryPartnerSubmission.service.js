import mongoose from 'mongoose';
import { FoodDeliveryPartnerSubmission } from '../models/deliveryPartnerSubmission.model.js';

export const syncLegacyVehicleFieldsFromDriverVehicles = (partner = {}) => {
    const vehicles = Array.isArray(partner.driverVehicles) ? partner.driverVehicles : [];
    if (!vehicles.length) return partner;

    const activeId = partner.activeVehicleId ? String(partner.activeVehicleId) : null;
    const active =
        (activeId &&
            vehicles.find((v) => String(v?.id || v?._id || '') === activeId)) ||
        vehicles.find((v) => v?.isDefault) ||
        vehicles[0];

    if (!active) return partner;

    partner.vehicleType = String(active.vehicleCode || active.vehicleType || '').trim();
    partner.vehicleName = String(active.vehicleName || '').trim();
    partner.vehicleNumber = String(active.vehicleNumber || '').trim().toUpperCase();
    if (!partner.vehicleImage && (active.vehiclePhoto || active.vehicleImage)) {
        partner.vehicleImage = active.vehiclePhoto || active.vehicleImage;
    }
    return partner;
};

export const buildPartnerOnboardingSnapshot = (partner = {}) => {
    // Ensure snapshot legacy vehicle fields match driverVehicles before freeze.
    syncLegacyVehicleFieldsFromDriverVehicles(partner);

    const snapshot = {
        name: partner.name || '',
        phone: partner.phone || '',
        email: partner.email || '',
        countryCode: partner.countryCode || '+91',
        address: partner.address || '',
        city: partner.city || '',
        state: partner.state || '',
        vehicleType: partner.vehicleType || '',
        vehicleName: partner.vehicleName || '',
        vehicleNumber: partner.vehicleNumber || '',
        panNumber: partner.panNumber || '',
        aadharNumber: partner.aadharNumber || '',
        drivingLicenseNumber: partner.drivingLicenseNumber || '',
        profilePhoto: partner.profilePhoto || '',
        aadharPhoto: partner.aadharPhoto || '',
        panPhoto: partner.panPhoto || '',
        drivingLicensePhoto: partner.drivingLicensePhoto || '',
        vehicleImage: partner.vehicleImage || '',
        driverVehicles: Array.isArray(partner.driverVehicles)
            ? partner.driverVehicles.map((v) => (v?.toObject ? v.toObject() : { ...v }))
            : [],
        activeVehicleId: partner.activeVehicleId || null
    };

    // Bank/UPI are post-approval profile fields — include only when actually present.
    // Avoid persisting empty bank noise in every onboarding snapshot.
    const bankFields = {
        bankAccountHolderName: partner.bankAccountHolderName || '',
        bankAccountNumber: partner.bankAccountNumber || '',
        bankIfscCode: partner.bankIfscCode || '',
        bankName: partner.bankName || '',
        upiId: partner.upiId || '',
        upiQrCode: partner.upiQrCode || ''
    };
    const hasBankData = Object.values(bankFields).some((v) => String(v || '').trim());
    if (hasBankData) {
        Object.assign(snapshot, bankFields);
    }

    return snapshot;
};

export const getNextSubmissionNumber = async (partnerId) => {
    const latest = await FoodDeliveryPartnerSubmission.findOne({ partnerId })
        .sort({ submissionNumber: -1 })
        .select('submissionNumber')
        .lean();
    return Number(latest?.submissionNumber || 0) + 1;
};

/**
 * Create an immutable onboarding submission and point the partner at it.
 * Retries on duplicate submissionNumber (concurrent creates).
 * Never updates prior submission documents.
 */
export const createOnboardingSubmission = async ({
    partner,
    submissionType = 'initial',
    previousSubmissionId = null
} = {}) => {
    if (!partner?._id) {
        throw new Error('partner is required to create onboarding submission');
    }

    const partnerId = partner._id;
    const snapshot = buildPartnerOnboardingSnapshot(partner);
    const prevId = previousSubmissionId || partner.latestSubmissionId || null;

    let lastError = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const submissionNumber = await getNextSubmissionNumber(partnerId);
        try {
            const submission = await FoodDeliveryPartnerSubmission.create({
                partnerId,
                submissionNumber,
                status: 'pending',
                submissionType,
                previousSubmissionId: prevId,
                submittedAt: new Date(),
                snapshot
            });

            partner.latestSubmissionId = submission._id;
            partner.currentSubmissionNumber = submissionNumber;
            if (typeof partner.markModified === 'function') {
                partner.markModified('latestSubmissionId');
            }

            return submission;
        } catch (err) {
            lastError = err;
            // Duplicate key on unique (partnerId, submissionNumber) — retry with next number.
            if (err?.code === 11000) {
                continue;
            }
            throw err;
        }
    }

    throw lastError || new Error('Failed to create onboarding submission after retries');
};

export const getLastRejectedSubmission = async (partnerId) => {
    if (!partnerId || !mongoose.Types.ObjectId.isValid(String(partnerId))) {
        return null;
    }
    return FoodDeliveryPartnerSubmission.findOne({
        partnerId,
        status: 'rejected'
    })
        .sort({ submissionNumber: -1 })
        .lean();
};

export const ensureLegacySubmission = async (partner) => {
    if (!partner?._id) return null;
    if (partner.latestSubmissionId) {
        const existing = await FoodDeliveryPartnerSubmission.findById(partner.latestSubmissionId).lean();
        if (existing) return existing;
    }

    const count = await FoodDeliveryPartnerSubmission.countDocuments({ partnerId: partner._id });
    if (count > 0) {
        const latest = await FoodDeliveryPartnerSubmission.findOne({ partnerId: partner._id })
            .sort({ submissionNumber: -1 })
            .lean();
        if (latest) {
            partner.latestSubmissionId = latest._id;
            partner.currentSubmissionNumber = latest.submissionNumber;
            await partner.save();
            return latest;
        }
    }

    // Backfill one submission from current partner profile (legacy partners).
    const submission = await FoodDeliveryPartnerSubmission.create({
        partnerId: partner._id,
        submissionNumber: 1,
        status: partner.status || 'pending',
        submissionType: 'initial',
        submittedAt: partner.createdAt || new Date(),
        reviewedAt: partner.approvedAt || partner.rejectedAt || null,
        approvedBy: partner.approvedBy || null,
        rejectedBy: partner.rejectedBy || null,
        rejectionReason: partner.rejectionReason || null,
        snapshot: buildPartnerOnboardingSnapshot(partner)
    });

    partner.latestSubmissionId = submission._id;
    partner.currentSubmissionNumber = 1;
    await partner.save();
    return submission.toObject ? submission.toObject() : submission;
};

export const listPartnerSubmissions = async (partnerId) => {
    if (!partnerId || !mongoose.Types.ObjectId.isValid(String(partnerId))) {
        return [];
    }
    return FoodDeliveryPartnerSubmission.find({ partnerId })
        .sort({ submissionNumber: 1 })
        .lean();
};

export const getLatestSubmissionForPartner = async (partnerId) => {
    if (!partnerId || !mongoose.Types.ObjectId.isValid(String(partnerId))) {
        return null;
    }
    return FoodDeliveryPartnerSubmission.findOne({ partnerId })
        .sort({ submissionNumber: -1 })
        .lean();
};

export const serializeSubmissionForPrefill = (submission) => {
    if (!submission) return null;
    const snap = submission.snapshot || {};
    return {
        submissionId: String(submission._id),
        submissionNumber: submission.submissionNumber,
        submissionType: submission.submissionType,
        status: submission.status,
        submittedAt: submission.submittedAt,
        reviewedAt: submission.reviewedAt,
        rejectionReason: submission.rejectionReason || null,
        rejectedAt: submission.reviewedAt || null,
        rejectedBy: submission.rejectedBy || null,
        snapshot: {
            name: snap.name || '',
            phone: snap.phone || '',
            email: snap.email || '',
            countryCode: snap.countryCode || '+91',
            address: snap.address || '',
            city: snap.city || '',
            state: snap.state || '',
            vehicleType: snap.vehicleType || '',
            vehicleName: snap.vehicleName || '',
            vehicleNumber: snap.vehicleNumber || '',
            panNumber: snap.panNumber || '',
            aadharNumber: snap.aadharNumber || '',
            drivingLicenseNumber: snap.drivingLicenseNumber || '',
            profilePhoto: snap.profilePhoto || '',
            aadharPhoto: snap.aadharPhoto || '',
            panPhoto: snap.panPhoto || '',
            drivingLicensePhoto: snap.drivingLicensePhoto || '',
            vehicleImage: snap.vehicleImage || '',
            driverVehicles: Array.isArray(snap.driverVehicles) ? snap.driverVehicles : [],
            activeVehicleId: snap.activeVehicleId || null
        }
    };
};

export const partnerHasPriorRejectedSubmission = async (partnerId) => {
    if (!partnerId) return false;
    const found = await FoodDeliveryPartnerSubmission.exists({
        partnerId,
        status: 'rejected'
    });
    return Boolean(found);
};
