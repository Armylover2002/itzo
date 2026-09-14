import { logger } from '../../utils/logger.js';
import { creditWallet } from '../../core/payments/wallet.service.js';
import { createPayment, markPaymentSuccess } from '../../core/payments/payment.service.js';
import { initiateRefund } from '../../core/payments/refund.service.js';

/**
 * Post-delivery financial settlement processor.
 * Called by BullMQ when a delivery_completed event fires.
 *
 * Splits the order total into:
 * 1. Delivery partner earning credit
 * 2. Platform profit credit (admin wallet)
 *
 * Also handles refunds on order cancellation.
 *
 * @param {import('bullmq').Job} job
 */
export const processPaymentJob = async (job) => {
    const { action, orderMongoId, orderId } = job.data || {};
    logger.info(`[PaymentProcessor] Processing ${action} for order ${orderId || orderMongoId} (job ${job.id})`);

    try {
        switch (action) {
            case 'delivery_completed':
                await handleDeliveryCompleted(job.data);
                break;

            case 'order_cancelled':
            case 'order_cancelled_by_user':
            case 'order_cancelled_by_watchdog':
                await handleOrderCancelled(job.data);
                break;

            case 'payment_verified':
                await handlePaymentVerified(job.data);
                break;

            default:
                logger.info(`[PaymentProcessor] No handler for action: ${action}`);
        }
    } catch (err) {
        logger.error(`[PaymentProcessor] Error processing ${action}: ${err.message}`);
        throw err; // Let BullMQ retry
    }

    return { processed: true, action, jobId: job.id };
};

/**
 * After delivery is completed and payment is confirmed:
 * Credit delivery partner + platform wallets only.
 *
 * Restaurant order share stays on `food_transactions` (captured on delivery in
 * order.service). It is intentionally NOT credited to `food_restaurant_wallets`.
 */
async function handleDeliveryCompleted(data) {
    const {
        orderMongoId, orderId,
        deliveryPartnerId,
        riderEarning = 0, platformProfit = 0,
        paymentMethod
    } = data;

    // 1. Credit delivery partner wallet with their earning
    if (deliveryPartnerId && riderEarning > 0) {
        try {
            const creditResult = await creditWallet({
                entityType: 'deliveryBoy',
                entityId: deliveryPartnerId,
                amount: riderEarning,
                description: `Order ${orderId} - delivery earning`,
                category: 'delivery_earning',
                orderId: orderMongoId,
                metadata: {
                    orderId,
                    paymentMethod,
                    // Informative only — amount already includes quickRiderBonus when applicable
                    deliveryMode: data.deliveryMode || 'basic',
                    quickRiderBonus: Number(data.quickRiderBonus || 0) || 0,
                }
            });

            // Increment delivery count only on first successful credit.
            if (!creditResult?.alreadyProcessed) {
                const { FoodDeliveryWallet } = await import('../../modules/food/delivery/models/deliveryWallet.model.js');
                const mongoose = await import('mongoose');
                await FoodDeliveryWallet.updateOne(
                    { deliveryPartnerId: new mongoose.default.Types.ObjectId(deliveryPartnerId) },
                    { $inc: { totalDeliveries: 1 } }
                );
            }

            logger.info(`[PaymentProcessor] Delivery partner ${deliveryPartnerId} credited ${riderEarning} for order ${orderId}${creditResult?.alreadyProcessed ? ' (idempotent)' : ''}`);
        } catch (err) {
            logger.error(`[PaymentProcessor] Failed to credit delivery partner: ${err.message}`);
        }
    }

    // 2. Credit admin/platform wallet with platform profit
    if (platformProfit > 0) {
        try {
            const creditResult = await creditWallet({
                entityType: 'admin',
                entityId: 'platform',
                amount: platformProfit,
                description: `Order ${orderId} - platform profit`,
                category: 'platform_fee',
                orderId: orderMongoId,
                metadata: { orderId, paymentMethod, riderEarning }
            });
            logger.info(`[PaymentProcessor] Platform credited ${platformProfit} for order ${orderId}${creditResult?.alreadyProcessed ? ' (idempotent)' : ''}`);
        } catch (err) {
            logger.error(`[PaymentProcessor] Failed to credit platform: ${err.message}`);
        }
    }
}

/**
 * Handle order cancellation — trigger refund if payment was made.
 */
async function handleOrderCancelled(data) {
    const { orderMongoId, paymentId, paymentMethod, paymentStatus, userId, amount, reason } = data;

    if (!paymentId || paymentStatus !== 'success') {
        logger.info(`[PaymentProcessor] No refund needed for order ${orderMongoId} (status: ${paymentStatus})`);
        return;
    }

    try {
        await initiateRefund({
            paymentId,
            orderId: orderMongoId,
            userId,
            amount,
            reason: reason || 'Order cancelled',
            refundTo: paymentMethod === 'wallet' ? 'wallet' : 'wallet' // Default to wallet refund
        });
        logger.info(`[PaymentProcessor] Refund initiated for order ${orderMongoId}`);
    } catch (err) {
        logger.error(`[PaymentProcessor] Refund failed for order ${orderMongoId}: ${err.message}`);
    }
}

/**
 * Handle payment verified — create a Payment record in the new system.
 */
async function handlePaymentVerified(data) {
    const { orderMongoId, orderId, userId, paymentMethod, paymentStatus, amount, gatewayPaymentId } = data;

    try {
        const payment = await createPayment({
            orderId: orderMongoId,
            userId,
            amount,
            method: paymentMethod,
            gateway: paymentMethod === 'razorpay' ? 'razorpay' : 'none',
            gatewayOrderId: data.razorpayOrderId || '',
            metadata: { orderId, source: 'payment_verified_event' }
        });

        if (paymentStatus === 'paid' && gatewayPaymentId) {
            await markPaymentSuccess(payment._id, { gatewayPaymentId });
        }

        logger.info(`[PaymentProcessor] Payment record created for order ${orderId}: ${payment._id}`);
    } catch (err) {
        logger.error(`[PaymentProcessor] Failed to create payment record: ${err.message}`);
    }
}
