import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { QuickFeeSettings } from '../models/feeSettings.model.js';
import { QuickCategory } from '../../models/category.model.js';
import { calculateHeaderGstAmount } from './commission.service.js';

const DEFAULT_QUICK_FEE_SETTINGS = {
  deliveryFee: 25,
  deliveryFeeRanges: [],
  freeDeliveryThreshold: 0,
  platformFee: 0,
  minWithdrawalAmount: 0,
  maxWithdrawalAmount: 0,
  isActive: true,
};


const sanitizeFeeSettingsForApi = (doc) => {
  if (!doc) return null;
  // Strip legacy/private fields. gstRate and return window are obsolete —
  // GST + customer returns come from Header Categories.
  const {
    returnDeliveryCommission,
    returnPickupFee,
    gstRate: _legacyGstRate,
    returnWindowHours: _legacyReturnWindowHours,
    returnsEnabled: _legacyReturnsEnabled,
    ...rest
  } = doc;
  return rest;
};

export async function getFeeSettings() {
  const doc = await QuickFeeSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
  return { feeSettings: sanitizeFeeSettingsForApi(doc) };
}

export async function upsertFeeSettings(body) {
  const existing = await QuickFeeSettings.findOne({ isActive: true }).sort({ createdAt: -1 });
  if (existing) {
    const $set = {};
    const $unset = {};

    if (body.deliveryFeeRanges !== undefined) $set.deliveryFeeRanges = body.deliveryFeeRanges;

    if (body.platformFee === null) $unset.platformFee = 1;
    else if (body.platformFee !== undefined) $set.platformFee = body.platformFee;

    if (body.freeDeliveryThreshold === null) $unset.freeDeliveryThreshold = 1;
    else if (body.freeDeliveryThreshold !== undefined) {
      $set.freeDeliveryThreshold = body.freeDeliveryThreshold;
    }

    if (body.minWithdrawalAmount === null) $unset.minWithdrawalAmount = 1;
    else if (body.minWithdrawalAmount !== undefined) {
      $set.minWithdrawalAmount = body.minWithdrawalAmount;
    }

    if (body.maxWithdrawalAmount === null) $unset.maxWithdrawalAmount = 1;
    else if (body.maxWithdrawalAmount !== undefined) {
      $set.maxWithdrawalAmount = body.maxWithdrawalAmount;
    }

    if (body.isActive !== undefined) $set.isActive = body.isActive;

    const update = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;
    if (!Object.keys(update).length) return sanitizeFeeSettingsForApi(existing.toObject());

    const updated = await QuickFeeSettings.findByIdAndUpdate(existing._id, update, { new: true }).lean();
    return sanitizeFeeSettingsForApi(updated);
  }

  const payload = {
    deliveryFeeRanges: body.deliveryFeeRanges ?? [],
    isActive: body.isActive ?? true,
    minWithdrawalAmount: body.minWithdrawalAmount ?? 0,
    maxWithdrawalAmount: body.maxWithdrawalAmount ?? 0,
  };
  if (body.platformFee !== undefined && body.platformFee !== null) payload.platformFee = body.platformFee;
  if (body.freeDeliveryThreshold !== undefined && body.freeDeliveryThreshold !== null) {
    payload.freeDeliveryThreshold = body.freeDeliveryThreshold;
  }

  const created = await QuickFeeSettings.create(payload);
  return sanitizeFeeSettingsForApi(created.toObject());
}

export async function getActiveFeeSettings() {
  const doc = await QuickFeeSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
  return doc || DEFAULT_QUICK_FEE_SETTINGS;
}

export async function calculateHandlingFeeFromProducts(products = []) {
  const ids = new Set();

  for (const product of products) {
    const candidates = [product?.headerId, product?.categoryId, product?.subcategoryId];
    candidates.forEach((value) => {
      const normalized =
        value && typeof value === 'object' && value._id ? String(value._id) : String(value || '').trim();
      if (normalized && mongoose.Types.ObjectId.isValid(normalized)) {
        ids.add(normalized);
      }
    });
  }

  if (!ids.size) return 0;

  const categories = await QuickCategory.find({ _id: { $in: Array.from(ids) } })
    .select('_id handlingFees')
    .lean();

  return categories.reduce(
    (maxFee, category) => Math.max(maxFee, Number(category?.handlingFees || 0)),
    0,
  );
}

export function matchFeeRange(ranges, distance, resolver) {
  if (!Array.isArray(ranges) || ranges.length === 0) return 0;
  const sorted = [...ranges].sort((a, b) => Number(a.min) - Number(b.min));
  let matched = null;
  for (let i = 0; i < sorted.length; i += 1) {
    const range = sorted[i] || {};
    const min = Number(range.min);
    const max = Number(range.max);
    if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
    const isLast = i === sorted.length - 1;
    const inRange = isLast
      ? distance >= min && distance <= max
      : distance >= min && distance < max;
    if (inRange) {
      matched = range;
      break;
    }
  }
  return matched ? resolver(matched) : 0;
}

export function calculateCustomerDeliveryFee(feeSettings, distanceKm) {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance < 0) return 0;
  const ranges = Array.isArray(feeSettings.deliveryFeeRanges) ? feeSettings.deliveryFeeRanges : [];
  if (ranges.length > 0) {
    const fee = matchFeeRange(ranges, distance, (range) => Number(range.fee || 0));
    return Number.isFinite(fee) && fee > 0 ? fee : 0;
  }
  return 0;
}

export function calculateRiderEarning(feeSettings = {}, distanceKm) {
  const breakdown = calculateRiderEarningBreakdown(feeSettings, distanceKm);
  return Number(breakdown.earning || 0);
}

/**
 * Full rider payout breakdown for trip-history / return pickup UIs.
 * QC slabs use deliveryBoyBasePay (flat) and/or deliveryBoyPerKm.
 */
export function calculateRiderEarningBreakdown(feeSettings = {}, distanceKm) {
  const distance = Number(distanceKm);
  const empty = {
    earning: 0,
    basePayout: 0,
    perKmRate: 0,
    baseKm: 0,
    extraKm: 0,
    distanceKm: Number.isFinite(distance) && distance > 0 ? distance : 0,
  };
  if (!Number.isFinite(distance) || distance < 0) return empty;

  const ranges = Array.isArray(feeSettings.deliveryFeeRanges) ? feeSettings.deliveryFeeRanges : [];
  if (!ranges.length) return empty;

  let matched = null;
  const sorted = [...ranges].sort((a, b) => Number(a.min) - Number(b.min));
  for (let i = 0; i < sorted.length; i += 1) {
    const range = sorted[i] || {};
    const min = Number(range.min);
    const max = Number(range.max);
    if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
    const isLast = i === sorted.length - 1;
    const inRange = isLast
      ? distance >= min && distance <= max
      : distance >= min && distance < max;
    if (inRange) {
      matched = range;
      break;
    }
  }
  if (!matched) return empty;

  const basePayout = Number(matched.deliveryBoyBasePay || 0);
  const perKmRate = Number(matched.deliveryBoyPerKm || 0);
  const baseKm = Number.isFinite(Number(matched.min)) ? Math.max(0, Number(matched.min)) : 0;
  const extraKm =
    perKmRate > 0 && basePayout <= 0
      ? Math.max(0, Math.round((distance - baseKm) * 1000) / 1000)
      : 0;

  let earning = 0;
  if (basePayout > 0) earning = basePayout;
  else if (perKmRate > 0) earning = distance * perKmRate;
  earning = Number.isFinite(earning) && earning > 0 ? Math.round(earning * 100) / 100 : 0;

  return {
    earning,
    basePayout: basePayout > 0 ? basePayout : earning,
    perKmRate,
    baseKm,
    extraKm,
    distanceKm: distance,
    matchedMin: Number(matched.min),
    matchedMax: Number(matched.max),
  };
}

export async function calculateQuickPricing({
  subtotal = 0,
  discount = 0,
  products = [],
  items = [],
  distanceKm = 0,
  packagingFee = 0,
  couponType = '',
} = {}) {
  const feeSettings = await getActiveFeeSettings();
  const safeSubtotal = Number(subtotal || 0);
  const safeDiscount = Math.max(0, Number(discount || 0));
  const safePackagingFee = Number(packagingFee || 0);
  const platformFee = Number(feeSettings.platformFee || 0);

  const handlingFee = await calculateHandlingFeeFromProducts(products);

  let deliveryFee =
    String(couponType || '').trim().toLowerCase() === 'free_delivery'
      ? 0
      : calculateCustomerDeliveryFee(feeSettings, distanceKm);

  const freeDeliveryThreshold = Number(feeSettings.freeDeliveryThreshold || 0);
  if (
    deliveryFee > 0 &&
    Number.isFinite(freeDeliveryThreshold) &&
    freeDeliveryThreshold > 0 &&
    safeSubtotal >= freeDeliveryThreshold
  ) {
    deliveryFee = 0;
  }

  // GST % from Header Category only — apply on post-discount taxable item value
  const taxableSubtotal = Math.max(0, safeSubtotal - safeDiscount);
  const gst = await calculateHeaderGstAmount({
    products,
    items: (Array.isArray(items) && items.length
      ? items
      : []
    ).map((item) => {
      if (!safeSubtotal || !safeDiscount) return item;
      const lineTotal =
        Number(item?.lineTotal) ||
        Math.max(0, Number(item?.price || 0) * Number(item?.quantity || 0));
      const share = lineTotal / safeSubtotal;
      return {
        ...item,
        lineTotal: Math.max(0, lineTotal - safeDiscount * share),
      };
    }),
    subtotal: taxableSubtotal,
  });

  const total = Math.max(
    0,
    safeSubtotal + deliveryFee + platformFee + gst + safePackagingFee + handlingFee - safeDiscount,
  );

  return {
    pricing: {
      subtotal: safeSubtotal,
      gst,
      tax: 0,
      packagingFee: safePackagingFee,
      deliveryFee,
      platformFee,
      handlingFee,
      discount: safeDiscount,
      total,
      currency: 'INR',
    },
    snapshots: {
      feeSettings,
    },
  };
}

export async function getRiderEarning(distanceKm) {
  const feeSettings = await getActiveFeeSettings();
  return calculateRiderEarning(feeSettings, distanceKm);
}
