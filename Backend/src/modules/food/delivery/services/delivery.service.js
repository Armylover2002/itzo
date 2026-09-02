import mongoose from 'mongoose';
import ms from 'ms';
import { FoodDeliveryPartner } from '../models/deliveryPartner.model.js';
import { DeliverySupportTicket } from '../models/supportTicket.model.js';
import { DeliveryBonusTransaction } from '../../admin/models/deliveryBonusTransaction.model.js';
import { FoodEarningAddon } from '../../admin/models/earningAddon.model.js';
import { FoodOrder } from '../../orders/models/order.model.js';
import { uploadImageBuffer } from '../../../../services/upload.service.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { getDeliveryCashLimitSettings } from '../../admin/services/admin.service.js';
import { ensureDailyPassEligibility, activateDailyPass } from '../../subscriptions/services/wallet.service.js';
import { signAccessToken, signRefreshToken } from '../../../../core/auth/token.util.js';
import { FoodRefreshToken } from '../../../../core/refreshTokens/refreshToken.model.js';
import { config } from '../../../../config/env.js';

export const registerDeliveryPartner = async (payload, files) => {
    const { 
        name, phone, email, countryCode, address, city, state, 
        vehicleType, vehicleName, vehicleNumber, drivingLicenseNumber, panNumber, aadharNumber,
        fcmToken, platform 
    } = payload;
    const refRaw = typeof payload?.ref === 'string' ? String(payload.ref).trim() : '';

    const digits = String(phone || '').replace(/\D/g, '');
    const normalizedPhone = digits.slice(-10);

    const existing = await FoodDeliveryPartner.findOne({
        $or: [
            { phone: phone },
            { phone: normalizedPhone },
            { phone: { $regex: new RegExp(normalizedPhone + '$') } }
        ]
    });

    if (existing) {
        if (!existing.isDeleted && existing.status === 'approved') {
            throw new ValidationError('Delivery partner with this phone already exists and is active. Please login.');
        }
    }

    const images = {};

    if (files?.profilePhoto?.[0]) {
        images.profilePhoto = await uploadImageBuffer(files.profilePhoto[0].buffer, 'food/delivery/profile');
    }
    if (files?.aadharPhoto?.[0]) {
        images.aadharPhoto = await uploadImageBuffer(files.aadharPhoto[0].buffer, 'food/delivery/aadhar');
    }
    if (files?.panPhoto?.[0]) {
        images.panPhoto = await uploadImageBuffer(files.panPhoto[0].buffer, 'food/delivery/pan');
    }
    if (files?.drivingLicensePhoto?.[0]) {
        images.drivingLicensePhoto = await uploadImageBuffer(
            files.drivingLicensePhoto[0].buffer,
            'food/delivery/license'
        );
    }

    let partner;

    if (existing) {
        const isReapplied = existing.status === 'rejected' || existing.status === 'pending';

        existing.isDeleted = false;
        existing.deletedAt = undefined;
        existing.status = 'pending';
        existing.isActive = true;

        if (isReapplied) {
            existing.applicationType = 'reapplied';
            existing.reappliedAt = new Date();
            existing.reapplicationCount = (existing.reapplicationCount || 0) + 1;
            if (existing.rejectionReason) {
                existing.previousRejectionReason = existing.rejectionReason;
            }
            existing.rejectionReason = undefined;
            existing.rejectedAt = undefined;
            existing.rejectedBy = undefined;
        }

        existing.name = name;
        existing.phone = phone;
        if (email && String(email).trim()) existing.email = String(email).trim();
        if (countryCode) existing.countryCode = countryCode;
        if (address) existing.address = address;
        if (city) existing.city = city;
        if (state) existing.state = state;
        if (vehicleType) existing.vehicleType = vehicleType;
        if (vehicleName) existing.vehicleName = vehicleName;
        if (vehicleNumber) existing.vehicleNumber = vehicleNumber;
        if (drivingLicenseNumber) existing.drivingLicenseNumber = drivingLicenseNumber;
        if (panNumber) existing.panNumber = panNumber;
        if (aadharNumber) existing.aadharNumber = aadharNumber;

        if (images.profilePhoto) existing.profilePhoto = images.profilePhoto;
        if (images.aadharPhoto) existing.aadharPhoto = images.aadharPhoto;
        if (images.panPhoto) existing.panPhoto = images.panPhoto;
        if (images.drivingLicensePhoto) existing.drivingLicensePhoto = images.drivingLicensePhoto;

        await existing.save();
        partner = existing;
    } else {
        partner = await FoodDeliveryPartner.create({
            name,
            phone,
            email: email && String(email).trim() ? String(email).trim() : undefined,
            countryCode: countryCode || '+91',
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
            applicationType: 'new',
            ...images
        });
    }

    // Update FCM token if provided
    if (fcmToken) {
        if (platform === 'mobile') {
            partner.fcmTokenMobile = [fcmToken];
        } else {
            partner.fcmTokens = [fcmToken];
        }
        await partner.save();
    }

    // Ensure referralCode exists for sharing.
    if (!partner.referralCode) {
        partner.referralCode = String(partner._id);
        await partner.save();
    }

    // Store referredBy (no credit here; credit happens on admin approval).
    if (refRaw && String(refRaw) !== String(partner._id)) {
        // Search by ID if it's a valid ObjectId, otherwise search by referralCode field
        let referrer = null;
        if (mongoose.Types.ObjectId.isValid(refRaw)) {
            referrer = await FoodDeliveryPartner.findById(refRaw).select('_id').lean();
        }

        if (!referrer) {
            referrer = await FoodDeliveryPartner.findOne({ 
                $or: [
                    { referralCode: refRaw },
                    { phone: refRaw }
                ]
            }).select('_id').lean();
        }

        if (referrer && (!partner.referredBy || String(partner.referredBy) !== String(referrer._id))) {
            partner.referredBy = referrer._id;
            await partner.save();
        }
    }

    try {
        const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
        void notifyAdminsSafely({
            title: 'New Delivery Partner Registration 🚲',
            body: `A new delivery partner "${partner.name}" has signed up and is pending approval.`,
            data: {
                type: 'new_registration',
                subType: 'delivery_partner',
                id: String(partner._id)
            }
        });
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to notify admins of new delivery partner registration:', e);
    }

    return partner.toObject ? partner.toObject() : partner;
};

export const getDeliveryOnboardingStatus = async (phone) => {
    if (!phone) {
        throw new ValidationError('Phone number is required');
    }
    const digits = String(phone).replace(/\D/g, '');
    const last10 = digits.slice(-10);

    const partner = await FoodDeliveryPartner.findOne({
        $or: [
            { phone: String(phone).trim() },
            { phone: digits },
            { phone: last10 },
            { phone: { $regex: new RegExp(last10 + '$') } }
        ]
    });

    if (!partner || partner.isDeleted) {
        return { exists: false };
    }

    let auth = null;
    if (partner.status === 'approved' && partner.isActive !== false) {
        const payload = {
            userId: partner._id.toString(),
            role: 'DELIVERY_PARTNER'
        };
        const accessToken = signAccessToken(payload);
        const refreshToken = signRefreshToken(payload);
        const ttlMs = ms(config.jwtRefreshExpiresIn || '7d');
        const expiresAt = new Date(Date.now() + ttlMs);

        await FoodRefreshToken.create({
            userId: partner._id,
            token: refreshToken,
            expiresAt
        });

        auth = {
            accessToken,
            refreshToken,
            user: partner
        };
    }

    return {
        exists: true,
        status: partner.status || 'pending',
        applicationType: partner.applicationType || 'new',
        reappliedAt: partner.reappliedAt || null,
        reapplicationCount: partner.reapplicationCount || 0,
        createdAt: partner.createdAt,
        updatedAt: partner.updatedAt,
        rejectionReason: partner.rejectionReason || null,
        previousRejectionReason: partner.previousRejectionReason || null,
        data: {
            _id: partner._id,
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
            drivingLicenseNumber: partner.drivingLicenseNumber || '',
            panNumber: partner.panNumber || '',
            aadharNumber: partner.aadharNumber || '',
            profilePhoto: partner.profilePhoto || null,
            aadharPhoto: partner.aadharPhoto || null,
            panPhoto: partner.panPhoto || null,
            drivingLicensePhoto: partner.drivingLicensePhoto || null,
            bankAccountHolderName: partner.bankAccountHolderName || '',
            bankAccountNumber: partner.bankAccountNumber || '',
            bankIfscCode: partner.bankIfscCode || '',
            bankName: partner.bankName || '',
            upiId: partner.upiId || '',
            upiQrCode: partner.upiQrCode || null
        },
        auth
    };
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
        if (platform === 'mobile') {
            if (!partner.fcmTokenMobile) partner.fcmTokenMobile = [];
            if (!partner.fcmTokenMobile.includes(fcmToken)) {
                partner.fcmTokenMobile.push(fcmToken);
            }
        } else {
            if (!partner.fcmTokens) partner.fcmTokens = [];
            if (!partner.fcmTokens.includes(fcmToken)) {
                partner.fcmTokens.push(fcmToken);
            }
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

    if (aadharNumber !== undefined) partner.aadharNumber = aadharNumber;
    if (panNumber !== undefined) partner.panNumber = panNumber;

    await partner.save();
    return {
        partner: partner.toObject(),
        requiresReapproval: false
    };
};

export const deleteDeliveryPartnerAccount = async (userId) => {
    const partner = await FoodDeliveryPartner.findById(userId);
    if (!partner) throw new ValidationError('Delivery partner not found');

    partner.isDeleted = true;
    partner.availabilityStatus = 'offline';
    partner.deletionRequest = {
        status: 'approved',
        reason: 'Delivery partner requested account deletion',
        requestedAt: new Date(),
        reviewedAt: new Date()
    };
    await partner.save();
    return { success: true, message: 'Account deleted successfully' };
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
        partner.panNumber = panDetails.number ? String(panDetails.number).trim().toUpperCase() : '';
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
    let validStatus = 'offline';
    if (status === 'online' || status === true) validStatus = 'online';
    else if (status === 'offline' || status === false) validStatus = 'offline';
    
    // PHASE 3C-1: SUBSCRIPTION TRIGGER (OFFLINE -> ONLINE ONLY)
    if (partner.availabilityStatus === 'offline' && validStatus === 'online') {
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

    partner.availabilityStatus = validStatus;
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
    return { availabilityStatus: partner.availabilityStatus };
};

// ----- Delivery partner wallet (Pocket / requests page) -----
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

    const partnerId = new mongoose.Types.ObjectId(deliveryPartnerId);

    // Earnings paid to rider through completed deliveries
    const [earningsAgg, cashAgg] = await Promise.all([
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
                    cashInHand: { $sum: { $ifNull: ['$riderEarning', 0] } }
                }
            }
        ])
    ]);

    const totalEarned = Number(earningsAgg?.[0]?.totalEarned) || 0;
    const cashInHand = Number(cashAgg?.[0]?.cashInHand) || 0;

    // Admin-set delivery bonuses / earning addons
    const bonusAgg = await DeliveryBonusTransaction.aggregate([
        { $match: { deliveryPartnerId: partnerId } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalBonus = bonusAgg?.[0] ? Number(bonusAgg[0].total) : 0;

    // Keep transactions list reasonably small (UI only needs recent data for charts)
    const [paymentTxList, bonusTxList] = await Promise.all([
        FoodOrder.find({
            'dispatch.deliveryPartnerId': partnerId,
            orderStatus: 'delivered',
        })
            .sort({ 'deliveryState.deliveredAt': -1, createdAt: -1 })
            .select('orderId riderEarning payment orderStatus deliveryState createdAt deliveryState.deliveredAt')
            .limit(2000)
            .lean(),
        DeliveryBonusTransaction.find({ deliveryPartnerId: partnerId })
            .sort({ createdAt: -1 })
            .limit(1000)
            .lean(),
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
        transactions: [...paymentTransactions, ...bonusTransactions].sort((a, b) => {
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

    const [totalOrders, agg] = await Promise.all([
        FoodOrder.countDocuments(match),
        FoodOrder.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    totalEarnings: { $sum: { $ifNull: ['$riderEarning', 0] } }
                }
            }
        ])
    ]);

    const totalEarnings = Number(agg?.[0]?.totalEarnings) || 0;

    // Frontend only strongly relies on totalEarnings + totalOrders.
    const summary = {
        totalEarnings,
        totalOrders,
        totalHours: 0,
        totalMinutes: 0,
        orderEarning: totalEarnings,
        incentive: 0,
        otherEarnings: 0
    };

    return {
        summary,
        period,
        date: date.toISOString(),
        pagination: { page, limit, total: totalOrders }
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
        order?.pickupPoints?.[0]?.sourceName ||
        order?.items?.[0]?.sourceName ||
        '';

    const paymentMethod = order?.payment?.method || order?.paymentMethod || '';
    const pricingTotal = Number(order?.pricing?.total) || Number(order?.totalAmount) || 0;

    const earningAmount = Number(order?.riderEarning ?? order?.deliveryEarning ?? 0) || 0;
    const codAmount = paymentMethod === 'cash' ? Number(order?.payment?.amountDue) || 0 : 0;
    const codCollectedAmount = paymentMethod === 'cash' && order?.payment?.status === 'paid' ? codAmount : 0;
    return {
        id: order?._id,
        _id: order?._id,
        orderId: order?.orderId || order?._id,
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
        match['deliveryState.deliveredAt'] = { $gte: start, $lte: end };
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
        // ALL TRIPS: show anything created in range, and compute earnings only for delivered orders.
        match.createdAt = { $gte: start, $lte: end };
    }

    const orders = await FoodOrder.find(match)
        .populate({ path: 'restaurantId', select: 'restaurantName' })
        .sort({ 'deliveryState.deliveredAt': -1, createdAt: -1 })
        .limit(limit)
        .lean();

    return {
        period,
        date: (date || new Date()).toISOString(),
        range: { start: start.toISOString(), end: end.toISOString() },
        trips: (orders || []).map(toTripDto)
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

    const orders = await FoodOrder.find({
        'dispatch.deliveryPartnerId': partnerId,
        orderStatus: 'delivered',
        $or: [
            { 'deliveryState.deliveredAt': { $gte: start, $lte: end } },
            { deliveredAt: { $gte: start, $lte: end } },
            { completedAt: { $gte: start, $lte: end } },
            { updatedAt: { $gte: start, $lte: end } },
            { createdAt: { $gte: start, $lte: end } }
        ]
    })
        .populate({ path: 'restaurantId', select: 'restaurantName' })
        .sort({ 'deliveryState.deliveredAt': -1, deliveredAt: -1, completedAt: -1, updatedAt: -1, createdAt: -1 })
        .limit(limit)
        .lean();

    const bonusTxList = await DeliveryBonusTransaction.find({
        deliveryPartnerId: partnerId,
        createdAt: { $gte: start, $lte: end }
    })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

    const trips = (orders || []).map(toTripDto);

    const paymentTransactions = (orders || []).map((o) => {
        const storeName = o?.restaurantId?.restaurantName || o?.restaurantName || o?.pickupPoints?.[0]?.sourceName || o?.items?.[0]?.sourceName;
        return {
            _id: o._id,
            type: 'payment',
            amount: Number(o.riderEarning) || 0,
            status: 'Completed',
            date: o?.deliveryState?.deliveredAt || o?.deliveredAt || o?.createdAt,
            createdAt: o?.deliveryState?.deliveredAt || o?.deliveredAt || o?.createdAt,
            orderId: o.orderId || String(o._id),
            metadata: { orderId: o.orderId || String(o._id) },
            description: storeName ? `Order earning - ${storeName}` : 'Order earning'
        };
    });

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

    const totalEarning = paymentTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalBonus = bonusTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    return {
        week: { start: start.toISOString(), end: end.toISOString() },
        summary: { totalEarning, totalBonus, grandTotal: totalEarning + totalBonus },
        trips,
        transactions: {
            payment: paymentTransactions,
            bonus: bonusTransactions
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

