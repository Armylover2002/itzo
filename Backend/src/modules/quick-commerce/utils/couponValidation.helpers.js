import { ValidationError } from '../../../core/auth/errors.js';
import {
  normalizeCouponValidFrom,
  normalizeCouponValidTill,
} from './coupon.helpers.js';
import mongoose from 'mongoose';
const DISCOUNT_TYPES = ['percentage', 'fixed', 'free_delivery'];

/**
 * Derive legacy couponType from discount + min order (strategy UI removed).
 */
export const deriveQuickCouponType = (discountType, minOrderValue = 0) => {
  if (String(discountType || '').toLowerCase() === 'free_delivery') {
    return 'free_delivery';
  }
  if (Number(minOrderValue || 0) > 0) return 'min_order_value';
  return 'generic';
};

/**
 * Shared create/update payload validation for admin + seller QC coupons.
 * Same-day start/end is allowed. End cannot be before start.
 */
export const validateAndNormalizeQuickCouponPayload = (body = {}) => {
  const code = String(body?.code || '').trim().toUpperCase();
  if (!code) throw new ValidationError('Coupon code is required');
  if (code.length < 3) throw new ValidationError('Coupon code must be at least 3 characters');
  if (!/^[A-Z0-9_-]+$/.test(code)) {
    throw new ValidationError('Coupon code may only contain letters, numbers, hyphen and underscore');
  }

  const discountType = String(body?.discountType || '').trim().toLowerCase();
  if (!DISCOUNT_TYPES.includes(discountType)) {
    throw new ValidationError('Discount type must be percentage, fixed, or free_delivery');
  }

  let discountValue = Number(body?.discountValue);
  if (discountType === 'free_delivery') {
    if (!Number.isFinite(discountValue) || discountValue < 0) discountValue = 0;
  } else if (!Number.isFinite(discountValue) || discountValue <= 0) {
    throw new ValidationError('Discount value must be greater than 0');
  }

  if (discountType === 'percentage' && discountValue > 100) {
    throw new ValidationError('Percentage discount cannot exceed 100');
  }

  const minOrderValue = Number(body?.minOrderValue);
  const safeMinOrder = Number.isFinite(minOrderValue) && minOrderValue > 0 ? minOrderValue : 0;

  let maxDiscount;
  if (body?.maxDiscount !== undefined && body?.maxDiscount !== null && body?.maxDiscount !== '') {
    maxDiscount = Number(body.maxDiscount);
    if (!Number.isFinite(maxDiscount) || maxDiscount < 0) {
      throw new ValidationError('Max discount must be a valid non-negative number');
    }
    if (discountType === 'fixed' && maxDiscount > 0 && maxDiscount < discountValue) {
      throw new ValidationError('Max discount cannot be less than fixed discount value');
    }
  }

  let usageLimit = null;
  if (body?.usageLimit !== undefined && body?.usageLimit !== null && body?.usageLimit !== '') {
    usageLimit = Number(body.usageLimit);
    if (!Number.isInteger(usageLimit) || usageLimit < 1) {
      throw new ValidationError('Total usage limit must be a whole number of at least 1');
    }
  }

  let perUserLimit = 1;
  if (body?.perUserLimit !== undefined && body?.perUserLimit !== null && body?.perUserLimit !== '') {
    perUserLimit = Number(body.perUserLimit);
    if (!Number.isInteger(perUserLimit) || perUserLimit < 1) {
      throw new ValidationError('Per user limit must be a whole number of at least 1');
    }
  }

  if (usageLimit != null && perUserLimit > usageLimit) {
    throw new ValidationError('Per user limit cannot exceed total usage limit');
  }

  const validFrom = normalizeCouponValidFrom(body?.validFrom);
  const validTill = normalizeCouponValidTill(body?.validTill);
  if (!validFrom) throw new ValidationError('Valid From date is required');
  if (!validTill) throw new ValidationError('Valid Till date is required');
  if (validTill.getTime() < validFrom.getTime()) {
    throw new ValidationError('End date cannot be before start date');
  }

  const firstOrderOnly = Boolean(body?.firstOrderOnly ?? body?.isFirstOrderOnly);
  const description = String(body?.description || '').trim();

  return {
    code,
    discountType,
    couponType: deriveQuickCouponType(discountType, safeMinOrder),
    discountValue,
    minOrderValue: safeMinOrder,
    maxDiscount,
    usageLimit,
    perUserLimit,
    validFrom,
    validTill,
    firstOrderOnly,
    description,
  };
};

/**
 * Reject first-order-only coupons when the customer already has a QC order.
 */
export async function assertQuickFirstOrderOnly(coupon, { userId = null, sessionId = null } = {}) {
  if (!coupon?.firstOrderOnly && !coupon?.isFirstOrderOnly) return;

  const ownership = [];
  if (userId && mongoose.Types.ObjectId.isValid(String(userId))) {
    ownership.push({ userId: new mongoose.Types.ObjectId(String(userId)) });
  }
  if (sessionId) {
    ownership.push({ sessionId: String(sessionId).trim() });
  }
  if (!ownership.length) {
    throw new ValidationError('Please log in to use this first-order coupon');
  }

  const { QuickOrder } = await import('../models/order.model.js');
  const prior = await QuickOrder.countDocuments({
    ...(ownership.length === 1 ? ownership[0] : { $or: ownership }),
    status: { $nin: ['cancelled', 'Canceled', 'CANCELLED', 'failed', 'Failed'] },
  });
  if (prior > 0) {
    throw new ValidationError('This coupon is valid for your first order only');
  }
}
