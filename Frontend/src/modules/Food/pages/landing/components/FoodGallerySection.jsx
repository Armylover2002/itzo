import React from 'react';
import { motion } from 'framer-motion';

const inspirations = [
  { id: 1, name: 'Biryani', image: 'https://images.unsplash.com/photo-1589302168068-964664d93cb0?q=80&w=300&auto=format&fit=crop' },
  { id: 2, name: 'Pizza', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=300&auto=format&fit=crop' },
  { id: 3, name: 'Burger', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=300&auto=format&fit=crop' },
  { id: 4, name: 'Rolls', image: 'https://images.unsplash.com/photo-1626804475297-41609ae0f4da?q=80&w=300&auto=format&fit=crop' },
  { id: 5, name: 'Cake', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=300&auto=format&fit=crop' },
  { id: 6, name: 'Dosa', image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?q=80&w=300&auto=format&fit=crop' },
];

const FoodGallerySection = React.memo(function FoodGallerySection({ navigate }) {
  return (
    <div className="bg-gray-50 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl font-bold text-gray-800 mb-8"
        >
          Inspiration for your first order
        </motion.h2>
        
        <div className="flex overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0 gap-6 hide-scrollbar">
          {inspirations.map((item, index) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="flex-shrink-0 flex flex-col items-center cursor-pointer group"
              onClick={() => navigate(`/food/user?search=${item.name.toLowerCase()}`)}
            >
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden mb-4 shadow-sm group-hover:shadow-lg transition-all duration-300">
                <img 
                  src={item.image} 
                  alt={item.name} 
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                />
              </div>
              <span className="text-lg font-semibold text-gray-700">{item.name}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default FoodGallerySection;
