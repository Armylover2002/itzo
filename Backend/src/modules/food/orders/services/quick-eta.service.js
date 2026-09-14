/**
 * Food Quick Delivery ETA promise engine v2.
 * Used only when deliveryMode=quick. Basic Instant unchanged.
 *
 * NEVER uses estimatedDeliveryTime / estimatedDeliveryTimeMinutes
 * (those are customer listing / Basic delivery estimates only).
 *
 * Formula:
 *   kitchenPrep + assignment + pickup + travel + buffer = midRaw
 *   windowed {min,max}; reject if max > maxEtaMinutes.
 *
 * SLA clock (FOOD_QUICK_SLA_CLOCK = 'placed'):
 *   Promise startsAt is order placement / quote time.
 *   Breach if deliveredAt > endsAt.
 */
import {
  FOOD_QUICK_ETA_ENGINE_VERSION,
  FOOD_QUICK_SLA_CLOCK,
  QUICK_DELIVERY_DEFAULTS,
  normalizeQuickDeliverySettings,
  parseKitchenPrepMinutes,
} from '../utils/quickDeliveryConstants.js';

const WINDOW_HALF_MINUTES = 2.5;

/**
 * @param {object} params
 * @param {object|null} params.restaurant — normalized source (kitchenPrepMinutes)
 * @param {number|null} params.deliveryDistanceKm
 * @param {number|null} params.travelMinutes — Matrix / Google duration if available
 * @param {object|null} params.quickSettings — normalized or raw fee.quickDelivery
 * @param {Date} [params.startsAt]
 * @param {number|null} [params.assignmentMinutes] — override for future live provider
 */
export function computeFoodQuickEtaPromise(params = {}) {
  const settings = normalizeQuickDeliverySettings(params.quickSettings);
  const {
    kitchenPrep,
    prepSource,
  } = resolveKitchenPrepMinutes(params.restaurant, settings);

  const {
    assignment,
    assignmentSource,
  } = resolveAssignmentMinutes(params.assignmentMinutes, settings);

  const pickup = Math.max(0, Number(settings.pickupMinutes) || 0);
  const pickupSource = 'settings_internal';

  const {
    travel,
    travelSource,
  } = resolveTravelMinutes({
    travelMinutes: params.travelMinutes,
    deliveryDistanceKm: params.deliveryDistanceKm,
    settings,
  });

  const buffer = Math.max(0, Number(settings.etaBufferMinutes) || 0);
  const bufferSource = 'settings_internal';

  const components = {
    kitchenPrepMinutes: Math.round(kitchenPrep),
    assignmentMinutes: Math.round(assignment),
    pickupMinutes: Math.round(pickup),
    travelMinutes: Math.round(travel),
    bufferMinutes: Math.round(buffer),
  };

  const sources = {
    prepSource,
    assignmentSource,
    pickupSource,
    travelSource,
    bufferSource,
  };

  const midRaw =
    components.kitchenPrepMinutes +
    components.assignmentMinutes +
    components.pickupMinutes +
    components.travelMinutes +
    components.bufferMinutes;

  const half = WINDOW_HALF_MINUTES;
  let min = Math.max(5, Math.floor((midRaw - half) / 5) * 5);
  let max = Math.ceil((midRaw + half) / 5) * 5;
  if (max < min) max = min + 5;

  const maxCap = Number(settings.maxEtaMinutes) || 0;
  const auditBase = {
    engineVersion: FOOD_QUICK_ETA_ENGINE_VERSION,
    slaClock: FOOD_QUICK_SLA_CLOCK,
    components,
    sources,
    midRaw: Math.round(midRaw * 100) / 100,
    windowMin: min,
    windowMax: max,
    maxEtaMinutes: maxCap,
  };

  if (maxCap > 0 && max > maxCap) {
    return {
      eligibleByEta: false,
      reason: 'max_eta',
      etaPromise: null,
      audit: {
        ...auditBase,
        rejectionReason: 'max_eta',
        eligibleByEta: false,
      },
    };
  }

  const startsAt = params.startsAt instanceof Date ? params.startsAt : new Date();
  const endsAt = new Date(startsAt.getTime() + max * 60 * 1000);

  const etaPromise = {
    min,
    max,
    mid: Math.round(midRaw),
    startsAt,
    endsAt,
    /** BC alias — same as kitchen prep (not listing delivery estimate). */
    prepMinutes: components.kitchenPrepMinutes,
    kitchenPrepMinutes: components.kitchenPrepMinutes,
    assignmentMinutes: components.assignmentMinutes,
    pickupMinutes: components.pickupMinutes,
    travelMinutes: components.travelMinutes,
    bufferMinutes: components.bufferMinutes,
    engineVersion: FOOD_QUICK_ETA_ENGINE_VERSION,
    slaClock: FOOD_QUICK_SLA_CLOCK,
    components,
    sources,
    prepSource,
    travelSource,
    assignmentSource,
    rejectionReason: '',
  };

  return {
    eligibleByEta: true,
    reason: '',
    etaPromise,
    audit: {
      ...auditBase,
      rejectionReason: '',
      eligibleByEta: true,
    },
  };
}

/**
 * Display-only ETA for Basic Instant food orders (banner / tracking countdown).
 * Same component math as Quick, but NEVER rejects on maxEtaMinutes and
 * does not participate in Quick SLA compensation.
 */
export function computeFoodDisplayEtaPromise(params = {}) {
  const result = computeFoodQuickEtaPromise({
    ...params,
    // Disable maxEta rejection by clearing the cap for display-only estimates.
    quickSettings: {
      ...(params.quickSettings && typeof params.quickSettings === 'object'
        ? params.quickSettings
        : {}),
      maxEtaMinutes: 0,
    },
  });

  if (!result?.etaPromise) {
    return { etaPromise: null };
  }

  return {
    etaPromise: {
      ...result.etaPromise,
      engineVersion: 'food-basic-eta-v1',
      // Display clock only — not Quick SLA.
      slaClock: 'placed',
      rejectionReason: '',
    },
  };
}

function resolveKitchenPrepMinutes(restaurant, settings) {
  const fromRestaurant = parseKitchenPrepMinutes(restaurant?.kitchenPrepMinutes);
  if (Number.isFinite(fromRestaurant)) {
    return { kitchenPrep: fromRestaurant, prepSource: 'restaurant' };
  }
  // settings always come from normalizeQuickDeliverySettings (finite defaultKitchenPrepMinutes).
  const fromDefault = parseKitchenPrepMinutes(settings.defaultKitchenPrepMinutes);
  return {
    kitchenPrep: Number.isFinite(fromDefault)
      ? fromDefault
      : QUICK_DELIVERY_DEFAULTS.defaultKitchenPrepMinutes,
    prepSource: 'platform_default',
  };
}

function resolveAssignmentMinutes(override, settings) {
  const fromOverride = Number(override);
  if (Number.isFinite(fromOverride) && fromOverride >= 0) {
    return { assignment: fromOverride, assignmentSource: 'provider_override' };
  }
  return {
    assignment: Math.max(0, Number(settings.riderAssignmentMinutes) || 0),
    assignmentSource: 'settings_internal',
  };
}

function resolveTravelMinutes({ travelMinutes, deliveryDistanceKm, settings }) {
  const fromApi = Number(travelMinutes);
  if (Number.isFinite(fromApi) && fromApi > 0) {
    return { travel: fromApi, travelSource: 'matrix' };
  }

  const distanceKm = Number(deliveryDistanceKm);
  const speed = Math.max(1, Number(settings.avgRiderSpeedKmh) || 22);
  if (Number.isFinite(distanceKm) && distanceKm >= 0) {
    return {
      travel: (distanceKm / speed) * 60,
      travelSource: 'road_distance',
    };
  }

  return {
    travel: Math.max(0, Number(settings.fallbackTravelMinutes) || 12),
    travelSource: 'fallback',
  };
}

/**
 * SLA: deliveredAt must be <= endsAt (placed clock).
 * Frozen: FOOD_QUICK_SLA_CLOCK = 'placed' — uses etaPromise.startsAt/endsAt from create.
 */
export function evaluateQuickSlaBreach(order, deliveredAt = new Date()) {
  if (String(order?.deliveryMode || '') !== 'quick') {
    return { applicable: false, breached: false, slaClock: FOOD_QUICK_SLA_CLOCK };
  }
  const promise = order?.etaPromise;
  if (!promise?.max && !promise?.endsAt) {
    return { applicable: false, breached: false, slaClock: FOOD_QUICK_SLA_CLOCK };
  }
  const end =
    promise.endsAt instanceof Date
      ? promise.endsAt
      : promise.endsAt
        ? new Date(promise.endsAt)
        : promise.startsAt
          ? new Date(new Date(promise.startsAt).getTime() + Number(promise.max) * 60 * 1000)
          : null;
  if (!end || Number.isNaN(end.getTime())) {
    return { applicable: false, breached: false, slaClock: FOOD_QUICK_SLA_CLOCK };
  }
  const delivered = deliveredAt instanceof Date ? deliveredAt : new Date(deliveredAt);
  const breached = delivered.getTime() > end.getTime();
  const delayMinutes = Math.max(0, Math.round((delivered.getTime() - end.getTime()) / 60000));
  return {
    applicable: true,
    breached,
    delayMinutes,
    endsAt: end,
    slaClock: String(promise.slaClock || FOOD_QUICK_SLA_CLOCK),
  };
}

