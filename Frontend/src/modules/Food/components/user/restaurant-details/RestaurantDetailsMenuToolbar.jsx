import { SlidersHorizontal, ChevronDown, X } from "lucide-react";
import { Button } from "@food/components/ui/button";

export default function RestaurantDetailsMenuToolbar({
  activeFilterCount,
  filters,
  vegMode,
  isPureVeg,
  hasNonVegItems,
  menuCategories,
  selectedMenuCategory,
  onOpenFilters,
  onToggleVegFilter,
  onToggleNonVegFilter,
  onSelectCategory,
}) {
  return (
    <div className="sticky top-0 z-30 mt-5 bg-[#f6f7fb]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md border-y border-gray-200/80 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-2.5">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <Button
            variant="outline"
            size="sm"
            className="relative shrink-0 rounded-full border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a]"
            onClick={onOpenFilters}
          >
            <SlidersHorizontal className="h-4 w-4 mr-1.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 h-5 min-w-5 px-1 rounded-full bg-[#FF0000] text-white text-xs font-bold inline-flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>

          {true && (
            <Button
              variant="outline"
              size="sm"
              className={`shrink-0 rounded-full ${
                filters.vegNonVeg === "veg"
                  ? "border-green-600 bg-green-50 text-green-700 font-bold"
                  : "border-gray-300 bg-white dark:bg-[#1a1a1a]"
              }`}
              onClick={onToggleVegFilter}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-green-600 mr-1.5" />
              Veg
              {filters.vegNonVeg === "veg" && <X className="h-3 w-3 ml-1" />}
            </Button>
          )}

          {(vegMode !== "pure" && vegMode !== "all" && vegMode !== true && !isPureVeg && hasNonVegItems) && (
            <Button
              variant="outline"
              size="sm"
              className={`shrink-0 rounded-full ${
                filters.vegNonVeg === "non-veg"
                  ? "border-amber-700 bg-amber-50 text-amber-800 font-bold"
                  : "border-gray-300 bg-white dark:bg-[#1a1a1a]"
              }`}
              onClick={onToggleNonVegFilter}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-amber-700 mr-1.5" />
              Non-veg
              {filters.vegNonVeg === "non-veg" && <X className="h-3 w-3 ml-1" />}
            </Button>
          )}
        </div>

        {menuCategories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            <button
              type="button"
              onClick={() => onSelectCategory("all")}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                selectedMenuCategory === "all"
                  ? "bg-[#FF0000] text-white shadow-sm"
                  : "bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
              }`}
            >
              All
            </button>
            {menuCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelectCategory(category.id)}
                className={`shrink-0 flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                  selectedMenuCategory === category.id
                    ? "bg-[#FF0000] text-white shadow-sm"
                    : "bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                }`}
              >
                {category.image ? (
                  <img
                    src={category.image}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  <span className="h-6 w-6 rounded-full bg-gray-100 text-[10px] font-bold flex items-center justify-center uppercase">
                    {category.name?.charAt(0) || "C"}
                  </span>
                )}
                {category.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
