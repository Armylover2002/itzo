import mongoose from 'mongoose';
import { ValidationError } from '../../../core/auth/errors.js';
import { SellerCoupon } from '../models/sellerCoupon.model.js';
import { SellerCouponUsage } from '../models/sellerCouponUsage.model.js';

const getConsumerIdentity = ({ userId = null, sessionId = null } = {}) => {
  const normalizedUserId = userId && mongoose.Types.ObjectId.isValid(String(userId))
    ? String(userId)
    : '';
  if (normalizedUserId) {
    return {
      consumerKey: `user:${normalizedUserId}`,
      userId: new mongoose.Types.ObjectId(normalizedUserId),
      sessionId: null,
    };
  }

  const normalizedSessionId = String(sessionId || '').trim();
  if (normalizedSessionId) {
    return {
      consumerKey: `session:${normalizedSessionId}`,
      userId: null,
      sessionId: normalizedSessionId,
    };
  }

  return null;
};

export const getQuickSellerCouponUsageConsumer = (context = {}) => getConsumerIdentity(context);

export const getQuickSellerCouponEffectivePerUserLimit = (coupon) => {
  const configured = Number(coupon?.perUserLimit);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return 1;
};

/**
 * @returns {Promise<null | { code: string, message: string }>}
 */
export const getQuickSellerCouponUsageBlock = async (coupon, context = {}) => {
  if (!coupon) return null;

  const consumer = getConsumerIdentity(context);
  if (!consumer) {
    return {
      code: 'IDENTITY_REQUIRED',
      message: 'Customer identity is required to use this coupon',
    };
  }

  const usageLimit = Number(coupon?.usageLimit);
  const hasUsageLimit = Number.isFinite(usageLimit) && usageLimit > 0;
  if (hasUsageLimit && Number(coupon.usedCount || 0) >= usageLimit) {
    return {
      code: 'USAGE_LIMIT',
      message: 'This coupon has reached its usage limit',
    };
  }

  if (!coupon._id) {
    return {
      code: 'NOT_FOUND',
      message: 'Coupon not found',
    };
  }

  const perUserLimit = getQuickSellerCouponEffectivePerUserLimit(coupon);
  const usage = await SellerCouponUsage.findOne({
    couponId: coupon._id,
    consumerKey: consumer.consumerKey,
  }).select('count').lean();

  if (Number(usage?.count || 0) >= perUserLimit) {
    return {
      code: 'PER_USER_LIMIT',
      message: 'You have already used this coupon the maximum number of times',
    };
  }

  return null;
};

export const isQuickSellerCouponUsageAvailable = async (coupon, context = {}) => {
  const block = await getQuickSellerCouponUsageBlock(coupon, context);
  return !block;
};

/**
 * Count usage only after a real order commitment (COD/wallet placed, or online paid).
 * Apply / preview must never call this.
 */
export const consumeQuickSellerCouponUsage = async (coupon, context = {}) => {
  if (!coupon?._id) {
    throw new ValidationError('Coupon not found');
  }

  const consumer = getConsumerIdentity(context);
  if (!consumer) {
    throw new ValidationError('Customer identity is required to use this coupon');
  }

  await assertQuickSellerCouponUsageAvailable(coupon, context);

  const usageLimit = Number(coupon?.usageLimit);
  const hasUsageLimit = Number.isFinite(usageLimit) && usageLimit > 0;

  // Always bump usedCount so admin/seller dashboards stay accurate (even when unlimited).
  const usageResult = await SellerCoupon.updateOne(
    {
      _id: coupon._id,
      ...(hasUsageLimit
        ? {
            $or: [
              { usageLimit: { $exists: false } },
              { usageLimit: null },
              { usageLimit: 0 },
              { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
            ],
          }
        : {}),
    },
    { $inc: { usedCount: 1 } },
  );

  if (!usageResult.matchedCount) {
    throw new ValidationError('This coupon has reached its usage limit');
  }

  const perUserLimit = getQuickSellerCouponEffectivePerUserLimit(coupon);
  const now = new Date();
  const perUserResult = await SellerCouponUsage.updateOne(
    {
      couponId: coupon._id,
      consumerKey: consumer.consumerKey,
      count: { $lt: perUserLimit },
    },
    {
      $setOnInsert: {
        couponId: coupon._id,
        sellerId: coupon.sellerId,
        userId: consumer.userId,
        sessionId: consumer.sessionId,
        consumerKey: consumer.consumerKey,
        firstUsedAt: now,
      },
      $set: { lastUsedAt: now },
      $inc: { count: 1 },
    },
    { upsert: true },
  );

  if (!perUserResult.matchedCount && !perUserResult.upsertedCount) {
    await SellerCoupon.updateOne(
      { _id: coupon._id, usedCount: { $gte: 1 } },
      { $inc: { usedCount: -1 } },
    );
    throw new ValidationError('You have already used this coupon the maximum number of times');
  }

  return true;
};

/**
 * Restore usage when an order that already consumed the coupon is cancelled.
 */
export const restoreQuickSellerCouponUsage = async (coupon, context = {}) => {
  if (!coupon?._id) return false;

  const consumer = getConsumerIdentity(context);
  if (!consumer) return false;

  await Promise.allSettled([
    SellerCoupon.updateOne(
      { _id: coupon._id, usedCount: { $gte: 1 } },
      { $inc: { usedCount: -1 } },
    ),
    SellerCouponUsage.updateOne(
      {
        couponId: coupon._id,
        consumerKey: consumer.consumerKey,
        count: { $gte: 1 },
      },
      {
        $inc: { count: -1 },
        $set: { lastUsedAt: new Date() },
      },
    ),
  ]);

  return true;
};

export const resolveSellerCouponForOrder = async (order) => {
  const applied = order?.pricing?.appliedCoupon;
  const source = String(applied?.source || '').toLowerCase();
  if (source !== 'restaurant' && source !== 'seller') return null;

  const code = String(applied?.code || order?.pricing?.couponCode || '').trim().toUpperCase();
  if (!code) return null;

  const sellerId =
    order?.items?.find((item) => item?.type === 'quick' && item?.sourceId)?.sourceId ||
    order?.items?.[0]?.sourceId ||
    null;

  const query = {
    code,
    status: 'Approved',
    isActive: { $ne: false },
  };
  if (sellerId && mongoose.Types.ObjectId.isValid(String(sellerId))) {
    query.sellerId = new mongoose.Types.ObjectId(String(sellerId));
  }

  return SellerCoupon.findOne(query).lean();
};

/**
 * Idempotent restore for cancelled quick orders that had already consumed usage.
 */
export const restoreSellerCouponUsageForOrder = async (order) => {
  if (!order) return false;
  // Online unpaid orders never consume; skip restore.
  if (order?.pricing?.couponUsageConsumed === false) return false;

  const applied = order?.pricing?.appliedCoupon;
  const source = String(applied?.source || '').toLowerCase();
  const code = String(applied?.code || order?.pricing?.couponCode || '').trim().toUpperCase();

  if (source === 'admin') {
    if (!code) return false;
    const { findAdminQuickCouponByCode, restoreAdminQuickCouponUsage } = await import(
      './adminCouponUsage.helpers.js'
    );
    const adminCoupon = await findAdminQuickCouponByCode(code, { includeInactive: true });
    if (!adminCoupon) return false;
    await restoreAdminQuickCouponUsage(adminCoupon);

    if (order._id && typeof order.save === 'function') {
      if (!order.pricing) order.pricing = {};
      order.pricing.couponUsageConsumed = false;
      await order.save();
    } else if (order._id) {
      const { QuickOrder } = await import('../models/order.model.js');
      await QuickOrder.updateOne(
        { _id: order._id },
        { $set: { 'pricing.couponUsageConsumed': false } },
      );
    }
    return true;
  }

  if (source !== 'restaurant' && source !== 'seller') return false;

  const coupon = await resolveSellerCouponForOrder(order);
  if (!coupon) return false;

  const consumer = getConsumerIdentity({
    userId: order.userId || null,
    sessionId: order.sessionId || null,
  });
  if (!consumer) return false;

  await restoreQuickSellerCouponUsage(coupon, {
    userId: order.userId || null,
    sessionId: order.sessionId || null,
  });

  if (order._id && typeof order.save === 'function') {
    if (!order.pricing) order.pricing = {};
    order.pricing.couponUsageConsumed = false;
    await order.save();
  } else if (order._id) {
    const { QuickOrder } = await import('../models/order.model.js');
    await QuickOrder.updateOne(
      { _id: order._id },
      { $set: { 'pricing.couponUsageConsumed': false } },
    );
  }

  return true;
};

/**
 * Free usage slots held by cancelled orders (e.g. seller declined / user cancelled)
 * so apply + placeOrder are not blocked after a cancelled attempt.
 */
export const reconcileCancelledSellerCouponUsage = async (coupon, context = {}) => {
  if (!coupon?._id) return 0;

  const consumer = getConsumerIdentity(context);
  if (!consumer) return 0;

  const { QuickOrder } = await import('../models/order.model.js');
  const code = String(coupon.code || '').trim().toUpperCase();
  if (!code) return 0;

  const ownership = consumer.userId
    ? { userId: consumer.userId }
    : { sessionId: consumer.sessionId };

  const cancelledOrders = await QuickOrder.find({
    orderType: 'quick',
    ...ownership,
    orderStatus: { $regex: /cancel/i },
    $or: [
      { 'pricing.appliedCoupon.code': code },
      { 'pricing.couponCode': code },
    ],
    'pricing.couponUsageConsumed': { $ne: false },
  })
    .select('_id orderId userId sessionId pricing payment orderStatus')
    .limit(25);

  let restored = 0;
  for (const order of cancelledOrders) {
    const didRestore = await restoreSellerCouponUsageForOrder(order);
    if (didRestore) restored += 1;
  }
  return restored;
};

export const assertQuickSellerCouponUsageAvailable = async (coupon, context = {}) => {
  let block = await getQuickSellerCouponUsageBlock(coupon, context);
  if (!block) return;

  // Auto-heal: cancelled orders should not keep consuming the limit.
  if (block.code === 'USAGE_LIMIT' || block.code === 'PER_USER_LIMIT') {
    await reconcileCancelledSellerCouponUsage(coupon, context);
    // Reload usedCount after restore
    if (coupon._id) {
      const fresh = await SellerCoupon.findById(coupon._id).select('usedCount usageLimit perUserLimit').lean();
      if (fresh) {
        coupon.usedCount = fresh.usedCount;
        coupon.usageLimit = fresh.usageLimit ?? coupon.usageLimit;
        coupon.perUserLimit = fresh.perUserLimit ?? coupon.perUserLimit;
      }
    }
    block = await getQuickSellerCouponUsageBlock(coupon, context);
  }

  if (block) {
    throw new ValidationError(block.message);
  }
};
