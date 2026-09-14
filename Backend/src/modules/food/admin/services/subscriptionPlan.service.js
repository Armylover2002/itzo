import mongoose from 'mongoose';
import { SubscriptionPlan } from '../models/subscriptionPlan.model.js';
import { UserSubscription } from '../../user/models/userSubscription.model.js';
import { FoodWalletLedger } from '../../subscriptions/models/foodWalletLedger.model.js';
import { FoodDailyPass } from '../../subscriptions/models/foodDailyPass.model.js';
import * as razorpayHelper from '../../orders/helpers/razorpay.helper.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import dayjs from 'dayjs';
import { logger } from '../../../../utils/logger.js';
import { getCache, setCache } from '../../../../utils/cacheManager.js';
import {
    invalidateSubscriptionStatsCache,
    SUBSCRIPTION_ANALYTICS_CACHE_KEY,
    SUBSCRIPTION_OVERVIEW_CACHE_KEY
} from '../utils/subscriptionStatsCache.js';

/**
 * Maps our internal duration units to Razorpay periods.
 */
const mapToRazorpayPeriod = (unit) => {
    const mapping = {
        'DAY': 'daily',
        'WEEK': 'weekly',
        'MONTH': 'monthly',
        'YEAR': 'yearly'
    };
    return mapping[unit];
};

export async function createPlan(data) {
    // 1. Determine Payment Type based on unit
    const paymentType = data.durationUnit === 'DAY' ? 'ONE_TIME' : 'RECURRING';
    
    let razorpayPlanId = null;

    // 2. Create Razorpay Plan for recurring types
    if (paymentType === 'RECURRING') {
        try {
            const rpPlan = await razorpayHelper.createRazorpayPlan({
                name: data.name,
                description: data.description,
                amountPaise: data.price * 100,
                interval: data.durationValue,
                period: mapToRazorpayPeriod(data.durationUnit)
            });
            razorpayPlanId = rpPlan.id;
        } catch (err) {
            throw new Error(`Razorpay Plan Creation Failed: ${err.message}`);
        }
    }

    // 3. Save to DB only after RP success
    const plan = await SubscriptionPlan.create({
        ...data,
        paymentType,
        razorpayPlanId
    });

    invalidateSubscriptionStatsCache();
    return plan;
}

export async function updatePlan(id, updates) {
    const oldPlan = await SubscriptionPlan.findOne({ _id: id, isDeleted: false });
    if (!oldPlan) throw new NotFoundError('Subscription plan not found');

    // 📂 CASE 1: RECURRING PRICE CHANGE (Versioning Required)
    const isPriceChanging = updates.price !== undefined && Number(updates.price) !== oldPlan.price;
    
    if (oldPlan.paymentType === 'RECURRING' && isPriceChanging) {
        try {
            // 1. Create NEW Razorpay Plan
            const rpPlan = await razorpayHelper.createRazorpayPlan({
                name: updates.name || oldPlan.name,
                description: updates.description || oldPlan.description,
                amountPaise: Number(updates.price) * 100,
                interval: oldPlan.durationValue,
                period: mapToRazorpayPeriod(oldPlan.durationUnit)
            });

            // 2. Mark OLD plan as inactive
            oldPlan.isActive = false;
            await oldPlan.save();

            // 3. Create NEW MongoDB document (New Version)
            const newPlan = await SubscriptionPlan.create({
                ...oldPlan.toObject(),
                ...updates,
                _id: undefined, // New ID
                razorpayPlanId: rpPlan.id,
                isActive: updates.isActive !== undefined ? updates.isActive : true,
                createdAt: undefined,
                updatedAt: undefined
            });

            invalidateSubscriptionStatsCache();
            return newPlan;
        } catch (err) {
            throw new Error(`Failed to version plan on Razorpay: ${err.message}`);
        }
    }

    // 📂 CASE 2: METADATA OR ONE-TIME UPDATE (Safe Mutation)
    Object.assign(oldPlan, updates);
    await oldPlan.save();
    invalidateSubscriptionStatsCache();
    return oldPlan;
}

export async function listPlans(query = {}) {
    const filter = { isDeleted: false };
    if (query.userType) filter.userType = query.userType;
    
    // Default: Show only active plans unless includeInactive is explicitly true
    if (query.includeInactive !== 'true') {
        filter.isActive = true;
    }

    return SubscriptionPlan.find(filter).sort({ createdAt: -1 }).lean();
}

export async function deletePlan(id) {
    const plan = await SubscriptionPlan.findByIdAndUpdate(
        id, 
        { isDeleted: true, isActive: false }, 
        { new: true }
    );
    if (!plan) throw new NotFoundError('Plan not found');
    invalidateSubscriptionStatsCache();
    return plan;
}

/**
 * ✅ NEW: Process Expiry and Grace Periods for all subscriptions.
 * Called hourly via Cron.
 */
export async function processSubscriptionExpiry() {
    const now = new Date();

    // 0. Cleanup stale PENDING (older than 30 mins) to avoid infinite pending records.
    // Webhook activation can still re-activate the doc if payment succeeds later.
    const pendingCutoff = dayjs(now).subtract(30, 'minutes').toDate();
    const pendingCleanup = await UserSubscription.updateMany(
        {
            status: 'pending',
            createdAt: { $lt: pendingCutoff }
        },
        {
            $set: {
                status: 'failed',
                'metadata.pendingFailedAt': now,
                'metadata.pendingFailedReason': 'pending_timeout'
            }
        }
    );
    if (pendingCleanup.modifiedCount > 0) {
        logger.info(`Subscription Lifecycle: Marked ${pendingCleanup.modifiedCount} stale PENDING as FAILED`);
    }

    // 1. Move ACTIVE -> EXPIRED immediately if cancelAtCycleEnd is true (no grace period)
    const cancelledToExpired = await UserSubscription.updateMany(
        {
            status: 'active',
            cancelAtCycleEnd: true,
            expiryDate: { $lt: now }
        },
        {
            $set: {
                status: 'expired'
            }
        }
    );
    if (cancelledToExpired.modifiedCount > 0) {
        logger.info(`Subscription Lifecycle: Marked ${cancelledToExpired.modifiedCount} cancelled-at-cycle-end subscriptions as EXPIRED`);
    }

    // 2. Move standard ACTIVE -> GRACE (if expiry reached and cancelAtCycleEnd is not true)
    const toGrace = await UserSubscription.updateMany(
        {
            status: 'active',
            cancelAtCycleEnd: { $ne: true },
            expiryDate: { $lt: now }
        },
        {
            $set: {
                status: 'grace',
                gracePeriodUntil: dayjs().add(24, 'hours').toDate()
            }
        }
    );
    if (toGrace.modifiedCount > 0) {
        logger.info(`Subscription Lifecycle: Moved ${toGrace.modifiedCount} to GRACE state`);
    }

    // 3. Move GRACE -> EXPIRED (if grace window closed)
    const toExpired = await UserSubscription.updateMany(
        {
            status: 'grace',
            gracePeriodUntil: { $lt: now }
        },
        {
            $set: { status: 'expired' }
        }
    );
    if (toExpired.modifiedCount > 0) {
        logger.info(`Subscription Lifecycle: Marked ${toExpired.modifiedCount} as EXPIRED`);
    }

    const changed =
        pendingCleanup.modifiedCount > 0 ||
        cancelledToExpired.modifiedCount > 0 ||
        toGrace.modifiedCount > 0 ||
        toExpired.modifiedCount > 0;
    if (changed) {
        invalidateSubscriptionStatsCache();
    }

    return { 
        toGrace: toGrace.modifiedCount, 
        toExpired: toExpired.modifiedCount + cancelledToExpired.modifiedCount 
    };
}

export async function getSubscriptionOverview() {
    const cacheKey = SUBSCRIPTION_OVERVIEW_CACHE_KEY;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const startOfToday = dayjs().startOf('day').toDate();
    const endOfToday = dayjs().endOf('day').toDate();

    const activeRestaurantCount = await UserSubscription.countDocuments({
        userType: 'RESTAURANT',
        status: 'active'
    });
    const activeDeliveryCount = await UserSubscription.countDocuments({
        userType: 'DELIVERY_PARTNER',
        status: 'active'
    });

    const threeDaysFromNow = dayjs().add(3, 'days').toDate();
    const expiringSoonCount = await UserSubscription.countDocuments({
        status: 'active',
        expiryDate: { $gte: now, $lte: threeDaysFromNow }
    });

    const directPaymentsAgg = await UserSubscription.aggregate([
        { $match: { status: { $in: ['active', 'grace', 'expired', 'cancelled'] } } },
        {
            $lookup: {
                from: 'food_subscription_plans',
                localField: 'planId',
                foreignField: '_id',
                as: 'plan'
            }
        },
        { $unwind: { path: '$plan', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                price: { $ifNull: ['$purchasedPrice', '$plan.price'] },
                renewalCount: { $ifNull: ['$renewalCount', 0] },
                createdAt: 1
            }
        },
        {
            $project: {
                totalPaid: { $multiply: ['$price', { $add: ['$renewalCount', 1] }] },
                todayPaid: {
                    $cond: {
                        if: { $and: [{ $gte: ['$createdAt', startOfToday] }, { $lte: ['$createdAt', endOfToday] }] },
                        then: { $multiply: ['$price', { $add: ['$renewalCount', 1] }] },
                        else: 0
                    }
                }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$totalPaid' },
                today: { $sum: '$todayPaid' }
            }
        }
    ]);

    const walletTopupsAgg = await FoodWalletLedger.aggregate([
        { $match: { type: 'TOPUP' } },
        {
            $group: {
                _id: null,
                total: { $sum: '$amount' },
                today: {
                    $sum: {
                        $cond: {
                            if: { $and: [{ $gte: ['$createdAt', startOfToday] }, { $lte: ['$createdAt', endOfToday] }] },
                            then: '$amount',
                            else: 0
                        }
                    }
                }
            }
        }
    ]);

    const dailyPassSpendAgg = await FoodWalletLedger.aggregate([
        { $match: { type: 'DAILY_DEDUCTION' } },
        {
            $group: {
                _id: null,
                total: { $sum: '$amount' }
            }
        }
    ]);

    const directTotal = directPaymentsAgg[0]?.total || 0;
    const directToday = directPaymentsAgg[0]?.today || 0;

    const topupTotal = walletTopupsAgg[0]?.total || 0;
    const topupToday = walletTopupsAgg[0]?.today || 0;

    const dailyPassSpend = dailyPassSpendAgg[0]?.total || 0;
    const oneDayPassCount = await FoodDailyPass.countDocuments({});

    const totalRevenue = directTotal + topupTotal;
    const todayRevenue = directToday + topupToday;

    const stats = {
        totalRevenue,
        todayRevenue,
        activeSubscribers: {
            total: activeRestaurantCount + activeDeliveryCount,
            restaurants: activeRestaurantCount,
            deliveryPartners: activeDeliveryCount
        },
        oneDayPassCount,
        oneDayPassSpend: dailyPassSpend,
        walletRechargeRevenue: topupTotal,
        recurringPlanRevenue: directTotal,
        expiringSoon: expiringSoonCount
    };

    setCache(cacheKey, stats, 30000);
    return stats;
}

export async function getSubscriptionHistory(query, res) {
    const pageNum = parseInt(query.page) || 1;
    const limitNum = parseInt(query.limit) || 10;
    const skipNum = (pageNum - 1) * limitNum;

    const { search, userType, type, status, startDate, endDate, export: exportData } = query;

    let ownerIdsFilter = null;
    if (search) {
        const isEmail = search.includes('@');
        const isPhone = /^\+?\d+$/.test(search);
        
        if (isEmail) {
            const rIds = await mongoose.model('FoodRestaurant').find({ ownerEmail: search }).distinct('_id');
            const dIds = await mongoose.model('FoodDeliveryPartner').find({ email: search }).distinct('_id');
            ownerIdsFilter = [...rIds, ...dIds];
        } else if (isPhone) {
            const rIds = await mongoose.model('FoodRestaurant').find({ ownerPhone: search }).distinct('_id');
            const dIds = await mongoose.model('FoodDeliveryPartner').find({ phone: search }).distinct('_id');
            ownerIdsFilter = [...rIds, ...dIds];
        } else {
            const regex = { $regex: search, $options: 'i' };
            const rIds = await mongoose.model('FoodRestaurant').find({
                $or: [{ restaurantName: regex }, { ownerName: regex }]
            }).distinct('_id');
            const dIds = await mongoose.model('FoodDeliveryPartner').find({ name: regex }).distinct('_id');
            ownerIdsFilter = [...rIds, ...dIds];
        }
    }

    let dateFilter = {};
    if (startDate && endDate) {
        dateFilter = {
            $gte: dayjs(startDate).startOf('day').toDate(),
            $lte: dayjs(endDate).endOf('day').toDate()
        };
    }

    const ledgerMatch = {};
    if (ownerIdsFilter) {
        ledgerMatch.ownerId = { $in: ownerIdsFilter };
    }
    if (userType && userType !== 'All') {
        ledgerMatch.ownerType = userType;
    }
    if (Object.keys(dateFilter).length > 0) {
        ledgerMatch.createdAt = dateFilter;
    }
    
    if (type && type !== 'All') {
        if (type === 'TOPUP') {
            ledgerMatch.type = 'TOPUP';
        } else if (type === 'DAILY_DEDUCTION') {
            ledgerMatch.type = 'DAILY_DEDUCTION';
        } else {
            ledgerMatch.type = '__NONE__';
        }
    } else {
        ledgerMatch.type = { $in: ['TOPUP', 'DAILY_DEDUCTION'] };
    }

    const subMatch = { status: { $in: ['active', 'grace', 'expired', 'cancelled'] } };
    if (ownerIdsFilter) {
        subMatch.$or = [
            { restaurantId: { $in: ownerIdsFilter } },
            { deliveryBoyId: { $in: ownerIdsFilter } }
        ];
    }
    if (userType && userType !== 'All') {
        subMatch.userType = userType;
    }
    if (Object.keys(dateFilter).length > 0) {
        subMatch.startDate = dateFilter;
    }
    if (status && status !== 'All') {
        if (status === 'expiring') {
            const threeDays = dayjs().add(3, 'days').toDate();
            subMatch.status = 'active';
            subMatch.expiryDate = { $gte: new Date(), $lte: threeDays };
        } else {
            subMatch.status = status.toLowerCase();
        }
    }

    const ledgerPipeline = [
        { $match: ledgerMatch },
        {
            $project: {
                userId: '$ownerId',
                userType: '$ownerType',
                planName: { $cond: [{ $eq: ['$type', 'DAILY_DEDUCTION'] }, 'One Day Pass', 'Wallet Topup'] },
                amountPaid: '$amount',
                beforeBalance: '$beforeBalance',
                afterBalance: '$afterBalance',
                paymentMethod: { $cond: [{ $eq: ['$type', 'DAILY_DEDUCTION'] }, 'Wallet', 'Razorpay'] },
                purchaseDate: '$createdAt',
                expiryDate: { $cond: [{ $eq: ['$type', 'DAILY_DEDUCTION'] }, '$createdAt', null] },
                status: { $cond: [{ $eq: ['$type', 'DAILY_DEDUCTION'] }, 'Expired', 'Active'] },
                referenceType: { $cond: [{ $eq: ['$type', 'DAILY_DEDUCTION'] }, 'DAY_PASS', 'TOPUP'] },
                subscriptionSource: { $cond: [{ $eq: ['$ownerType', 'RESTAURANT'] }, 'Restaurant Wallet', 'Delivery Wallet'] },
                purchaseTrigger: { $cond: [{ $eq: ['$type', 'DAILY_DEDUCTION'] }, 'Auto Daily Pass', 'Wallet Recharge'] },
                transactionId: '$referenceId',
                isLegacyPricing: { $literal: false }
            }
        }
    ];

    const subUnionPipeline = [
        { $match: subMatch }
    ];

    if (type && type !== 'All') {
        if (type === 'WEEKLY_SUBSCRIPTION' || type === 'MONTHLY_SUBSCRIPTION') {
            // Include direct plans matching units
        } else if (type === 'TOPUP' || type === 'DAILY_DEDUCTION') {
            subUnionPipeline.push({ $match: { _id: null } });
        }
    }

    subUnionPipeline.push(
        { $lookup: { from: 'food_subscription_plans', localField: 'planId', foreignField: '_id', as: 'p' } },
        {
            $project: {
                userId: { $ifNull: ['$restaurantId', '$deliveryBoyId'] },
                userType: '$userType',
                planName: { $ifNull: ['$purchasedPlanName', { $arrayElemAt: ['$p.name', 0] }] },
                amountPaid: { $ifNull: ['$purchasedPrice', { $arrayElemAt: ['$p.price', 0] }] },
                beforeBalance: { $literal: 0 },
                afterBalance: { $literal: 0 },
                paymentMethod: { $literal: 'Razorpay' },
                purchaseDate: '$startDate',
                expiryDate: '$expiryDate',
                status: {
                    $cond: [
                        { $eq: ['$status', 'active'] }, 'Active',
                        { $cond: [{ $eq: ['$status', 'grace'] }, 'Grace',
                          { $cond: [{ $eq: ['$status', 'expired'] }, 'Expired', 'Cancelled'] }
                        ]}
                    ]
                },
                durationUnit: { $ifNull: ['$purchasedDurationType', { $arrayElemAt: ['$p.durationUnit', 0] }] },
                referenceType: {
                    $cond: [
                        { $eq: [{ $ifNull: ['$purchasedDurationType', { $arrayElemAt: ['$p.durationUnit', 0] }] }, 'WEEK'] },
                        'WEEK_PLAN',
                        'MONTH_PLAN'
                    ]
                },
                subscriptionSource: { $literal: 'Direct Razorpay' },
                purchaseTrigger: { $cond: ['$autoRenew', 'Auto Renewal', 'Manual Plan Purchase'] },
                transactionId: { $ifNull: ['$razorpayPaymentId', '$razorpaySubscriptionId'] },
                isLegacyPricing: {
                    $cond: [
                        { $and: [
                            { $eq: ['$purchasedPrice', null] },
                            { $gt: [{ $size: '$p' }, 0] }
                        ] },
                        true,
                        false
                    ]
                }
            }
        }
    );

    if (type && type !== 'All') {
        if (type === 'WEEKLY_SUBSCRIPTION') {
            subUnionPipeline.push({ $match: { durationUnit: 'WEEK' } });
        } else if (type === 'MONTHLY_SUBSCRIPTION') {
            subUnionPipeline.push({ $match: { durationUnit: 'MONTH' } });
        }
    }

    const pipeline = [
        ...ledgerPipeline,
        { $unionWith: { coll: 'food_user_subscriptions', pipeline: subUnionPipeline } },
        { $sort: { purchaseDate: -1 } }
    ];

    if (exportData === 'true') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=subscription_history.csv');
        res.write("Date,User Name,Email,Phone,Wallet Type,Ref Type,Source,Trigger,Amount,Before Bal,After Bal,Payment Method,Transaction ID,Status,Legacy Pricing\n");

        pipeline.push(
            { $lookup: { from: 'food_restaurants', localField: 'userId', foreignField: '_id', as: 'r' } },
            { $lookup: { from: 'food_delivery_partners', localField: 'userId', foreignField: '_id', as: 'd' } },
            {
                $project: {
                    purchaseDate: 1, planName: 1, userType: 1, referenceType: 1, subscriptionSource: 1,
                    purchaseTrigger: 1, amountPaid: 1, beforeBalance: 1, afterBalance: 1, paymentMethod: 1,
                    transactionId: 1, status: 1, isLegacyPricing: 1,
                    userName: {
                        $cond: [
                            { $eq: ['$userType', 'RESTAURANT'] },
                            { $ifNull: [{ $arrayElemAt: ['$r.restaurantName', 0] }, { $arrayElemAt: ['$r.ownerName', 0] }] },
                            { $arrayElemAt: ['$d.name', 0] }
                        ]
                    },
                    userEmail: {
                        $cond: [{ $eq: ['$userType', 'RESTAURANT'] }, { $arrayElemAt: ['$r.ownerEmail', 0] }, { $arrayElemAt: ['$d.email', 0] }]
                    },
                    userPhone: {
                        $cond: [{ $eq: ['$userType', 'RESTAURANT'] }, { $arrayElemAt: ['$r.ownerPhone', 0] }, { $arrayElemAt: ['$d.phone', 0] }]
                    }
                }
            }
        );

        const cursor = FoodWalletLedger.aggregate(pipeline).cursor({ batchSize: 1000 });
        await cursor.eachAsync(async (doc) => {
            const formattedDate = doc.purchaseDate ? dayjs(doc.purchaseDate).format('YYYY-MM-DD HH:mm:ss') : '';
            const userName = (doc.userName || '').replace(/"/g, '""');
            const userEmail = doc.userEmail || '';
            const userPhone = doc.userPhone || '';
            const userTypeStr = doc.userType === 'RESTAURANT' ? 'Restaurant' : 'Delivery';
            const legacyPricing = doc.isLegacyPricing ? 'Yes' : 'No';
            res.write(`"${formattedDate}","${userName}","${userEmail}","${userPhone}","${userTypeStr}","${doc.referenceType}","${doc.subscriptionSource}","${doc.purchaseTrigger}","${doc.amountPaid}","${doc.beforeBalance}","${doc.afterBalance}","${doc.paymentMethod}","${doc.transactionId}","${doc.status}","${legacyPricing}"\n`);
        });

        res.end();
        return null;
    }

    const countPipeline = [
        ...pipeline,
        { $count: 'total' }
    ];
    const countResult = await FoodWalletLedger.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    pipeline.push({ $skip: skipNum }, { $limit: limitNum });

    pipeline.push(
        { $lookup: { from: 'food_restaurants', localField: 'userId', foreignField: '_id', as: 'r' } },
        { $lookup: { from: 'food_delivery_partners', localField: 'userId', foreignField: '_id', as: 'd' } },
        { $lookup: { from: 'food_restaurant_wallets', localField: 'userId', foreignField: 'restaurantId', as: 'rw' } },
        { $lookup: { from: 'food_delivery_wallets', localField: 'userId', foreignField: 'deliveryPartnerId', as: 'dw' } },
        {
            $project: {
                userId: 1, userType: 1, planName: 1, amountPaid: 1, beforeBalance: 1, afterBalance: 1,
                paymentMethod: 1, purchaseDate: 1, expiryDate: 1, status: 1, referenceType: 1,
                subscriptionSource: 1, purchaseTrigger: 1, transactionId: 1, isLegacyPricing: 1,
                userName: {
                    $cond: [
                        { $eq: ['$userType', 'RESTAURANT'] },
                        { $ifNull: [{ $arrayElemAt: ['$r.restaurantName', 0] }, { $arrayElemAt: ['$r.ownerName', 0] }] },
                        { $arrayElemAt: ['$d.name', 0] }
                    ]
                },
                userEmail: {
                    $cond: [{ $eq: ['$userType', 'RESTAURANT'] }, { $arrayElemAt: ['$r.ownerEmail', 0] }, { $arrayElemAt: ['$d.email', 0] }]
                },
                userPhone: {
                    $cond: [{ $eq: ['$userType', 'RESTAURANT'] }, { $arrayElemAt: ['$r.ownerPhone', 0] }, { $arrayElemAt: ['$d.phone', 0] }]
                },
                currentWalletBalance: {
                    $cond: [
                        { $eq: ['$userType', 'RESTAURANT'] },
                        { $ifNull: [{ $arrayElemAt: ['$rw.subscriptionBalance', 0] }, 0] },
                        { $ifNull: [{ $arrayElemAt: ['$dw.subscriptionBalance', 0] }, 0] }
                    ]
                }
            }
        }
    );

    const transactions = await FoodWalletLedger.aggregate(pipeline);

    return {
        transactions,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(total / limitNum)
        }
    };
}

export async function getSubscriptionAnalytics() {
    const cacheKey = SUBSCRIPTION_ANALYTICS_CACHE_KEY;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const thirtyDaysAgo = dayjs().subtract(30, 'days').startOf('day').toDate();

    const dailyRecharges = await FoodWalletLedger.aggregate([
        { $match: { type: 'TOPUP', createdAt: { $gte: thirtyDaysAgo } } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } },
                total: { $sum: "$amount" }
            }
        }
    ]);

    const dailySubscriptions = await UserSubscription.aggregate([
        { $match: { status: { $in: ['active', 'grace', 'expired', 'cancelled'] }, createdAt: { $gte: thirtyDaysAgo } } },
        {
            $lookup: {
                from: 'food_subscription_plans',
                localField: 'planId',
                foreignField: '_id',
                as: 'plan'
            }
        },
        { $unwind: { path: '$plan', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                price: { $ifNull: ['$purchasedPrice', '$plan.price'] },
                renewalCount: { $ifNull: ['$renewalCount', 0] },
                createdAt: 1
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } },
                total: { $sum: { $multiply: ['$price', { $add: ['$renewalCount', 1] }] } }
            }
        }
    ]);

    const trendMap = {};
    for (let i = 29; i >= 0; i--) {
        const dStr = dayjs().subtract(i, 'days').format('YYYY-MM-DD');
        trendMap[dStr] = { date: dStr, revenue: 0, recharge: 0, subscription: 0 };
    }

    dailyRecharges.forEach(item => {
        if (trendMap[item._id]) {
            trendMap[item._id].recharge = item.total;
            trendMap[item._id].revenue += item.total;
        }
    });

    dailySubscriptions.forEach(item => {
        if (trendMap[item._id]) {
            trendMap[item._id].subscription = item.total;
            trendMap[item._id].revenue += item.total;
        }
    });

    const revenueTrend = Object.values(trendMap);

    const walletSplit = await FoodWalletLedger.aggregate([
        { $match: { type: 'TOPUP' } },
        {
            $group: {
                _id: "$ownerType",
                total: { $sum: "$amount" }
            }
        }
    ]);

    const subSplit = await UserSubscription.aggregate([
        { $match: { status: { $in: ['active', 'grace', 'expired', 'cancelled'] } } },
        {
            $lookup: {
                from: 'food_subscription_plans',
                localField: 'planId',
                foreignField: '_id',
                as: 'plan'
            }
        },
        { $unwind: { path: '$plan', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                userType: 1,
                price: { $ifNull: ['$purchasedPrice', '$plan.price'] },
                renewalCount: { $ifNull: ['$renewalCount', 0] }
            }
        },
        {
            $group: {
                _id: "$userType",
                total: { $sum: { $multiply: ['$price', { $add: ['$renewalCount', 1] }] } }
            }
        }
    ]);

    let restRevenue = 0;
    let delRevenue = 0;

    walletSplit.forEach(item => {
        if (item._id === 'RESTAURANT') restRevenue += item.total;
        if (item._id === 'DELIVERY_PARTNER') delRevenue += item.total;
    });

    subSplit.forEach(item => {
        if (item._id === 'RESTAURANT') restRevenue += item.total;
        if (item._id === 'DELIVERY_PARTNER') delRevenue += item.total;
    });

    const dayPassCount = await FoodDailyPass.countDocuments({});
    
    const weekCount = await UserSubscription.aggregate([
        { $match: { status: { $in: ['active', 'grace', 'expired', 'cancelled'] } } },
        { $lookup: { from: 'food_subscription_plans', localField: 'planId', foreignField: '_id', as: 'p' } },
        { $unwind: { path: '$p', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                durationUnit: { $ifNull: ['$purchasedDurationType', '$p.durationUnit'] }
            }
        },
        { $match: { durationUnit: 'WEEK' } },
        { $count: 'total' }
    ]);

    const monthCount = await UserSubscription.aggregate([
        { $match: { status: { $in: ['active', 'grace', 'expired', 'cancelled'] } } },
        { $lookup: { from: 'food_subscription_plans', localField: 'planId', foreignField: '_id', as: 'p' } },
        { $unwind: { path: '$p', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                durationUnit: { $ifNull: ['$purchasedDurationType', '$p.durationUnit'] }
            }
        },
        { $match: { durationUnit: 'MONTH' } },
        { $count: 'total' }
    ]);

    const analytics = {
        revenueTrend,
        userSplit: {
            restaurant: restRevenue,
            deliveryPartner: delRevenue
        },
        planPurchaseSplit: {
            day: dayPassCount,
            week: weekCount[0]?.total || 0,
            month: monthCount[0]?.total || 0
        }
    };

    setCache(cacheKey, analytics, 30000);
    return analytics;
}
