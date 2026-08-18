import React, { memo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Clock, Heart, BadgePercent, Timer, Bookmark } from "lucide-react";
import { Card, CardContent } from "@food/components/ui/card";
import { Button } from "@food/components/ui/button";
import { RestaurantGridSkeleton, LoadingSkeletonRegion } from "@food/components/ui/loading-skeletons";
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability";
import { useProfile } from "@food/context/ProfileContext";
import { toast } from "sonner";
import RestaurantImageCarousel from "./RestaurantImageCarousel";

const FoodRestaurantCard = memo(({ 
  restaurant, 
  index, 
  isOutOfService, 
  availabilityTick, 
  isFavorite, 
  onFavoriteToggle, 
  backendOrigin 
}) => {
  const { isFoodWishlisted, toggleFoodWishlistItem } = useProfile();
  const nameStr = typeof restaurant?.name === "string" ? restaurant.name.trim() : "";
  const fallbackSlugSource =
    nameStr ||
    (typeof restaurant?.restaurantName === "string" ? restaurant.restaurantName.trim() : "") ||
    String(restaurant?.slug || restaurant?.id || restaurant?._id || `restaurant-${index}`);

  const restaurantSlug =
    typeof restaurant?.slug === "string" && restaurant.slug.trim()
      ? restaurant.slug.trim()
      : fallbackSlugSource.toLowerCase().replace(/\s+/g, "-");

  const availability = getRestaurantAvailabilityStatus(restaurant, new Date(availabilityTick), {
    ignoreOperationalStatus: true,
  });
  const favorite = isFavorite(restaurantSlug);

  return (
    <div
      key={restaurant?.id || restaurant?._id || restaurantSlug || index}
      className="h-full transform transition-all duration-300 hover:-translate-y-3 hover:scale-[1.02]"
      style={{
        perspective: 1000,
        animation: index < 10 ? `fade-in-up 0.5s ease-out ${index * 0.05}s backwards` : "none",
      }}
    >
      <div className="h-full group">
        <Link to={`/user/restaurants/${restaurantSlug}`} className="flex h-full">
          <Card
            className={`relative flex h-full w-full flex-col gap-0 overflow-hidden rounded-[28px] border-0 border-background bg-white py-0 shadow-sm transition-all duration-500 hover:shadow-xl dark:border-gray-800 dark:bg-[#1a1a1a] ${
              isOutOfService || !availability.isOpen ? "grayscale opacity-75" : ""
            }`}
          >
            <div className="relative">
              <RestaurantImageCarousel
                restaurant={restaurant}
                priority={index < 3}
                backendOrigin={backendOrigin}
              />

              {restaurant.featuredDish && (
                <div className="absolute left-4 top-4 z-10 flex items-center transform transition-transform duration-300 group-hover:scale-105">
                  <div className="flex items-center rounded-full border border-white/20 bg-black/70 px-1 py-1 text-[11px] font-medium tracking-tight text-white shadow-2xl backdrop-blur-lg">
                    <span className="px-3 py-0.5">{restaurant.featuredDish} {restaurant.featuredPrice ? `• ₹${restaurant.featuredPrice}` : ""}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        
                        let token = localStorage.getItem("user_accessToken") || localStorage.getItem("auth_customer");
                        if (!token) {
                          const generic = localStorage.getItem("accessToken");
                          if (generic) {
                            try {
                              const payload = JSON.parse(window.atob(generic.split(".")[1]));
                              if (payload?.role && payload.role.toUpperCase() !== "USER") {
                                token = null;
                              } else {
                                token = generic;
                              }
                            } catch (e) {
                              token = generic;
                            }
                          }
                        }
                        if (!token) {
                          toast.error("Please login to save dishes to your wishlist");
                          return;
                        }

                        try {
                          const isAdded = await toggleFoodWishlistItem({
                            restaurantId: restaurant.id || restaurant._id,
                            restaurantName: restaurant.name || restaurant.restaurantName,
                            restaurantSlug: restaurantSlug,
                            dishName: restaurant.featuredDish,
                            price: restaurant.featuredPrice
                          });
                          if (isAdded) toast.success("Dish added to wishlist");
                          else toast.success("Dish removed from wishlist");
                        } catch (err) {
                          toast.error("Failed to update wishlist");
                        }
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/20"
                    >
                      <Heart className={`h-3 w-3 ${isFoodWishlisted(restaurant.id || restaurant._id, restaurant.featuredDish) ? "fill-[#FE5502] text-[#FE5502]" : "text-white"}`} />
                    </Button>
                  </div>
                </div>
              )}


            </div>

            <div className="transform transition-transform duration-300 group-hover:-translate-y-1">
              <CardContent className="flex flex-grow flex-col p-3 pt-3 sm:p-4 sm:pt-4 lg:p-5 lg:pt-5">
                <div className="mb-2 flex items-start justify-between gap-2 lg:mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-1 text-lg font-medium leading-tight tracking-tight text-gray-950 transition-colors duration-300 group-hover:text-[#FE5502] dark:text-white lg:text-2xl">
                      {restaurant.name}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-widest shadow-sm ${
                          availability.isOpen ? "bg-emerald-500 text-white" : "bg-gray-400 text-white"
                        }`}
                      >
                        {availability.isOpen ? "Open now" : "Offline"}
                      </span>
                      {availability.isOpen && availability.closingCountdownLabel && (
                        <div className="flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-amber-700">
                          <Timer className="h-3 w-3 flex-shrink-0" strokeWidth={2.5} />
                          <span>{availability.closingCountdownLabel}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className={`flex-shrink-0 rounded-2xl px-3 py-1.5 text-white shadow-md transition-transform duration-300 group-hover:scale-110 ${
                      Number(restaurant.rating) > 0 ? "bg-[#259539]" : "bg-gray-400"
                    } flex items-center gap-1.5`}
                  >
                    <span className="text-sm font-medium tracking-tight lg:text-lg">
                      {Number(restaurant.rating) > 0 ? Number(restaurant.rating).toFixed(1) : "NEW"}
                    </span>
                    {Number(restaurant.rating) > 0 && (
                      <Star className="h-3.5 w-3.5 fill-white text-white lg:h-4.5 lg:w-4.5" strokeWidth={0} />
                    )}
                  </div>
                </div>

                <div className="mb-2 flex items-center gap-1 text-sm text-gray-500 opacity-70 transition-opacity duration-300 group-hover:opacity-100 lg:mb-3 lg:text-base">
                  <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400 lg:h-5 lg:w-5" strokeWidth={1.5} />
                  <span className="font-medium text-gray-700 dark:text-gray-300">{restaurant.deliveryTime}</span>
                  <span className="mx-1">|</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{restaurant.distance}</span>
                </div>

                {typeof restaurant.offer === 'string' && restaurant.offer.trim() !== '' && restaurant.offer.trim() !== 'null' && restaurant.offer.trim() !== 'undefined' && (
                  <div className="mt-auto flex items-center gap-2 text-sm transition-transform duration-300 group-hover:translate-x-1 lg:text-base">
                    <BadgePercent className="h-4 w-4 text-black lg:h-5 lg:w-5" strokeWidth={2} />
                    <span className="font-medium text-gray-700 dark:text-gray-300">{restaurant.offer}</span>
                  </div>
                )}
              </CardContent>
            </div>

            <div className="pointer-events-none absolute inset-0 z-0 rounded-md border border-transparent transition-all duration-300 group-hover:border-[#FE5502]/30 group-hover:shadow-[inset_0_0_0_1px_rgba(204,37,50,0.2)]" />
          </Card>
        </Link>
      </div>
    </div>
  );
});

const RestaurantGrid = memo(({
  filteredRestaurants,
  visibleRestaurants,
  showRestaurantSkeleton,
  isLoadingFilterResults,
  loadingRestaurants,
  isOutOfService,
  availabilityTick,
  isFavorite,
  onFavoriteToggle,
  backendOrigin,
  hasMoreRestaurants,
  loadMoreRestaurants,
  restaurantLoadMoreRef
}) => {
  return (
    <section className="content-auto space-y-0 pb-8 pt-3 sm:pt-4 md:pb-10 lg:pt-6">
      <div className="mb-4 px-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            {filteredRestaurants.length} Restaurants Delivering to You
          </h2>
          <span className="text-sm font-medium text-gray-500">Featured</span>
        </div>
      </div>
      
      <div className={`relative ${showRestaurantSkeleton ? "min-h-[360px] sm:min-h-[420px]" : ""}`}>
        <AnimatePresence>
          {showRestaurantSkeleton && (
            <motion.div
              className="absolute inset-0 z-10 rounded-lg bg-white/94 dark:bg-[#1a1a1a]/94"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <LoadingSkeletonRegion label="Loading restaurants" className="h-full p-1 sm:p-2">
                <RestaurantGridSkeleton count={3} className="grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3" compact />
              </LoadingSkeletonRegion>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className={`grid grid-cols-1 items-stretch gap-5 px-4 pt-1 transition-opacity duration-300 sm:gap-4 sm:pt-1.5 md:grid-cols-2 lg:gap-5 lg:pt-2 lg:grid-cols-3 xl:gap-6 ${
            isLoadingFilterResults || loadingRestaurants ? "opacity-50" : "opacity-100"
          }`}
        >
          {visibleRestaurants.map((restaurant, index) => (
            <FoodRestaurantCard
              key={restaurant?.id || restaurant?._id || restaurant?.slug || index}
              restaurant={restaurant}
              index={index}
              isOutOfService={isOutOfService}
              availabilityTick={availabilityTick}
              isFavorite={isFavorite}
              onFavoriteToggle={onFavoriteToggle}
              backendOrigin={backendOrigin}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 px-4 pt-4 sm:pt-6">
        {hasMoreRestaurants && (
          <Button
            variant="outline"
            onClick={loadMoreRestaurants}
            className="border-gray-300 text-sm font-medium hover:border-gray-400 rounded-full px-8 py-6 h-auto"
          >
            Load more restaurants
          </Button>
        )}
        <div ref={restaurantLoadMoreRef} className="h-1 w-full" aria-hidden="true" />
      </div>
    </section>
  );
});

export default RestaurantGrid;
