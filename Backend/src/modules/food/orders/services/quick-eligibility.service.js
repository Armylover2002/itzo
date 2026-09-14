/**
 * Food Quick Delivery eligibility.
 * Customer may select Quick only when Global ∧ Restaurant ∧ Zone are true,
 * plus Instant food (not Schedule / not QC parent orderType).
 *
 * Distance: uses maxDistanceKm (customer eligibility). Not maxRadiusKm
 * (rider hunt — see order-dispatch.service.js).
 *
 * MOV: minOrderValue from ADR inventory; default 0 = no MOV gate. Not Admin UI.
 *
 * No .env switches. Missing DB fields ⇒ false.
 *
 * Identity: prefer the normalized restaurant from order entry. Never call
 * FoodRestaurant.findById with a business REST###### code. Fallback resolve
 * uses resolveRestaurantDocument (business code OR Mongo _id).
 */
import { FoodFeeSettings } from '../../admin/models/feeSettings.model.js';
import { FoodZone } from '../../admin/models/zone.model.js';
import { resolveRestaurantDocument } from '../../shared/restaurantIdentity.util.js';
import {
  FOOD_QUICK_FINANCE_VERSION,
  normalizeQuickDeliverySettings,
} from '../utils/quickDeliveryConstants.js';

/**
 * @param {object} params
 * @param {string} [params.orderType] food | quick | mixed
 * @param {object|null} [params.restaurant] lean restaurant or pickup source
 * @param {string|import('mongoose').Types.ObjectId|null} [params.restaurantId]
 * @param {object|null} [params.zone] lean FoodZone
 * @param {string|import('mongoose').Types.ObjectId|null} [params.zoneId]
 * @param {object|null} [params.feeSettings] active fee settings doc
 * @param {Date|string|null} [params.scheduledAt]
 * @param {number|null} [params.subtotal]
 * @param {number|null} [params.deliveryDistanceKm]
 */
export async function evaluateFoodQuickDeliveryEligibility(params = {}) {
  const orderType = String(params.orderType || 'food');
  const reasons = [];

  if (orderType !== 'food') {
    return ineligible('Food Quick Delivery is only available for restaurant food orders', {
      orderType,
    });
  }

  if (params.scheduledAt) {
    return ineligible('Quick Delivery cannot be combined with Schedule Order', {
      scheduledAt: true,
    });
  }

  let feeSettings = params.feeSettings;
  if (!feeSettings) {
    feeSettings = await FoodFeeSettings.findOne({ isActive: { $ne: false } })
      .sort({ createdAt: -1 })
      .lean();
  }
  const quick = normalizeQuickDeliverySettings(feeSettings?.quickDelivery);
  if (quick.enabled !== true) {
    reasons.push('global_disabled');
  }

  let restaurant = params.restaurant;
  // Only refetch when the caller did not provide a complete gate field.
  // Normalized order-entry sources always include quickDeliveryEnabled (boolean).
  const hasQuickGateField =
    restaurant != null && typeof restaurant.quickDeliveryEnabled === 'boolean';
  if (params.restaurantId && !hasQuickGateField) {
    restaurant = await resolveRestaurantDocument(params.restaurantId);
  }
  const restaurantEnabled = restaurant?.quickDeliveryEnabled === true;
  if (!restaurantEnabled) {
    reasons.push('restaurant_disabled');
  }

  let zone = params.zone;
  if (params.zoneId && (!zone || zone.quickDeliveryEnabled === undefined)) {
    zone = await FoodZone.findById(params.zoneId).select('quickDeliveryEnabled isActive').lean();
  }
  const zoneEnabled = zone?.quickDeliveryEnabled === true;
  if (!zoneEnabled) {
    reasons.push('zone_disabled');
  }

  const subtotal = Number(params.subtotal);
  // ADR minOrderValue: reserved Quick MOV. Default 0 → skipped. Not Admin-editable in FE.
  if (Number.isFinite(subtotal) && subtotal < Number(quick.minOrderValue || 0)) {
    reasons.push('min_order_value');
  }

  // Customer trip distance eligibility (maxDistanceKm). Distinct from rider search maxRadiusKm.
  const distanceKm = Number(params.deliveryDistanceKm);
  if (
    Number.isFinite(distanceKm) &&
    Number(quick.maxDistanceKm) > 0 &&
    distanceKm > Number(quick.maxDistanceKm)
  ) {
    reasons.push('max_distance');
  }

  const eligible =
    quick.enabled === true &&
    restaurantEnabled &&
    zoneEnabled &&
    !reasons.includes('min_order_value') &&
    !reasons.includes('max_distance');

  return {
    eligible,
    reason: eligible
      ? ''
      : reasons[0] || 'not_eligible',
    reasons,
    settings: quick,
    gates: {
      globalEnabled: quick.enabled === true,
      restaurantEnabled,
      zoneEnabled,
    },
  };
}

/**
 * Split Quick Charge using admin settings (3-way).
 * restaurantSharePct defaults to 0 → identical to historical Platform+Rider split.
 * Residual paise after rounding go to platform (conservation: P+R+S === charge).
 * quickRiderBonus kept as BC alias of rider share.
 */
export function splitQuickDeliveryCharge(quickSettings, chargeOverride = null) {
  const settings = normalizeQuickDeliverySettings(quickSettings);
  const charge = Math.max(
    0,
    Number(
      chargeOverride != null && Number.isFinite(Number(chargeOverride))
        ? chargeOverride
        : settings.charge,
    ) || 0,
  );
  const platformSharePct = Number(settings.platformSharePct) || 0;
  const riderSharePct = Number(settings.riderSharePct) || 0;
  const restaurantSharePct = Number(settings.restaurantSharePct) || 0;

  const quickRiderShare = Math.round(((charge * riderSharePct) / 100) * 100) / 100;
  const quickRestaurantShare =
    Math.round(((charge * restaurantSharePct) / 100) * 100) / 100;
  const quickPlatformShare =
    Math.round((charge - quickRiderShare - quickRestaurantShare) * 100) / 100;

  return {
    quickDeliveryFee: charge,
    quickPlatformShare,
    quickRiderShare,
    /** BC alias — same rupees as quickRiderShare; riderEarning still uses this name. */
    quickRiderBonus: quickRiderShare,
    quickRestaurantShare,
    platformSharePct,
    riderSharePct,
    restaurantSharePct,
    quickSharePcts: {
      platform: platformSharePct,
      rider: riderSharePct,
      restaurant: restaurantSharePct,
    },
    quickFinanceVersion: FOOD_QUICK_FINANCE_VERSION,
  };
}

function ineligible(reason, extra = {}) {
  return {
    eligible: false,
    reason,
    reasons: [reason],
    settings: normalizeQuickDeliverySettings(null),
    gates: {
      globalEnabled: false,
      restaurantEnabled: false,
      zoneEnabled: false,
      ...extra.gates,
    },
    ...extra,
  };
}

export function isFoodQuickDeliveryMode(deliveryMode) {
  return String(deliveryMode || 'basic').trim().toLowerCase() === 'quick';
}
