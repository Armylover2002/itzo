import crypto from 'crypto';
import mongoose from 'mongoose';
import { FoodOrder } from '../../../modules/food/orders/models/order.model.js';
import { UserSubscription } from '../../../modules/food/user/models/userSubscription.model.js';
import { SubscriptionPlan } from '../../../modules/food/admin/models/subscriptionPlan.model.js';
import * as foodTransactionService from '../../../modules/food/orders/services/foodTransaction.service.js';
import { config } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';
import { ProcessedWebhookEvent } from '../models/processedWebhookEvent.model.js';
import dayjs from 'dayjs';

import * as walletService from '../../../modules/food/subscriptions/services/wallet.service.js';

/**
 * Build the idempotency key for a delivery, preferring Razorpay's own event id and
 * falling back to a hash of the exact body we verified.
 */
const buildDedupeKey = (req, event) => {
    const eventId = String(req.headers['x-razorpay-event-id'] || req.body?.id || '').trim();
    if (eventId) return `razorpay:${eventId}`;
    const bodyHash = crypto.createHash('sha256').update(req.rawBody).digest('hex');
    return `razorpay:${event}:${bodyHash}`;
};

/**
 * Claim a webhook delivery exactly once.
 *
 * Razorpay retries deliveries, and the order-payment handlers below move money and
 * overwrite refund records — state-based guards alone cannot tell a retry apart from a
 * genuine second payment or a second partial refund. Insert-first with a unique index
 * makes the claim atomic: a duplicate key means somebody already handled this delivery.
 *
 * @returns {Promise<boolean>} true if this call owns the event, false if already handled
 */
const claimWebhookEvent = async (req, event, { entityType = null, entityId = null } = {}) => {
    const dedupeKey = buildDedupeKey(req, event);
    try {
        await ProcessedWebhookEvent.create({
            source: 'razorpay',
            dedupeKey,
            eventId: String(req.headers['x-razorpay-event-id'] || req.body?.id || '').trim() || null,
            eventType: event,
            entityType,
            entityId: entityId ? String(entityId) : null,
            bodyHash: crypto.createHash('sha256').update(req.rawBody).digest('hex')
        });
        return true;
    } catch (err) {
        if (err?.code === 11000) {
            logger.info(`Webhook [${event}]: Duplicate delivery skipped`, { dedupeKey });
            return false;
        }
        throw err;
    }
};

/**
 * ✅ NEW: Centralized Razorpay Webhook Handler (Core Layer)
 * Manages atomic updates for order payments and refunds across all modules.
 */
export const handleRazorpayWebhook = async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const secret = config.razorpayWebhookSecret;

    // 1. Verify Signature using raw body buffer
    if (!signature || !secret || !req.rawBody) {
        logger.warn('Razorpay Webhook: Missing signature or rawBody buffer.');
        return res.status(400).send('Invalid signature');
    }

    const expected = crypto
        .createHmac('sha256', secret)
        .update(req.rawBody)
        .digest('hex');

    if (expected !== signature) {
        logger.warn('Razorpay Webhook: Signature verification failed.');
        return res.status(400).send('Invalid signature');
    }

    const { event, payload } = req.body;
    logger.info(`Razorpay Webhook Received: ${event}`);

    try {
        // --- 🟢 Handle Payment Captured (Success) ---
        if (event === 'payment.captured') {
            const paymentObj = payload.payment.entity;
            const rzOrderId = paymentObj.order_id;
            const rzPaymentId = paymentObj.id;
            const notes = paymentObj.notes || {};

            // 📂 CASE A-1: Subscription Wallet Topup
            if (notes.type === 'subscription_wallet_topup') {
                logger.info(`Webhook [payment.captured]: Processing Subscription Wallet Topup`);
                try {
                    await walletService.verifyTopup({ 
                        payment: paymentObj, 
                        order: payload.order ? payload.order.entity : null, 
                        notes 
                    });
                } catch (err) {
                    logger.error(`Webhook Topup Error: ${err.message}`);
                    // We don't return 4xx here because we want Razorpay to stop retrying if it's a code error,
                    // but verifyTopup handles its own idempotency.
                }
                return res.status(200).json({ status: 'ok' });
            }

            // 📂 CASE A-2: Subscription One-Time Payment (Day Plan)
            if (notes.type === 'subscription') {
                logger.info(`Webhook [payment.captured]: Processing One-Time Subscription payment`);
                const { planId, restaurantId, deliveryBoyId, userType } = notes;
                
                const plan = await SubscriptionPlan.findById(planId);
                if (plan) {
                    const expiryDate = dayjs().add(plan.durationValue, plan.durationUnit.toLowerCase()).toDate();
                    
                    const ownerFilters = [
                        restaurantId ? { restaurantId: new mongoose.Types.ObjectId(restaurantId) } : null,
                        deliveryBoyId ? { deliveryBoyId: new mongoose.Types.ObjectId(deliveryBoyId) } : null
                    ].filter(Boolean);

                    const doc = await UserSubscription.findOne({
                        $or: ownerFilters,
                        planId: plan._id,
                        status: { $in: ['pending', 'failed', 'active', 'grace'] }
                    }).sort({ createdAt: -1 }).lean();

                    if (!doc) {
                        logger.error(`Webhook [payment.captured]: Subscription doc not found for activation`, {
                            planId: String(plan._id),
                            restaurantId,
                            deliveryBoyId,
                            userType
                        });
                        return res.status(200).json({ status: 'ok' });
                    }

                    await UserSubscription.updateOne(
                        { _id: doc._id, razorpayPaymentId: { $ne: rzPaymentId } },
                        {
                            $set: {
                                userType,
                                restaurantId: restaurantId ? new mongoose.Types.ObjectId(restaurantId) : null,
                                deliveryBoyId: deliveryBoyId ? new mongoose.Types.ObjectId(deliveryBoyId) : null,
                                razorpayPaymentId: rzPaymentId,
                                startDate: new Date(),
                                expiryDate,
                                status: 'active',
                                purchasedPlanName: plan.name,
                                purchasedPrice: plan.price,
                                purchasedDuration: plan.durationValue,
                                purchasedDurationType: plan.durationUnit
                            }
                        }
                    );
                }
                return res.status(200).json({ status: 'ok' });
            }

            // 📂 CASE B: Customer order (food or quick — they share one collection)
            if (!(await claimWebhookEvent(req, event, { entityType: 'order', entityId: rzOrderId }))) {
                return res.status(200).json({ status: 'ok' });
            }

            // Atomic update to mark as paid if not already
            const order = await FoodOrder.findOneAndUpdate(
                {
                    "payment.razorpay.orderId": rzOrderId,
                    "payment.status": { $ne: 'paid' }
                },
                {
                    $set: {
                        "payment.status": 'paid',
                        "payment.razorpay.paymentId": rzPaymentId
                    }
                },
                { new: true }
            );

            if (order) {
                // Food and quick orders live in the same collection but have different
                // finance models: only food maintains a FoodTransaction ledger. Calling
                // the food sync for a quick order silently no-ops, which hid the fact
                // that quick has no per-order finance record at all — so route by
                // orderType and say so in the log instead.
                const orderType = String(order.orderType || 'food');

                if (orderType === 'food' || orderType === 'mixed') {
                    try {
                        await foodTransactionService.updateTransactionStatus(order._id, 'captured', {
                            status: 'captured',
                            razorpayPaymentId: rzPaymentId,
                            note: 'Payment status synced via Webhook (payment.captured)'
                        });
                    } catch (ledgerErr) {
                        logger.error(`Webhook Ledger Error (Order ${order.orderId}): ${ledgerErr.message}`);
                    }
                } else {
                    logger.info(
                        `Webhook [payment.captured]: Order ${order.orderId} is orderType=${orderType}; no finance ledger to sync`
                    );
                }

                logger.info(`Webhook [payment.captured]: Synced Order ${order.orderId} (type=${orderType}, Status=paid)`);
            } else {
                // ✅ ADDED: Log warn if order not found but payment was captured
                logger.warn(`Webhook [payment.captured]: Order not found or already paid for RZ-Order: ${rzOrderId}`);
            }
        }

        // --- 🔴 Handle Refund Processed ---
        if (event === 'refund.processed') {
            const refundObj = payload.refund.entity;
            const rzPaymentId = refundObj.payment_id;
            const rzRefundId = refundObj.id;
            const refundAmount = refundObj.amount / 100; // to major unit

            if (!(await claimWebhookEvent(req, event, { entityType: 'refund', entityId: rzRefundId }))) {
                return res.status(200).json({ status: 'ok' });
            }

            // Sync refund fields in the order.
            //
            // Only individual fields are set here. Replacing the whole `payment.refund`
            // object used to wipe bookkeeping written by the quick-commerce returns flow
            // (which records per-leg partial refunds), and a second partial refund would
            // silently overwrite the first with no trace of either.
            const existing = await FoodOrder.findOne({
                "payment.razorpay.paymentId": rzPaymentId
            }).select({ orderId: 1, orderType: 1, payment: 1, pricing: 1 }).lean();

            if (!existing) {
                logger.warn(`Webhook [refund.processed]: Order not found for RZ-Payment: ${rzPaymentId}`);
            } else {
                // Accumulate refunded value rather than overwriting it, so partial
                // refunds add up to the true total.
                const alreadyRefunded = Number(existing?.payment?.refund?.amount || 0);
                const totalRefunded = Number((alreadyRefunded + refundAmount).toFixed(2));
                const orderTotal = Number(existing?.pricing?.total ?? existing?.payment?.amountDue ?? 0);

                // A refund that covers the whole order marks the payment refunded;
                // anything less leaves it paid but partially refunded.
                const isFullRefund = orderTotal > 0 ? totalRefunded + 0.01 >= orderTotal : true;

                const order = await FoodOrder.findOneAndUpdate(
                    {
                        "payment.razorpay.paymentId": rzPaymentId,
                        // Guard against applying the same gateway refund id twice even
                        // if the dedupe row were ever lost.
                        "payment.refund.refundId": { $ne: rzRefundId }
                    },
                    {
                        $set: {
                            ...(isFullRefund ? { "payment.status": 'refunded' } : {}),
                            "payment.refund.status": 'processed',
                            "payment.refund.amount": totalRefunded,
                            "payment.refund.refundId": rzRefundId,
                            "payment.refund.processedAt": new Date()
                        }
                    },
                    { new: true }
                );

                if (order) {
                    logger.info(
                        `Webhook [refund.processed]: Synced Order ${order.orderId} (type=${order.orderType || 'food'}, refunded=₹${totalRefunded}${isFullRefund ? ', full' : ', partial'})`
                    );
                } else {
                    logger.warn(`Webhook [refund.processed]: Refund ${rzRefundId} already applied to RZ-Payment: ${rzPaymentId}`);
                }
            }
        }

        // --- 🔄 Handle Subscription Events (Recurring) ---
        if (event.startsWith('subscription.')) {
            const subObj = payload.subscription.entity;
            const rzSubId = subObj.id;
            const notes = subObj.notes || {};

            if (notes.type === 'subscription') {
                const headerEventId = req.headers['x-razorpay-event-id'];
                const eventId = String(headerEventId || req.body?.id || '').trim() || null;
                const bodyHash = crypto.createHash('sha256').update(req.rawBody).digest('hex');
                const dedupeKey = eventId ? `razorpay:${eventId}` : `razorpay:${event}:${bodyHash}`;

                const existingEvent = await ProcessedWebhookEvent.findOne({ dedupeKey }).select({ _id: 1 }).lean();
                if (existingEvent) {
                    logger.info(`Webhook [${event}]: Duplicate delivery skipped`, { dedupeKey, rzSubId });
                    return res.status(200).json({ status: 'ok' });
                }

                const now = new Date();

                const subscriptionDoc = await UserSubscription.findOne({ razorpaySubscriptionId: rzSubId })
                    .populate('planId')
                    .exec();

                if (!subscriptionDoc) {
                    logger.error(`Webhook [${event}]: Pending subscription not found`, { rzSubId });
                    return res.status(200).json({ status: 'ok' });
                }

                const plan = subscriptionDoc.planId;
                if (!plan) {
                    logger.error(`Webhook [${event}]: Subscription plan not found for subscription`, { rzSubId, subscriptionId: String(subscriptionDoc._id) });
                    return res.status(200).json({ status: 'ok' });
                }

                const unit = String(plan.durationUnit || '').toLowerCase();
                const value = Number(plan.durationValue || 0);
                if (!unit || !value) {
                    logger.error(`Webhook [${event}]: Invalid plan duration`, { rzSubId, unit, value });
                    return res.status(200).json({ status: 'ok' });
                }

                if (event === 'subscription.activated') {
                    const startDate = now;
                    const expiryDate = dayjs(startDate).add(value, unit).toDate();

                    const updateFields = {
                        status: 'active',
                        startDate,
                        expiryDate,
                        lastRenewedAt: startDate,
                        renewalCount: 0,
                        gracePeriodUntil: null,
                        purchasedPlanName: plan.name,
                        purchasedPrice: plan.price,
                        purchasedDuration: plan.durationValue,
                        purchasedDurationType: plan.durationUnit,
                        'metadata.lastProcessedEventKey': dedupeKey,
                        'metadata.lastProcessedEventType': event,
                        'metadata.lastProcessedAt': now
                    };

                    if (!subscriptionDoc.cancelAtCycleEnd) {
                        updateFields.autoRenew = true;
                        updateFields.cancelAt = null;
                        updateFields.cancelAtCycleEnd = false;
                    }

                    const result = await UserSubscription.updateOne(
                        { _id: subscriptionDoc._id, 'metadata.lastProcessedEventKey': { $ne: dedupeKey } },
                        { $set: updateFields }
                    );

                    if (result.modifiedCount > 0) {
                        try {
                            await ProcessedWebhookEvent.create({
                                source: 'razorpay',
                                dedupeKey,
                                eventId,
                                eventType: event,
                                entityType: 'subscription',
                                entityId: rzSubId,
                                bodyHash
                            });
                        } catch (e) {
                            if (e?.code !== 11000) logger.error(`Webhook [${event}]: Failed to record dedupe`, { error: e?.message });
                        }
                        logger.info(`Webhook [${event}]: Activated subscription`, { rzSubId, expiryDate });
                    } else {
                        logger.info(`Webhook [${event}]: Already processed`, { dedupeKey, rzSubId });
                    }
                }

                if (event === 'subscription.charged') {
                    const base = subscriptionDoc.expiryDate && subscriptionDoc.expiryDate > now ? subscriptionDoc.expiryDate : now;
                    const expiryDate = dayjs(base).add(value, unit).toDate();

                    const updateFields = {
                        status: 'active',
                        expiryDate,
                        lastRenewedAt: now,
                        gracePeriodUntil: null,
                        purchasedPlanName: plan.name,
                        purchasedPrice: plan.price,
                        purchasedDuration: plan.durationValue,
                        purchasedDurationType: plan.durationUnit,
                        'metadata.lastProcessedEventKey': dedupeKey,
                        'metadata.lastProcessedEventType': event,
                        'metadata.lastProcessedAt': now
                    };

                    if (!subscriptionDoc.cancelAtCycleEnd) {
                        updateFields.autoRenew = true;
                        updateFields.cancelAt = null;
                        updateFields.cancelAtCycleEnd = false;
                    }

                    const result = await UserSubscription.updateOne(
                        { _id: subscriptionDoc._id, 'metadata.lastProcessedEventKey': { $ne: dedupeKey } },
                        {
                            $set: updateFields,
                            $inc: { renewalCount: 1 }
                        }
                    );

                    if (result.modifiedCount > 0) {
                        try {
                            await ProcessedWebhookEvent.create({
                                source: 'razorpay',
                                dedupeKey,
                                eventId,
                                eventType: event,
                                entityType: 'subscription',
                                entityId: rzSubId,
                                bodyHash
                            });
                        } catch (e) {
                            if (e?.code !== 11000) logger.error(`Webhook [${event}]: Failed to record dedupe`, { error: e?.message });
                        }
                        logger.info(`Webhook [${event}]: Renewal applied`, { rzSubId, expiryDate });
                    } else {
                        logger.info(`Webhook [${event}]: Already processed`, { dedupeKey, rzSubId });
                    }
                }

                if (event === 'subscription.cancelled') {
                    const cancelAt =
                        subObj.cancel_at ? dayjs.unix(subObj.cancel_at).toDate()
                        : subObj.ended_at ? dayjs.unix(subObj.ended_at).toDate()
                        : now;

                    const result = await UserSubscription.updateOne(
                        { _id: subscriptionDoc._id, 'metadata.lastProcessedEventKey': { $ne: dedupeKey } },
                        {
                            $set: {
                                autoRenew: false,
                                cancelAt,
                                cancelAtCycleEnd: true,
                                'metadata.lastProcessedEventKey': dedupeKey,
                                'metadata.lastProcessedEventType': event,
                                'metadata.lastProcessedAt': now
                            }
                        }
                    );

                    if (result.modifiedCount > 0) {
                        try {
                            await ProcessedWebhookEvent.create({
                                source: 'razorpay',
                                dedupeKey,
                                eventId,
                                eventType: event,
                                entityType: 'subscription',
                                entityId: rzSubId,
                                bodyHash
                            });
                        } catch (e) {
                            if (e?.code !== 11000) logger.error(`Webhook [${event}]: Failed to record dedupe`, { error: e?.message });
                        }
                        logger.info(`Webhook [${event}]: Cancel scheduled (access continues until expiry)`, { rzSubId, cancelAt });
                    } else {
                        logger.info(`Webhook [${event}]: Already processed`, { dedupeKey, rzSubId });
                    }
                }

                if (event === 'subscription.completed') {
                    const result = await UserSubscription.updateOne(
                        { _id: subscriptionDoc._id, 'metadata.lastProcessedEventKey': { $ne: dedupeKey } },
                        {
                            $set: {
                                status: 'expired',
                                autoRenew: false,
                                'metadata.lastProcessedEventKey': dedupeKey,
                                'metadata.lastProcessedEventType': event,
                                'metadata.lastProcessedAt': now
                            }
                        }
                    );

                    if (result.modifiedCount > 0) {
                        try {
                            await ProcessedWebhookEvent.create({
                                source: 'razorpay',
                                dedupeKey,
                                eventId,
                                eventType: event,
                                entityType: 'subscription',
                                entityId: rzSubId,
                                bodyHash
                            });
                        } catch (e) {
                            if (e?.code !== 11000) logger.error(`Webhook [${event}]: Failed to record dedupe`, { error: e?.message });
                        }
                        logger.info(`Webhook [${event}]: Completed -> expired`, { rzSubId });
                    } else {
                        logger.info(`Webhook [${event}]: Already processed`, { dedupeKey, rzSubId });
                    }
                }
            }
        }

        res.status(200).json({ status: 'ok' });
    } catch (err) {
        logger.error(`Razorpay Webhook Logic Error: ${err.message}`);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
