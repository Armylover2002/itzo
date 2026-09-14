/**
 * Customer-facing Quick Commerce coupon labels + discount math.
 * Keep in sync with Backend checkoutPreview / applyCoupon.
 */

const toType = (coupon) =>
  String(coupon?.discountType || coupon?.couponType || '').trim().toLowerCase();

const toValue = (coupon) =>
  Number(coupon?.discountValue ?? coupon?.discount ?? 0);

const toMaxDiscount = (coupon) =>
  Number(coupon?.maxDiscount || coupon?.maxDiscountValue || 0);

/** e.g. "12% OFF", "₹100 OFF", "Free Delivery" */
export const formatCouponDiscountLabel = (coupon) => {
  if (!coupon) return '';
  const type = toType(coupon);
  const value = toValue(coupon);

  if (type === 'free_delivery') return 'Free Delivery';
  if (type === 'percent' || type === 'percentage') {
    if (!Number.isFinite(value) || value <= 0) return 'Special offer';
    return `${value}% OFF`;
  }
  if (Number.isFinite(value) && value > 0) return `₹${value} OFF`;
  return String(coupon.title || coupon.description || 'Special offer').trim();
};

export const formatCouponSourceLabel = (coupon) => {
  if (!coupon) return '';
  if (coupon.isSellerCoupon || String(coupon.couponSource || coupon.source || '').toLowerCase() === 'seller') {
    return 'Store offer';
  }
  if (String(coupon.couponSource || coupon.source || '').toLowerCase() === 'admin') {
    return 'Platform offer';
  }
  return coupon.isSellerCoupon ? 'Store offer' : 'Platform offer';
};

/** Extra detail lines under the coupon code. */
export const getCouponDetailLines = (coupon, cartSubtotal = 0) => {
  if (!coupon) return [];
  const lines = [];
  const type = toType(coupon);
  const value = toValue(coupon);
  const maxDiscount = toMaxDiscount(coupon);
  const minOrder = Number(coupon.minOrderValue || coupon.minOrder || 0);
  const discountLabel = formatCouponDiscountLabel(coupon);

  if (discountLabel) lines.push(discountLabel);

  if ((type === 'percent' || type === 'percentage') && maxDiscount > 0) {
    lines.push(`Up to ₹${maxDiscount}`);
  }

  if (minOrder > 0) {
    lines.push(`Min order ₹${minOrder}`);
  }

  if (type !== 'free_delivery' && Number(cartSubtotal) > 0) {
    const estimated = computeQuickCouponDiscount(coupon, cartSubtotal);
    if (estimated > 0) {
      lines.push(`Save ₹${estimated} on this cart`);
    }
  }

  const description = String(coupon.description || '').trim();
  if (
    description &&
    description.toLowerCase() !== 'good' &&
    description !== discountLabel &&
    !lines.includes(description)
  ) {
    lines.push(description);
  }

  return lines;
};

export const computeQuickCouponDiscount = (coupon, subtotal = 0) => {
  if (!coupon) return 0;
  const type = toType(coupon);
  if (type === 'free_delivery') return 0;

  const value = toValue(coupon);
  const maxDiscount = toMaxDiscount(coupon);
  const safeSubtotal = Math.max(0, Number(subtotal || 0));
  if (!Number.isFinite(value) || value <= 0 || safeSubtotal <= 0) {
    // Fall back to previously applied absolute amount when type/value missing
    const applied = Number(coupon.discountAmount || coupon.discount || 0);
    return Math.max(0, Math.min(applied, safeSubtotal));
  }

  let discount = 0;
  if (type === 'percent' || type === 'percentage') {
    discount = Math.round((safeSubtotal * value) / 100);
    if (maxDiscount > 0) discount = Math.min(discount, maxDiscount);
  } else {
    discount = value;
  }

  return Math.max(0, Math.min(discount, safeSubtotal));
};
