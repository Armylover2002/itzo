import { Clock, MapPin, Star, Zap, ChevronDown } from "lucide-react"
import BottomSheetPortal from "./BottomSheetPortal"

export default function RestaurantLocationSheet({ open, onClose, restaurant }) {
  return (
    <BottomSheetPortal open={open} onClose={onClose} sheetClassName="fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:w-auto flex flex-col h-[75vh] md:h-auto md:max-h-[90vh] md:max-w-xl">
      {/* Header */}
                  <div className="px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">All delivery outlets for</p>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-red-600 dark:bg-red-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-base">{(restaurant.name || "R").charAt(0).toUpperCase()}</span>
                      </div>
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white">{restaurant?.name || "Unknown Restaurant"}</h2>
                    </div>
                  </div>

                  {/* Outlets List */}
                  <div className="flex-1 overflow-y-auto px-4 py-3">
                    {restaurant?.outlets && Array.isArray(restaurant.outlets) && restaurant.outlets.length > 0 ? (
                      <div className="space-y-2">
                        {restaurant.outlets.map((outlet) => (
                          <div
                            key={outlet?.id || Math.random()}
                            className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2a2a2a]"
                          >
                            {outlet?.isNearest && (
                              <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-red-50 dark:bg-[#FF0000]/20 rounded-md">
                                <Zap className="h-3.5 w-3.5 text-[#FF0000] dark:text-[#FF0000] fill-[#FF0000] dark:fill-[#FF0000]" />
                                <span className="text-xs font-semibold text-[#FF0000] dark:text-[#FF0000]">
                                  Nearest available outlet
                                </span>
                              </div>
                            )}
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                              {outlet?.location || "Location"}
                            </h3>
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>{outlet?.deliveryTime || "25-30 mins"}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  <span>{outlet?.distance || "1.2 km"}</span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-0.5">
                                <div className="flex items-center gap-1">
                                  <Star className="h-3.5 w-3.5 text-green-600 dark:text-green-500 fill-green-600 dark:fill-green-500" />
                                  <span className="text-xs font-medium text-gray-900 dark:text-white">
                                    {outlet?.rating || 4.5}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  By {(outlet?.reviews || 0) >= 1000 ? `${((outlet.reviews || 0) / 1000).toFixed(1)}K+` : `${outlet?.reviews || 0}+`}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No outlets available
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {restaurant?.outlets && Array.isArray(restaurant.outlets) && restaurant.outlets.length > 5 && (
                    <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-3 bg-white dark:bg-[#1a1a1a]">
                      <button className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400 font-medium text-sm w-full">
                        <span>See all {restaurant.outlets.length} outlets</span>
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  )}
    </BottomSheetPortal>
  );
}
