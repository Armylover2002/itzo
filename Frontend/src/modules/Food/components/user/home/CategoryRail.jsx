import React, { memo } from "react";
import { Link } from "react-router-dom";
import { ArrowDownUp } from "lucide-react";
import { CategoryChipRowSkeleton } from "@food/components/ui/loading-skeletons";
import OptimizedImage from "@food/components/OptimizedImage";
import foodPattern from "@food/assets/food_pattern_background.png";

const CategoryRail = memo(({ 
  displayCategories, 
  showCategorySkeleton,
  navigate,
  backendOrigin = ""
}) => {
  return (
    <section className="px-4 md:px-0 py-4 space-y-4">
      <h2 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">
        What's on your mind?
      </h2>
      
      <div className="flex gap-4 sm:gap-6 overflow-x-auto scrollbar-hide pb-2 pt-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {/* Offers Card - Rounded Square */}
        <div 
          className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer group"
          onClick={() => navigate("/user/under-250")}
        >
          <div className="w-[72px] h-[72px] sm:w-[84px] sm:h-[84px] bg-[#FE5502] rounded-2xl flex flex-col items-center justify-center p-1 shadow-sm transition-transform group-hover:scale-105 group-active:scale-95">
            <span className="text-[10px] font-bold text-white/90">UNDER</span>
            <span className="text-sm sm:text-base font-black text-white">₹200</span>
            <div className="mt-1 px-2 py-0.5 bg-white rounded-full">
              <span className="text-[8px] font-extrabold text-[#FE5502]">Explore</span>
            </div>
          </div>
          <span className="text-xs font-semibold text-gray-600">Offers</span>
        </div>

        {!showCategorySkeleton && displayCategories.map((category, index) => (
          <Link
            key={category.id || index}
            to={`/user/category/${category.slug || category.name.toLowerCase().replace(/\s+/g, "-")}`}
            className="flex-shrink-0 flex flex-col items-center gap-2 group"
          >
            <div className="w-[72px] h-[72px] sm:w-[84px] sm:h-[84px] rounded-full overflow-hidden shadow-sm border border-gray-100 transition-transform group-hover:scale-110">
              <OptimizedImage
                src={category.image}
                alt={category.name}
                className="w-full h-full object-cover"
                backendOrigin={backendOrigin}
              />
            </div>
            <span className="text-xs font-semibold text-gray-600 truncate w-full text-center">
              {category.name}
            </span>
          </Link>
        ))}

        {showCategorySkeleton && <CategoryChipRowSkeleton className="flex-shrink-0" />}
      </div>
    </section>
  );
});

export default CategoryRail;
