import React, { memo } from "react";
import { Clock, Plus, Minus, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { resolveQuickImageUrl } from "../utils/image";

const ProductCard = memo(({ product, quantity, onAdd, onIncrement, onDecrement, compact = false }) => {
  const money = (val) => `₹${Number(val || 0).toLocaleString("en-IN")}`;
  const discount = product.originalPrice > product.price 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) 
    : 0;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={cn("flex flex-col h-full group", className)}
    >
      <div className={cn(
        "flex flex-col h-full overflow-hidden rounded-[24px] border border-[#f1f5f1] transition-all duration-300 hover:shadow-[0_15px_35px_rgba(0,0,0,0.08)]",
        compact ? "bg-white" : "bg-white shadow-[0_8px_18px_rgba(0,0,0,0.04)]"
      )}>
        <div className="relative p-2.5">
          {discount > 0 && (
            <span className="absolute left-2.5 top-2.5 z-10 rounded-lg bg-[#0c831f] px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white">
              {discount}% OFF
            </span>
          )}
          
          <button className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
             <Heart className="h-4 w-4 text-slate-400 hover:text-red-500 hover:fill-red-500" />
          </button>

          <div className={cn(
            "flex aspect-square items-center justify-center overflow-hidden rounded-2xl transition-colors duration-300 p-3",
            compact ? "bg-[#f8f9f8]" : "bg-white group-hover:bg-[#f7fbf7]"
          )}>
            <img
              src={resolveQuickImageUrl(product.image || product.mainImage)}
              alt={product.name}
              className="h-full w-full object-contain mix-blend-multiply transition duration-500 group-hover:scale-110"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "https://cdn-icons-png.flaticon.com/128/2321/2321831.png";
              }}
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col px-2.5 pb-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-[#0c831f]">
            <Clock className="h-3 w-3" />
            {product.deliveryTime || '10 MINS'}
          </div>

          <h3 className={cn(
            "line-clamp-2 font-semibold leading-tight text-[#17212f]",
            compact ? "text-[12px] min-h-[32px]" : "text-[13px] min-h-[36px]"
          )}>
            {product.name}
          </h3>
          <p className="mt-1 text-[11px] font-medium text-slate-500">{product.weight || product.unit || '1 unit'}</p>

          <div className="mt-auto flex flex-wrap items-end justify-between pt-2.5 gap-2">
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="text-[14px] font-bold leading-none text-[#111827]">{money(product.price)}</p>
              {discount > 0 && (
                <p className="text-[10px] font-semibold text-[#9ca3af] line-through">{money(product.originalPrice)}</p>
              )}
            </div>

            <div className="flex flex-shrink-0">
              {quantity > 0 ? (
                <div className="flex items-center rounded-xl border border-[#0c831f] bg-white p-0.5 shadow-sm w-[72px] justify-between h-[32px]">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDecrement(product); }} 
                    className="flex-1 flex items-center justify-center text-[#0c831f] transition-transform active:scale-90"
                  >
                    <Minus className="h-3.5 w-3.5 stroke-[3.5px]" />
                  </button>
                  <span className="text-[12px] font-black text-[#0c831f] px-0.5">{quantity}</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onIncrement(product); }} 
                    className="flex-1 flex items-center justify-center text-[#0c831f] transition-transform active:scale-90"
                  >
                    <Plus className="h-3.5 w-3.5 stroke-[3.5px]" />
                  </button>
                </div>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={(e) => { e.stopPropagation(); onAdd(product); }}
                  className="flex items-center justify-center rounded-xl border border-[#0c831f] bg-white w-[72px] h-[32px] text-[11px] font-black uppercase tracking-wide text-[#0c831f] shadow-sm transition-all hover:bg-[#0c831f]/5"
                >
                  ADD
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

export default ProductCard;
