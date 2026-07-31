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

    return sorted.slice(0, 6);
  }, [products]);

  // If no live products are available, don't render the section at all
  if (displayProducts.length === 0) return null;

  return (
    <div className="w-full bg-[#F0F9FF] pt-6 pb-8 md:mt-2 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border-b border-[#E2E8F0]">
      <div className="px-4 md:px-8 lg:px-[50px] mx-auto flex items-end justify-between mb-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[20px] md:text-[28px] font-[900] text-[#0A2351] tracking-tighter leading-none">
            LOWEST PRICE EVER
          </h2>
          <p className="text-[9px] md:text-xs font-bold text-[#1C3A7A]/80 tracking-[0.05em]">
            <span className="text-[#FE5502] mr-1">•</span> UNBEATABLE SAVINGS <span className="text-[#FE5502] mx-1">•</span> UPDATED HOURLY
          </p>
        </div>
        <button
          className="flex items-center gap-0.5 bg-white text-[#0A2351] px-3 md:px-4 py-1.5 md:py-2 rounded-full font-bold text-xs shadow-sm hover:shadow-md transition-shadow ring-1 ring-slate-100"
          onClick={() => navigate(categoriesPath)}
        >
          See all
          <ChevronRight size={14} className="mt-[1px]" />
        </button>
      </div>

      <div className="px-4 md:px-8 lg:px-[50px] mx-auto">
        <div className="flex overflow-x-auto gap-3 md:gap-4 pb-2 no-scrollbar snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0">
          {displayProducts.map((product, idx) => (
            <motion.div
              key={product._id || product.id || `lp-prod-${idx}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.1 }}
              className="w-[145px] md:w-[165px] lg:w-[185px] flex-shrink-0 snap-start"
            >
              <ProductCard
                product={product}
                badge={product.discount || product.badge}
                className="shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)] border-transparent"
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
