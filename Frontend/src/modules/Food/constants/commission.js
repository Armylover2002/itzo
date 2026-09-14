export const DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE = 15;

/**
 * Resolves restaurant commission percentage.
 * - null / undefined / NaN / empty → default 15%
 * - explicit 0 → 0% (negotiated zero commission)
 */
export function resolveRestaurantCommissionPercentage(value) {
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
  return resolveRestaurantCommissionPercentage(value) !== DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE;
}
