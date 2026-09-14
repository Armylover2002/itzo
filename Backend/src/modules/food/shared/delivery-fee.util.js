import { FoodFeeSettings } from '../admin/models/feeSettings.model.js';
import { getRoadDistanceKmValue } from '../../../services/roadDistance.service.js';
import {
  calculateDistanceKm,
  normalizeDeliveryAddress,
  normalizeRestaurantLocation,
  parseGeoPoint,
} from './geo.utils.js';

export const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

export function resolveRestaurantToUserDistanceKm(restaurant, address) {
  const normalizedAddress = normalizeDeliveryAddress(address);
  const normalizedRestaurant = restaurant
    ? { ...restaurant, location: normalizeRestaurantLocation(restaurant.location) }
    : restaurant;
  const distanceKm = calculateDistanceKm(normalizedRestaurant, normalizedAddress);
  return Number.isFinite(distanceKm) ? Number(distanceKm.toFixed(2)) : null;
}

/** Road/travel distance (same source as home & restaurant details pages). */
export async function resolveRestaurantToUserRoadDistanceKm(restaurant, address) {
  const normalizedAddress = normalizeDeliveryAddress(address);
  const normalizedRestaurant = restaurant
    ? { ...restaurant, location: normalizeRestaurantLocation(restaurant.location) }
    : restaurant;

  const from = parseGeoPoint(normalizedRestaurant);
  const to = parseGeoPoint(normalizedAddress);
  if (!from || !to) {
    return resolveRestaurantToUserDistanceKm(restaurant, address);
  }

  try {
    const distanceKm = await getRoadDistanceKmValue(from, to);
    if (Number.isFinite(distanceKm) && distanceKm > 0) {
      return Number(distanceKm.toFixed(2));
    }
  } catch {
    // Fall through to straight-line estimate.
  }

  return resolveRestaurantToUserDistanceKm(restaurant, address);
}

function resolveBaseDeliveryFee(feeSettings = {}) {
  const ranges = Array.isArray(feeSettings.deliveryFeeRanges)
    ? feeSettings.deliveryFeeRanges
    : [];
  const rangeFees = ranges
    .map((range) => Number(range?.fee))
    .filter((fee) => Number.isFinite(fee) && fee >= 0);

  const flat = Number(feeSettings.deliveryFee ?? feeSettings.baseDeliveryFee);
  const hasPositiveFlat = Number.isFinite(flat) && flat > 0;

  if (rangeFees.length > 0) {
    const minRangeFee = Math.min(...rangeFees);
    return hasPositiveFlat ? flat : minRangeFee;
  }

  return Number.isFinite(flat) && flat >= 0 ? flat : 0;
}

function matchFeeRange(ranges, distanceKm, pickValue) {
  if (!Array.isArray(ranges) || ranges.length === 0 || !Number.isFinite(distanceKm)) {
    return null;
  }

  const sorted = [...ranges].sort((a, b) => Number(a.min) - Number(b.min));
  for (let i = 0; i < sorted.length; i += 1) {
    const range = sorted[i] || {};
    const min = Number(range.min);
    const max = Number(range.max);
    if (!Number.isFinite(min) || !Number.isFinite(max)) continue;

    const isLast = i === sorted.length - 1;
    const inRange = isLast
      ? distanceKm >= min && distanceKm <= max
      : distanceKm >= min && distanceKm < max;

    if (inRange) {
      const value = pickValue(range);
      return Number.isFinite(value) ? value : null;
    }
  }

  return null;
}

export async function loadActiveFeeSettings() {
  const feeDoc = await FoodFeeSettings.findOne({ isActive: { $ne: false } })
    .sort({ createdAt: -1 })
    .lean();

  return (
    feeDoc || {
      deliveryFee: 0,
      deliveryFeeRanges: [],
      platformFee: 0,
      packagingFee: 0,
      gstRate: 0,
    }
  );
}

export function hasDeliveryFeeRanges(feeSettings = {}) {
  return Array.isArray(feeSettings.deliveryFeeRanges) && feeSettings.deliveryFeeRanges.length > 0;
}

/**
 * Admin-configured flat / base+per-km delivery fee used when ranges/slabs do not match.
 * Never hardcodes a magic ₹60 — uses deliveryFee / baseDeliveryFee / perKmCharge.
 */
export function resolveConfiguredDeliveryFeeFallback(feeSettings = {}, distanceKm = null) {
  const distance = Number(distanceKm);
  const baseFee = Number(feeSettings.baseDeliveryFee ?? feeSettings.deliveryFee);
  const baseKm = Number(feeSettings.baseDistanceKm);
  const perKm = Number(feeSettings.perKmCharge);

  if (Number.isFinite(baseFee) && baseFee >= 0) {
    if (
      Number.isFinite(distance) &&
      distance >= 0 &&
      Number.isFinite(perKm) &&
      perKm > 0 &&
      Number.isFinite(baseKm) &&
      baseKm >= 0 &&
      distance > baseKm
    ) {
      return round2(baseFee + (distance - baseKm) * perKm);
    }
    return round2(baseFee);
  }

  // Matches normalizeFoodFeeSettings default when admin has not configured fees.
  return 25;
}

export function resolveUserDeliveryFee(feeSettings = {}, { subtotal = 0, distanceKm = null } = {}) {
  const ranges = Array.isArray(feeSettings.deliveryFeeRanges)
    ? feeSettings.deliveryFeeRanges
    : [];

  if (ranges.length > 0 && Number.isFinite(distanceKm)) {
    const matchedFee = matchFeeRange(ranges, distanceKm, (range) => Number(range.fee));
    if (Number.isFinite(matchedFee)) {
      return {
        deliveryFee: matchedFee,
        distanceKm: Number(distanceKm.toFixed(2)),
        source: 'distance',
      };
    }
  }

  const fallbackFee = Number.isFinite(Number(distanceKm))
    ? resolveConfiguredDeliveryFeeFallback(feeSettings, distanceKm)
    : resolveBaseDeliveryFee(feeSettings);
  return {
    deliveryFee: fallbackFee,
    distanceKm: Number.isFinite(distanceKm) ? Number(distanceKm.toFixed(2)) : null,
    source: Number.isFinite(distanceKm) ? 'default_unmatched_range' : 'default',
  };
}

/**
 * Rider earning from deliveryFeeRanges when configured; otherwise same base/per-km
 * (or flat) fee config used for customer delivery so riders are never stuck at ₹0
 * while the customer still pays a delivery charge.
 */
export function calculateRiderEarning(feeSettings = {}, distanceKm) {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance < 0) return 0;

  const ranges = Array.isArray(feeSettings.deliveryFeeRanges)
    ? feeSettings.deliveryFeeRanges
    : [];

  if (ranges.length > 0) {
    const earning = matchFeeRange(ranges, distance, (range) => {
      const basePay = Number(range.deliveryBoyBasePay || 0);
      const perKm = Number(range.deliveryBoyPerKm || 0);
      const perKmAmount = perKm > 0 ? distance * perKm : 0;

      // Guarantee slab base pay floor while still allowing higher per-km payout.
      if (basePay > 0 && perKmAmount > 0) return Math.max(basePay, perKmAmount);
      if (basePay > 0) return basePay;
      if (perKmAmount > 0) return perKmAmount;
      return 0;
    });

    if (Number.isFinite(earning) && earning > 0) {
      return round2(earning);
    }
  }

  return resolveConfiguredDeliveryFeeFallback(feeSettings, distance);
}
