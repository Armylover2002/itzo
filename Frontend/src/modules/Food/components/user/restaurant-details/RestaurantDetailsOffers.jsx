import { BadgePercent } from "lucide-react";
import { getCouponHeadline, getCouponSubline } from "./restaurantDetailsUtils";

/** Zomato-style horizontal strip of the coupons applicable at this restaurant. */
export default function RestaurantDetailsOffers({ coupons = [], onOpenOffers }) {
  const visibleCoupons = coupons.filter((coupon) => coupon?.couponCode);
  if (visibleCoupons.length === 0) return null;

  const single = visibleCoupons.length === 1;

  return (
    <section className="mt-4" aria-label="Offers">
      <div className="max-w-7xl mx-auto">
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory px-4 sm:px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleCoupons.map((coupon, index) => (
            <button
              key={coupon.id || coupon.couponCode}
              type="button"
              onClick={onOpenOffers}
              className={`snap-start shrink-0 ${single ? "w-full" : "w-[82%] sm:w-[340px]"} text-left rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1a1a] px-3.5 py-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow`}
            >
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#FB4F01] to-[#ff7a3d] flex items-center justify-center shrink-0">
                <BadgePercent className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-extrabold text-gray-900 dark:text-white truncate">
                  {getCouponHeadline(coupon)}
                </p>
                <p className="text-[11px] font-semibold tracking-wide text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  {getCouponSubline(coupon)}
                </p>
              </div>
              {!single && (
                <span className="self-end text-[10px] font-semibold text-gray-400 shrink-0">
                  {index + 1}/{visibleCoupons.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
