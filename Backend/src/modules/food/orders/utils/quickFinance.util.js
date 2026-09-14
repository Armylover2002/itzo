/**
 * Food Quick Delivery finance helpers (accounting freeze).
 *
 * Shared pure math for platform P&L so order create and food_transactions
 * stay identical. Does not perform DB I/O.
 *
 * Freeze rules (unchanged for platform P&L):
 * - Platform receives quickPlatformShare only (never full quickDeliveryFee)
 * - Restaurant Quick Share is not platform income (settlement via restaurantShare after delivery)
 * - Rider bonus is already inside riderShare/riderEarning — deduct base rider only
 */

/**
 * @param {object} params
 * @param {number} params.deliveryFee
 * @param {number} params.platformFee
 * @param {number} params.restaurantCommission
 * @param {number} [params.sellerCommission=0]
 * @param {number} [params.quickPlatformShare=0]
 * @param {number} [params.baseRiderShare=0] — rider earning WITHOUT quickRiderBonus
 * @param {number} [params.adminDiscountShare=0]
 * @returns {number}
 */
export function computePlatformNetProfitWithQuickFreeze({
  deliveryFee = 0,
  platformFee = 0,
  restaurantCommission = 0,
  sellerCommission = 0,
  quickPlatformShare = 0,
  baseRiderShare = 0,
  adminDiscountShare = 0,
} = {}) {
  const raw =
    (Number(deliveryFee) || 0) +
    (Number(platformFee) || 0) +
    (Number(restaurantCommission) || 0) +
    (Number(sellerCommission) || 0) +
    (Number(quickPlatformShare) || 0) -
    (Number(baseRiderShare) || 0) -
    (Number(adminDiscountShare) || 0);
  return Math.max(0, raw);
}
