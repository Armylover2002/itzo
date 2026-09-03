import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import ProductCard from "../shared/ProductCard";
import { useNavigate } from "react-router-dom";
import { getQuickCategoriesPath } from "../../utils/routes";

const LowestPriceEverSection = ({ products = [] }) => {
  const navigate = useNavigate();
  const categoriesPath = getQuickCategoriesPath();

  // Select up to 6 products with the lowest sale/regular price from live data only.
  // No fallback to mocks — if there are no live products, the section is hidden.
  const displayProducts = useMemo(() => {
    const live = products.filter(
      (p) =>
        p &&
        (p._id || p.id) &&
        p.name &&
        // Exclude any product that has no valid price
        (Number(p.price || 0) > 0 || Number(p.salePrice || 0) > 0)
    );

    if (live.length === 0) return [];

    const getDiscount = (p) => {
      const price = Number(p.salePrice || 0) > 0 ? Number(p.salePrice) : Number(p.price || 0);
      const original = Number(p.originalPrice || p.mrp || p.price || 0);
      if (original > price && price > 0) {
        return ((original - price) / original) * 100;
      }
      return 0;
    };

    // Sort by discount percentage descending.
    // If discounts are equal, preserve the original backend order (which is newest first),
    // so recently added test products like "basmati" still show up.
    const sorted = [...live].sort((a, b) => {
      const discountA = getDiscount(a);
      const discountB = getDiscount(b);
      
      if (discountA !== discountB) {
        return discountB - discountA;
      }
      return 0; // Maintain original order (newest first)
    });

    return sorted.slice(0, 10);
  }, [products]);

  // If no live products are available, don't render the section at all
  if (displayProducts.length === 0) return null;

  return (
    <div className="w-full bg-[#F0F9FF] dark:bg-card/40 pt-5 pb-7 md:mt-2 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border-b border-[#E2E8F0] dark:border-white/5">
      <div className="px-3 md:px-8 lg:px-[50px] mx-auto flex items-end justify-between mb-3.5">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[18px] md:text-[26px] font-[900] text-[#0A2351] dark:text-foreground tracking-tighter leading-none">
            LOWEST PRICE EVER
          </h2>
          <p className="text-[9px] md:text-xs font-bold text-[#1C3A7A]/80 dark:text-muted-foreground tracking-[0.05em]">
            <span className="text-[#FE5502] mr-1">•</span> UNBEATABLE SAVINGS <span className="text-[#FE5502] mx-1">•</span> UPDATED HOURLY
          </p>
        </div>
        <button
          className="flex items-center gap-0.5 bg-white dark:bg-card text-[#0A2351] dark:text-foreground px-3 md:px-4 py-1.5 md:py-2 rounded-full font-bold text-xs shadow-sm hover:shadow-md transition-shadow ring-1 ring-slate-100 dark:ring-white/10"
          onClick={() => navigate(categoriesPath)}
        >
          See all
          <ChevronRight size={14} className="mt-[1px]" />
        </button>
      </div>

      <div className="px-3 md:px-8 lg:px-[50px] mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 md:gap-4">
          {displayProducts.map((product, idx) => (
            <motion.div
              key={product._id || product.id || `lp-prod-${idx}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.3) }}
              className="w-full flex"
            >
              <ProductCard
                product={product}
                badge={product.discount || product.badge}
                className="shadow-sm border-slate-100 dark:border-white/5 w-full h-full"
                compact
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default React.memo(LowestPriceEverSection);
