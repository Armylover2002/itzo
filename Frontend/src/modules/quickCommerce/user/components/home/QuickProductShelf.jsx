import React, { useRef } from "react";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ProductCard from "../shared/ProductCard";
import { getQuickCategoryPath } from "../../utils/routes";
import { Skeleton } from "@food/components/ui/skeleton";

const QuickProductShelf = ({ category, products = [], isLoading = false }) => {
  const navigate = useNavigate();
  const scrollRef = useRef(null);

  if (isLoading) {
    return (
      <div className="w-full bg-white dark:bg-background pt-4 pb-6 mb-2">
        <div className="px-4 mb-3 flex items-center justify-between">
          <Skeleton className="h-6 w-48 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        <div className="flex gap-3 px-4 overflow-x-hidden">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="min-w-[140px] md:min-w-[180px] h-64 rounded-xl shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (!products || products.length === 0) return null;

  return (
    <div className="w-full bg-white dark:bg-background pt-4 pb-6 mb-2">
      <div className="px-4 mb-3 flex items-center justify-between">
        <h3 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white tracking-tight">
          {category?.name || "Recommended"}
        </h3>
        {category && category.id !== "all" && category._id !== "all" && (
          <button
            onClick={() => navigate(getQuickCategoryPath(category._id || category.id))}
            className="flex items-center text-sm font-semibold text-emerald-600 dark:text-emerald-400 active:scale-95 transition-transform"
          >
            See all
            <ChevronRight size={16} className="ml-0.5" />
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 px-4 overflow-x-auto no-scrollbar snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {products.map((p) => (
          <div key={p._id || p.id} className="snap-start shrink-0 w-[140px] md:w-[180px]">
            <ProductCard product={p} hideActions={false} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(QuickProductShelf);
