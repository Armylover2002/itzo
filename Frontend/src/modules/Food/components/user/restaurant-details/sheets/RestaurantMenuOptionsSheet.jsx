import { Bookmark, Share2 } from "lucide-react"
import fssaiLogo from "@food/assets/fssai.png"
import BottomSheetPortal from "./BottomSheetPortal"

export default function RestaurantMenuOptionsSheet({
  open,
  onClose,
  restaurant,
  slug,
  isFavorite,
  handleAddToCollection,
  handleShareRestaurant,
}) {
  return (
    <BottomSheetPortal open={open} onClose={onClose} sheetClassName="fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:w-auto flex flex-col max-h-[70vh] md:max-h-[90vh] md:max-w-lg">
      {/* Header */}
                  <div className="px-4 pt-6 pb-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      {restaurant?.name || "Unknown Restaurant"}
                    </h2>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto px-4 py-4">
                    {/* Menu Options List */}
                    <div className="space-y-1">
                      {/* Add to Collection */}
                      <button
                        className="w-full flex items-center gap-4 px-2 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
                        onClick={handleAddToCollection}
                      >
                        <Bookmark className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                        <span className="text-base text-gray-900 dark:text-white">
                          {isFavorite(restaurant?.slug || slug || "") ? "Remove from Collection" : "Add to Collection"}
                        </span>
                      </button>

                      {/* Share this restaurant */}
                      <button
                        className="w-full flex items-center gap-4 px-2 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
                        onClick={handleShareRestaurant}
                      >
                        <Share2 className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                        <span className="text-base text-gray-900 dark:text-white">Share this restaurant</span>
                      </button>

                    </div>

                    {/* Disclaimer Text */}
                    <div className="mt-6 px-2">
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Menu items, prices, photos and descriptions are set directly by the restaurant. In case you see any incorrect information, please report it to us.
                      </p>
                    </div>

                    {/* FSSAI License Information */}
                    {restaurant?.onboarding?.step3?.fssai?.registrationNumber && (
                      <div className="mt-4 px-2 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3 opacity-80 mb-2">
                        <div className="h-8 w-14 flex items-center justify-center bg-white rounded p-1 border border-gray-100">
                          <img
                            src={fssaiLogo}
                            alt="FSSAI"
                            className="h-full w-auto object-contain"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                            Lic. No.
                          </p>
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {restaurant?.onboarding?.step3?.fssai?.registrationNumber}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Handle */}
                  <div className="px-4 pb-2 pt-2 flex justify-center">
                    <div className="h-1 w-12 bg-gray-300 rounded-full" />
                  </div>
    </BottomSheetPortal>
  );
}
