import React, { memo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Clock, Heart, BadgePercent, Timer, Bookmark } from "lucide-react";
import { Card, CardContent } from "@food/components/ui/card";
import { Button } from "@food/components/ui/button";
import { RestaurantGridSkeleton, LoadingSkeletonRegion } from "@food/components/ui/loading-skeletons";
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability";
import RestaurantImageCarousel from "./RestaurantImageCarousel";

const FoodRestaurantCard = memo(({ 
  restaurant, 
  index, 
  isOutOfService, 
  currentDate,
  isFavorite, 
  onFavoriteToggle, 
  backendOrigin 
}) => {
  const nameStr = typeof restaurant?.name === "string" ? restaurant.name.trim() : "";
  const fallbackSlugSource =
    nameStr ||
    (typeof restaurant?.restaurantName === "string" ? restaurant.restaurantName.trim() : "") ||
    String(restaurant?.slug || restaurant?.id || restaurant?._id || `restaurant-${index}`);

  const restaurantSlug =
    typeof restaurant?.slug === "string" && restaurant.slug.trim()
      ? restaurant.slug.trim()
      : fallbackSlugSource.toLowerCase().replace(/\s+/g, "-");

  const availability = getRestaurantAvailabilityStatus(restaurant, currentDate, {
    ignoreOperationalStatus: false,
  });
  const favorite = isFavorite(restaurantSlug);

  return (
    <div
      key={restaurant?.id || restaurant?._id || restaurantSlug || index}
      className={`h-full transform transition-all duration-300 ${isOutOfService || !availability.isOpen ? "grayscale opacity-75" : ""}`}
      style={{
        animation: index < 10 ? `fade-in-up 0.5s ease-out ${index * 0.05}s backwards` : "none",
      }}
    >
      <div className="h-full group flex flex-col cursor-pointer bg-white dark:bg-[#1a1a1a] rounded-[16px] border border-gray-200/80 dark:border-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 overflow-hidden">
        <Link to={`/user/restaurants/${restaurantSlug}`} className="flex flex-col h-full relative">
          
          <div className="relative w-full aspect-[4/3] bg-gray-50 dark:bg-gray-900 overflow-hidden group/img">
            <div className="absolute inset-0 w-full h-full transition-transform duration-500 group-hover/img:scale-105">
              <RestaurantImageCarousel
                restaurant={restaurant}
                priority={index < 3}
                backendOrigin={backendOrigin}
                className="relative w-full h-full overflow-hidden"
              />
            </div>

            {restaurant.featuredDish && (
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded z-10">
                <span className="text-[10px] sm:text-[11px] text-white/95 font-medium tracking-wide">Promoted</span>
              </div>
            )}

            <div className="absolute right-2 top-2 z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onFavoriteToggle(event, restaurant, restaurantSlug, favorite);
                }}
                aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
                className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full shadow-md transition-all duration-300 ${
                  favorite
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-white/95 text-gray-800 backdrop-blur-sm hover:bg-white"
                }`}
              >
                <Bookmark className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-all duration-300 ${favorite ? "fill-white" : ""}`} />
              </Button>
            </div>

            {restaurant.offer && (
              <div className="absolute bottom-0 left-0 bg-blue-600 px-2 py-1 z-10 rounded-tr-[12px]">
                <span className="text-[10px] sm:text-[11px] font-bold text-white flex items-center gap-1">
                  <BadgePercent className="h-3 w-3" />
                  {restaurant.offer}
                </span>
              </div>
            )}
            
            <div className="pointer-events-none absolute inset-0 z-0 border-b border-black/5" />
          </div>

          <div className="flex flex-col flex-grow p-2.5 sm:p-3">
            <div className="flex justify-between items-start mb-1 sm:mb-1.5 gap-2">
              <h3 className="line-clamp-1 text-[13px] sm:text-[15px] font-bold text-gray-900 dark:text-white leading-tight group-hover:text-[#FF0000] transition-colors duration-300">
                {restaurant.name}
              </h3>
              <div className="flex items-center justify-center gap-0.5 bg-green-700 text-white px-1.5 py-0.5 rounded-[6px] shrink-0 shadow-sm">
                <span className="text-[10px] sm:text-[11px] font-bold tracking-tight">
                  {Number(restaurant.rating) > 0 ? Number(restaurant.rating).toFixed(1) : "NEW"}
                </span>
                {Number(restaurant.rating) > 0 && <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 fill-white text-white" strokeWidth={0} />}
              </div>
            </div>

            <div className="flex justify-between items-center text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
              <span className="line-clamp-1 mr-2">{restaurant.cuisine}</span>
              <span className="shrink-0 font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-[4px]">{restaurant.deliveryTime}</span>
            </div>

            <div className="flex justify-between items-center text-[11px] sm:text-xs text-gray-400 dark:text-gray-500 mt-1 sm:mt-1.5">
              <span className="line-clamp-1 mr-2 flex items-center gap-0.5">
                {typeof restaurant.location === "string" ? restaurant.location : (restaurant.location?.area || restaurant.location?.city || "Indore")}
              </span>
              <span className="shrink-0">{restaurant.distance}</span>
            </div>
          </div>

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
  const observer = React.useRef();

  // Pre-compute Date object once per tick to avoid N new Date() calls inside card renders
  const currentDate = React.useMemo(() => new Date(availabilityTick), [availabilityTick]);

  React.useEffect(() => {
    if (loadingRestaurants || !hasMoreRestaurants) return;

    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        loadMoreRestaurants();
      }
    }, { threshold: 0.1, rootMargin: '100px' });

    if (restaurantLoadMoreRef?.current) {
      observer.current.observe(restaurantLoadMoreRef.current);
    }

    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, [loadingRestaurants, hasMoreRestaurants, loadMoreRestaurants, restaurantLoadMoreRef]);

  return (
    <section className="content-auto space-y-0 pb-8 pt-3 sm:pt-4 md:pb-10 lg:pt-6">
      <div className="mb-4 px-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-[#9ca3af]">
            {filteredRestaurants.length} Restaurants Delivering to You
          </h2>
          <span className="text-[15px] font-bold text-[#1c1c1e]">Featured</span>
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
          className={`grid grid-cols-2 items-stretch gap-3 px-3 pt-1 transition-opacity duration-300 sm:gap-4 sm:pt-1.5 md:grid-cols-3 lg:gap-5 lg:pt-2 lg:grid-cols-4 xl:gap-6 ${
            isLoadingFilterResults || loadingRestaurants ? "opacity-50" : "opacity-100"
          }`}
        >
          {visibleRestaurants.map((restaurant, index) => (
            <FoodRestaurantCard
              key={restaurant?.id || restaurant?._id || restaurant?.slug || index}
              restaurant={restaurant}
              index={index}
              isOutOfService={isOutOfService}
              currentDate={currentDate}
              isFavorite={isFavorite}
              onFavoriteToggle={onFavoriteToggle}
              backendOrigin={backendOrigin}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 px-4 pt-4 sm:pt-6">
        {hasMoreRestaurants && loadingRestaurants && (
          <div className="flex items-center justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FF0000] border-t-transparent"></div>
          </div>
        )}
        <div ref={restaurantLoadMoreRef} className="h-10 w-full" aria-hidden="true" />
      </div>
    </section>
  );
});

export default RestaurantGrid;
