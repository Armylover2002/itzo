import mongoose from 'mongoose';
import { Refund } from './models/refund.model.js';
import { Payment } from './models/payment.model.js';
import { creditWallet } from './wallet.service.js';
import { getRazorpayInstance, isRazorpayConfigured } from '../../modules/food/orders/helpers/razorpay.helper.js';
import { logger } from '../../utils/logger.js';

/**
 * Initiate a refund for a payment.
 * - For wallet payments → credits user wallet immediately.
 * - For gateway payments → creates a pending refund record (processGatewayRefund() does actual refund).
 */
export async function initiateRefund({ paymentId, orderId, userId, amount, reason = '', refundTo }) {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new Error('Payment not found');
    if (payment.status !== 'success') throw new Error('Can only refund successful payments');

    // Determine refund path
    const to = refundTo || (payment.method === 'wallet' ? 'wallet' : 'wallet');
    // Default to wallet refund for all methods — safer, faster. Admin can override to gateway.

    const refund = await Refund.create({
        paymentId: new mongoose.Types.ObjectId(paymentId),
        orderId: orderId ? new mongoose.Types.ObjectId(orderId) : payment.orderId,
        userId: userId ? new mongoose.Types.ObjectId(userId) : payment.userId,
        amount: Number(amount) || payment.amount,
        currency: payment.currency || 'INR',
        reason,
        status: 'pending',
        refundTo: to
    });

    // If refunding to wallet, credit immediately
    if (to === 'wallet') {
        try {
            await creditWallet({
                entityType: 'user',
                entityId: String(userId || payment.userId),
                amount: refund.amount,
                description: `Refund for order`,
                category: 'order_refund',
                orderId: String(refund.orderId),
                paymentId: String(paymentId),
                metadata: { refundId: refund._id, reason }
            });

            refund.status = 'processed';
            refund.processedAt = new Date();
            await refund.save();

            // Also credit back to the existing FoodUserWallet for backward compat
            await addRefundToLegacyWallet(userId || payment.userId, refund.amount, orderId);

            // Mark payment as refunded
            payment.status = 'refunded';
            await payment.save();

            logger.info(`Refund processed (wallet): ${refund._id} amount=${refund.amount}`);
        } catch (err) {
            refund.status = 'failed';
            refund.metadata = { error: err.message };
            await refund.save();
            throw err;
        }
    }

    return refund.toObject();
}

/**
 * Process a gateway refund (Razorpay) for a pending refund record.
 */
export async function processGatewayRefund(refundId) {
    const refund = await Refund.findById(refundId);
    if (!refund) throw new Error('Refund not found');
    if (refund.status === 'processed') return refund.toObject();

    const payment = await Payment.findById(refund.paymentId);
    if (!payment) throw new Error('Payment not found');

    if (payment.gateway === 'razorpay' && payment.gatewayPaymentId && isRazorpayConfigured()) {
        try {
            const instance = getRazorpayInstance();
            const rzRefund = await instance.payments.refund(payment.gatewayPaymentId, {
                amount: Math.round(refund.amount * 100), // paise
                speed: 'normal'
            });

            refund.gatewayRefundId = rzRefund.id;
            refund.status = 'processed';
            refund.processedAt = new Date();
            await refund.save();

            payment.status = 'refunded';
            await payment.save();

            logger.info(`Gateway refund processed: ${refundId} gatewayRefundId=${rzRefund.id}`);
        } catch (err) {
            refund.status = 'failed';
            refund.metadata = { error: err.message };
            await refund.save();
            throw err;
        }
    } else {
        // Fallback to wallet refund
        return initiateRefund({
            paymentId: String(payment._id),
            orderId: String(refund.orderId),
            userId: String(refund.userId),
            amount: refund.amount,
            reason: refund.reason,
            refundTo: 'wallet'
        });
    }

    return refund.toObject();
}

/**
 * Get refunds for an order.
 */
export async function getRefundsByOrder(orderId) {
    return Refund.find({ orderId: new mongoose.Types.ObjectId(orderId) })
        .sort({ createdAt: -1 })
        .lean();
}

/**
 * List refunds with filters.
 */
export async function listRefunds({ status, page = 1, limit = 20 } = {}) {
    const filter = {};
    if (status) filter.status = status;

    const skip = (Math.max(1, page) - 1) * limit;
    const [docs, total] = await Promise.all([
        Refund.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Refund.countDocuments(filter)
    ]);

    return { refunds: docs, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Backward compatibility hook after universal wallet credit.
 * Balance + embedded history are now written atomically by recordTransaction /
 * creditWallet — do NOT credit balance or push history again here
 * (previously double-credited FoodUserWallet.balance).
 */
async function addRefundToLegacyWallet(userId, amount, orderId) {
    // Intentionally a no-op: creditWallet already updates food_user_wallets.balance
    // and appends one embedded transactions[] entry for order_refund.
    logger.info(
        `addRefundToLegacyWallet skipped (handled by creditWallet embed) userId=${userId} amount=${amount} orderId=${orderId}`
    );
}
