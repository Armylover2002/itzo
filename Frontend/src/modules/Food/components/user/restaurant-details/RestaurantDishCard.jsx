import { motion } from "framer-motion";
import { Heart, Plus, Minus } from "lucide-react";
import {
  getFoodDisplayPrice,
  getFoodVariants,
  hasFoodVariants,
} from "@food/utils/foodVariants";
import ItemSlotAvailabilityNote from "@food/components/user/ItemSlotAvailabilityNote";
import { FOOD_IMAGE_FALLBACK, RUPEE_SYMBOL } from "./restaurantDetailsUtils";

export default function RestaurantDishCard({
  item,
  quantity = 0,
  highlighted = false,
  disabled = false,
  isRecommended = false,
  isBookmarked = false,
  cardRef,
  onOpen,
  onBookmark,
  onShare,
  onDecrease,
  onIncrease,
}) {
  const isVeg = item.foodType === "Veg" || item.isVeg === true;
  const price = getFoodDisplayPrice(item);
  const variants = getFoodVariants(item);

  let otherPrice = Number(item.otherPrice) || 0;
  if (variants.length > 0) {
    const validOtherPrices = variants.map((v) => Number(v.otherPrice) || 0).filter((p) => p > 0);
    if (validOtherPrices.length > 0) otherPrice = Math.min(...validOtherPrices);
  }

  return (
    <div
      ref={cardRef}
      onClick={(e) => {
        if (!disabled && onOpen) {
          onOpen(e);
        }
      }}
      className={`bg-white dark:bg-[#1a1a1a] rounded-[12px] border overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] block hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col relative group ${
        highlighted ? "border-[#FF0000]/30 bg-red-50/20" : "border-gray-100 dark:border-gray-800"
      }`}
      data-purpose="product-card"
    >
      <div className="relative h-24 sm:h-28 bg-gray-100 dark:bg-gray-800 shrink-0">
        <img
          src={item.image || item.imageUrl || FOOD_IMAGE_FALLBACK}
          alt={item.name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            if (e.currentTarget.src !== FOOD_IMAGE_FALLBACK) {
              e.currentTarget.src = FOOD_IMAGE_FALLBACK;
            }
          }}
        />
        {isVeg ? (
          <div className="absolute top-2 left-2 bg-green-600 px-1.5 py-0.5 rounded flex items-center shadow-sm">
            <span className="text-[7.5px] font-bold text-white uppercase tracking-wider">VEG</span>
          </div>
        ) : (
          <div className="absolute top-2 left-2 bg-red-600 px-1.5 py-0.5 rounded flex items-center shadow-sm">
            <span className="text-[7.5px] font-bold text-white uppercase tracking-wider">NON-VEG</span>
          </div>
        )}
        <button
          type="button"
          className="absolute top-2 right-2 bg-white dark:bg-[#1a1a1a] rounded-full p-1.5 shadow-sm border-0 outline-none z-10 transition-transform active:scale-90"
          onClick={(e) => {
            e.stopPropagation();
            onBookmark?.(e);
          }}
        >
          <Heart 
            className="h-3.5 w-3.5 transition-colors" 
            fill={isBookmarked ? "#FF0000" : "none"} 
            stroke={isBookmarked ? "#FF0000" : "#4B5563"} 
          />
        </button>
        {isRecommended && (
          <div className="absolute bottom-2 left-2 bg-[#FF0000]/90 backdrop-blur-sm px-1.5 py-0.5 rounded shadow-sm">
            <span className="text-[8px] font-bold text-white uppercase tracking-wider">Bestseller</span>
          </div>
        )}
      </div>

      <div className="p-2.5 pb-6 flex flex-col flex-1">
        <h4 className="font-bold text-[13px] text-[#1c1c1e] dark:text-gray-100 line-clamp-2 leading-tight">{item.name}</h4>
        
        {item.description && (
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-1 font-medium">
            {item.description}
          </p>
        )}

        <ItemSlotAvailabilityNote item={item} className="mt-1" />
        
        <div className="flex justify-between items-center mt-auto pt-3 shrink-0">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[14px] font-bold text-[#FF0000] leading-none">
                {RUPEE_SYMBOL}{Math.round(price)}
              </span>
              {otherPrice > 0 && otherPrice > price && (
                <span className="text-[10px] text-gray-400 line-through font-medium leading-none">
                  {RUPEE_SYMBOL}{Math.round(otherPrice)}
                </span>
              )}
            </div>
          </div>
          
          <div className="relative z-10 flex flex-col items-center">
            {quantity > 0 ? (
              <div className="flex items-center bg-[#FF0000] rounded-[8px] overflow-hidden shadow-sm h-7 w-20">
                <button
                  type="button"
                  disabled={disabled}
                  className="flex-1 h-full text-white font-bold flex items-center justify-center hover:bg-[#CC0000] transition-colors disabled:opacity-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) onDecrease?.(e);
                  }}
                >
                  <Minus className="h-3 w-3 stroke-[3]" />
                </button>
                <span className="text-white font-bold text-[11px] px-1">{quantity}</span>
                <button
                  type="button"
                  disabled={disabled}
                  className="flex-1 h-full text-white font-bold flex items-center justify-center hover:bg-[#CC0000] transition-colors disabled:opacity-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) onIncrease?.(e);
                  }}
                >
                  <Plus className="h-3 w-3 stroke-[3]" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={disabled}
                className="bg-[#FF0000] text-white font-bold text-[10px] pl-3 pr-1.5 py-1.5 rounded-[8px] flex items-center gap-1 shadow-sm transition-colors hover:bg-[#CC0000] disabled:bg-gray-300 disabled:cursor-not-allowed border-0 outline-none h-7"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!disabled) onIncrease?.(e);
                }}
              >
                ADD <Plus className="h-3.5 w-3.5 bg-white text-[#FF0000] rounded-full p-0.5 stroke-[3]" />
              </button>
            )}
            
            {hasFoodVariants(item) && quantity === 0 && (
              <div className="absolute top-full left-0 right-0 mt-0.5 text-center pointer-events-none">
                <span className="text-[9px] text-gray-500 font-medium tracking-wide">Options</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
