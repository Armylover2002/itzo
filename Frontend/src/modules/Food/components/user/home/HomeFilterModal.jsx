import React from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Check } from "lucide-react";

const PRIMARY_FILTERS = [
  { id: "delivery-under-30", label: "Under 30 mins" },
  { id: "delivery-under-45", label: "Under 45 mins" },
  { id: "distance-under-1km", label: "Under 1km", icon: MapPin },
  { id: "distance-under-2km", label: "Under 2km", icon: MapPin },
];

const HomeFilterModal = ({ isOpen, onClose, activeFilters, toggleFilter }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative w-full max-w-sm bg-white dark:bg-[#111111] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[80vh]"
          >
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-bold">Filters</h2>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 custom-scrollbar space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Quick Filters</h3>
              <div className="space-y-2">
                {PRIMARY_FILTERS.map((filter) => {
                  const isActive = activeFilters?.has(filter.id);
                  const Icon = filter.icon;
                  return (
                    <label key={filter.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-all duration-200">
                      <div className="flex items-center gap-2">
                        {Icon && <Icon className="w-4 h-4 text-gray-500" />}
                        <span className="text-sm font-medium">{filter.label}</span>
                      </div>
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={isActive || false}
                          onChange={() => {
                            toggleFilter(filter.id);
                          }}
                        />
                        <div className={`w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center ${
                          isActive ? 'border-[#FF0000] bg-[#FF0000]' : 'border-gray-300 dark:border-gray-700'
                        }`}>
                          {isActive && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#111111]">
              <button 
                onClick={onClose}
                className="w-full py-3 bg-[#FF0000] text-white text-sm font-bold rounded-xl shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all active:scale-95"
              >
                Apply Filters
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default HomeFilterModal;
