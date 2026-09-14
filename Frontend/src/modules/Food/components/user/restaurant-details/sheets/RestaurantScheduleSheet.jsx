import { X } from "lucide-react"
import { Button } from "@food/components/ui/button"
import BottomSheetPortal from "./BottomSheetPortal"

export default function RestaurantScheduleSheet({ open, onClose, selectedDate, setSelectedDate, selectedTimeSlot, setSelectedTimeSlot }) {
  return (
    <BottomSheetPortal open={open} onClose={onClose} sheetClassName="fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:w-auto flex flex-col max-h-[60vh] md:max-h-[90vh] md:max-w-lg">
      {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto px-4 pt-10 pb-4">
                    {/* Title */}
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 text-center">
                      Select your delivery time
                    </h2>

                    {/* Date Selection */}
                    <div className="flex items-center gap-3 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                      {(() => {
                        const today = new Date()
                        const tomorrow = new Date(today)
                        tomorrow.setDate(tomorrow.getDate() + 1)
                        const dayAfter = new Date(today)
                        dayAfter.setDate(dayAfter.getDate() + 2)

                        const dates = [
                          { date: today, label: "Today" },
                          { date: tomorrow, label: "Tomorrow" },
                          { date: dayAfter, label: dayAfter.toLocaleDateString('en-US', { weekday: 'short' }) }
                        ]

                        return dates.map((item, index) => {
                          const dateStr = item.date.toISOString().split('T')[0]
                          const day = String(item.date.getDate()).padStart(2, '0')
                          const month = item.date.toLocaleDateString('en-US', { month: 'short' })
                          const isSelected = selectedDate === dateStr

                          return (
                            <button
                              key={index}
                              onClick={() => setSelectedDate(dateStr)}
                              className="flex flex-col items-center gap-0.5 flex-shrink-0 pb-1"
                            >
                              <span className={`text-sm font-medium ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                {day} {month} {item.label}
                              </span>
                              {isSelected && (
                                <div className="h-0.5 w-full bg-red-500 mt-0.5" />
                              )}
                            </button>
                          )
                        })
                      })()}
                    </div>

                    {/* Time Slot Selection */}
                    <div className="space-y-2 mb-4">
                      {["6:30 - 7 PM", "7 - 7:30 PM", "7:30 - 8 PM", "8 - 8:30 PM"].map((slot, index) => {
                        const isSelected = selectedTimeSlot === slot
                        return (
                          <button
                            key={index}
                            onClick={() => setSelectedTimeSlot(slot)}
                            className={`w-full text-left px-4 py-2.5 rounded-lg transition-all ${isSelected
                              ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600"
                              : "bg-white dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent"
                              }`}
                          >
                            <span className="text-sm font-medium">{slot}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Confirm Button - Fixed at bottom */}
                  <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                    <Button
                      className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-semibold"
                      onClick={() => {
                        onClose()
                        // Handle schedule confirmation
                      }}
                    >
                      Confirm
                    </Button>
                  </div>
    </BottomSheetPortal>
  );
}
