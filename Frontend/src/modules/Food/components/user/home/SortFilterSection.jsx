import React, { memo } from "react";
import { SlidersHorizontal, MapPin } from "lucide-react";
import { Button } from "@food/components/ui/button";

const PRIMARY_FILTERS = [
  { id: "delivery-under-30", label: "Under 30 mins" },
  { id: "delivery-under-45", label: "Under 45 mins" },
  { id: "distance-under-1km", label: "Under 1km", icon: MapPin },
  { id: "distance-under-2km", label: "Under 2km", icon: MapPin },
];

const SortFilterSection = memo(({ activeFilters, toggleFilter, setIsFilterOpen }) => {
  return (
    <section className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 px-4 py-2 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-[#1a1a1a]/95 md:top-[5.5rem] lg:py-3">
      <div
        className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide sm:gap-2 lg:gap-3 lg:pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="transition-transform hover:scale-105 active:scale-95">
          <Button
            variant="outline"
            onClick={() => setIsFilterOpen(true)}
            className="flex h-7 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-gray-200 bg-white px-3 font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-800 dark:bg-[#1a1a1a] dark:text-white dark:hover:bg-gray-800 sm:h-8 sm:px-4"
          >
            <SlidersHorizontal className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="text-xs font-bold text-black dark:text-white sm:text-sm">Filters</span>
          </Button>
        </div>

        {PRIMARY_FILTERS.map((filter, index) => {
          const Icon = filter.icon;
          const isActive = activeFilters.has(filter.id);

          return (
            <div
              key={filter.id}
              className="animate-in fade-in"
              style={{ animationDelay: `${index * 50}ms`, animationFillMode: "backwards" }}
            >
              <Button
                variant="outline"
                onClick={() => toggleFilter(filter.id)}
                className={`flex h-7 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 font-medium transition-all active:scale-95 sm:h-8 sm:px-4 ${
                  isActive
                    ? "border border-[#FF0000] bg-[#FF0000] text-white hover:bg-[#FF0000]/90"
                    : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-[#1a1a1a] dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                {Icon && <Icon className={`h-3 w-3 sm:h-4 sm:w-4 ${isActive ? "fill-white" : ""}`} />}
                <span className="text-xs font-bold text-black dark:text-white sm:text-sm">{filter.label}</span>
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
});

export default SortFilterSection;
