import React from 'react';
import { motion } from "framer-motion";
import { Star, Clock, IndianRupee, Heart, BadgePercent } from "lucide-react";
import OptimizedImage from "@food/components/OptimizedImage";

const RestaurantDishCard = ({ 
  restaurant, 
  isFavorite, 
  onFavoriteClick, 
  onClick,
  onAddDish 
}) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-[#111111] rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-800 group relative"
      onClick={onClick}
    >
      <div className="relative h-48 sm:h-56 overflow-hidden">
        <OptimizedImage
          src={restaurant.image}
          alt={restaurant.name}
          className="w-full h-full object-cover transform scale-100 group-hover:scale-110 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
        
        {/* Floating Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          {restaurant.offer && (
             <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-lg flex items-center gap-1">
               <BadgePercent className="w-3 h-3" />
               {restaurant.offer}
             </div>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onFavoriteClick(restaurant.id);
          }}
          className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-md rounded-full border border-white/20 text-white hover:bg-white hover:text-red-500 transition-all duration-300"
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>

        {/* Info Grid on Image */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold ring-1 ring-white/20">
            <Star className="w-3 h-3 text-yellow-400 fill-current" />
            <span>{restaurant.rating || "4.5"}</span>
          </div>
          <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold ring-1 ring-white/20">
            <Clock className="w-3 h-3 text-white" />
            <span>{restaurant.deliveryTime || "25 min"}</span>
          </div>
        </div>
      </div>

      <div className="p-5">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1 line-clamp-1 group-hover:text-primary-orange transition-colors">
          {restaurant.name}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 line-clamp-1 italic">
          {restaurant.cuisine || "Cuisines not listed"}
        </p>

        {restaurant.featuredDish && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800/50 group/dish relative">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <span className="text-[10px] uppercase font-bold text-primary-orange tracking-widest mb-1 block">Featured Dish</span>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-1">{restaurant.featuredDish.name}</p>
                <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300 mt-1">
                  <IndianRupee className="w-3 h-3" />
                  <span className="text-xs font-bold">{restaurant.featuredDish.price}</span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddDish(restaurant.featuredDish);
                }}
                className="p-2 bg-white dark:bg-gray-700 rounded-xl shadow-sm hover:shadow-md hover:scale-110 transition-all text-primary-orange active:scale-95"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default React.memo(RestaurantDishCard);
