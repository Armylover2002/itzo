import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { QuickFeeSettings } from '../models/feeSettings.model.js';

const DEFAULT_QUICK_FEE_SETTINGS = {
  deliveryFee: 25,
  baseDistanceKm: 3,
  baseDeliveryFee: 25,
  perKmCharge: 10,
  sponsorRules: [],
  platformFee: 0,
  gstRate: 0,
  minWithdrawal: undefined,
  maxWithdrawal: undefined,
  isActive: true,
};

function roundCurrency(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Number(num.toFixed(2));
}

function stripLegacyQuickFeeSettingsFields(doc) {
  if (!doc || typeof doc !== 'object') return doc || null;
  const next = { ...doc };
  delete next.deliveryFeeRanges;
  delete next.freeDeliveryThreshold;
  delete next.returnDeliveryCommission;
  return next;
}

/**
 * Distance-based delivery fee: base fee up to `baseDistanceKm`, then
 * `perKmCharge` for every km beyond it. Mirrors the Food admin fee model.
 */
export function calculateBaseDeliveryFeeForDistance(distanceKm, feeSettings) {
  const distance = Number(distanceKm);
  const baseDistance = Number(feeSettings?.baseDistanceKm || 0);
  const baseFee = Number(feeSettings?.baseDeliveryFee ?? feeSettings?.deliveryFee ?? 0);
  const perKmCharge = Number(feeSettings?.perKmCharge || 0);

  if (!Number.isFinite(distance) || distance <= baseDistance) {
    return roundCurrency(Math.max(0, baseFee));
  }

  return roundCurrency(Math.max(0, baseFee + (distance - baseDistance) * perKmCharge));
}

/**
 * Picks the best-matching sponsor rule for an order subtotal + delivery
 * distance. Same matching semantics as the Food admin sponsor rules.
 */
export function resolveDeliverySponsorRule(subtotal, distanceKm, sponsorRules = []) {
  const safeSubtotal = Number(subtotal);
  const safeDistance = Number(distanceKm);
  if (!Number.isFinite(safeSubtotal) || !Number.isFinite(safeDistance)) return null;

  const normalizedRules = (Array.isArray(sponsorRules) ? sponsorRules : [])
    .map((rule, index) => ({
      index,
      minOrderAmount: Number(rule?.minOrderAmount),
      maxOrderAmount:
        rule?.maxOrderAmount == null || rule?.maxOrderAmount === ''
          ? null
          : Number(rule.maxOrderAmount),
      maxDistanceKm: Number(rule?.maxDistanceKm),
      sponsorType: String(rule?.sponsorType || '').trim().toUpperCase(),
      sponsoredKm:
        rule?.sponsoredKm == null || rule?.sponsoredKm === ''
          ? null
          : Number(rule.sponsoredKm),
    }))
    .filter((rule) =>
      Number.isFinite(rule.minOrderAmount) &&
      Number.isFinite(rule.maxDistanceKm) &&
      ['USER_FULL', 'SELLER_FULL', 'SPLIT'].includes(rule.sponsorType),
    )
    .sort((a, b) => {
      if (b.minOrderAmount !== a.minOrderAmount) return b.minOrderAmount - a.minOrderAmount;
      if (a.maxDistanceKm !== b.maxDistanceKm) return a.maxDistanceKm - b.maxDistanceKm;
      return a.index - b.index;
    });

  return normalizedRules.find((rule) => {
    const orderOk =
      safeSubtotal >= rule.minOrderAmount &&
      (rule.maxOrderAmount == null || safeSubtotal <= rule.maxOrderAmount);
    return orderOk && safeDistance <= rule.maxDistanceKm;
  }) || null;
}

/**
 * Splits a distance-based delivery fee between the customer and the seller
 * per the matched sponsor rule. Shared by the single-seller pricing preview
 * and the multi-seller order placement flow.
 */
export function calculateDeliverySplit(subtotal, distanceKm, feeSettings) {
  const totalDeliveryFee = calculateBaseDeliveryFeeForDistance(distanceKm, feeSettings);
  const matchedRule = resolveDeliverySponsorRule(subtotal, distanceKm, feeSettings?.sponsorRules);

  let sellerDeliveryFee = 0;
  let userDeliveryFee = totalDeliveryFee;
  let sponsoredKm = 0;
  let deliverySponsorType = 'USER_FULL';

  if (matchedRule?.sponsorType === 'SELLER_FULL') {
    sellerDeliveryFee = totalDeliveryFee;
    userDeliveryFee = 0;
    sponsoredKm = roundCurrency(distanceKm);
    deliverySponsorType = 'SELLER_FULL';
  } else if (matchedRule?.sponsorType === 'SPLIT') {
    const safeSponsoredKm = Math.max(0, Math.min(Number(distanceKm || 0), Number(matchedRule.sponsoredKm || 0)));
    sellerDeliveryFee = Math.min(
      totalDeliveryFee,
      calculateBaseDeliveryFeeForDistance(safeSponsoredKm, feeSettings),
    );
    userDeliveryFee = Math.max(0, roundCurrency(totalDeliveryFee - sellerDeliveryFee));
    sponsoredKm = roundCurrency(safeSponsoredKm);
    deliverySponsorType = 'SPLIT';
  }

  return {
    totalDeliveryFee: roundCurrency(totalDeliveryFee),
    userDeliveryFee: roundCurrency(userDeliveryFee),
    sellerDeliveryFee: roundCurrency(sellerDeliveryFee),
    sponsoredKm,
    deliveryDistanceKm: roundCurrency(distanceKm),
    deliverySponsorType,
  };
}

let feeSettingsPromise = null;
let feeSettingsLoadedAt = 0;
const FEE_SETTINGS_CACHE_MS = 60 * 1000;

const clearFeeSettingsCache = () => {
  feeSettingsPromise = null;
  feeSettingsLoadedAt = 0;
};

export async function getFeeSettings() {
  const doc = await QuickFeeSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
  if (doc?._id && ('deliveryFeeRanges' in doc || 'freeDeliveryThreshold' in doc || 'returnDeliveryCommission' in doc)) {
    await QuickFeeSettings.findByIdAndUpdate(doc._id, {
      $unset: { deliveryFeeRanges: 1, freeDeliveryThreshold: 1, returnDeliveryCommission: 1 },
    });
  }
  return { feeSettings: stripLegacyQuickFeeSettingsFields(doc) || null };
}

export async function upsertFeeSettings(body) {
  const existing = await QuickFeeSettings.findOne({ isActive: true }).sort({ createdAt: -1 });
  if (existing) {
    const $set = {};
    const $unset = {};

    if (body.baseDistanceKm === null) $unset.baseDistanceKm = 1;
    else if (body.baseDistanceKm !== undefined) $set.baseDistanceKm = body.baseDistanceKm;

    if (body.baseDeliveryFee === null) {
      $unset.baseDeliveryFee = 1;
      $unset.deliveryFee = 1;
    } else if (body.baseDeliveryFee !== undefined) {
      $set.baseDeliveryFee = body.baseDeliveryFee;
      $set.deliveryFee = body.baseDeliveryFee;
    }

    if (body.perKmCharge === null) $unset.perKmCharge = 1;
    else if (body.perKmCharge !== undefined) $set.perKmCharge = body.perKmCharge;

    if (body.sponsorRules !== undefined) $set.sponsorRules = body.sponsorRules;

    if (body.platformFee === null) $unset.platformFee = 1;
    else if (body.platformFee !== undefined) $set.platformFee = body.platformFee;

    if (body.gstRate === null) $unset.gstRate = 1;
    else if (body.gstRate !== undefined) $set.gstRate = body.gstRate;

    if (body.minWithdrawal === null) $unset.minWithdrawal = 1;
    else if (body.minWithdrawal !== undefined) $set.minWithdrawal = body.minWithdrawal;

    if (body.maxWithdrawal === null) $unset.maxWithdrawal = 1;
    else if (body.maxWithdrawal !== undefined) $set.maxWithdrawal = body.maxWithdrawal;

    if (body.isActive !== undefined) $set.isActive = body.isActive;

    // Remove the legacy order-value-range model whenever the new distance model is saved.
    if (
      body.baseDistanceKm !== undefined ||
      body.baseDeliveryFee !== undefined ||
      body.perKmCharge !== undefined ||
      body.sponsorRules !== undefined
    ) {
      $unset.deliveryFeeRanges = 1;
      $unset.freeDeliveryThreshold = 1;
    }
    $unset.returnDeliveryCommission = 1;

    const update = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;
    if (!Object.keys(update).length) return stripLegacyQuickFeeSettingsFields(existing.toObject());

    const updated = await QuickFeeSettings.findByIdAndUpdate(existing._id, update, { new: true }).lean();
    clearFeeSettingsCache();
    return stripLegacyQuickFeeSettingsFields(updated);
  }

  const payload = {
    isActive: body.isActive ?? true,
  };
  if (body.baseDistanceKm !== undefined && body.baseDistanceKm !== null) payload.baseDistanceKm = body.baseDistanceKm;
  if (body.baseDeliveryFee !== undefined && body.baseDeliveryFee !== null) {
    payload.baseDeliveryFee = body.baseDeliveryFee;
    payload.deliveryFee = body.baseDeliveryFee;
  }
  if (body.perKmCharge !== undefined && body.perKmCharge !== null) payload.perKmCharge = body.perKmCharge;
  if (body.sponsorRules !== undefined) payload.sponsorRules = body.sponsorRules ?? [];
  if (body.platformFee !== undefined && body.platformFee !== null) payload.platformFee = body.platformFee;
  if (body.gstRate !== undefined && body.gstRate !== null) payload.gstRate = body.gstRate;
  if (body.minWithdrawal !== undefined && body.minWithdrawal !== null) payload.minWithdrawal = body.minWithdrawal;
  if (body.maxWithdrawal !== undefined && body.maxWithdrawal !== null) payload.maxWithdrawal = body.maxWithdrawal;

  const created = await QuickFeeSettings.create(payload);
  clearFeeSettingsCache();
  return stripLegacyQuickFeeSettingsFields(created.toObject());
}

export function getActiveFeeSettings() {
  const now = Date.now();
  if (feeSettingsPromise && (now - feeSettingsLoadedAt < FEE_SETTINGS_CACHE_MS)) {
    return feeSettingsPromise;
  }
  
  feeSettingsPromise = QuickFeeSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean().then(doc => doc || DEFAULT_QUICK_FEE_SETTINGS).catch(err => {
    feeSettingsPromise = null;
    throw err;
  });
  feeSettingsLoadedAt = now;
  return feeSettingsPromise;
}

/**
 * Handling fees are no longer configured per category — charges are managed
 * centrally in the quick-commerce fee settings instead. Kept as a no-op so the
 * order total pipeline keeps its shape and callers stay unchanged.
 */
export async function calculateHandlingFeeFromProducts() {
  return 0;
}

/**
 * Legacy signature (subtotal only, no distance) kept for the Food "mixed
 * order" combiner, which only needs a base delivery-fee estimate for the
 * quick-commerce leg of a combined order.
 */
export function calculateDeliveryFeeFromSettings(subtotal, feeSettings = DEFAULT_QUICK_FEE_SETTINGS) {
  return calculateBaseDeliveryFeeForDistance(0, feeSettings || DEFAULT_QUICK_FEE_SETTINGS);
}

export async function calculateQuickPricing({
  subtotal = 0,
  discount = 0,
  tip = 0,
  products = [],
  distanceKm = 0,
} = {}) {
  const feeSettings = await getActiveFeeSettings();
  const safeSubtotal = Number(subtotal || 0);
  const safeDiscount = Math.max(0, Number(discount || 0));
  const safeTip = Math.max(0, Number(tip || 0));
  const platformFee = Number(feeSettings.platformFee || 0);
  const handlingFee = await calculateHandlingFeeFromProducts(products);
  const split = calculateDeliverySplit(safeSubtotal, distanceKm, feeSettings);
  const deliveryFee = split.userDeliveryFee;
  const gstRate = Number(feeSettings.gstRate || 0);
  const calculatedGst =
    Number.isFinite(gstRate) && gstRate > 0
      ? Math.round(safeSubtotal * (gstRate / 100))
      : 0;
  const tax = calculatedGst;
  const gst = calculatedGst;
  const total = Math.max(0, safeSubtotal + deliveryFee + handlingFee + platformFee + tax - safeDiscount + safeTip);

  return {
    pricing: {
      subtotal: safeSubtotal,
      tax,
      gst,
      packagingFee: 0,
      deliveryFee,
      totalDeliveryFee: split.totalDeliveryFee,
      userDeliveryFee: split.userDeliveryFee,
      restaurantDeliveryFee: split.sellerDeliveryFee,
      sponsoredDelivery: split.sellerDeliveryFee > 0,
      sponsoredKm: split.sponsoredKm,
      deliveryDistanceKm: split.deliveryDistanceKm,
      deliverySponsorType: split.deliverySponsorType,
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

// Rider earning is no longer a separate commission-slab system — it is the
// full distance-based delivery fee (see calculateDeliverySplit.totalDeliveryFee),
// computed per seller in order.controller.js's placeOrder flow.
