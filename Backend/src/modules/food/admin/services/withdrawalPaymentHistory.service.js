import mongoose from 'mongoose';
import { WithdrawalPaymentHistory } from '../models/withdrawalPaymentHistory.model.js';
import { logger } from '../../../../utils/logger.js';

function isDuplicateKeyError(err) {
    return err?.code === 11000 || String(err?.message || '').includes('E11000');
}

/**
 * Permanently record a successful withdrawal payout.
 * Idempotent on (withdrawalRequestId, userType). Never throws to callers —
 * payout money path must not fail because of history write issues.
 *
 * @returns {Promise<object|null>} created/existing history doc, or null on failure
 */
export async function recordWithdrawalPaymentHistory({
    withdrawalRequestId,
    userType,
    userId,
    userName = '',
    amount,
    paymentMethod = 'bank_transfer',
    transactionReferenceId = null,
    adminId = null,
    adminName = 'Admin',
    paymentStatus = 'paid',
    requestTime,
    approvalTime,
    paymentTime,
    notes = null,
} = {}) {
    const wId = String(withdrawalRequestId || '');
    const uId = String(userId || '');

    if (!wId || !mongoose.Types.ObjectId.isValid(wId)) {
        logger.error('recordWithdrawalPaymentHistory: invalid withdrawalRequestId');
        return null;
    }
    if (!['restaurant', 'delivery_partner'].includes(userType)) {
        logger.error(`recordWithdrawalPaymentHistory: invalid userType=${userType}`);
        return null;
    }
    if (!uId || !mongoose.Types.ObjectId.isValid(uId)) {
        logger.error('recordWithdrawalPaymentHistory: invalid userId');
        return null;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
        logger.error('recordWithdrawalPaymentHistory: invalid amount');
        return null;
    }

    const now = new Date();
    const payload = {
        withdrawalRequestId: new mongoose.Types.ObjectId(wId),
        userType,
        userId: new mongoose.Types.ObjectId(uId),
        userName: String(userName || '').trim() || 'N/A',
        amount: numericAmount,
        paymentMethod: String(paymentMethod || 'bank_transfer').trim() || 'bank_transfer',
        transactionReferenceId: transactionReferenceId
            ? String(transactionReferenceId).trim()
            : null,
        adminId:
            adminId && mongoose.Types.ObjectId.isValid(String(adminId))
                ? new mongoose.Types.ObjectId(String(adminId))
                : null,
        adminName: String(adminName || 'Admin').trim() || 'Admin',
        paymentStatus: paymentStatus === 'completed' ? 'completed' : 'paid',
        requestTime: requestTime ? new Date(requestTime) : now,
        approvalTime: approvalTime ? new Date(approvalTime) : now,
        paymentTime: paymentTime ? new Date(paymentTime) : now,
        notes: notes != null && String(notes).trim() ? String(notes).trim() : null,
    };

    try {
        const [created] = await WithdrawalPaymentHistory.create([payload]);
        return created.toObject ? created.toObject() : created;
    } catch (err) {
        if (isDuplicateKeyError(err)) {
            const existing = await WithdrawalPaymentHistory.findOne({
                withdrawalRequestId: payload.withdrawalRequestId,
                userType: payload.userType,
            }).lean();
            return existing;
        }
        logger.error(
            `recordWithdrawalPaymentHistory failed for ${userType} withdrawal ${wId}: ${err?.message || err}`
        );
        return null;
    }
}

/**
 * Build + record history from a claimed restaurant withdrawal document.
 */
export async function recordRestaurantWithdrawalPayment(claimed, performer = null, extras = {}) {
    const restaurant = claimed?.restaurantId;
    const userId = restaurant?._id || restaurant || extras.userId;
    const userName =
        restaurant?.restaurantName ||
        extras.userName ||
        'N/A';
    const paidAt = claimed?.processedAt || new Date();

    return recordWithdrawalPaymentHistory({
        withdrawalRequestId: claimed._id,
        userType: 'restaurant',
        userId,
        userName,
        amount: claimed.amount,
        paymentMethod: claimed.paymentMethod || 'bank_transfer',
        transactionReferenceId: extras.transactionId ?? claimed.transactionId ?? null,
        adminId: performer?.userId || null,
        adminName: performer?.name || 'Admin',
        paymentStatus: 'paid',
        requestTime: claimed.createdAt,
        approvalTime: paidAt,
        paymentTime: paidAt,
        notes: extras.adminNote ?? claimed.adminNote ?? null,
    });
}

/**
 * Build + record history from a claimed delivery withdrawal document.
 */
export async function recordDeliveryWithdrawalPayment(claimed, performer = null, extras = {}) {
    const partner = claimed?.deliveryPartnerId;
    const userId = partner?._id || partner || extras.userId;
    const userName = partner?.name || extras.userName || 'N/A';
    const paidAt = claimed?.processedAt || new Date();

    return recordWithdrawalPaymentHistory({
        withdrawalRequestId: claimed._id,
        userType: 'delivery_partner',
        userId,
        userName,
        amount: claimed.amount,
        paymentMethod: claimed.paymentMethod || 'bank_transfer',
        transactionReferenceId: extras.transactionId ?? claimed.transactionId ?? null,
        adminId: performer?.userId || null,
        adminName: performer?.name || 'Admin',
        paymentStatus: 'paid',
        requestTime: claimed.createdAt,
        approvalTime: paidAt,
        paymentTime: paidAt,
        notes: extras.adminNote ?? claimed.adminNote ?? null,
    });
}
