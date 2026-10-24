// Neutral inline placeholder (plate + fork/knife) — a random stock photo looked like a real dish image.
export const FOOD_IMAGE_FALLBACK =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#f3f4f6"/>' +
      '<circle cx="400" cy="300" r="110" fill="none" stroke="#d1d5db" stroke-width="14"/>' +
      '<circle cx="400" cy="300" r="70" fill="none" stroke="#e5e7eb" stroke-width="8"/>' +
      '<path d="M235 200v70a18 18 0 0 0 18 18v112M253 200v60M271 200v70a18 18 0 0 1-18 18" fill="none" stroke="#d1d5db" stroke-width="12" stroke-linecap="round"/>' +
      '<path d="M565 400V200c-25 15-35 55-35 95h35" fill="none" stroke="#d1d5db" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  );
export const RUPEE_SYMBOL = "\u20B9";

const toAmount = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
};

/** "20% OFF UPTO \u20B980" / "FLAT \u20B9100 OFF" \u2014 headline for a coupon from /food/restaurant/offers. */
export const getCouponHeadline = (coupon = {}) => {
  const value = toAmount(coupon.discountValue);
  if (coupon.discountType === "percentage") {
    const max = toAmount(coupon.maxDiscount);
    return `${value}% OFF${max ? ` UPTO ${RUPEE_SYMBOL}${max}` : ""}`;
  }
  return `FLAT ${RUPEE_SYMBOL}${value} OFF`;
};

/** "Flat \u20B975 OFF" / "20% OFF upto \u20B980" \u2014 sentence-case title for the cart offer banner. */
export const getCouponShortTitle = (coupon = {}) => {
  if (coupon.discountType === "free-item") return `Free ${coupon.freeItem?.name || "item"}`;
  const value = toAmount(coupon.discountValue);
  if (coupon.discountType === "percentage") {
    const max = toAmount(coupon.maxDiscount);
    return `${value}% OFF${max ? ` upto ${RUPEE_SYMBOL}${max}` : ""}`;
  }
  return `Flat ${RUPEE_SYMBOL}${value} OFF`;
};

/** Discount a coupon gives on `subtotal` (0 when the minimum order is not met). */
export const getCouponDiscountFor = (coupon = {}, subtotal = 0) => {
  if (coupon.discountType === "free-item") return 0; // value comes from the free item line in the cart
  if (subtotal < toAmount(coupon.minOrderValue)) return 0;
  const value = toAmount(coupon.discountValue);
  if (coupon.discountType === "percentage") {
    const pct = (subtotal * value) / 100;
    const max = toAmount(coupon.maxDiscount);
    return max ? Math.min(pct, max) : pct;
  }
  return Math.min(value, subtotal);
};

/**
 * Picks what the Zomato-style cart banner should say: the best unlocked coupon, or
 * else the one closest to unlocking. Returns null when there is nothing to show.
 */
export const pickCartOfferCoupon = (coupons = [], subtotal = 0) => {
  const list = coupons.filter((coupon) => coupon?.couponCode);
  if (list.length === 0) return null;

  const unlocked = list
    .map((coupon) => ({ coupon, discount: getCouponDiscountFor(coupon, subtotal) }))
    .filter((entry) => entry.discount > 0)
    .sort((a, b) => b.discount - a.discount)[0];
  if (unlocked) return { coupon: unlocked.coupon, unlocked: true, amountToUnlock: 0 };

  const closest = list
    .map((coupon) => ({ coupon, gap: toAmount(coupon.minOrderValue) - subtotal }))
    .filter((entry) => entry.gap > 0)
    .sort((a, b) => a.gap - b.gap)[0];
  if (!closest) return null;
  return { coupon: closest.coupon, unlocked: false, amountToUnlock: Math.ceil(closest.gap) };
};

/** "USE WELCOME50 | ABOVE \u20B9199" \u2014 sub line shown under the headline. */
export const getCouponSubline = (coupon = {}) => {
  const min = toAmount(coupon.minOrderValue);
  const code = String(coupon.couponCode || "").toUpperCase();
  return [code && `USE ${code}`, min ? `ABOVE ${RUPEE_SYMBOL}${min}` : ""].filter(Boolean).join(" | ");
};

/** Terms list for the offers sheet, built only from fields the API actually returns. */
export const getCouponTerms = (coupon = {}) => {
  const terms = [];
  const min = toAmount(coupon.minOrderValue);
  const max = toAmount(coupon.maxDiscount);
  if (min) terms.push(`Valid on orders above ${RUPEE_SYMBOL}${min}`);
  if (coupon.discountType === "percentage" && max) terms.push(`Maximum discount ${RUPEE_SYMBOL}${max}`);
  if (coupon.isFirstOrderOnly || coupon.customerScope === "first-time") terms.push("Valid on your first order only");
  if (toAmount(coupon.perUserLimit)) {
    const limit = toAmount(coupon.perUserLimit);
    terms.push(`Can be used ${limit} time${limit > 1 ? "s" : ""} per user`);
  }
  if (coupon.endDate) {
    const end = new Date(coupon.endDate);
    if (!Number.isNaN(end.getTime())) {
      terms.push(`Valid till ${end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`);
    }
  }
  terms.push("Apply the code in cart before placing the order");
  return terms;
};

const toImageUrl = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && value.url) return String(value.url).trim();
  return "";
};

export const buildRestaurantGallery = (restaurant) => {
  if (!restaurant) return [];

  // Banner shows only the restaurant's profile picture (no cover/menu images).
  // Empty result lets the hero fall back to FOOD_IMAGE_FALLBACK.
  const profile = toImageUrl(restaurant.profileImage);
  return profile ? [profile] : [];
};
