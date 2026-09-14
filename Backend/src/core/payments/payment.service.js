import mongoose from 'mongoose';
import { Payment } from './models/payment.model.js';
import { recordTransaction } from './transaction.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Create a new Payment record when an order is placed.
 * Does NOT move money — that happens on markPaymentSuccess().
 */
export async function createPayment({
    orderId, userId, amount, method, gateway = 'none',
    gatewayOrderId = '', module = 'food', metadata
}) {
    const status = method === 'cash' ? 'pending' : method === 'wallet' ? 'success' : 'created';
    const doc = await Payment.create({
        orderId: new mongoose.Types.ObjectId(orderId),
        userId: new mongoose.Types.ObjectId(userId),
        amount: Number(amount),
        currency: 'INR',
        method,
        gateway,
        gatewayOrderId,
        status,
        module,
        metadata
    });

    logger.info(`Payment created: ${doc._id} method=${method} status=${status} amount=${amount}`);

    // For wallet payments, immediately debit user wallet
    if (method === 'wallet' && status === 'success') {
        try {
            await recordTransaction({
                entityType: 'user',
                entityId: String(userId),
                type: 'debit',
                amount: Number(amount),
                description: `Order payment - wallet debit`,
                category: 'order_payment',
                orderId: String(orderId),
                paymentId: String(doc._id),
                metadata: { method: 'wallet' }
            });
        } catch (err) {
            // If wallet debit fails (insufficient balance), mark payment as failed
            doc.status = 'failed';
            doc.rawResponse = { error: err.message };
            await doc.save();
            throw err;
        }
    }

    return doc.toObject();
}

/**
 * Mark payment as success after gateway verification.
 * Creates a transaction to debit the user wallet for online payments.
 */
export async function markPaymentSuccess(paymentId, { gatewayPaymentId, rawResponse } = {}) {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new Error('Payment not found');
    if (payment.status === 'success') return payment.toObject();

    payment.status = 'success';
    if (gatewayPaymentId) payment.gatewayPaymentId = gatewayPaymentId;
    if (rawResponse) payment.rawResponse = rawResponse;
    await payment.save();

    logger.info(`Payment marked success: ${paymentId}`);
    return payment.toObject();
}

/**
 * Mark payment as failed.
 */
export async function markPaymentFailed(paymentId, rawResponse) {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new Error('Payment not found');

    payment.status = 'failed';
    if (rawResponse) payment.rawResponse = rawResponse;
    await payment.save();

    logger.info(`Payment marked failed: ${paymentId}`);
    return payment.toObject();
}

/**
 * Get all payments for an order.
 */
export async function getPaymentsByOrder(orderId) {
    return Payment.find({ orderId: new mongoose.Types.ObjectId(orderId) })
        .sort({ createdAt: -1 })
        .lean();
}

/**
 * Get a payment by its gateway payment id.
 */
export async function getPaymentByGatewayId(gatewayPaymentId) {
    return Payment.findOne({ gatewayPaymentId }).lean();
}

/**
 * Find or create payment for an order (idempotent).
 */
export async function findOrCreatePayment({
    orderId, userId, amount, method, gateway = 'none',
    gatewayOrderId = '', module = 'food'
}) {
    // Check if a non-failed payment already exists
    const existing = await Payment.findOne({
        orderId: new mongoose.Types.ObjectId(orderId),
        status: { $ne: 'failed' }
    }).lean();

    if (existing) return existing;

    return createPayment({ orderId, userId, amount, method, gateway, gatewayOrderId, module });
}
