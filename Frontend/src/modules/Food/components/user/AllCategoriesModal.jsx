import React from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { X, Search } from "lucide-react";
import OptimizedImage from "@food/components/OptimizedImage";

const AllCategoriesModal = ({ 
  isOpen, 
  onClose, 
  categories, 
  onCategoryClick 
}) => {
  const [searchTerm, setSearchTerm] = React.useState("");
  
  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white dark:bg-[#111111] w-full max-w-2xl max-h-[85vh] rounded-[32px] overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-800"
          >
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">What's on your mind?</h2>
                <p className="text-gray-500 text-sm">Explore cuisines and dishes</p>
              </div>
              <button 
                onClick={onClose}
                className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors group"
              >
                <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(85vh-120px)] custom-scrollbar">
              <div className="relative mb-8">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search for a specific category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-none focus:ring-2 focus:ring-primary-orange/20 text-sm font-medium transition-all"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
                {filteredCategories.map((category, index) => (
                  <motion.div
                    key={category.id || category.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => {
                      onCategoryClick(category);
                      onClose();
                    }}
                    className="flex flex-col items-center gap-3 cursor-pointer group"
                  >
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white dark:bg-gray-800 shadow-sm group-hover:shadow-xl transition-all duration-300 p-0.5 ring-2 ring-transparent group-hover:ring-primary-orange/20 overflow-hidden transform group-hover:scale-105">
                      <OptimizedImage
                        src={category.image}
                        alt={category.name}
                        className="w-full h-full object-cover rounded-full"
                      />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-primary-orange text-center px-2 line-clamp-1">
                      {category.name}
                    </span>
                  </motion.div>
                ))}
              </div>

              {filteredCategories.length === 0 && (
                <div className="py-20 text-center">
                  <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-gray-400 font-medium">No categories found matching "{searchTerm}"</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(AllCategoriesModal);
