/**
 * Splits coupon discount between admin (platform) and restaurant based on coupon source.
 * Admin FoodOffer coupons: admin bears 100% by default.
 * Restaurant RestaurantCoupon coupons: restaurant bears 100%.
 */
export function splitDiscountForCouponSource(source, discount) {
    const safeDiscount = Math.max(0, Number(discount) || 0);
    if (safeDiscount <= 0) {
        return {
            adminDiscountShare: 0,
            restaurantDiscountShare: 0,
            adminBearPercentage: 0,
            restaurantBearPercentage: 0,
        };
    }

    const isRestaurantCoupon = source === 'restaurant';
    const adminBearPercentage = isRestaurantCoupon ? 0 : 100;
    const restaurantBearPercentage = isRestaurantCoupon ? 100 : 0;
    const restaurantDiscountShare = isRestaurantCoupon
        ? Math.round(safeDiscount * 100) / 100
        : 0;
    const adminDiscountShare = Math.max(0, Math.round((safeDiscount - restaurantDiscountShare) * 100) / 100);

    return {
        adminDiscountShare,
        restaurantDiscountShare,
        adminBearPercentage,
        restaurantBearPercentage,
    };
}

export async function resolveDiscountSplitByCoupon({ couponCode, discount, couponSource }) {
    const safeDiscount = Math.max(0, Number(discount) || 0);
    if (safeDiscount <= 0) {
        return splitDiscountForCouponSource('admin', 0);
    }

    if (couponSource === 'restaurant') {
        return splitDiscountForCouponSource('restaurant', safeDiscount);
    }

    if (couponSource === 'admin') {
        return splitDiscountForCouponSource('admin', safeDiscount);
    }

    const code = String(couponCode || '').trim().toUpperCase();
    if (!code) {
        return splitDiscountForCouponSource('admin', safeDiscount);
    }

    try {
        const { FoodOffer } = await import('../admin/models/offer.model.js');
        const offer = await FoodOffer.findOne({ couponCode: code }).lean();
        if (offer) {
            const adminPct = Number(offer.adminBearPercentage ?? 100);
            const restaurantPct = Number(offer.restaurantBearPercentage ?? 0);
            const totalPct = adminPct + restaurantPct;
            const adminBearPercentage = totalPct > 0 ? (adminPct / totalPct) * 100 : 100;
            const restaurantBearPercentage = totalPct > 0 ? (restaurantPct / totalPct) * 100 : 0;
            const restaurantDiscountShare = Math.round(safeDiscount * (restaurantBearPercentage / 100) * 100) / 100;
            const adminDiscountShare = Math.max(0, Math.round((safeDiscount - restaurantDiscountShare) * 100) / 100);
            return { adminDiscountShare, restaurantDiscountShare, adminBearPercentage, restaurantBearPercentage };
        }
    } catch {
        // fall through
    }

    try {
        const { RestaurantCoupon } = await import('../admin/models/restaurantCoupon.model.js');
        const restCoupon = await RestaurantCoupon.findOne({ couponCode: code, status: 'Approved' }).lean();
        if (restCoupon) {
            return splitDiscountForCouponSource('restaurant', safeDiscount);
        }
    } catch {
        // fall through
    }

    return splitDiscountForCouponSource('admin', safeDiscount);
}
