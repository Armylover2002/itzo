/* eslint-disable react/prop-types */
import { memo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import OptimizedImage from "@food/components/OptimizedImage";
import { useCart } from "@food/context/CartContext";
import { useProfile } from "@food/context/ProfileContext";
import { isModuleAuthenticated } from "@food/utils/auth";
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability";
import useHomePriceFilter from "@food/hooks/user/useHomePriceFilter";

const RUPEE_SYMBOL = "₹";
const HOME_RAIL_LIMIT = 15;

const getRestaurantPath = (restaurant) => `/user/restaurants/${restaurant?.slug || restaurant?.id}`;

const getSourcePosition = (event, itemId) => {
  const button = event?.currentTarget;
  if (!button) return null;
  const rect = button.getBoundingClientRect();
  return {
    viewportX: rect.left + rect.width / 2,
    viewportY: rect.top + rect.height / 2,
    scrollX: window.pageXOffset || window.scrollX || 0,
    scrollY: window.pageYOffset || window.scrollY || 0,
    itemId,
  };
};

/** Cart controls shared by the home rail and the "See All" page. */
export function useMealCartActions() {
  const navigate = useNavigate();
  const { addToCart, updateQuantity, getCartItem } = useCart();

  const getQuantity = useCallback((item) => getCartItem(item.id)?.quantity || 0, [getCartItem]);

  const add = useCallback(
    (event, item) => {
      event.preventDefault();
      event.stopPropagation();

      if (!isModuleAuthenticated("user")) {
        toast.error("Please login to add items to cart");
        navigate("/user/auth/login", { state: { from: window.location.pathname } });
        return;
      }

      // Items with variants need a variant choice — let the restaurant page handle it.
      if (Array.isArray(item.variants) && item.variants.length > 0) {
        navigate(getRestaurantPath(item.restaurant));
        return;
      }

      const sourcePosition = getSourcePosition(event, item.id);
      const existing = getCartItem(item.id);
      if (existing) {
        updateQuantity(item.id, existing.quantity + 1, sourcePosition, {
          id: item.id,
          name: item.name,
          imageUrl: item.image,
        });
        return;
      }

      const result = addToCart(
        {
          ...item,
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image,
          description: item.description || "",
          originalPrice: item.price,
          restaurant: item.restaurant?.name,
          restaurantId: item.restaurant?.restaurantId || item.restaurant?.id,
        },
        sourcePosition,
      );
      if (result?.ok === false) {
        toast.error(result.error || "Cannot add item from different restaurant. Please clear cart first.");
      }
    },
    [addToCart, getCartItem, navigate, updateQuantity],
  );

  const remove = useCallback(
    (event, item) => {
      event.preventDefault();
      event.stopPropagation();
      const existing = getCartItem(item.id);
      if (!existing) return;
      updateQuantity(item.id, existing.quantity - 1, getSourcePosition(event, item.id), {
        id: item.id,
        name: item.name,
        imageUrl: item.image,
      });
    },
    [getCartItem, updateQuantity],
  );

  return { add, remove, getQuantity };
}

export const MealItemCard = memo(function MealItemCard({ item, quantity, onAdd, onRemove, className = "" }) {
  const restaurant = item.restaurant || {};
  const isOpen = getRestaurantAvailabilityStatus(restaurant, new Date()).isOpen;
  const isCustomisable = Array.isArray(item.variants) && item.variants.length > 0;

  return (
    <Link to={getRestaurantPath(restaurant)} className={`group block ${className}`}>
      <div className={`relative aspect-square w-full overflow-hidden rounded-[22px] bg-gray-100`}>
        {item.image ? (
          <OptimizedImage
            src={item.image}
            alt={item.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}

        {isOpen ? (
          quantity > 0 && !isCustomisable ? (
            <div className="absolute bottom-2 right-2 flex h-9 items-center gap-2 rounded-full bg-white px-1.5 shadow-md">
              <button
                type="button"
                aria-label={`Remove one ${item.name}`}
                onClick={(event) => onRemove(event, item)}
                className="flex h-6 w-6 items-center justify-center text-[#e23744]"
              >
                <Minus className="h-4 w-4" strokeWidth={2.5} />
              </button>
              <span className="min-w-[1ch] text-sm font-bold text-[#e23744]">{quantity}</span>
              <button
                type="button"
                aria-label={`Add one more ${item.name}`}
                onClick={(event) => onAdd(event, item)}
                className="flex h-6 w-6 items-center justify-center text-[#e23744]"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              aria-label={`Add ${item.name}`}
              onClick={(event) => onAdd(event, item)}
              className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-[#e23744] shadow-md transition-transform active:scale-90"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </button>
          )
        ) : (
          <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
            Offline
          </span>
        )}
      </div>

      <p className="mt-2 truncate text-xs font-semibold text-gray-500">{restaurant.name}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span
          className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-[3px] border ${
            item.isVeg ? "border-green-600" : "border-red-600"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${item.isVeg ? "bg-green-600" : "bg-red-600"}`} />
        </span>
        <h3 className="truncate text-sm font-bold text-gray-900">{item.name}</h3>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-gray-900">
          {RUPEE_SYMBOL}
          {item.price}
        </span>
        {isCustomisable && (
          <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Customisable
          </span>
        )}
      </div>
    </Link>
  );
});

export function MealsUnderHeading({ section }) {
  return (
    <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-gray-900 sm:text-2xl">
      {section?.title || "Meals under"}
      <span className="rounded-full border-2 border-gray-900 px-2.5 text-lg leading-7 sm:text-xl">
        {RUPEE_SYMBOL}
        {section?.maxPrice}
      </span>
    </h2>
  );
}

function MealsUnderSection({ zoneId, location }) {
  const { vegMode } = useProfile();
  const { section, items, loading } = useHomePriceFilter({
    zoneId,
    latitude: location?.latitude,
    longitude: location?.longitude,
  });
  const { add, remove, getQuantity } = useMealCartActions();

  const visibleItems = (vegMode ? items.filter((item) => item.isVeg) : items).slice(0, HOME_RAIL_LIMIT);

  if (loading || !section?.isActive || visibleItems.length === 0) return null;

  return (
    <section className="content-auto px-4 pb-2 pt-4 max-w-7xl mx-auto">
      <div className="mb-3 flex items-center justify-between gap-3">
        <MealsUnderHeading section={section} />
        <Link
          to="/user/meals-under"
          className="flex flex-shrink-0 items-center gap-1 text-sm font-bold text-[#e23744]"
        >
          See All <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div
        className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {visibleItems.map((item) => (
          <MealItemCard
            key={item.id}
            item={item}
            quantity={getQuantity(item)}
            onAdd={add}
            onRemove={remove}
            className="w-[150px] flex-shrink-0 sm:w-[170px]"
          />
        ))}
      </div>
    </section>
  );
}

export default memo(MealsUnderSection);
