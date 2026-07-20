import React, { memo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ExploreGridSkeleton } from "@food/components/ui/loading-skeletons";
import OptimizedImage from "@food/components/OptimizedImage";
import discoveryBg from "@food/assets/food_discovery_bg.png";

const ExploreMoreSection = memo(({
  exploreMoreHeading,
  showExploreSkeleton,
  finalExploreItems,
  backendOrigin = ""
}) => {
  return (
    <section className="px-4 py-4">
      <div className="relative rounded-[20px] overflow-hidden bg-gradient-to-br from-[#0c0524] via-[#1a144b] to-[#0c0524] shadow-lg border border-[#3b328a]/40 p-4 pt-4 pb-5">
        
        {/* Background Effects matching the second image */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400 rounded-full blur-[80px] opacity-20 pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-primary rounded-full blur-[70px] opacity-30 pointer-events-none" />
        
        {/* Subtle floating stars/particles */}
        <div className="absolute top-3 left-4 w-1 h-1 bg-white rounded-full shadow-[0_0_8px_2px_rgba(255,255,255,0.8)] opacity-70" />
        <div className="absolute top-1/2 right-6 w-1 h-1 bg-amber-200 rounded-full shadow-[0_0_10px_2px_rgba(251,191,36,0.8)] opacity-80" />
        <div className="absolute bottom-4 left-1/3 w-0.5 h-0.5 bg-white rounded-full shadow-[0_0_6px_2px_rgba(255,255,255,0.8)] opacity-50" />

        <h2 className="relative z-10 text-[11px] font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 tracking-[0.15em] uppercase mb-4 text-center drop-shadow-sm">
          {exploreMoreHeading || "Explore More"}
        </h2>
        
        {showExploreSkeleton ? (
          <div className="relative z-10 w-full px-1 sm:px-2">
            <ExploreGridSkeleton count={3} className="grid-cols-3" />
          </div>
        ) : (
          <div className="relative z-10 flex justify-between items-start gap-1 px-1 sm:px-2">
            {finalExploreItems.map((item, index) => (
              <Link
                key={item.id || `explore-item-${index}`}
                to={item.href}
                className="flex flex-col items-center gap-1.5 group w-[30%]"
              >
                <div className="relative w-[52px] h-[52px] sm:w-[60px] sm:h-[60px] rounded-full p-[2px] bg-gradient-to-b from-amber-300 via-yellow-500 to-amber-700 shadow-[0_4px_12px_rgba(251,191,36,0.25)] transition-transform duration-300 group-hover:-translate-y-1 group-active:scale-95">
                  <div className="w-full h-full rounded-full overflow-hidden bg-[#0a041c] border-[1.5px] border-[#1a144b]">
                    <OptimizedImage
                      src={item.image}
                      alt={item.label}
                      className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                    />
                  </div>
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold text-orange-50 text-center tracking-wide group-hover:text-amber-300 transition-colors duration-300">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
});

export default ExploreMoreSection;
