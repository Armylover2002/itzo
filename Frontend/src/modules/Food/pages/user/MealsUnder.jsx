import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import AnimatedPage from "@food/components/user/AnimatedPage";
import { useLocation } from "@food/hooks/useLocation";
import { useZone } from "@food/hooks/useZone";
import { useProfile } from "@food/context/ProfileContext";
import useHomePriceFilter from "@food/hooks/user/useHomePriceFilter";
import {
  MealItemCard,
  MealsUnderHeading,
  useMealCartActions,
} from "@food/components/user/home/MealsUnderSection";

/** "See All" page for the admin-controlled "Meals under ₹X" home section. */
export default function MealsUnder() {
  const navigate = useNavigate();
  const { location } = useLocation();
  const { zoneId, zoneStatus } = useZone(location);
  const { vegMode } = useProfile();
  const { section, items, loading } = useHomePriceFilter({
    zoneId,
    latitude: location?.latitude,
    longitude: location?.longitude,
    enabled: zoneStatus !== "loading",
  });
  const { add, remove, getQuantity } = useMealCartActions();

  const visibleItems = vegMode ? items.filter((item) => item.isVeg) : items;
  const isDisabled = !loading && section && !section.isActive;

  return (
    <AnimatedPage className="min-h-screen bg-white pb-24">
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <button
          type="button"
          aria-label="Go back"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100"
        >
          <ChevronLeft className="h-6 w-6 text-gray-900" />
        </button>
        {section ? <MealsUnderHeading section={section} /> : null}
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="aspect-square w-full rounded-[22px] bg-gray-100" />
                <div className="mt-2 h-3 w-2/3 rounded bg-gray-100" />
                <div className="mt-2 h-4 w-full rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : isDisabled || visibleItems.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">No items available right now.</p>
        ) : (
          <>
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
              {visibleItems.length} items
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {visibleItems.map((item) => (
                <MealItemCard
                  key={item.id}
                  item={item}
                  quantity={getQuantity(item)}
                  onAdd={add}
                  onRemove={remove}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AnimatedPage>
  );
}
