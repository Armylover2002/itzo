import React, { memo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Star, BadgePercent, Bookmark, Plus, Minus, UtensilsCrossed } from "lucide-react";
import { Button } from "@food/components/ui/button";
import { RestaurantGridSkeleton, LoadingSkeletonRegion } from "@food/components/ui/loading-skeletons";
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability";
import { useCart } from "@food/context/CartContext";
import { buildCartLineId, getDefaultFoodVariant, getFoodDisplayPrice, hasFoodVariants } from "@food/utils/foodVariants";
import { restaurantAPI } from "@food/api";
import { getCouponShortTitle } from "@food/components/user/restaurant-details/restaurantDetailsUtils";
import RestaurantImageCarousel from "./RestaurantImageCarousel";

const ACCENT = "#FB4F01";

// Rough headline value used only to rank coupons for the card ("biggest" offer wins).
const couponRank = (coupon) =>
  coupon.discountType === "percentage"
    ? Number(coupon.maxDiscount) || Number(coupon.discountValue) || 0
    : Number(coupon.discountValue) || 0;

/** "Flat ₹75 OFF above ₹199" for the restaurant card. */
const getCardCouponText = (coupon) => {
  const min = Math.round(Number(coupon.minOrderValue) || 0);
  return `${getCouponShortTitle(coupon)}${min > 0 ? ` above ₹${min}` : ""}`;
};

const MAX_CARD_COUPONS = 4;
const COUPON_ROTATE_MS = 3000;

/**
 * Splits the public offers list into per-restaurant coupons and platform-wide ones
 * (business id, Mongo id or slug keys). All coupons are kept so the card can rotate them.
 */
const buildCouponIndex = (offers = []) => {
  const byRestaurant = new Map();
  const platform = [];
  for (const coupon of offers) {
    if (!coupon?.couponCode || coupon.showInCart === false) continue;
    if (coupon.restaurantScope === "all") {
      platform.push(coupon);
      continue;
    }
    const keys = [coupon.restaurantId, coupon.restaurantSlug].filter(Boolean).map((key) => String(key).toLowerCase());
    for (const key of keys) {
      if (!byRestaurant.has(key)) byRestaurant.set(key, []);
      byRestaurant.get(key).push(coupon);
    }
  }
  return { byRestaurant, platform };
};

/** Best-first, de-duplicated coupons for a card: restaurant coupons, else platform-wide ones. */
const findRestaurantCoupons = (couponIndex, restaurant) => {
  if (!couponIndex) return [];
  const keys = [
    restaurant?.restaurantId,
    restaurant?.mongoId,
    restaurant?._id,
    restaurant?.id,
    restaurant?.restaurantNameNormalized,
  ]
    .filter(Boolean)
    .map((key) => String(key).toLowerCase());
  const seen = new Set();
  const own = [];
  for (const key of keys) {
    for (const coupon of couponIndex.byRestaurant.get(key) || []) {
      if (seen.has(coupon.couponCode)) continue;
      seen.add(coupon.couponCode);
      own.push(coupon);
    }
  }
  const pool = own.length > 0 ? own : couponIndex.platform;
  return [...pool].sort((a, b) => couponRank(b) - couponRank(a)).slice(0, MAX_CARD_COUPONS);
};

/** Zomato-style offer ticker: cycles through coupons with a vertical slide. */
const CardCouponTicker = ({ coupons }) => {
  const [active, setActive] = React.useState(0);
  const count = coupons.length;

  React.useEffect(() => {
    setActive(0);
    if (count < 2) return undefined;
    const timer = setInterval(() => setActive((prev) => (prev + 1) % count), COUPON_ROTATE_MS);
    return () => clearInterval(timer);
  }, [count]);

  if (count === 0) return null;
  const coupon = coupons[active % count];

  return (
    <div className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-gray-700 dark:text-gray-300">
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#256FEF]">
        <BadgePercent className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
      </span>
      <div className="h-4 min-w-0 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={coupon.couponCode}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="truncate leading-4"
          >
            {getCardCouponText(coupon)}
          </motion.div>
        </AnimatePresence>
      </div>
      {count > 1 && (
        <span className="flex shrink-0 items-center gap-0.5">
          {coupons.map((item, i) => (
            <span
              key={item.couponCode}
              className={`h-1 rounded-full transition-all ${i === active % count ? "w-2.5 bg-[#256FEF]" : "w-1 bg-gray-300"}`}
            />
          ))}
        </span>
      )}
    </div>
  );
};

const getSavingsPercent = (price, otherPrice) => {
  const p = Number(price) || 0;
  const o = Number(otherPrice) || 0;
  if (p <= 0 || o <= p) return 0;
  return Math.round(((o - p) / o) * 100);
};

const VegIcon = ({ isVeg }) => (
  <span
    className={`mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] ${
      isVeg ? "border-green-600" : "border-red-600"
    }`}
    aria-label={isVeg ? "Veg" : "Non-veg"}
  >
    <span className={`h-1.5 w-1.5 rounded-full ${isVeg ? "bg-green-600" : "bg-red-600"}`} />
  </span>
);

const DishPreviewCard = memo(({ dish, quantity, disabled, onOpen, onChangeQuantity }) => {
  const price = getFoodDisplayPrice(dish);
  const savings = getSavingsPercent(price, dish.otherPrice);
  const isVeg = dish.isVeg === true || dish.foodType === "Veg";
  const [imageFailed, setImageFailed] = React.useState(false);

  return (
    <div
      onClick={onOpen}
      className="w-[136px] shrink-0 cursor-pointer snap-start sm:w-[150px]"
      data-purpose="restaurant-dish-preview"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[14px] bg-gray-100 dark:bg-gray-800">
        {dish.image && !imageFailed ? (
          <img
            src={dish.image}
            alt={dish.name}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300 dark:text-gray-600">
            <UtensilsCrossed className="h-7 w-7" />
          </div>
        )}

        {dish.isRecommended && (
          <span className="absolute left-2 top-2 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-green-700 shadow-sm">
            Popular
          </span>
        )}

        {!disabled &&
          (quantity > 0 ? (
            <div
              className="absolute bottom-2 right-2 flex h-8 items-center overflow-hidden rounded-full shadow-md"
              style={{ backgroundColor: ACCENT }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Decrease quantity"
                className="flex h-full w-7 items-center justify-center"
                style={{ color: "#fff" }}
                onClick={(event) => onChangeQuantity(event, quantity - 1)}
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={3} />
              </button>
              <span className="min-w-[14px] text-center text-[12px] font-bold text-white">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                className="flex h-full w-7 items-center justify-center"
                style={{ color: "#fff" }}
                onClick={(event) => onChangeQuantity(event, quantity + 1)}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={3} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              aria-label={`Add ${dish.name}`}
              className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full shadow-md transition-transform active:scale-90"
              style={{ backgroundColor: ACCENT, color: "#fff" }}
              onClick={(event) => onChangeQuantity(event, 1)}
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </button>
          ))}
      </div>

      <div className="mt-2 flex items-start gap-1.5">
        <VegIcon isVeg={isVeg} />
        <h4 className="line-clamp-2 text-[13px] font-medium leading-snug text-gray-900 dark:text-white">{dish.name}</h4>
      </div>

      <div className="mt-1 flex items-center gap-1.5">
        {savings > 0 && (
          <span className="text-[12px] text-gray-400 line-through">₹{Math.round(Number(dish.otherPrice))}</span>
        )}
        <span
          className={`text-[13px] font-semibold text-green-700 dark:text-green-500 ${savings > 0 ? "rounded-md bg-green-50 px-1.5 py-0.5 dark:bg-green-900/30" : ""}`}
        >
          ₹{Math.round(price)}
        </span>
      </div>

      {savings > 0 && (
        <p className="mt-1 text-[11px] font-semibold" style={{ color: ACCENT }}>
          Our app: {savings}% lower
        </p>
      )}
    </div>
  );
});

const FoodRestaurantCard = memo(({
  restaurant,
  index,
  isOutOfService,
  currentDate,
  isFavorite,
  onFavoriteToggle,
  backendOrigin,
  coupons
}) => {
  const navigate = useNavigate();
  const { addToCart, updateQuantity, removeFromCart, getCartItem, cart } = useCart();

  const nameStr = typeof restaurant?.name === "string" ? restaurant.name.trim() : "";
  const fallbackSlugSource =
    nameStr ||
    (typeof restaurant?.restaurantName === "string" ? restaurant.restaurantName.trim() : "") ||
    String(restaurant?.slug || restaurant?.id || restaurant?._id || `restaurant-${index}`);

  const restaurantSlug =
    typeof restaurant?.slug === "string" && restaurant.slug.trim()
      ? restaurant.slug.trim()
      : fallbackSlugSource.toLowerCase().replace(/\s+/g, "-");
  const restaurantPath = `/user/restaurants/${restaurantSlug}`;

  const availability = getRestaurantAvailabilityStatus(restaurant, currentDate, {
    ignoreOperationalStatus: false,
  });
  const isUnavailable = isOutOfService || !availability.isOpen;
  const favorite = isFavorite(restaurantSlug);

  const dishes = Array.isArray(restaurant.menuPreview) ? restaurant.menuPreview : [];
  const maxSavings = dishes.reduce((max, dish) => Math.max(max, getSavingsPercent(getFoodDisplayPrice(dish), dish.otherPrice)), 0);
  const lowestPrice = dishes.reduce((min, dish) => {
    const price = getFoodDisplayPrice(dish);
    return price > 0 && (min === 0 || price < min) ? price : min;
  }, 0);
  const rating = Number(restaurant.rating) || 0;
  const cuisineLabel = (restaurant.cuisines?.length ? restaurant.cuisines.slice(0, 2).join(", ") : restaurant.cuisine) || "";
  const metaParts = [restaurant.offer, lowestPrice > 0 ? `Items at ₹${Math.round(lowestPrice)}` : null, restaurant.distance].filter(Boolean);

  const getLineItemId = (dish) => {
    const variant = getDefaultFoodVariant(dish);
    return buildCartLineId(dish?.id || dish?._id || "", variant?.id || variant?._id || "");
  };

  const getDishQuantity = (dish) => cart.find((entry) => entry.id === getLineItemId(dish))?.quantity || 0;

  const handleQuantityChange = (dish) => (event, nextQuantity) => {
    event.preventDefault();
    event.stopPropagation();
    // Dishes with variants need a size/option choice, which lives on the restaurant page.
    if (hasFoodVariants(dish)) {
      navigate(restaurantPath);
      return;
    }

    const lineItemId = getLineItemId(dish);
    if (nextQuantity <= 0) {
      removeFromCart(lineItemId);
      return;
    }
    if (getCartItem(lineItemId)) {
      updateQuantity(lineItemId, nextQuantity);
      return;
    }

    const price = getFoodDisplayPrice(dish);
    const result = addToCart({
      ...dish,
      id: lineItemId,
      lineItemId,
      itemId: String(dish.id || dish._id || ""),
      name: dish.name,
      price,
      otherPrice: dish.otherPrice || 0,
      variantId: "",
      variantName: "",
      variantPrice: price,
      image: dish.image,
      restaurant: restaurant.name,
      restaurantId: restaurant.mongoId || restaurant.id,
      description: dish.description,
      isVeg: dish.foodType === "Veg" || dish.isVeg === true,
      preparationTime: dish.preparationTime,
    });
    if (result?.ok === false) {
      toast.error(result.error || "Cannot add item to cart.");
    }
  };

  return (
    <div
      className="h-full transition-all duration-300"
      style={{
        animation: index < 10 ? `fade-in-up 0.5s ease-out ${index * 0.05}s backwards` : "none",
      }}
    >
      <div className="h-full overflow-hidden rounded-[20px] border border-gray-200/80 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:border-gray-800 dark:bg-[#1a1a1a]">
        <Link to={restaurantPath} className="relative block px-4 pt-4">
          <div className="pr-10">
            {maxSavings > 0 && (
              <p className="mb-0.5 text-[12px] font-extrabold uppercase tracking-wide" style={{ color: ACCENT }}>
                {maxSavings}% lower prices
              </p>
            )}
            <h3 className="line-clamp-1 text-[17px] font-extrabold leading-tight text-gray-900 dark:text-white">
              {restaurant.name}
            </h3>
            <div className="mt-1 flex items-center gap-1 text-[13px] text-gray-600 dark:text-gray-400">
              {rating > 0 ? (
                <>
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green-700">
                    <Star className="h-2.5 w-2.5 fill-white text-white" strokeWidth={0} />
                  </span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{rating.toFixed(1)}</span>
                </>
              ) : (
                <span className="rounded bg-green-700 px-1.5 py-px text-[10px] font-bold text-white">NEW</span>
              )}
              <span className="shrink-0">• {restaurant.deliveryTime}</span>
              {cuisineLabel && <span className="line-clamp-1">• {cuisineLabel}</span>}
            </div>
            {metaParts.length > 0 && (
              <div className="mt-1 flex items-center gap-1.5 text-[12px] text-gray-600 dark:text-gray-400">
                <BadgePercent className="h-3.5 w-3.5 shrink-0 text-green-700" />
                <span className="line-clamp-1">{metaParts.join(" • ")}</span>
              </div>
            )}
            <CardCouponTicker coupons={coupons} />
            {isUnavailable && (
              <p className="mt-1 text-[12px] font-semibold text-red-600">
                {isOutOfService ? "Not delivering to your location" : "Closed"}
              </p>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onFavoriteToggle(event, restaurant, restaurantSlug, favorite);
            }}
            aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
            className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-300 ${
              favorite
                ? "border-red-500 bg-red-500 text-white hover:bg-red-600"
                : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            }`}
          >
            <Bookmark className={`h-4 w-4 ${favorite ? "fill-white" : ""}`} />
          </Button>
        </Link>

        {dishes.length > 0 ? (
          <div className="scrollbar-hide mt-3 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-4">
            {dishes.map((dish) => (
              <DishPreviewCard
                key={dish.id || dish._id}
                dish={dish}
                quantity={getDishQuantity(dish)}
                disabled={isUnavailable}
                onOpen={() => navigate(restaurantPath)}
                onChangeQuantity={handleQuantityChange(dish)}
              />
            ))}
            {/* Flex scrollers drop trailing padding; keep a gap after the last dish. */}
            <div className="w-1 shrink-0" aria-hidden="true" />
          </div>
        ) : !restaurant.images?.length && !restaurant.image ? (
          <p className="px-4 pb-4 pt-2 text-[12px] text-gray-400">Menu coming soon</p>
        ) : (
          // No dishes to preview yet (empty menu or stale cached list): show the restaurant photos.
          <Link to={restaurantPath} className="block px-4 pb-4 pt-3">
            <div className="relative aspect-[16/7] w-full overflow-hidden rounded-[14px] bg-gray-50 dark:bg-gray-900">
              <RestaurantImageCarousel
                restaurant={restaurant}
                priority={index < 3}
                backendOrigin={backendOrigin}
                className="relative h-full w-full overflow-hidden"
              />
            </div>
          </Link>
        )}
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
  loadingMoreRestaurants,
  totalRestaurants,
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

  // One request for all active coupons; each card then picks its own best offer.
  const [couponIndex, setCouponIndex] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    restaurantAPI
      .getPublicOffers({}, { contextModule: "user" })
      .then((res) => {
        const offers = res?.data?.data?.allOffers;
        if (!cancelled && Array.isArray(offers)) setCouponIndex(buildCouponIndex(offers));
      })
      .catch(() => {
        // Coupons are decorative on the card; the list works without them.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-created after every page lands, so if the sentinel is still on screen (short
  // page, or client-side filters hid most of it) the next page is requested right away.
  React.useEffect(() => {
    if (loadingRestaurants || loadingMoreRestaurants || !hasMoreRestaurants) return;

    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        loadMoreRestaurants();
      }
    }, { threshold: 0, rootMargin: '600px 0px' });

    if (restaurantLoadMoreRef?.current) {
      observer.current.observe(restaurantLoadMoreRef.current);
    }

    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, [loadingRestaurants, loadingMoreRestaurants, hasMoreRestaurants, loadMoreRestaurants, restaurantLoadMoreRef]);

  return (
    <section className="content-auto space-y-0 pb-8 pt-3 sm:pt-4 md:pb-10 lg:pt-6">
      <div className="mb-4 px-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-[#9ca3af]">
            {totalRestaurants ?? filteredRestaurants.length} Restaurants Delivering to You
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
          className={`grid grid-cols-1 items-stretch gap-4 px-3 pt-1 transition-opacity duration-300 sm:pt-1.5 md:grid-cols-2 lg:gap-5 lg:pt-2 xl:grid-cols-3 xl:gap-6 ${
            isLoadingFilterResults || (loadingRestaurants && visibleRestaurants.length > 0) ? "opacity-50" : "opacity-100"
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
              coupons={findRestaurantCoupons(couponIndex, restaurant)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 px-4 pt-4 sm:pt-6">
        {loadingMoreRestaurants && (
          <div className="flex items-center justify-center gap-2 py-3" role="status" aria-live="polite">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#FB4F01] border-t-transparent"></div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Loading more restaurants…</span>
          </div>
        )}
        <div ref={restaurantLoadMoreRef} className="h-10 w-full" aria-hidden="true" />
      </div>
    </section>
  );
});

export default RestaurantGrid;
