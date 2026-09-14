import { SubscriptionPlan } from '../../admin/models/subscriptionPlan.model.js';
import { UserSubscription } from '../../user/models/userSubscription.model.js';
import * as razorpayHelper from '../../orders/helpers/razorpay.helper.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import crypto from 'crypto';
import { invalidateSubscriptionStatsCache } from '../../admin/utils/subscriptionStatsCache.js';

export async function initiatePurchase(userId, userType, { planId }) {
    const plan = await SubscriptionPlan.findOne({ _id: planId, isDeleted: false, isActive: true });
    if (!plan) throw new NotFoundError('Subscription plan not found or inactive');

    if (plan.userType !== userType) {
        throw new ValidationError('Plan mismatch for user role');
    }

    const restaurantId = userType === 'RESTAURANT' ? userId : null;
    const deliveryBoyId = userType === 'DELIVERY_PARTNER' ? userId : null;
    const ownerFilter = userType === 'RESTAURANT' ? { restaurantId } : { deliveryBoyId };

    // 1. Check if already has an active subscription
    const existing = await UserSubscription.findOne({
        ...ownerFilter,
        status: { $in: ['active', 'grace'] }
    });
    if (existing) throw new ValidationError('You already have an active subscription');

    const PENDING_REUSE_MS = 30 * 60 * 1000;
    const lockWindowMs = 2 * 60 * 1000;
    const lockWaitMs = 5 * 1000;
    const lockPollMs = 250;
    const nowMs = Date.now();

    const getPendingForPlan = async () => {
        return UserSubscription.findOne({ ...ownerFilter, planId: plan._id, status: 'pending' })
            .sort({ createdAt: -1 })
            .exec();
    };

    let pendingDoc = await getPendingForPlan();
    if (pendingDoc?.createdAt) {
        const ageMs = nowMs - new Date(pendingDoc.createdAt).getTime();
        if (ageMs < PENDING_REUSE_MS) {
            if (plan.paymentType === 'ONE_TIME') {
                const pendingOrderId = pendingDoc?.metadata?.razorpayOrderId;
                const pendingAmount = pendingDoc?.metadata?.razorpayOrderAmount;
                if (pendingOrderId && pendingAmount) {
                    return {
                        orderId: pendingOrderId,
                        amount: pendingAmount,
                        key: razorpayHelper.getRazorpayKeyId()
                    };
                }
            } else {
                if (pendingDoc?.razorpaySubscriptionId) {
                    return {
                        subscriptionId: pendingDoc.razorpaySubscriptionId,
                        key: razorpayHelper.getRazorpayKeyId()
                    };
                }
            }
        }
    }

    if (!pendingDoc) {
        try {
            pendingDoc = await UserSubscription.create({
                planId: plan._id,
                userType,
                restaurantId,
                deliveryBoyId,
                status: 'pending',
                metadata: {}
            });
        } catch (e) {
            if (e?.code === 11000) {
                pendingDoc = await getPendingForPlan();
            } else {
                throw e;
            }
        }
    }

    if (!pendingDoc) {
        throw new ValidationError('Unable to create purchase intent');
    }

    const lockId = crypto.randomBytes(16).toString('hex');
    const lockUntil = new Date(Date.now() + lockWindowMs);

    const lockResult = await UserSubscription.updateOne(
        {
            _id: pendingDoc._id,
            status: 'pending',
            planId: plan._id,
            $or: [
                { 'metadata.purchaseLockUntil': { $exists: false } },
                { 'metadata.purchaseLockUntil': null },
                { 'metadata.purchaseLockUntil': { $lt: new Date() } }
            ]
        },
        {
            $set: {
                'metadata.purchaseLockId': lockId,
                'metadata.purchaseLockUntil': lockUntil
            }
        }
    );

    if (lockResult.modifiedCount === 0) {
        const startedAt = Date.now();
        while (Date.now() - startedAt < lockWaitMs) {
            const fresh = await getPendingForPlan();
            if (fresh) {
                if (plan.paymentType === 'ONE_TIME') {
                    const pendingOrderId = fresh?.metadata?.razorpayOrderId;
                    const pendingAmount = fresh?.metadata?.razorpayOrderAmount;
                    if (pendingOrderId && pendingAmount) {
                        return {
                            orderId: pendingOrderId,
                            amount: pendingAmount,
                            key: razorpayHelper.getRazorpayKeyId()
                        };
                    }
                } else {
                    if (fresh?.razorpaySubscriptionId) {
                        return {
                            subscriptionId: fresh.razorpaySubscriptionId,
                            key: razorpayHelper.getRazorpayKeyId()
                        };
                    }
                }
            }
            await new Promise((r) => setTimeout(r, lockPollMs));
        }
        throw new ValidationError('Purchase is already in progress. Please retry.');
    }

    let razorpayData = {};

    // 2. Handle One-Time vs Recurring
    if (plan.paymentType === 'ONE_TIME') {
        const order = await razorpayHelper.createRazorpayOrder(
            plan.price * 100,
            'INR',
            String(pendingDoc._id)
        );

        // 📂 CRITICAL: Create PENDING subscription record for One-Time too (idempotency)
        await UserSubscription.updateOne(
            { _id: pendingDoc._id, status: 'pending', planId: plan._id, 'metadata.purchaseLockId': lockId },
            {
                $set: {
                    razorpayPaymentId: null,
                    'metadata.razorpayOrderId': order.id,
                    'metadata.razorpayOrderAmount': order.amount
                },
                $unset: {
                    'metadata.purchaseLockId': 1,
                    'metadata.purchaseLockUntil': 1
                }
            }
        );

        razorpayData = {
            orderId: order.id,
            amount: order.amount,
            key: razorpayHelper.getRazorpayKeyId()
        };
    } else {
        const sub = await razorpayHelper.createRazorpaySubscription({
            planId: plan.razorpayPlanId,
            customerNotes: {
                planId: String(plan._id),
                restaurantId: restaurantId ? String(restaurantId) : undefined,
                deliveryBoyId: deliveryBoyId ? String(deliveryBoyId) : undefined,
                userType
            }
        });

        // 📂 CRITICAL: Create PENDING subscription record for Recurring
        await UserSubscription.updateOne(
            { _id: pendingDoc._id, status: 'pending', planId: plan._id, 'metadata.purchaseLockId': lockId },
            {
                $set: {
                    razorpaySubscriptionId: sub.id,
                    'metadata.razorpaySubscriptionId': sub.id
                },
                $unset: {
                    'metadata.purchaseLockId': 1,
                    'metadata.purchaseLockUntil': 1
                }
            }
        );

        razorpayData = {
            subscriptionId: sub.id,
            key: razorpayHelper.getRazorpayKeyId()
        };
    }

    return razorpayData;
}

export async function verifyPurchase(userId, userType, data) {
    const { razorpayPaymentId, razorpaySignature, razorpayOrderId, razorpaySubscriptionId } = data;

    // 1. Verify Signature
    let verified = false;
    if (razorpaySubscriptionId) {
        verified = razorpayHelper.verifySubscriptionSignature(
            razorpaySubscriptionId,
            razorpayPaymentId,
            razorpaySignature
        );
    } else {
        verified = razorpayHelper.verifyPaymentSignature(
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature
        );
    }

    if (!verified) throw new ValidationError('Payment signature verification failed');

    // 2. Perform direct DB update to activate the subscription immediately (local/fallback bypass)
    const restaurantId = userType === 'RESTAURANT' ? userId : null;
    const deliveryBoyId = userType === 'DELIVERY_PARTNER' ? userId : null;
    const ownerFilter = userType === 'RESTAURANT' ? { restaurantId } : { deliveryBoyId };

    let query = { ...ownerFilter };
    if (razorpayOrderId) {
        query['metadata.razorpayOrderId'] = razorpayOrderId;
    } else if (razorpaySubscriptionId) {
        query.razorpaySubscriptionId = razorpaySubscriptionId;
    }

    const doc = await UserSubscription.findOne(query).populate('planId');
    if (doc) {
        const plan = doc.planId;
        if (plan) {
            const expiryDate = dayjs().add(plan.durationValue, plan.durationUnit.toLowerCase()).toDate();
            
            if (razorpayOrderId) {
                await UserSubscription.updateOne(
                    { _id: doc._id },
                    {
                        $set: {
                            razorpayPaymentId,
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
            } else {
                await UserSubscription.updateOne(
                    { _id: doc._id },
                    {
                        $set: {
                            razorpayPaymentId,
                            status: 'active',
                            startDate: new Date(),
                            expiryDate,
                            lastRenewedAt: new Date(),
                            renewalCount: 0,
                            autoRenew: true,
                            gracePeriodUntil: null,
                            cancelAt: null,
                            cancelAtCycleEnd: false,
                            purchasedPlanName: plan.name,
                            purchasedPrice: plan.price,
                            purchasedDuration: plan.durationValue,
                            purchasedDurationType: plan.durationUnit
                        }
                    }
                );
            }
        }
        invalidateSubscriptionStatsCache();
    }

    return { verified: true };
}

export async function getActiveSubscription(userId, userType) {
    const query = { status: { $in: ['active', 'grace'] } };
    if (userType === 'RESTAURANT') {
        query.restaurantId = userId;
    } else {
        query.deliveryBoyId = userId;
    }

    return UserSubscription.findOne(query).populate('planId').lean();
}

export async function cancelAutoRenew(userId, userType) {
    const query = { status: 'active' };
    if (userType === 'RESTAURANT') {
        query.restaurantId = userId;
    } else {
        query.deliveryBoyId = userId;
    }

    // 1. Fetch only the subscription with status === "active" for the user. Do NOT fetch subscriptions in grace status.
    const sub = await UserSubscription.findOne(query);

    if (!sub) {
        throw new ValidationError('No active subscription found. Cancellation is only allowed for active subscriptions.');
    }

    // 2. Validate subscription type (recurring only; has razorpaySubscriptionId and is not a one-time plan; throw validation error otherwise).
    if (!sub.razorpaySubscriptionId) {
        throw new ValidationError('This plan does not support recurring billing auto-renewal.');
    }

    // 3. Validate that cancelAtCycleEnd is not already true.
    if (sub.cancelAtCycleEnd) {
        throw new ValidationError('Auto-renewal is already cancelled for this subscription.');
    }

    // 4. Invoke razorpayHelper.cancelRazorpaySubscription(razorpaySubscriptionId, true) to cancel the subscription on Razorpay at the end of the cycle.
    await razorpayHelper.cancelRazorpaySubscription(sub.razorpaySubscriptionId, true);

    // 5. Perform an immediate MongoDB update: set autoRenew = false, cancelAtCycleEnd = true, and cancelAt = new Date().
    sub.autoRenew = false;
    sub.cancelAtCycleEnd = true;
    sub.cancelAt = new Date();
    await sub.save();

    return sub;
}
