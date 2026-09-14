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
import { OnboardingPaymentLog } from '../../../modules/common/models/onboardingPaymentLog.model.js';
import { processOrderPostPaymentFulfillment } from '../../../modules/food/orders/services/order.service.js';
import { QuickOrder } from '../../../modules/quick-commerce/models/order.model.js';
import { fanOutQuickSellerOrdersForParent } from '../../../modules/quick-commerce/services/quickSellerOrderFanout.service.js';

import * as walletService from '../../../modules/food/subscriptions/services/wallet.service.js';
import { invalidateSubscriptionStatsCache } from '../../../modules/food/admin/utils/subscriptionStatsCache.js';
import { sendNotificationToOwners } from '../../../core/notifications/firebase.service.js';

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
                    invalidateSubscriptionStatsCache();
                }
                return res.status(200).json({ status: 'ok' });
            }

            // 📂 CASE B: Regular Food Order
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
                // ✅ UPDATED: Wrapped in try-catch to prevent secondary failures from breaking the webhook response
                try {
                    await foodTransactionService.updateTransactionStatus(order._id, 'captured', {
                        status: 'captured',
                        razorpayPaymentId: rzPaymentId,
                        note: 'Payment status synced via Webhook (payment.captured)'
                    });
                    await processOrderPostPaymentFulfillment(order, { notifyCustomer: false });
                } catch (ledgerErr) {
                    logger.error(`Webhook Ledger Error (Order ${order.orderId}): ${ledgerErr.message}`);
                    return res.status(500).json({ message: 'Ledger sync failed; retrying webhook' });
                }
                logger.info(`Webhook [payment.captured]: Synced Order ${order.orderId} (Status=paid)`);
            } else {
                const existingPaidOrder = await FoodOrder.findOne({
                    "payment.razorpay.orderId": rzOrderId,
                    "payment.status": 'paid',
                });

                if (existingPaidOrder) {
                    try {
                        await foodTransactionService.updateTransactionStatus(existingPaidOrder._id, 'captured', {
                            status: 'captured',
                            razorpayPaymentId: rzPaymentId,
                            note: 'Payment status re-synced via Webhook retry (payment.captured)',
                        });
                        await processOrderPostPaymentFulfillment(existingPaidOrder, { notifyCustomer: false });
                        logger.info(`Webhook [payment.captured]: Re-synced paid Order ${existingPaidOrder.orderId} on retry`);
                    } catch (retryLedgerErr) {
                        logger.error(`Webhook Retry Ledger Error (Order ${existingPaidOrder.orderId}): ${retryLedgerErr.message}`);
                        return res.status(500).json({ message: 'Ledger sync failed; retrying webhook' });
                    }
                } else {
                    // ✅ ADDED: Log warn if order not found but payment was captured
                    logger.warn(`Webhook [payment.captured]: Order not found for RZ-Order: ${rzOrderId}`);
                }
            }

            // 📂 CASE C: Onboarding Payment
            const onboardingLog = await OnboardingPaymentLog.findOneAndUpdate(
                { 
                    razorpayOrderId: rzOrderId,
                    status: { $ne: 'success' }
                },
                { 
                    $set: { 
                        status: 'success', 
                        razorpayPaymentId: rzPaymentId,
                        razorpaySignature: 'webhook_verified'
                    } 
                },
                { new: true }
            );

            if (onboardingLog) {
                logger.info(`Webhook [payment.captured]: Synced Onboarding Payment Log for Order ${rzOrderId} (Status=success)`);
            }

            // 📂 CASE D: Quick Commerce Order
            const quickOrder = await QuickOrder.findOneAndUpdate(
                {
                    'payment.razorpay.orderId': rzOrderId,
                    'payment.status': { $ne: 'paid' },
                },
                {
                    $set: {
                        'payment.status': 'paid',
                        'payment.razorpay.paymentId': rzPaymentId,
                    },
                },
                { new: true },
            );
            if (quickOrder) {
                try {
                    await foodTransactionService.updateTransactionStatus(quickOrder._id, 'captured', {
                        status: 'captured',
                        razorpayPaymentId: rzPaymentId,
                        note: 'Quick payment synced via webhook',
                    });
                } catch (txnErr) {
                    logger.error(`Webhook quick txn sync failed for ${quickOrder.orderId}: ${txnErr?.message || txnErr}`);
                }
                try {
                    await fanOutQuickSellerOrdersForParent(quickOrder);
                } catch (fanoutErr) {
                    logger.error(`Webhook quick seller fanout failed for ${quickOrder.orderId}: ${fanoutErr?.message || fanoutErr}`);
                }
                logger.info(`Webhook [payment.captured]: Synced Quick Order ${quickOrder.orderId} (Status=paid)`);
            }
        }

        // --- 🔴 Handle Refund Processed ---
        if (event === 'refund.processed') {
            const refundObj = payload.refund.entity;
            const rzPaymentId = refundObj.payment_id;
            const rzRefundId = refundObj.id;
            const refundAmount = refundObj.amount / 100; // to major unit

            // Sync refund fields in the order
            const order = await FoodOrder.findOneAndUpdate(
                { 
                    "payment.razorpay.paymentId": rzPaymentId,
                    "payment.refund.status": { $ne: 'processed' }
                },
                { 
                    $set: { 
                        "payment.status": 'refunded',
                        "payment.refund": {
                            status: 'processed',
                            amount: refundAmount,
                            refundId: rzRefundId,
                            processedAt: new Date()
                        }
                    } 
                },
                { new: true }
            );

            if (order) {
                logger.info(`Webhook [refund.processed]: Synced Order ${order.orderId} (Refunded)`);
            } else {
                // ✅ ADDED: Log warn if order not found for refund
                logger.warn(`Webhook [refund.processed]: Order not found or already refunded for RZ-Payment: ${rzPaymentId}`);
            }
        }

        // --- 🔴 Handle Payment Failed ---
        if (event === 'payment.failed') {
            const paymentObj = payload?.payment?.entity || {};
            const rzOrderId = String(paymentObj?.order_id || '').trim();
            const rzPaymentId = String(paymentObj?.id || '').trim();
            const failureReason =
                String(paymentObj?.error_description || paymentObj?.error_reason || paymentObj?.error_code || '').trim()
                || 'Payment failed';

            if (rzOrderId) {
                const order = await FoodOrder.findOneAndUpdate(
                    {
                        'payment.razorpay.orderId': rzOrderId,
                        'payment.status': { $nin: ['paid', 'refunded', 'cancelled', 'failed'] },
                    },
                    {
                        $set: {
                            'payment.status': 'failed',
                            ...(rzPaymentId ? { 'payment.razorpay.paymentId': rzPaymentId } : {}),
                        },
                    },
                    { new: true },
                );

                if (order) {
                    try {
                        await foodTransactionService.updateTransactionStatus(order._id, 'failed', {
                            status: 'failed',
                            razorpayPaymentId: rzPaymentId || undefined,
                            note: `Payment failed via webhook: ${failureReason}`,
                        });
                    } catch (txnErr) {
                        logger.error(`Webhook payment.failed transaction sync failed for ${order.orderId}: ${txnErr?.message || txnErr}`);
                    }

                    try {
                        await sendNotificationToOwners(
                            [{ ownerType: 'USER', ownerId: order.userId }],
                            {
                                title: 'Payment Failed',
                                body: `Payment failed for Order #${order.orderId}. Please retry checkout.`,
                                data: {
                                    type: 'payment_failed',
                                    orderId: String(order.orderId),
                                    orderMongoId: String(order._id),
                                    reason: failureReason,
                                },
                            },
                        );
                    } catch (notifyErr) {
                        logger.warn(`Webhook payment.failed notify failed: ${notifyErr?.message || notifyErr}`);
                    }

                    logger.info(`Webhook [payment.failed]: Marked Order ${order.orderId} as failed`);
                } else {
                    logger.warn(`Webhook [payment.failed]: Order not found or not eligible for failure update: ${rzOrderId}`);
                }
            } else {
                logger.warn('Webhook [payment.failed]: Missing razorpay order id');
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
                        invalidateSubscriptionStatsCache();
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
                        invalidateSubscriptionStatsCache();
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
                        invalidateSubscriptionStatsCache();
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
