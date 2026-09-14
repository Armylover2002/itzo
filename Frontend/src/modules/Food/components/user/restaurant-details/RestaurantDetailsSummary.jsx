import { Clock, MapPin, Star, Utensils, Leaf, Info } from "lucide-react";
import { Badge } from "@food/components/ui/badge";

export default function RestaurantDetailsSummary({
  restaurant,
  isRestaurantOffline,
  isOutOfService,
}) {
  const cuisines = Array.isArray(restaurant?.cuisines) && restaurant.cuisines.length > 0
    ? restaurant.cuisines.slice(0, 3).join(" • ")
    : restaurant?.topCategory || restaurant?.cuisine || "Multi-cuisine";

  const isPureVeg = restaurant?.pureVegRestaurant === true || 
                    String(restaurant?.pureVegRestaurant).toLowerCase() === "true" ||
                    restaurant?.details?.pureVegRestaurant === true ||
                    String(restaurant?.details?.pureVegRestaurant).toLowerCase() === "true";

  const rating = restaurant?.rating > 0 ? restaurant.rating : "New";
  const reviewsCount = restaurant?.reviews > 0 ? `${restaurant.reviews.toLocaleString()}+ ratings` : "No ratings";

  return (
    <section className="px-4 sm:px-6 -mt-12 sm:-mt-16 relative z-10 mb-6">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-[20px] bg-white dark:bg-[#1a1a1a] shadow-[0_4px_20px_rgb(0,0,0,0.08)] p-4 sm:p-5 border border-gray-100 dark:border-gray-800">
          
          {/* Header Row: Title & Rating */}
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0 pr-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight truncate">
                {restaurant?.name || "Restaurant"}
              </h1>
              <p className="mt-1 text-xs sm:text-[13px] text-gray-600 dark:text-gray-400 truncate font-medium">
                {cuisines}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                 {restaurant?.location || "Nearby"}
              </p>
            </div>

            {/* Rating Box */}
            <div className="flex flex-col items-center justify-center bg-green-700 rounded-lg p-1.5 shadow-sm shrink-0 min-w-[60px]">
              <div className="flex items-center gap-1 text-white font-extrabold text-sm">
                <span className="leading-none pt-0.5">{rating}</span>
                <Star className="h-3.5 w-3.5 fill-white" />
              </div>
              <div className="w-full h-[1px] bg-white/20 my-1" />
              <span className="text-[9px] text-white font-bold tracking-wide uppercase">
                 {reviewsCount.replace('ratings', 'rating')}
              </span>
            </div>
          </div>

          {/* Badges Row */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {isPureVeg && (
              <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded border border-green-200">
                <Leaf className="h-3 w-3" />
                <span className="text-[10px] font-bold uppercase tracking-wide">Pure Veg</span>
              </div>
            )}

            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded ${
              isOutOfService || isRestaurantOffline 
                ? "bg-rose-50 text-rose-700 border border-rose-200" 
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}>
              {isOutOfService ? "Out of zone" : isRestaurantOffline ? "Offline" : "Open now"}
            </span>
          </div>

          <div className="h-[1px] w-full bg-gray-100 dark:bg-gray-800 my-3" />

          {/* Info Row: Delivery & Distance */}
          <div className="flex items-center gap-5 sm:gap-6">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center shrink-0">
                <Clock className="h-3.5 w-3.5 text-gray-700 dark:text-gray-300" />
              </div>
              <div>
                <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">Delivery</p>
                <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100 leading-none mt-0.5">
                  {restaurant?.deliveryTime || "25-30 mins"}
                </p>
              </div>
            </div>

            <div className="w-[1px] h-6 bg-gray-200 dark:bg-gray-800 shrink-0" />

            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center shrink-0">
                <MapPin className="h-3.5 w-3.5 text-gray-700 dark:text-gray-300" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">Distance</p>
                <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100 leading-none mt-0.5 truncate">
                  {restaurant?.distance || "—"}
                </p>
              </div>
            </div>
          </div>

          {(isRestaurantOffline || isOutOfService) && (
            <div className="mt-5 flex items-start gap-2 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2.5">
              <Info className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-[13px] font-medium text-rose-700 leading-tight">
                {isOutOfService
                  ? "You are outside the delivery zone. Change your location to order."
                  : "This restaurant is currently offline. You can browse the menu but cannot place orders."}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
