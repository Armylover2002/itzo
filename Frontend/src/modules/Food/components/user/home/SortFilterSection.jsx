import React, { memo } from "react";
import { motion } from "framer-motion";
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
    <section className="py-1 lg:py-2 px-4 md:px-0">
      <div
        className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide sm:gap-2 lg:gap-3 lg:pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="outline"
            onClick={() => setIsFilterOpen(true)}
            className="flex h-7 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-200 bg-white px-2 font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-800 dark:bg-[#1a1a1a] dark:text-white dark:hover:bg-gray-800 sm:h-8 sm:px-3"
          >
            <SlidersHorizontal className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="text-xs font-bold text-black dark:text-white sm:text-sm">Filters</span>
          </Button>
        </motion.div>

        {PRIMARY_FILTERS.map((filter, index) => {
          const Icon = filter.icon;
          const isActive = activeFilters.has(filter.id);

          return (
            <motion.div
              key={filter.id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="outline"
                onClick={() => toggleFilter(filter.id)}
                className={`flex h-7 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 font-medium transition-all sm:h-8 sm:px-3 ${
                  isActive
                    ? "border border-[#FE5502] bg-[#FE5502] text-white hover:bg-[#FE5502]/90"
                    : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-[#1a1a1a] dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                {Icon && <Icon className={`h-3 w-3 sm:h-4 sm:w-4 ${isActive ? "fill-white" : ""}`} />}
                <span className="text-xs font-bold text-black dark:text-white sm:text-sm">{filter.label}</span>
              </Button>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
});

export default SortFilterSection;
