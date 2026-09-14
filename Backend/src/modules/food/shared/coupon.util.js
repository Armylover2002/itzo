import mongoose from 'mongoose';
import { FoodOrder } from '../orders/models/order.model.js';
import { FoodOffer } from '../admin/models/offer.model.js';

export const CANCELLED_ORDER_STATUSES = [
    'cancelled_by_user',
    'cancelled_by_restaurant',
    'cancelled_by_admin',
    'cancelled_by_system',
];

export async function countEligibleUserOrders(userId, restaurantObjectId = null) {
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) return 0;
    const filter = {
        userId: new mongoose.Types.ObjectId(String(userId)),
        orderStatus: { $nin: CANCELLED_ORDER_STATUSES },
    };
    if (restaurantObjectId) {
        filter.restaurantId = new mongoose.Types.ObjectId(String(restaurantObjectId));
    }
    return FoodOrder.countDocuments(filter);
}

export async function isFirstTimeEligible(userId, restaurantObjectId = null) {
    if (!userId) return true;
    const count = await countEligibleUserOrders(userId, restaurantObjectId);
    return count === 0;
}

/** Admin "all restaurants" = app-wide; selected restaurant / restaurant coupon = that restaurant only. */
export function resolveFirstTimeRestaurantScope(coupon, resolvedRestaurantObjectId = null) {
    if (!coupon) return null;

    if (coupon.restaurantScope === 'all') return null;

    if (coupon.restaurantScope === 'selected') {
        const fromCoupon = coupon.restaurantId?._id || coupon.restaurantId;
        if (fromCoupon && mongoose.Types.ObjectId.isValid(String(fromCoupon))) {
            return new mongoose.Types.ObjectId(String(fromCoupon));
        }
        return resolvedRestaurantObjectId
            ? new mongoose.Types.ObjectId(String(resolvedRestaurantObjectId))
            : null;
    }

    // Restaurant-created coupons have restaurantId and no restaurantScope field.
    const fromCoupon = coupon.restaurantId?._id || coupon.restaurantId;
    if (fromCoupon && mongoose.Types.ObjectId.isValid(String(fromCoupon))) {
        return new mongoose.Types.ObjectId(String(fromCoupon));
    }

    return resolvedRestaurantObjectId
        ? new mongoose.Types.ObjectId(String(resolvedRestaurantObjectId))
        : null;
}

/** @deprecated Prefer importing from restaurantIdentity.util.js — kept as re-export for BC. */
export { resolveRestaurantObjectId } from './restaurantIdentity.util.js';

export function normalizeDiscountType(discountType) {
    const value = String(discountType || '').toLowerCase();
    if (value === 'fixed' || value === 'flat-price' || value === 'flat') return 'flat-price';
    return 'percentage';
}

export function calculateDiscountFromCoupon(coupon, itemSubtotal) {
    const safeSubtotal = Math.max(0, Number(itemSubtotal) || 0);
    if (!coupon || safeSubtotal <= 0) return 0;

    const discountType = normalizeDiscountType(coupon.discountType);
    if (discountType === 'percentage') {
        const raw = safeSubtotal * ((Number(coupon.discountValue) || 0) / 100);
        const maxDiscount = Number(coupon.maxDiscount);
        const capped = Number.isFinite(maxDiscount) && maxDiscount > 0 ? Math.min(raw, maxDiscount) : raw;
        return Math.max(0, Math.min(safeSubtotal, Math.floor(capped)));
    }

    return Math.max(0, Math.min(safeSubtotal, Math.floor(Number(coupon.discountValue) || 0)));
}

export function getCouponMinOrderValue(coupon) {
    return Math.max(0, Number(coupon?.minOrderValue ?? coupon?.minOrderAmount ?? 0) || 0);
}

export function getCouponEndDate(coupon) {
    return coupon?.endDate || coupon?.expiryDate || null;
}

export function getCouponStartDate(coupon) {
    return coupon?.startDate || null;
}

export function isCouponWithinDateWindow(coupon, now = new Date()) {
    const startDate = getCouponStartDate(coupon);
    const endDate = getCouponEndDate(coupon);
    const startOk = !startDate || now >= new Date(startDate);
    if (!startOk) return false;
    if (!endDate) return true;
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return now <= end;
}

export async function countGlobalCouponApplications(couponCode) {
    const code = couponCode ? String(couponCode).trim().toUpperCase() : '';
    if (!code) return 0;

    return FoodOrder.countDocuments({
        orderStatus: { $nin: CANCELLED_ORDER_STATUSES },
        $or: [
            { 'pricing.couponCode': code },
            { 'pricing.appliedCoupon.code': code },
        ],
    });
}

export async function isCouponUsageAvailable(coupon) {
    const usageLimit = Number(coupon?.usageLimit);
    if (!Number.isFinite(usageLimit) || usageLimit <= 0) return true;

    let usedCount = Number(coupon?.usedCount || 0);

    // Count in-flight orders too (usage is only incremented on delivery).
    if (coupon?.couponCode) {
        const appliedOrders = await countGlobalCouponApplications(coupon.couponCode);
        usedCount = Math.max(usedCount, appliedOrders);
    }

    return usedCount < usageLimit;
}

export async function isCouponFirstTimeEligible(coupon, userId, resolvedRestaurantObjectId = null) {
    if (!userId) return true;
    const needsFirstTime =
        coupon?.customerScope === 'first-time' || coupon?.isFirstOrderOnly === true;
    if (!needsFirstTime) return true;

    const scopedRestaurantId = resolveFirstTimeRestaurantScope(coupon, resolvedRestaurantObjectId);
    return isFirstTimeEligible(userId, scopedRestaurantId);
}

/** Default 1 use per user when admin left perUserLimit empty (null/0). */
export function getEffectivePerUserLimit(coupon) {
    const configured = Number(coupon?.perUserLimit);
    if (Number.isFinite(configured) && configured > 0) return configured;
    return 1;
}

export async function countUserCouponApplications(userId, couponCode) {
    if (!userId || !couponCode) return 0;
    const code = String(couponCode).trim().toUpperCase();
    if (!code) return 0;

    return FoodOrder.countDocuments({
        userId: new mongoose.Types.ObjectId(String(userId)),
        orderStatus: { $nin: CANCELLED_ORDER_STATUSES },
        $or: [
            { 'pricing.couponCode': code },
            { 'pricing.appliedCoupon.code': code },
        ],
    });
}

export async function isCouponPerUserAvailable(coupon, userId, usageModel, foreignKeyField) {
    if (!userId || !coupon) return true;

    const perUserLimit = getEffectivePerUserLimit(coupon);
    let usedCount = 0;

    if (usageModel && foreignKeyField && coupon._id) {
        const usage = await usageModel.findOne({
            [foreignKeyField]: coupon._id,
            userId: new mongoose.Types.ObjectId(String(userId)),
        }).lean();
        usedCount = Math.max(usedCount, Number(usage?.count || 0));
    }

    // Also count in-flight / delivered orders that already applied this code
    // (usage is only incremented on delivery).
    if (coupon.couponCode) {
        const appliedOrders = await countUserCouponApplications(userId, coupon.couponCode);
        usedCount = Math.max(usedCount, appliedOrders);
    }

    return usedCount < perUserLimit;
}

export function offerMatchesRestaurant(offer, resolvedRestaurantObjectId) {
    if (!offer || offer.restaurantScope !== 'selected') return true;
    if (!resolvedRestaurantObjectId) return false;
    const target = String(resolvedRestaurantObjectId);
    const directId = offer.restaurantId ? String(offer.restaurantId?._id || offer.restaurantId) : '';
    if (directId && directId === target) return true;
    const ids = Array.isArray(offer.restaurantIds) ? offer.restaurantIds : [];
    return ids.some((id) => String(id?._id || id) === target);
}

export const buildActivePublicOfferFilter = (now = new Date()) => {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    return {
        status: 'active',
        showInCart: { $ne: false },
        $and: [
            { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }] },
            { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: startOfToday } }] },
            {
                $or: [
                    { usageLimit: { $exists: false } },
                    { usageLimit: null },
                    { usageLimit: 0 },
                    { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
                ],
            },
        ],
    };
};

export const buildActiveRestaurantCouponFilter = (now = new Date()) => {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    return {
        status: 'Approved',
        showInCart: { $ne: false },
        $and: [
            { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }] },
            {
                $or: [
                    { endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: startOfToday } },
                    { expiryDate: { $exists: false } }, { expiryDate: null }, { expiryDate: { $gte: startOfToday } },
                ],
            },
            {
                $or: [
                    { usageLimit: { $exists: false } },
                    { usageLimit: null },
                    { usageLimit: 0 },
                    { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
                ],
            },
        ],
    };
};

export async function validateAndApplyCoupon({
    couponCode,
    itemSubtotal,
    userId,
    resolvedRestaurantObjectId,
}) {
    const codeRaw = couponCode ? String(couponCode).trim().toUpperCase() : '';
    if (!codeRaw || itemSubtotal <= 0) {
        return { discount: 0, appliedCoupon: null };
    }

    const now = new Date();
    const { FoodOfferUsage } = await import('../admin/models/offerUsage.model.js');
    const { RestaurantCoupon } = await import('../admin/models/restaurantCoupon.model.js');
    const { RestaurantCouponUsage } = await import('../admin/models/restaurantCouponUsage.model.js');

    const offer = await FoodOffer.findOne({ couponCode: codeRaw }).lean();
    if (offer) {
        const statusOk = offer.status === 'active' && offer.showInCart !== false;
        const scopeOk = offerMatchesRestaurant(offer, resolvedRestaurantObjectId);
        const minOk = itemSubtotal >= getCouponMinOrderValue(offer);
        const dateOk = isCouponWithinDateWindow(offer, now);
        const usageOk = await isCouponUsageAvailable(offer);

        let perUserOk = true;
        if (userId) {
            perUserOk = await isCouponPerUserAvailable(offer, userId, FoodOfferUsage, 'offerId');
        }
        let firstOrderOk = true;
        if (userId) {
            firstOrderOk = await isCouponFirstTimeEligible(offer, userId, resolvedRestaurantObjectId);
        }

        const allowed = statusOk && scopeOk && minOk && dateOk && usageOk && perUserOk && firstOrderOk;
        if (allowed) {
            const discount = calculateDiscountFromCoupon(offer, itemSubtotal);
            return {
                discount,
                appliedCoupon: {
                    code: codeRaw,
                    discount,
                    source: 'admin',
                },
            };
        }
        return { discount: 0, appliedCoupon: null };
    }

    if (!resolvedRestaurantObjectId) {
        return { discount: 0, appliedCoupon: null };
    }

    const restCoupon = await RestaurantCoupon.findOne({
        couponCode: codeRaw,
        status: 'Approved',
        restaurantId: resolvedRestaurantObjectId,
    }).lean();

    if (!restCoupon || restCoupon.showInCart === false) {
        return { discount: 0, appliedCoupon: null };
    }

    const minOk = itemSubtotal >= getCouponMinOrderValue(restCoupon);
    const dateOk = isCouponWithinDateWindow(restCoupon, now);
    const usageOk = await isCouponUsageAvailable(restCoupon);

    let perUserOk = true;
    if (userId) {
        perUserOk = await isCouponPerUserAvailable(restCoupon, userId, RestaurantCouponUsage, 'couponId');
    }
    let firstOrderOk = true;
    if (userId) {
        firstOrderOk = await isCouponFirstTimeEligible(restCoupon, userId, resolvedRestaurantObjectId);
    }

    const allowed = minOk && dateOk && usageOk && perUserOk && firstOrderOk;
    if (!allowed) {
        return { discount: 0, appliedCoupon: null };
    }

    const discount = calculateDiscountFromCoupon(restCoupon, itemSubtotal);
    return {
        discount,
        appliedCoupon: {
            code: codeRaw,
            discount,
            source: 'restaurant',
        },
    };
}

export function getCouponCartEligibility(coupon, numericSubtotal) {
    const minOrderValue = getCouponMinOrderValue(coupon);
    const hasSubtotal = Number.isFinite(numericSubtotal) && numericSubtotal > 0;
    const meetsMinOrder = minOrderValue <= 0 || (hasSubtotal && numericSubtotal >= minOrderValue);
    const amountToUnlock = meetsMinOrder
        ? 0
        : Math.max(0, Math.ceil(minOrderValue - (hasSubtotal ? numericSubtotal : 0)));
    const estimatedDiscount = meetsMinOrder && hasSubtotal
        ? calculateDiscountFromCoupon(coupon, numericSubtotal)
        : 0;
    const isFlatDiscount = normalizeDiscountType(coupon?.discountType) === 'flat-price';
    const displayDiscount = isFlatDiscount
        ? Math.max(0, Math.floor(Number(coupon?.discountValue) || 0))
        : estimatedDiscount;
    return { minOrderValue, meetsMinOrder, amountToUnlock, estimatedDiscount, displayDiscount };
}

const COUPON_USAGE_LIMIT_GATE = [
    { usageLimit: { $exists: false } },
    { usageLimit: null },
    { usageLimit: 0 },
    { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
];

/** Increment coupon usage only when an order is delivered (not on place/cancel). */
export async function consumeOrderCouponUsageOnDelivery(order, userId = null) {
    if (!order) return;

    const status = String(order.orderStatus || '').toLowerCase();
    if (status !== 'delivered') return;

    const couponCode = order?.pricing?.couponCode
        ? String(order.pricing.couponCode).trim().toUpperCase()
        : '';
    if (!couponCode) return;

    const orderType = String(order?.orderType || '').toLowerCase();
    if (!['food', 'mixed'].includes(orderType)) return;

    // Claim first so concurrent delivery handlers cannot double-increment.
    const claimed = await FoodOrder.findOneAndUpdate(
        {
            _id: order._id,
            orderStatus: 'delivered',
            'pricing.couponUsageConsumed': { $ne: true },
        },
        { $set: { 'pricing.couponUsageConsumed': true } },
        { new: true },
    );
    if (!claimed) return;
    if (order.pricing) {
        order.pricing.couponUsageConsumed = true;
    }

    const resolvedUserId = userId || order.userId;
    const couponSource = order?.pricing?.appliedCoupon?.source;
    const { FoodOfferUsage } = await import('../admin/models/offerUsage.model.js');

    const offer = await FoodOffer.findOne({ couponCode }).lean();
    if (offer && couponSource !== 'restaurant') {
        await FoodOffer.updateOne(
            { _id: offer._id, $or: COUPON_USAGE_LIMIT_GATE },
            { $inc: { usedCount: 1 } },
        );
        if (resolvedUserId) {
            await FoodOfferUsage.updateOne(
                { offerId: offer._id, userId: new mongoose.Types.ObjectId(String(resolvedUserId)) },
                { $inc: { count: 1 }, $set: { lastUsedAt: new Date() } },
                { upsert: true },
            );
        }
        return;
    }

    const resolvedRestaurantId = await resolveRestaurantObjectId(order?.restaurantId);
    if (!resolvedRestaurantId) return;

    const { RestaurantCoupon } = await import('../admin/models/restaurantCoupon.model.js');
    const { RestaurantCouponUsage } = await import('../admin/models/restaurantCouponUsage.model.js');
    const restCoupon = await RestaurantCoupon.findOne({
        couponCode,
        restaurantId: resolvedRestaurantId,
        status: 'Approved',
    }).select('_id').lean();

    if (!restCoupon) return;

    await RestaurantCoupon.updateOne(
        { _id: restCoupon._id, $or: COUPON_USAGE_LIMIT_GATE },
        { $inc: { usedCount: 1 } },
    );
    if (resolvedUserId) {
        await RestaurantCouponUsage.updateOne(
            { couponId: restCoupon._id, userId: new mongoose.Types.ObjectId(String(resolvedUserId)) },
            { $inc: { count: 1 }, $set: { lastUsedAt: new Date() } },
            { upsert: true },
        );
    }
}
