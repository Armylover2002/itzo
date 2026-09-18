// Restaurant per-order commission flow is disabled in favor of the subscription
// based model. Kept in place (not removed) so it can be re-enabled later by
// flipping this flag back to true. Mirrors Backend/src/modules/food/constants/commission.constants.js.
export const RESTAURANT_COMMISSION_ENABLED = false;

export const DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE = 15;

/**
 * Resolves restaurant commission percentage.
 * - null / undefined / NaN / empty → default 15%
 * - explicit 0 → 0% (negotiated zero commission)
 *
 * When RESTAURANT_COMMISSION_ENABLED is false the whole flow is disabled and
 * this always resolves to 0, regardless of the stored/passed value.
 */
export function resolveRestaurantCommissionPercentage(value) {
  if (!RESTAURANT_COMMISSION_ENABLED) {
    return 0;
  }
  if (value === null || value === undefined || value === '') {
    return DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE;
  }
  return num;
}

export function isCustomRestaurantCommission(value) {
  if (!RESTAURANT_COMMISSION_ENABLED) {
    return false;
  }
  return resolveRestaurantCommissionPercentage(value) !== DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE;
}
