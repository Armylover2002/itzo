import React from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { HorizontalCarousel } from "@food/components/ui/horizontal-carousel";
import OptimizedImage from "@food/components/OptimizedImage";

const HomeHeroBanner = ({ 
  loadingBanners, 
  heroBannerImages, 
  currentBannerIndex, 
  onBannerClick 
}) => {
  if (loadingBanners) {
    return (
      <div className="mx-4 mt-6 h-48 sm:h-64 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
    );
  }

  if (heroBannerImages.length === 0) return null;

  return (
    <div className="mx-0 sm:mx-4 mt-4 sm:mt-6 mb-8 overflow-hidden">
      <div className="relative h-48 sm:h-64 md:h-80 w-full group">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentBannerIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full h-full cursor-pointer overflow-hidden rounded-none sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
            onClick={onBannerClick}
          >
            <OptimizedImage
              src={heroBannerImages[currentBannerIndex]}
              alt={`Banner ${currentBannerIndex + 1}`}
              className="w-full h-full object-cover transform scale-100 group-hover:scale-105 transition-transform duration-700"
            />
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
          </motion.div>
        </AnimatePresence>

        {/* Dynamic Navigation Dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-1.5 bg-black/20 backdrop-blur-md rounded-full border border-white/20">
          {heroBannerImages.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentBannerIndex ? 'w-5 sm:w-6 bg-white' : 'w-1.5 bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default React.memo(HomeHeroBanner);
