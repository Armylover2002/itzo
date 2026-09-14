import { X, UtensilsCrossed } from "lucide-react"
import BottomSheetPortal from "./BottomSheetPortal"
import { motion } from "framer-motion"

export default function RestaurantMenuSheet({ open, onClose, menuCategories = [], onCategoryClick }) {
  return (
    <BottomSheetPortal 
      open={open} 
      onClose={onClose} 
      sheetClassName="fixed left-4 right-4 bottom-[90px] md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-[90px] z-[10000] bg-white dark:bg-[#1a1a1a] rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] w-auto flex flex-col max-h-[60vh] md:max-h-[70vh] md:w-[320px] mx-auto border border-gray-100 dark:border-gray-800 overflow-hidden"
    >
      <style>{`
        .menu-scrollbar::-webkit-scrollbar {
          width: 0px; /* Hide scrollbar for a cleaner look */
        }
      `}</style>
      
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-[#1a1a1a]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5 text-[#FF0000]" />
          <h3 className="font-bold text-gray-900 dark:text-white text-[16px] tracking-wide uppercase">Menu</h3>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 menu-scrollbar">
        <div className="space-y-1">
          {menuCategories.map((category, index) => (
            <motion.button
              whileTap={{ scale: 0.98 }}
              key={index}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-200 text-left group hover:bg-red-50 dark:hover:bg-[#FF0000]/10"
              onClick={() => {
                onClose()
                if (onCategoryClick) {
                  onCategoryClick(category.sectionIndex)
                }
                // Scroll to category section
                setTimeout(() => {
                  const sectionId = `menu-section-${category.sectionIndex}`
                  const sectionElement = document.getElementById(sectionId)
                  if (sectionElement) {
                    // Calculate offset for sticky headers
                    const yOffset = -120; 
                    const y = sectionElement.getBoundingClientRect().top + window.scrollY + yOffset;
                    window.scrollTo({ top: y, behavior: 'smooth' });
                  }
                }, 300)
              }}
            >
              <span className="text-[14px] font-semibold text-gray-700 dark:text-gray-300 group-hover:text-[#FF0000] dark:group-hover:text-[#FF0000] transition-colors truncate pr-4">
                {category.name}
              </span>
              <div className="flex items-center justify-center min-w-[24px] h-[24px] px-2 rounded-full bg-gray-100 dark:bg-gray-800 group-hover:bg-[#FF0000] group-hover:text-white transition-colors">
                <span className="text-[12px] font-bold text-gray-600 dark:text-gray-400 group-hover:text-white transition-colors">
                  {category.count}
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </BottomSheetPortal>
  );
}
