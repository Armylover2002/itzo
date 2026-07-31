import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { QuickFeeSettings } from '../models/feeSettings.model.js';
import { QuickDeliveryCommissionRule } from '../models/deliveryCommissionRule.model.js';
import { QuickCategory } from '../../models/category.model.js';

const DEFAULT_QUICK_FEE_SETTINGS = {
  deliveryFee: 25,
  deliveryFeeRanges: [],
  freeDeliveryThreshold: 0,
  platformFee: 0,
  gstRate: 0,
  returnDeliveryCommission: 0,
  isActive: true,
};

let deliveryCommissionRulesCache = null;
let deliveryCommissionRulesLoadedAt = 0;
const DELIVERY_COMMISSION_CACHE_MS = 30 * 1000;

const clearDeliveryCommissionRulesCache = () => {
  deliveryCommissionRulesCache = null;
  deliveryCommissionRulesLoadedAt = 0;
};

export async function getDeliveryCommissionRules() {
  const list = await QuickDeliveryCommissionRule.find({}).sort({ createdAt: -1 }).lean();
  const commissions = list.map((r, index) => ({
    _id: r._id,
    sl: index + 1,
    name: r.name || '',
    minDistance: r.minDistance,
    maxDistance: r.maxDistance ?? null,
    commissionPerKm: r.commissionPerKm,
    basePayout: r.basePayout,
    status: r.status !== false,
  }));
  return { commissions };
}

function validateCommissionRuleSet(rules) {
  const active = (rules || []).filter((r) => r && r.status !== false);
  if (!active.length) {
    throw new ValidationError('A base slab with minDistance = 0 is required');
  }

  const baseRules = active.filter((r) => Number(r.minDistance || 0) === 0);
  if (baseRules.length !== 1) {
    throw new ValidationError('A base slab with minDistance = 0 is required');
  }

  const sorted = [...active].sort((a, b) => Number(a.minDistance || 0) - Number(b.minDistance || 0));
  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i];
    const min = Number(current.minDistance || 0);
    const max = current.maxDistance == null ? null : Number(current.maxDistance);
    if (max != null && max <= min) {
      throw new ValidationError('maxDistance must be greater than minDistance');
    }
    if (i > 0) {
      const prev = sorted[i - 1];
      const prevMin = Number(prev.minDistance || 0);
      const prevMax = prev.maxDistance == null ? null : Number(prev.maxDistance);
      const effectivePrevMax = prevMax == null ? Infinity : prevMax;
      if (min < effectivePrevMax) {
        throw new ValidationError('Distance slabs must not overlap');
      }
      if (min === prevMin) {
        throw new ValidationError('Distance slabs must not share the same minDistance');
      }
    }
  }
}

export async function createDeliveryCommissionRule(body) {
  const existing = await QuickDeliveryCommissionRule.find({}).lean();
  const candidate = [
    ...existing,
    {
      minDistance: body.minDistance,
      maxDistance: body.maxDistance ?? null,
      commissionPerKm: body.commissionPerKm,
      basePayout: body.basePayout,
      status: body.status ?? true,
    },
  ];

  validateCommissionRuleSet(candidate);
  const created = await QuickDeliveryCommissionRule.create({
    name: body.name || '',
    minDistance: body.minDistance,
    maxDistance: body.maxDistance ?? null,
    commissionPerKm: body.commissionPerKm,
    basePayout: body.basePayout,
    status: body.status ?? true,
  });
  clearDeliveryCommissionRulesCache();
  return created.toObject();
}

export async function updateDeliveryCommissionRule(id, body) {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  const existing = await QuickDeliveryCommissionRule.find({}).lean();
  const candidate = existing.map((r) =>
    String(r._id) === String(id)
      ? {
          ...r,
          minDistance: body.minDistance,
          maxDistance: body.maxDistance ?? null,
          commissionPerKm: body.commissionPerKm,
          basePayout: body.basePayout,
          status: r.status !== false,
        }
      : r,
  );

  validateCommissionRuleSet(candidate);
  const updated = await QuickDeliveryCommissionRule.findByIdAndUpdate(
    id,
    {
      $set: {
        name: body.name || '',
        minDistance: body.minDistance,
        maxDistance: body.maxDistance ?? null,
        commissionPerKm: body.commissionPerKm,
        basePayout: body.basePayout,
      },
    },
    { new: true },
  ).lean();
  clearDeliveryCommissionRulesCache();
  return updated;
}

export async function deleteDeliveryCommissionRule(id) {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  const deleted = await QuickDeliveryCommissionRule.findByIdAndDelete(id).lean();
  clearDeliveryCommissionRulesCache();
  return deleted ? { id } : null;
}

export async function toggleDeliveryCommissionRuleStatus(id, status) {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  const updated = await QuickDeliveryCommissionRule.findByIdAndUpdate(
    id,
    { $set: { status: Boolean(status) } },
    { new: true },
  ).lean();
  clearDeliveryCommissionRulesCache();
  return updated;
}

export async function getFeeSettings() {
  const doc = await QuickFeeSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
  return { feeSettings: doc || null };
}

export async function upsertFeeSettings(body) {
  const existing = await QuickFeeSettings.findOne({ isActive: true }).sort({ createdAt: -1 });
  if (existing) {
    const $set = {};
    const $unset = {};

    if (body.deliveryFee === null) $unset.deliveryFee = 1;
    else if (body.deliveryFee !== undefined) $set.deliveryFee = body.deliveryFee;

    if (body.deliveryFeeRanges !== undefined) $set.deliveryFeeRanges = body.deliveryFeeRanges;

    if (body.freeDeliveryThreshold === null) $unset.freeDeliveryThreshold = 1;
    else if (body.freeDeliveryThreshold !== undefined) $set.freeDeliveryThreshold = body.freeDeliveryThreshold;

    if (body.platformFee === null) $unset.platformFee = 1;
    else if (body.platformFee !== undefined) $set.platformFee = body.platformFee;

    if (body.gstRate === null) $unset.gstRate = 1;
    else if (body.gstRate !== undefined) $set.gstRate = body.gstRate;

    if (body.returnDeliveryCommission === null) $unset.returnDeliveryCommission = 1;
    else if (body.returnDeliveryCommission !== undefined) {
      $set.returnDeliveryCommission = body.returnDeliveryCommission;
    }

    if (body.isActive !== undefined) $set.isActive = body.isActive;

    const update = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;
    if (!Object.keys(update).length) return existing.toObject();

    const updated = await QuickFeeSettings.findByIdAndUpdate(existing._id, update, { new: true }).lean();
    return updated;
  }

  const payload = {
    deliveryFeeRanges: body.deliveryFeeRanges ?? [],
    isActive: body.isActive ?? true,
    returnDeliveryCommission: body.returnDeliveryCommission ?? 0,
  };
  if (body.deliveryFee !== undefined && body.deliveryFee !== null) payload.deliveryFee = body.deliveryFee;
  if (body.freeDeliveryThreshold !== undefined && body.freeDeliveryThreshold !== null) {
    payload.freeDeliveryThreshold = body.freeDeliveryThreshold;
  }
  if (body.platformFee !== undefined && body.platformFee !== null) payload.platformFee = body.platformFee;
  if (body.gstRate !== undefined && body.gstRate !== null) payload.gstRate = body.gstRate;

  const created = await QuickFeeSettings.create(payload);
  return created.toObject();
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

export function calculateDeliveryFeeFromSettings(subtotal, feeSettings = DEFAULT_QUICK_FEE_SETTINGS) {
  const safeSubtotal = Number(subtotal || 0);
  const freeThreshold = Number(feeSettings.freeDeliveryThreshold || 0);

  if (Number.isFinite(freeThreshold) && freeThreshold > 0 && safeSubtotal >= freeThreshold) {
    return 0;
  }

  const ranges = Array.isArray(feeSettings.deliveryFeeRanges)
    ? [...feeSettings.deliveryFeeRanges].sort((a, b) => Number(a.min) - Number(b.min))
    : [];

  if (ranges.length) {
    let matched = null;
    for (let i = 0; i < ranges.length; i += 1) {
      const range = ranges[i] || {};
      const min = Number(range.min);
      const max = Number(range.max);
      const fee = Number(range.fee);
      if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(fee)) continue;
      const isLast = i === ranges.length - 1;
      const inRange = isLast
        ? safeSubtotal >= min && safeSubtotal <= max
        : safeSubtotal >= min && safeSubtotal < max;
      if (inRange) {
        matched = fee;
        break;
      }
    }
    if (Number.isFinite(matched)) return matched;
  }

  return Number(feeSettings.deliveryFee || 0);
}

export async function calculateQuickPricing({ subtotal = 0, discount = 0, tip = 0, products = [] } = {}) {
  const feeSettings = await getActiveFeeSettings();
  const safeSubtotal = Number(subtotal || 0);
  const safeDiscount = Math.max(0, Number(discount || 0));
  const safeTip = Math.max(0, Number(tip || 0));
  const platformFee = Number(feeSettings.platformFee || 0);
  const handlingFee = await calculateHandlingFeeFromProducts(products);
  const deliveryFee = calculateDeliveryFeeFromSettings(safeSubtotal, feeSettings);
  const gstRate = Number(feeSettings.gstRate || 0);
  const tax = 0;
  const gst =
    Number.isFinite(gstRate) && gstRate > 0
      ? Math.round(safeSubtotal * (gstRate / 100))
      : 0;
  const total = Math.max(0, safeSubtotal + deliveryFee + handlingFee + platformFee + tax + gst - safeDiscount + safeTip);

  return {
    pricing: {
      subtotal: safeSubtotal,
      tax,
      gst,
      packagingFee: 0,
      deliveryFee,
      platformFee,
      handlingFee,
      tip: safeTip,
      restaurantCommission: 0,
      discount: safeDiscount,
      total,
      currency: 'INR',
    },
    snapshots: {
      feeSettings,
    },
  };
}

export async function getActiveDeliveryCommissionRules() {
  const now = Date.now();
  if (
    deliveryCommissionRulesCache &&
    now - deliveryCommissionRulesLoadedAt < DELIVERY_COMMISSION_CACHE_MS
  ) {
    return deliveryCommissionRulesCache;
  }

  const list = await QuickDeliveryCommissionRule.find({ status: { $ne: false } }).lean();
  deliveryCommissionRulesCache = list || [];
  deliveryCommissionRulesLoadedAt = now;
  return deliveryCommissionRulesCache;
}

export async function getRiderEarning(distanceKm) {
  const d = Number(distanceKm);
  if (!Number.isFinite(d) || d < 0) return 0;

  const rules = await getActiveDeliveryCommissionRules();
  if (!rules.length) return 0;

  const sorted = [...rules].sort((a, b) => (a.minDistance || 0) - (b.minDistance || 0));
  const baseRule = sorted.find((r) => Number(r.minDistance || 0) === 0) || null;
  if (!baseRule) return 0;

  let earning = Number(baseRule.basePayout || 0);
  for (const rule of sorted) {
    const perKm = Number(rule.commissionPerKm || 0);
    if (!Number.isFinite(perKm) || perKm <= 0) continue;
    const min = Number(rule.minDistance || 0);
    const max = rule.maxDistance == null ? null : Number(rule.maxDistance);
    if (d <= min) continue;
    const upper = max == null ? d : Math.min(d, max);
    const kmInSlab = Math.max(0, upper - min);
    if (kmInSlab > 0) {
      earning += kmInSlab * perKm;
    }
  }

  if (!Number.isFinite(earning) || earning <= 0) return 0;
  return Math.round(earning);
}
