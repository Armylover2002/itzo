import { useMemo } from "react";
import { BadgePercent } from "lucide-react";
import { useCart } from "@food/context/CartContext";
import { RUPEE_SYMBOL, getCouponShortTitle, pickCartOfferCoupon } from "./restaurantDetailsUtils";

const sameRestaurant = (item, restaurant) => {
  const ids = [restaurant?.id, restaurant?.mongoId, restaurant?.restaurantId].filter(Boolean).map(String);
  if (item?.restaurantId && ids.includes(String(item.restaurantId))) return true;
  return Boolean(item?.restaurant && restaurant?.name && item.restaurant === restaurant.name);
};

/**
 * Zomato-style strip on top of the cart bar:
 * "You have unlocked Flat ₹75 OFF · Apply coupon on cart" or
 * "Add ₹40 more to unlock Flat ₹75 OFF · Use code FLAT75".
 */
export default function RestaurantCartOfferBanner({ coupons = [], restaurant }) {
  const { cart } = useCart();

  const subtotal = useMemo(
    () =>
      (Array.isArray(cart) ? cart : [])
        .filter((item) => sameRestaurant(item, restaurant))
        .reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0),
    [cart, restaurant],
  );

  const pick = useMemo(() => (subtotal > 0 ? pickCartOfferCoupon(coupons, subtotal) : null), [coupons, subtotal]);
  if (!pick) return null;

  const title = getCouponShortTitle(pick.coupon);
  const code = String(pick.coupon.couponCode || "").toUpperCase();

  return (
    <div className="flex items-center gap-3 rounded-t-2xl border border-b-0 border-blue-100 bg-[#EEF4FF] px-3.5 pt-2.5 pb-5 -mb-3 dark:border-blue-900/40 dark:bg-[#16203a]">
      <div className="h-7 w-7 rounded-full bg-[#256FEF] flex items-center justify-center shrink-0">
        <BadgePercent className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[#256FEF] dark:text-blue-300 truncate">
          {pick.unlocked
            ? `You have unlocked ${title}`
            : `Add ${RUPEE_SYMBOL}${pick.amountToUnlock} more to unlock ${title}`}
        </p>
        <p className="text-[11px] text-gray-600 dark:text-gray-400 truncate">
          {pick.unlocked ? "Apply coupon on cart" : `Use code ${code} on cart`}
        </p>
      </div>
    </div>
  );
}
