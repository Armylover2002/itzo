import React from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { HorizontalCarousel } from "@food/components/ui/horizontal-carousel";
import OptimizedImage from "@food/components/OptimizedImage";

const CategoryList = ({ loading, categories, onCategoryClick }) => {
  if (loading) {
    return (
      <div className="flex gap-4 overflow-hidden px-4 md:px-0">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex-shrink-0 flex flex-col items-center gap-2">
            <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" />
            <div className="w-12 h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <HorizontalCarousel className="w-full">
      <AnimatePresence mode="popLayout">
        <div className="flex gap-2 sm:gap-4 md:gap-5 px-4 md:px-0 py-2">
          {categories.map((category, index) => (
            <motion.div
              layout
              key={category.id || category.name}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -5 }}
              onClick={() => onCategoryClick(category)}
              className="flex-shrink-0 flex flex-col items-center gap-2 sm:gap-3 cursor-pointer group"
            >
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-full bg-white dark:bg-[#1a1a1a] shadow-md group-hover:shadow-xl transition-all duration-300 p-1 ring-2 ring-transparent group-hover:ring-primary-orange/20 overflow-hidden">
                <OptimizedImage
                  src={category.image}
                  alt={category.name}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-primary-orange text-center whitespace-normal max-w-[80px] sm:max-w-[100px] leading-tight line-clamp-2 transition-colors duration-300">
                {category.name}
              </span>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </HorizontalCarousel>
  );
};

export default React.memo(CategoryList);
