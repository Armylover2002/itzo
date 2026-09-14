/**
 * Food Quick Delivery settings (ADR-FOOD-QUICK-001).
 *
 * ── Business concepts (do NOT merge) ─────────────────────────────────────
 * maxDistanceKm  — CUSTOMER ELIGIBILITY: restaurant→customer road distance
 *                  must be ≤ this for Quick quote/create. Admin-editable.
 * maxRadiusKm    — RIDER SEARCH: max km from pickup when hunting delivery
 *                  partners for Quick priority dispatch. Internal (not Admin UI).
 * maxEtaMinutes  — ELIGIBILITY ONLY: promise window max; if computed ETA max
 *                  exceeds this, Quick is ineligible. Never a dispatch-hunt
 *                  constraint. Admin-editable.
 * defaultKitchenPrepMinutes — platform fallback when restaurant has no
 *                  kitchenPrepMinutes. Admin-editable business field.
 *
 * ── Surface ──────────────────────────────────────────────────────────────
 * BUSINESS (Admin UI): enabled, charge, platformSharePct, riderSharePct,
 *                      restaurantSharePct (default 0), maxDistanceKm,
 *                      maxEtaMinutes, defaultKitchenPrepMinutes
 * INTERNAL (defaults / preserved DB; not Admin UI):
 *   maxRadiusKm, etaBufferMinutes, riderAssignmentMinutes, pickupMinutes,
 *   avgRiderSpeedKmh, fallbackTravelMinutes, minOrderValue, dispatch*, sla*
 *
 * Admin save merges BUSINESS onto existing internals
 * (mergeQuickDeliveryForAdminSave) so ops cannot wipe eng knobs from FE.
 */

/** Engine identity for Quick ETA snapshots (immutable contract string). */
export const FOOD_QUICK_ETA_ENGINE_VERSION = 'food-quick-eta-v2';

/**
 * Finance snapshot version for Quick charge 3-way split (platform/rider/restaurant).
 * Orders persist this at create; never recompute historical splits from live settings.
 */
export const FOOD_QUICK_FINANCE_VERSION = 'food-quick-finance-v2';

/**
 * SLA clock freeze: Quick promise starts at order placement / pricing startsAt.
 * Delivered must be by etaPromise.endsAt. All services must use this definition.
 */
export const FOOD_QUICK_SLA_CLOCK = 'placed';

export const KITCHEN_PREP_MINUTES_MIN = 1;
export const KITCHEN_PREP_MINUTES_MAX = 90;

/** Admin-facing business keys only. */
export const QUICK_DELIVERY_BUSINESS_KEYS = Object.freeze([
  'enabled',
  'charge',
  'platformSharePct',
  'riderSharePct',
  'restaurantSharePct',
  'maxDistanceKm',
  'maxEtaMinutes',
  'defaultKitchenPrepMinutes',
]);

/**
 * Engineering / dispatch / SLA / reserved MOV — not shown in Admin UI.
 * maxRadiusKm ≠ maxDistanceKm (rider hunt vs customer eligibility).
 */
export const QUICK_DELIVERY_INTERNAL_DEFAULTS = Object.freeze({
  /** Rider search radius for Quick priority dispatch (km). */
  maxRadiusKm: 20,
  /** Added into ETA mid before promise windowing. */
  etaBufferMinutes: 5,
  /** Static rider-assignment minutes until live provider plugs in. */
  riderAssignmentMinutes: 3,
  /** Static pickup handover minutes. */
  pickupMinutes: 2,
  /** Fallback average rider speed (km/h) when no Matrix duration. */
  avgRiderSpeedKmh: 22,
  /** Travel minutes when distance is unknown. */
  fallbackTravelMinutes: 12,
  /**
   * Quick minimum order value (₹). ADR inventory; UI hidden; default 0 = off.
   * Eligibility still evaluates when > 0 (DB/API).
   */
  minOrderValue: 0,
  dispatchStartRadiusKm: 8,
  dispatchTimeoutSec: 45,
  maxDispatchWaves: 3,
  slaCompensationPct: 100,
  slaCompensationMode: 'wallet',
});

/** Full defaults (business + internal) for normalize / migrations. */
export const QUICK_DELIVERY_DEFAULTS = Object.freeze({
  enabled: false,
  charge: 30,
  platformSharePct: 70,
  riderSharePct: 30,
  /** Restaurant Quick Share — default 0 keeps historical 2-way finance identical. */
  restaurantSharePct: 0,
  /** Customer path distance cap for Quick eligibility (km). */
  maxDistanceKm: 8,
  /** Max allowed Quick promise upper bound (minutes); eligibility only. */
  maxEtaMinutes: 30,
  /** Platform kitchen prep fallback when restaurant.kitchenPrepMinutes unset. */
  defaultKitchenPrepMinutes: 12,
  ...QUICK_DELIVERY_INTERNAL_DEFAULTS,
});

/**
 * Pick only business fields from an incoming admin payload.
 * Omits undefined so merge can preserve existing values.
 */
export function pickQuickDeliveryBusinessFields(input = null) {
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const key of QUICK_DELIVERY_BUSINESS_KEYS) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  return out;
}

/**
 * Admin upsert merge: apply business fields from incoming; keep existing
 * internal fields (or constants). Does not change runtime behaviour for
 * already-stored engineering values.
 */
export function mergeQuickDeliveryForAdminSave(existingRaw, incomingRaw) {
  const existing =
    existingRaw && typeof existingRaw === 'object' ? existingRaw : {};
  const business = pickQuickDeliveryBusinessFields(incomingRaw);
  return normalizeQuickDeliverySettings({
    ...existing,
    ...business,
  });
}

/**
 * Merge partial quickDelivery with defaults. Never mutates input.
 * Used by pricing / eligibility / ETA / dispatch / SLA / getFeeSettings.
 */
export function normalizeQuickDeliverySettings(input = null) {
  const src = input && typeof input === 'object' ? input : {};

  // Missing restaurantSharePct ⇒ 0 (historical 2-way docs stay Platform+Rider=100).
  const restaurantSharePct = clampPct(
    src.restaurantSharePct ?? QUICK_DELIVERY_DEFAULTS.restaurantSharePct,
  );

  let platformSharePct = clampPct(
    src.platformSharePct ?? QUICK_DELIVERY_DEFAULTS.platformSharePct,
  );
  let riderSharePct = clampPct(src.riderSharePct ?? QUICK_DELIVERY_DEFAULTS.riderSharePct);

  // Keep shares coherent when only one of platform/rider is sent (restaurant stays explicit/default).
  if (src.platformSharePct !== undefined && src.riderSharePct === undefined) {
    riderSharePct = clampPct(100 - platformSharePct - restaurantSharePct);
  } else if (src.riderSharePct !== undefined && src.platformSharePct === undefined) {
    platformSharePct = clampPct(100 - riderSharePct - restaurantSharePct);
  }

  const modeRaw = String(src.slaCompensationMode || QUICK_DELIVERY_DEFAULTS.slaCompensationMode)
    .trim()
    .toLowerCase();
  const slaCompensationMode = modeRaw === 'refund' ? 'refund' : 'wallet';

  return {
    enabled: src.enabled === true,
    charge: nonNegNumber(src.charge, QUICK_DELIVERY_DEFAULTS.charge),
    platformSharePct,
    riderSharePct,
    restaurantSharePct,
    maxDistanceKm: nonNegNumber(src.maxDistanceKm, QUICK_DELIVERY_DEFAULTS.maxDistanceKm),
    maxRadiusKm: nonNegNumber(src.maxRadiusKm, QUICK_DELIVERY_DEFAULTS.maxRadiusKm),
    maxEtaMinutes: nonNegNumber(src.maxEtaMinutes, QUICK_DELIVERY_DEFAULTS.maxEtaMinutes),
    defaultKitchenPrepMinutes: clampKitchenPrep(
      src.defaultKitchenPrepMinutes,
      QUICK_DELIVERY_DEFAULTS.defaultKitchenPrepMinutes,
    ),
    etaBufferMinutes: nonNegNumber(src.etaBufferMinutes, QUICK_DELIVERY_DEFAULTS.etaBufferMinutes),
    riderAssignmentMinutes: nonNegNumber(
      src.riderAssignmentMinutes,
      QUICK_DELIVERY_DEFAULTS.riderAssignmentMinutes,
    ),
    pickupMinutes: nonNegNumber(src.pickupMinutes, QUICK_DELIVERY_DEFAULTS.pickupMinutes),
    avgRiderSpeedKmh: Math.max(
      1,
      nonNegNumber(src.avgRiderSpeedKmh, QUICK_DELIVERY_DEFAULTS.avgRiderSpeedKmh) || 1,
    ),
    fallbackTravelMinutes: nonNegNumber(
      src.fallbackTravelMinutes,
      QUICK_DELIVERY_DEFAULTS.fallbackTravelMinutes,
    ),
    minOrderValue: nonNegNumber(src.minOrderValue, QUICK_DELIVERY_DEFAULTS.minOrderValue),
    dispatchStartRadiusKm: nonNegNumber(
      src.dispatchStartRadiusKm,
      QUICK_DELIVERY_DEFAULTS.dispatchStartRadiusKm,
    ),
    dispatchTimeoutSec: Math.max(
      1,
      nonNegNumber(src.dispatchTimeoutSec, QUICK_DELIVERY_DEFAULTS.dispatchTimeoutSec) || 1,
    ),
    maxDispatchWaves: Math.max(
      1,
      Math.floor(
        nonNegNumber(src.maxDispatchWaves, QUICK_DELIVERY_DEFAULTS.maxDispatchWaves) || 1,
      ),
    ),
    slaCompensationPct: clampPct(
      src.slaCompensationPct ?? QUICK_DELIVERY_DEFAULTS.slaCompensationPct,
    ),
    slaCompensationMode,
  };
}

/**
 * Validate kitchen prep integer minutes (restaurant or platform default).
 * @returns {number|null} null when clear / empty
 */
export function parseKitchenPrepMinutes(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  const rounded = Math.round(n);
  if (rounded < KITCHEN_PREP_MINUTES_MIN || rounded > KITCHEN_PREP_MINUTES_MAX) {
    return NaN;
  }
  return rounded;
}

function clampKitchenPrep(value, fallback) {
  const parsed = parseKitchenPrepMinutes(value);
  if (Number.isFinite(parsed)) return parsed;
  const fb = parseKitchenPrepMinutes(fallback);
  return Number.isFinite(fb)
    ? fb
    : QUICK_DELIVERY_DEFAULTS.defaultKitchenPrepMinutes;
}

function clampPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function nonNegNumber(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return Number(fallback) || 0;
  return n;
}

