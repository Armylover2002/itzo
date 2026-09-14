/**
 * Quick Commerce coupon discount bearer split.
 * - Admin coupon  → cuts admin/platform earnings (can go negative)
 * - Seller coupon → cuts seller product earnings / receivable (can go negative)
 * Stored coupon source is usually `restaurant` for seller coupons; FE may send `seller`.
 */

export const normalizeQuickCouponSource = (source) => {
  const value = String(source || '').trim().toLowerCase();
  if (value === 'seller' || value === 'restaurant') return 'restaurant';
  if (value === 'admin') return 'admin';
  return '';
};

const round2 = (value) => Number(Number(value || 0).toFixed(2));

export const computeQuickDeliveryMargin = ({ deliveryFee = 0, riderEarning = 0 } = {}) =>
  round2(Number(deliveryFee || 0) - Number(riderEarning || 0));

/**
 * Wallet-aligned admin earning for one order:
 * platformFee + GST + seller commission + (deliveryFee − riderEarning) − admin coupon.
 */
export const computeQuickAdminEarning = ({
  platformFee = 0,
  tax = 0,
  gst = 0,
  commission = 0,
  adminDiscount = 0,
  deliveryFee = 0,
  riderEarning = 0,
  deliveryMargin = null,
} = {}) => {
  const margin =
    deliveryMargin == null
      ? computeQuickDeliveryMargin({ deliveryFee, riderEarning })
      : round2(deliveryMargin);

  return round2(
    Number(platformFee || 0) +
      Number(tax || gst || 0) +
      Number(commission || 0) +
      margin -
      Math.max(0, Number(adminDiscount || 0)),
  );
};

/**
 * @returns {{
 *   couponSource: string,
 *   sellerDiscount: number,
 *   adminDiscount: number,
 *   productEarnings: number,
 *   receivable: number,
 *   platformProfit: number,
 *   adminEarning: number,
 *   deliveryMargin: number,
 * }}
 */
export const allocateQuickCouponEarnings = ({
  couponSource = '',
  discount = 0,
  sellerSubtotal = 0,
  commission = 0,
  packingFee = 0,
  platformFee = 0,
  deliveryFee = 0,
  riderEarning = 0,
  tax = 0,
  gst = 0,
} = {}) => {
  const source = normalizeQuickCouponSource(couponSource);
  const safeDiscount = Math.max(0, Number(discount) || 0);
  const sellerDiscount = source === 'restaurant' ? safeDiscount : 0;
  const adminDiscount = source === 'admin' ? safeDiscount : 0;

  const productEarnings = round2(
    Number(sellerSubtotal || 0) - Number(commission || 0) - sellerDiscount,
  );
  const receivable = round2(productEarnings + Math.max(0, Number(packingFee || 0)));

  const deliveryMargin = computeQuickDeliveryMargin({ deliveryFee, riderEarning });
  // Legacy field kept for older consumers (delivery margin + platform fee − admin coupon).
  const platformProfit = round2(
    Number(deliveryFee || 0) +
      Number(platformFee || 0) -
      Number(riderEarning || 0) -
      adminDiscount,
  );
  const adminEarning = computeQuickAdminEarning({
    platformFee,
    tax,
    gst,
    commission,
    adminDiscount,
    deliveryMargin,
  });

  return {
    couponSource: source,
    sellerDiscount: round2(sellerDiscount),
    adminDiscount: round2(adminDiscount),
    productEarnings,
    receivable,
    platformProfit,
    adminEarning,
    deliveryMargin,
  };
};
