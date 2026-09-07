import React, { memo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";

const RecommendedSection = memo(({ recommendedForYouRestaurants }) => {
  if (!recommendedForYouRestaurants || recommendedForYouRestaurants.length === 0) return null;

  return (
    <motion.section
      className="content-auto pt-2 pb-4"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
    >
      <h2 className="text-[11px] font-bold text-slate-400 tracking-widest uppercase mb-3 px-4 md:px-0">
        RECOMMENDED FOR YOU
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 px-4 md:px-0">
        {recommendedForYouRestaurants.map((restaurant, index) => {
          const restaurantSlug =
            restaurant.slug ||
            restaurant.name.toLowerCase().replace(/\s+/g, "-");
          const isNew = !(Number(restaurant.rating) > 0);

          return (
            <motion.div
              key={`recommended-${restaurant.mongoId || restaurant.id || restaurantSlug}`}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
            >
              <Link
                to={`/user/restaurants/${restaurantSlug}`}
                className="block rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-50"
              >
                <div className="relative aspect-[4/3] bg-gray-100">
                  <img
                    src={restaurant.image}
                    alt={restaurant.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-md ${isNew ? "bg-white/90 text-slate-500 border border-gray-100" : "bg-black/80 text-white"}`}>
                    {isNew ? "NEW" : Number(restaurant.rating).toFixed(1)}
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {restaurant.name}
                  </p>
                  <p className="text-[10px] text-[#FE5502] font-extrabold mt-1.5 flex items-center gap-1 uppercase tracking-wider">
                    <Flame className="w-3.5 h-3.5 fill-[#FE5502]" />
                    NEAR & FAST
                  </p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
});

export default RecommendedSection;
