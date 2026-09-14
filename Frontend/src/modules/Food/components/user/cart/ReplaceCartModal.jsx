import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Trash2 } from 'lucide-react';

export default function ReplaceCartModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  previousRestaurantName, 
  newRestaurantName 
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          ref={(el) => {
            if (el) {
              console.log("REPLACE CART MODAL MOUNTED!", el);
            }
          }}
          key="replace-cart-modal" 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900"
          >
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-[#FF0000] dark:bg-red-900/30">
                <AlertCircle className="h-8 w-8" />
              </div>
              
              <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
                Start a new order?
              </h2>
              
              <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                Your cart already contains items from <strong className="text-gray-700 dark:text-gray-300">"{previousRestaurantName}"</strong>. 
                Would you like to clear your current cart and start a new order from <strong className="text-gray-700 dark:text-gray-300">"{newRestaurantName}"</strong>?
              </p>
              
              <div className="flex w-full flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF0000] px-4 py-3 font-semibold text-white shadow-lg shadow-red-500/30 transition-colors hover:bg-red-600 focus:outline-none"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear & Continue
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
