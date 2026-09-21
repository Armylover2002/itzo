import React, { memo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { CategoryChipRowSkeleton } from "@food/components/ui/loading-skeletons";
import OptimizedImage from "@food/components/OptimizedImage";
import foodPattern from "@food/assets/food_pattern_background.png";

const CategoryRail = memo(({ 
  displayCategories, 
  showCategorySkeleton,
  navigate,
  backendOrigin = "",
  hasOffers = true
}) => {
  const scrollRef = React.useRef(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const syncScrollState = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < maxScroll - 4);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    syncScrollState();
    el.addEventListener("scroll", syncScrollState, { passive: true });

    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(syncScrollState) : null;
    observer?.observe(el);

    return () => {
      el.removeEventListener("scroll", syncScrollState);
      observer?.disconnect();
    };
  }, [syncScrollState, displayCategories, showCategorySkeleton, hasOffers]);

  const scrollByStep = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.max(240, Math.round(el.clientWidth * 0.8));
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  const hasScrollableContent = canScrollLeft || canScrollRight;

  return (
    <section className="mt-4 px-4 md:mt-6" data-purpose="mind-categories">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <h3 className="text-[15px] font-semibold text-[#1c1c1e] dark:text-white md:text-xl tracking-tight">What's on your mind?</h3>
        {hasScrollableContent && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => scrollByStep(-1)}
              disabled={!canScrollLeft}
              aria-label="Scroll categories left"
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors border-0 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4 text-gray-700" />
            </button>
            <button
              type="button"
              onClick={() => scrollByStep(1)}
              disabled={!canScrollRight}
              aria-label="Scroll categories right"
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors border-0 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowRight className="h-4 w-4 text-gray-700" />
            </button>
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide md:gap-5 scroll-smooth">
        {/* Offers Card */}
        {hasOffers && (
        <div 
          className="w-[72px] md:w-[84px] flex-shrink-0 flex flex-col items-center space-y-2 cursor-pointer group"
          onClick={() => navigate("/user/under-250")}
        >
          <div className="w-16 h-16 rounded-full bg-red-100/30 flex items-center justify-center p-0.5 border-2 border-[#FE5502] overflow-hidden transition-transform group-hover:scale-105 group-active:scale-95">
            <div className="bg-[#FE5502] w-full h-full rounded-full flex flex-col items-center justify-center text-white p-2">
              <span className="text-[8px] font-bold uppercase">Under</span>
              <span className="text-xs font-bold">₹200</span>
              <div className="bg-white text-[#FE5502] text-[6px] px-1 py-0.5 rounded-full mt-1 font-bold">Explore</div>
            </div>
          </div>
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Offers</span>
        </div>
        )}

        {!showCategorySkeleton && displayCategories.map((category, index) => (
          <Link
            key={category.id || index}
            to={`/user/category/${category.slug || category.name.toLowerCase().replace(/\s+/g, "-")}`}
            className="w-[72px] md:w-[84px] flex-shrink-0 flex flex-col items-center space-y-2 group"
          >
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 transition-transform group-hover:scale-110">
              <OptimizedImage
                src={category.image}
                alt={category.name}
                className="w-full h-full object-cover"
                backendOrigin={backendOrigin}
              />
            </div>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 truncate w-full text-center">
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
