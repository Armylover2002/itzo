import React, { useRef } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ProductCard from "../shared/ProductCard";
import { resolveQuickImageUrl } from "../../utils/image";
import { getQuickCategoryPath } from "../../utils/routes";
import { motion } from "framer-motion";

const CategoryProductSection = ({ category, products = [] }) => {
  const navigate = useNavigate();
  const scrollRef = useRef(null);

  if (!category || !Array.isArray(products) || products.length === 0) {
    return null;
  }

  const categoryId = category._id || category.id;
  const categoryName = category.name || "Category";
  const categoryImage = resolveQuickImageUrl(category.image || category.icon);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -280 : 280;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <section className="w-full my-5 md:my-7">
      {/* Category Headline Header */}
      <div className="px-4 md:px-8 lg:px-[50px] mx-auto flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-3">
          {categoryImage && (
            <div className="w-9 h-9 md:w-11 md:h-11 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-100 dark:border-orange-900/30 flex items-center justify-center p-1.5 shadow-xs flex-shrink-0">
              <img
                src={categoryImage}
                alt={categoryName}
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.src = "https://cdn-icons-png.flaticon.com/128/2321/2321831.png";
                }}
              />
            </div>
          )}
          <div className="flex flex-col">
            <h3 className="text-[17px] md:text-[22px] font-black text-[#0A2351] dark:text-foreground tracking-tight leading-tight">
              {categoryName}
            </h3>
            <span className="text-[10px] md:text-xs font-semibold text-gray-500 dark:text-muted-foreground">
              {products.length} {products.length === 1 ? "item" : "items"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Desktop Arrow Scroll Controls */}
          <div className="hidden md:flex items-center gap-1 mr-1">
            <button
              onClick={() => scroll("left")}
              className="w-8 h-8 rounded-full bg-white dark:bg-card border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
              aria-label="Scroll left"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => scroll("right")}
              className="w-8 h-8 rounded-full bg-white dark:bg-card border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
              aria-label="Scroll right"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={() => navigate(getQuickCategoryPath(categoryId))}
            className="flex items-center gap-1 bg-white dark:bg-card text-[#FE5502] hover:text-[#e04b02] px-3.5 py-1.5 rounded-full font-bold text-xs shadow-xs hover:shadow-sm transition-all ring-1 ring-orange-100 dark:ring-orange-950/40 cursor-pointer"
          >
            <span>See all</span>
            <ChevronRight size={14} className="mt-[0.5px]" />
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Product Track */}
      <div className="px-4 md:px-8 lg:px-[50px] mx-auto">
        <div
          ref={scrollRef}
          className="flex overflow-x-auto gap-3 md:gap-4 pb-2 pt-1 no-scrollbar snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0"
        >
          {products.map((product, idx) => (
            <motion.div
              key={product._id || product.id || `cat-prod-${idx}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.3) }}
              className="w-[145px] md:w-[165px] lg:w-[180px] flex-shrink-0 snap-start flex"
            >
              <ProductCard
                product={product}
                badge={product.discount || product.badge}
                className="shadow-sm border-gray-100 dark:border-white/5 h-full w-full"
                compact
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default React.memo(CategoryProductSection);
