import mongoose from 'mongoose';
import { ValidationError } from '../../../core/auth/errors.js';
import { clearContentCache } from '../services/content.service.js';

const getQuickCouponsCollection = () => mongoose.connection?.db?.collection('quick_coupons') || null;

/**
 * Increment admin (platform) quick coupon usedCount after a real order commitment.
 * Apply / preview must never call this.
 */
export const consumeAdminQuickCouponUsage = async (coupon) => {
  if (!coupon?._id) {
    throw new ValidationError('Coupon not found');
  }

  const collection = getQuickCouponsCollection();
  if (!collection) {
    throw new ValidationError('Coupon store unavailable');
  }

  const { ObjectId } = mongoose.Types;
  const couponId =
    coupon._id instanceof ObjectId
      ? coupon._id
      : ObjectId.isValid(String(coupon._id))
        ? new ObjectId(String(coupon._id))
        : null;
  if (!couponId) {
    throw new ValidationError('Invalid coupon id');
  }

  const usageLimit = Number(coupon?.usageLimit);
  const hasUsageLimit = Number.isFinite(usageLimit) && usageLimit > 0;

  const filter = {
    _id: couponId,
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
  };

  const result = await collection.updateOne(filter, {
    $inc: { usedCount: 1 },
    $set: { updatedAt: new Date() },
  });

  if (!result.matchedCount) {
    throw new ValidationError('This coupon has reached its usage limit');
  }

  try {
    clearContentCache();
  } catch {
    // non-fatal
  }

  return true;
};

export const restoreAdminQuickCouponUsage = async (coupon) => {
  if (!coupon?._id) return false;

  const collection = getQuickCouponsCollection();
  if (!collection) return false;

  const { ObjectId } = mongoose.Types;
  const couponId =
    coupon._id instanceof ObjectId
      ? coupon._id
      : ObjectId.isValid(String(coupon._id))
        ? new ObjectId(String(coupon._id))
        : null;
  if (!couponId) return false;

  await collection.updateOne(
    { _id: couponId, usedCount: { $gte: 1 } },
    {
      $inc: { usedCount: -1 },
      $set: { updatedAt: new Date() },
    },
  );

  try {
    clearContentCache();
  } catch {
    // non-fatal
  }

  return true;
};

export const findAdminQuickCouponByCode = async (code, { includeInactive = false } = {}) => {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return null;
  const collection = getQuickCouponsCollection();
  if (!collection) return null;
  const query = { code: normalized };
  if (!includeInactive) {
    query.isActive = { $ne: false };
    query.status = { $nin: ['inactive', 'expired', 'rejected', 'pending'] };
  }
  return collection.findOne(query);
};
