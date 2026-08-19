import { useState, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  Loader2,
  Utensils,
  Minus,
  Plus,
  Upload,
  ChevronLeft,
  ChevronRight,
  X,
  ThumbsUp,
  Pencil
} from "lucide-react"
import RestaurantNavbar from "@food/components/restaurant/RestaurantNavbar"
import BottomNavOrders from "@food/components/restaurant/BottomNavOrders"
import { Switch } from "@food/components/ui/switch"
import { useNavigate } from "react-router-dom"
import { restaurantAPI, uploadAPI } from "@food/api"
import { toast } from "sonner"
const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }


const INVENTORY_STORAGE_KEY = "restaurant_inventory_state"
const INVENTORY_RECOMMENDED_KEY = "restaurant_inventory_recommended_map"
const ADDON_FORM_STORAGE_KEY = "restaurant_addon_form_data"
const INVENTORY_ACTIVE_TAB_KEY = "restaurant_inventory_active_tab"
const INVENTORY_ADDON_FORM_KEY = "restaurant_inventory_addon_form"
const INVENTORY_STOCK_RULES_KEY = "restaurant_inventory_stock_rules_v1"

const MENU_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "in-stock", label: "In stock" },
  { value: "out-of-stock", label: "Out of stock" },
  { value: "recommended", label: "Recommended" },
  { value: "veg", label: "Veg" },
  { value: "non-veg", label: "Non-veg" },
]

const ADDON_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "unavailable", label: "Unavailable" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
]

const getApprovalDisplayMeta = (approvalStatus) => {
  const normalizedStatus = String(approvalStatus || "approved").toLowerCase()

  if (normalizedStatus === "rejected") {
    return {
      label: "Rejected",
      className: "bg-red-50 text-red-700 border border-red-200",
    }
  }

  if (normalizedStatus === "pending") {
    return {
      label: "Pending",
      className: "bg-amber-50 text-amber-700 border border-amber-200",
    }
  }

  return {
    label: "Approved",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  }
}

const normalizeDayName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")

const parseRestaurantTimeToParts = (value) => {
  const raw = String(value || "").trim()
  if (!raw) return { hours: 9, minutes: 0 }

  const hhmmMatch = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (hhmmMatch) {
    return {
      hours: Math.max(0, Math.min(23, Number(hhmmMatch[1]))),
      minutes: Math.max(0, Math.min(59, Number(hhmmMatch[2]))),
    }
  }

  const meridiemMatch = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
  if (meridiemMatch) {
    let hours = Number(meridiemMatch[1])
    const minutes = Number(meridiemMatch[2] || 0)
    const period = meridiemMatch[3].toLowerCase()
    if (period === "pm" && hours !== 12) hours += 12
    if (period === "am" && hours === 12) hours = 0
    return {
      hours: Math.max(0, Math.min(23, hours)),
      minutes: Math.max(0, Math.min(59, minutes)),
    }
  }

  return { hours: 9, minutes: 0 }
}

const buildSpecificTimeResumeAt = (hours) => {
  const totalHours = Math.max(1, Number(hours) || 1)
  const date = new Date()
  date.setHours(date.getHours() + totalHours)
  return date.toISOString()
}

const buildCustomResumeAt = (selectedDate, selectedTime) => {
  if (!selectedDate || !selectedTime) return null

  const date = new Date(selectedDate)
  if (Number.isNaN(date.getTime())) return null

  let hours = Number(selectedTime.hour || 0)
  const minutes = Number(selectedTime.minute || 0)
  const period = String(selectedTime.period || "am").toLowerCase()

  if (period === "pm" && hours !== 12) hours += 12
  if (period === "am" && hours === 12) hours = 0

  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

const buildNextBusinessDayResumeAt = (restaurantProfile) => {
  const now = new Date()
  const openDays = Array.isArray(restaurantProfile?.openDays)
    ? restaurantProfile.openDays.map(normalizeDayName).filter(Boolean)
    : []
  const openingTime = parseRestaurantTimeToParts(
    restaurantProfile?.openingTime || "09:00",
  )

  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = new Date(now)
    candidate.setDate(now.getDate() + offset)
    const dayName = normalizeDayName(
      candidate.toLocaleDateString("en-US", { weekday: "long" }),
    )

    if (openDays.length > 0 && !openDays.includes(dayName)) continue

    candidate.setHours(openingTime.hours, openingTime.minutes, 0, 0)
    return candidate.toISOString()
  }

  const fallback = new Date(now)
  fallback.setDate(now.getDate() + 1)
  fallback.setHours(openingTime.hours, openingTime.minutes, 0, 0)
  return fallback.toISOString()
}

const buildStockRule = ({
  selectedOption,
  hours,
  selectedDate,
  selectedTime,
  restaurantProfile,
}) => {
  const createdAt = new Date().toISOString()

  if (selectedOption === "manual") {
    return { mode: "manual", createdAt, resumeAt: null }
  }

  if (selectedOption === "next-business-day") {
    return {
      mode: "next-business-day",
      createdAt,
      resumeAt: buildNextBusinessDayResumeAt(restaurantProfile),
    }
  }

  if (selectedOption === "custom-date-time") {
    const resumeAt = buildCustomResumeAt(selectedDate, selectedTime)
    return {
      mode: "custom-date-time",
      createdAt,
      resumeAt,
    }
  }

  return {
    mode: "specific-time",
    createdAt,
    durationHours: Math.max(1, Number(hours) || 1),
    resumeAt: buildSpecificTimeResumeAt(hours),
  }
}

const getRuleStatusLabel = (rule) => {
  if (!rule) return "No time set. Turn item in stock manually."
  if (rule.mode === "manual") {
    return "Manual off. Turn item in stock manually."
  }

  const resumeAt = new Date(rule.resumeAt || "")
  if (Number.isNaN(resumeAt.getTime())) {
    return "Out of stock"
  }

  const formatted = resumeAt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

  if (rule.mode === "specific-time") return `Out of stock until ${formatted}`
  if (rule.mode === "next-business-day") return `Back next business day at ${formatted}`
  if (rule.mode === "custom-date-time") return `Out of stock until ${formatted}`
  return "Out of stock"
}

// Time Picker Wheel Component (copied from DaySlots.jsx)
function TimePickerWheel({
  isOpen,
  onClose,
  initialHour,
  initialMinute,
  initialPeriod,
  onConfirm
}) {
  const parsedHour = Math.max(1, Math.min(12, parseInt(initialHour) || 1))
  const parsedMinute = Math.max(0, Math.min(59, parseInt(initialMinute) || 0))
  const parsedPeriod = (initialPeriod === "am" || initialPeriod === "pm") ? initialPeriod : "am"

  const [selectedHour, setSelectedHour] = useState(parsedHour)
  const [selectedMinute, setSelectedMinute] = useState(parsedMinute)
  const [selectedPeriod, setSelectedPeriod] = useState(parsedPeriod)

  const hourRef = useRef(null)
  const minuteRef = useRef(null)
  const periodRef = useRef(null)
  const scrollTimeoutRef = useRef(null)
  const isScrollingRef = useRef(false)

  const hours = Array.from({ length: 12 }, (_, i) => i + 1)
  const minutes = Array.from({ length: 60 }, (_, i) => i)
  const periods = ["am", "pm"]

  useEffect(() => {
    if (isOpen) {
      setSelectedHour(parsedHour)
      setSelectedMinute(parsedMinute)
      setSelectedPeriod(parsedPeriod)
    }
  }, [isOpen, initialHour, initialMinute, initialPeriod, parsedHour, parsedMinute, parsedPeriod])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'

      const timer = setTimeout(() => {
        const padding = 80
        const itemHeight = 40

        const hourIndex = parsedHour - 1
        const hourScrollPos = padding + (hourIndex * itemHeight)
        if (hourRef.current) {
          hourRef.current.scrollTop = hourScrollPos
          setSelectedHour(parsedHour)
          setTimeout(() => {
            hourRef.current?.scrollTo({
              top: hourScrollPos,
              behavior: 'smooth'
            })
          }, 50)
        }

        const minuteIndex = Math.max(0, Math.min(59, parsedMinute))
        const minuteScrollPos = padding + (minuteIndex * itemHeight)
        if (minuteRef.current) {
          minuteRef.current.scrollTop = minuteScrollPos
          setSelectedMinute(minuteIndex)
          setTimeout(() => {
            minuteRef.current?.scrollTo({
              top: minuteScrollPos,
              behavior: 'smooth'
            })
          }, 50)
        }

        const periodIndex = periods.indexOf(parsedPeriod)
        const periodScrollPos = padding + (periodIndex * itemHeight)
        if (periodRef.current) {
          periodRef.current.scrollTop = periodScrollPos
          setSelectedPeriod(parsedPeriod)
          setTimeout(() => {
            periodRef.current?.scrollTo({
              top: periodScrollPos,
              behavior: 'smooth'
            })
          }, 50)
        }
      }, 150)

      return () => {
        clearTimeout(timer)
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen, parsedHour, parsedMinute, parsedPeriod])

  const handleScroll = (container, setValue, values, itemHeight) => {
    if (!container || isScrollingRef.current) return

    const padding = 80
    const scrollTop = container.scrollTop
    const index = Math.round((scrollTop - padding) / itemHeight)
    const clampedIndex = Math.max(0, Math.min(index, values.length - 1))
    const newValue = values[clampedIndex]

    if (newValue !== undefined) {
      setValue(newValue)
    }

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }

    isScrollingRef.current = true
    scrollTimeoutRef.current = setTimeout(() => {
      const finalIndex = Math.round((container.scrollTop - padding) / itemHeight)
      const finalClampedIndex = Math.max(0, Math.min(finalIndex, values.length - 1))
      const snapPosition = padding + (finalClampedIndex * itemHeight)
      container.scrollTop = snapPosition
      if (values[finalClampedIndex] !== undefined) {
        setValue(values[finalClampedIndex])
      }
      setTimeout(() => {
        container.scrollTo({
          top: snapPosition,
          behavior: 'smooth'
        })
      }, 50)

      setTimeout(() => {
        isScrollingRef.current = false
      }, 300)
    }, 150)
  }

  const handleConfirm = () => {
    const hourStr = selectedHour.toString()
    const minuteStr = selectedMinute.toString().padStart(2, '0')
    onConfirm(hourStr, minuteStr, selectedPeriod)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-lg shadow-2xl w-full max-w-xs overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-center py-8 px-4 relative">
            <style>{`
              .time-picker-scroll::-webkit-scrollbar {
                display: none;
              }
              .time-picker-scroll {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
            `}</style>

            <div className="flex-1 flex flex-col items-center">
              <div
                ref={hourRef}
                className="w-full h-48 overflow-y-scroll time-picker-scroll snap-y snap-mandatory"
                style={{
                  scrollSnapType: 'y mandatory',
                  scrollBehavior: 'smooth',
                  WebkitOverflowScrolling: 'touch'
                }}
                onScroll={() => handleScroll(hourRef.current, setSelectedHour, hours, 40)}
                onTouchEnd={() => {
                  setTimeout(() => {
                    if (hourRef.current) {
                      const padding = 80
                      const itemHeight = 40
                      const scrollTop = hourRef.current.scrollTop
                      const index = Math.round((scrollTop - padding) / itemHeight)
                      const clampedIndex = Math.max(0, Math.min(index, hours.length - 1))
                      const snapPosition = padding + (clampedIndex * itemHeight)
                      hourRef.current.scrollTop = snapPosition
                      if (hours[clampedIndex] !== undefined) {
                        setSelectedHour(hours[clampedIndex])
                      }
                      setTimeout(() => {
                        hourRef.current?.scrollTo({
                          top: snapPosition,
                          behavior: 'smooth'
                        })
                      }, 50)
                    }
                  }, 100)
                }}
              >
                <div className="h-20"></div>
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="h-10 flex items-center justify-center snap-center"
                    style={{ minHeight: '40px' }}
                  >
                    <span
                      className={`text-lg transition-all duration-200 ${selectedHour === hour
                        ? 'font-bold text-gray-900 text-xl'
                        : 'font-normal text-gray-400 text-base'
                        }`}
                    >
                      {hour}
                    </span>
                  </div>
                ))}
                <div className="h-20"></div>
              </div>
            </div>

            <div className="px-2">
              <span className="text-2xl font-bold text-gray-900">:</span>
            </div>

            <div className="flex-1 flex flex-col items-center">
              <div
                ref={minuteRef}
                className="w-full h-48 overflow-y-scroll time-picker-scroll snap-y snap-mandatory"
                style={{
                  scrollSnapType: 'y mandatory',
                  scrollBehavior: 'smooth',
                  WebkitOverflowScrolling: 'touch'
                }}
                onScroll={() => handleScroll(minuteRef.current, setSelectedMinute, minutes, 40)}
                onTouchEnd={() => {
                  setTimeout(() => {
                    if (minuteRef.current) {
                      const padding = 80
                      const itemHeight = 40
                      const scrollTop = minuteRef.current.scrollTop
                      const index = Math.round((scrollTop - padding) / itemHeight)
                      const clampedIndex = Math.max(0, Math.min(index, minutes.length - 1))
                      const snapPosition = padding + (clampedIndex * itemHeight)
                      minuteRef.current.scrollTop = snapPosition
                      if (minutes[clampedIndex] !== undefined) {
                        setSelectedMinute(minutes[clampedIndex])
                      }
                      setTimeout(() => {
                        minuteRef.current?.scrollTo({
                          top: snapPosition,
                          behavior: 'smooth'
                        })
                      }, 50)
                    }
                  }, 100)
                }}
              >
                <div className="h-20"></div>
                {minutes.map((minute) => (
                  <div
                    key={minute}
                    className="h-10 flex items-center justify-center snap-center"
                    style={{ minHeight: '40px' }}
                  >
                    <span
                      className={`text-lg transition-all duration-200 ${selectedMinute === minute
                        ? 'font-bold text-gray-900 text-xl'
                        : 'font-normal text-gray-400 text-base'
                        }`}
                    >
                      {minute.toString().padStart(2, '0')}
                    </span>
                  </div>
                ))}
                <div className="h-20"></div>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center">
              <div
                ref={periodRef}
                className="w-full h-48 overflow-y-scroll time-picker-scroll snap-y snap-mandatory"
                style={{
                  scrollSnapType: 'y mandatory',
                  scrollBehavior: 'smooth',
                  WebkitOverflowScrolling: 'touch'
                }}
                onScroll={() => handleScroll(periodRef.current, setSelectedPeriod, periods, 40)}
                onTouchEnd={() => {
                  setTimeout(() => {
                    if (periodRef.current) {
                      const padding = 80
                      const itemHeight = 40
                      const scrollTop = periodRef.current.scrollTop
                      const index = Math.round((scrollTop - padding) / itemHeight)
                      const clampedIndex = Math.max(0, Math.min(index, periods.length - 1))
                      const snapPosition = padding + (clampedIndex * itemHeight)
                      periodRef.current.scrollTop = snapPosition
                      if (periods[clampedIndex] !== undefined) {
                        setSelectedPeriod(periods[clampedIndex])
                      }
                      setTimeout(() => {
                        periodRef.current?.scrollTo({
                          top: snapPosition,
                          behavior: 'smooth'
                        })
                      }, 50)
                    }
                  }, 100)
                }}
              >
                <div className="h-20"></div>
                {periods.map((period) => (
                  <div
                    key={period}
                    className="h-10 flex items-center justify-center snap-center"
                    style={{ minHeight: '40px' }}
                  >
                    <span
                      className={`text-lg transition-all duration-200 ${selectedPeriod === period
                        ? 'font-bold text-gray-900 text-xl'
                        : 'font-normal text-gray-400 text-base'
                        }`}
                    >
                      {period}
                    </span>
                  </div>
                ))}
                <div className="h-20"></div>
              </div>
            </div>

            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 pointer-events-none">
              <div className="border-t border-gray-300 mx-4"></div>
              <div className="border-b border-gray-300 mx-4 mt-10"></div>
            </div>
          </div>

          <div className="border-t border-gray-200 px-4 py-4 flex justify-center">
            <button
              onClick={handleConfirm}
              className="text-primary hover:text-primary-hover font-medium text-base transition-colors"
            >
              Okay
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Simple Calendar Component
function SimpleCalendar({ selectedDate, onDateSelect, isOpen, onClose }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    return selectedDate ? new Date(selectedDate) : new Date()
  })
  const calendarRef = useRef(null)

  useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(new Date(selectedDate))
    }
  }, [selectedDate])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - startDate.getDay() + (startDate.getDay() === 0 ? -6 : 1))

    const days = []
    const currentDate = new Date(startDate)

    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return days
  }, [currentMonth])

  const isCurrentMonth = (date) => {
    return date.getMonth() === currentMonth.getMonth()
  }

  const isSelected = (date) => {
    if (!selectedDate) return false
    return date.toDateString() === new Date(selectedDate).toDateString()
  }

  const isToday = (date) => {
    return date.toDateString() === new Date().toDateString()
  }

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"]
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          ref={calendarRef}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => {
                  const prevMonth = new Date(currentMonth)
                  prevMonth.setMonth(prevMonth.getMonth() - 1)
                  setCurrentMonth(prevMonth)
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-semibold">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h3>
              <button
                onClick={() => {
                  const nextMonth = new Date(currentMonth)
                  nextMonth.setMonth(nextMonth.getMonth() + 1)
                  setCurrentMonth(nextMonth)
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date, index) => {
                const isCurrent = isCurrentMonth(date)
                const isSelectedDate = isSelected(date)
                const isTodayDate = isToday(date)

                return (
                  <button
                    key={index}
                    onClick={() => {
                      onDateSelect(new Date(date))
                      onClose()
                    }}
                    className={`h-10 text-sm rounded transition-colors ${!isCurrent
                      ? 'text-gray-300'
                      : isSelectedDate
                        ? 'bg-black text-white'
                        : isTodayDate
                          ? 'bg-gray-100 text-black font-semibold'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function Inventory() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(() => {
    try {
      if (typeof window === "undefined") return "all-items"
      const saved = localStorage.getItem(INVENTORY_ACTIVE_TAB_KEY)
      return saved || "all-items"
    } catch {
      return "all-items"
    }
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(false)
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [categories, setCategories] = useState(() => {
    try {
      if (typeof window === "undefined") return []
      const saved = localStorage.getItem(INVENTORY_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          return parsed
        }
      }
    } catch (error) {
      debugError("Error loading inventory from storage:", error)
    }
    return []
  })
  const [expandedCategories, setExpandedCategories] = useState([])
  const [togglePopupOpen, setTogglePopupOpen] = useState(false)
  const [toggleTarget, setToggleTarget] = useState(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false)

  // Toggle popup state
  const [selectedOption, setSelectedOption] = useState("specific-time")
  const [hours, setHours] = useState(3)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTime, setSelectedTime] = useState({ hour: "2", minute: "30", period: "pm" })
  const [showCalendar, setShowCalendar] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [restaurantProfile, setRestaurantProfile] = useState(null)
  const [stockRules, setStockRules] = useState(() => {
    try {
      if (typeof window === "undefined") return {}
      const raw = localStorage.getItem(INVENTORY_STOCK_RULES_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      return parsed && typeof parsed === "object" ? parsed : {}
    } catch (error) {
      debugWarn("Failed to load stock rules:", error)
      return {}
    }
  })

  const categoryRefs = useRef({})
  const addonImageInputRef = useRef(null)

  // Swipe gesture refs
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const touchStartY = useRef(0)
  const isSwiping = useRef(false)
  const blockTabSwipeRef = useRef(false)
  const mouseStartX = useRef(0)
  const mouseEndX = useRef(0)
  const isMouseDown = useRef(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [addons, setAddons] = useState([])
  const [loadingAddons, setLoadingAddons] = useState(false)
  const [isAddAddonOpen, setIsAddAddonOpen] = useState(false)
  const [addonName, setAddonName] = useState("")
  const [addonDescription, setAddonDescription] = useState("")
  const [addonPrice, setAddonPrice] = useState("")
  const [addonImageFile, setAddonImageFile] = useState(null)
  const [addonImagePreview, setAddonImagePreview] = useState("")
  const [savingAddon, setSavingAddon] = useState(false)
  const [recommendedMap, setRecommendedMap] = useState(() => {
    try {
      if (typeof window === "undefined") return {}
      const raw = localStorage.getItem(INVENTORY_RECOMMENDED_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      return parsed && typeof parsed === "object" ? parsed : {}
    } catch (error) {
      debugWarn("Failed to load recommended map:", error)
      return {}
    }
  })

  // Inventory tabs
  const inventoryTabs = ["all-items", "add-ons"]
  const isPureVegRestaurant = restaurantProfile?.pureVegRestaurant === true

  // Tab bar ref for excluding swipe on topbar
  const tabBarRef = useRef(null)
  const filterChipsRef = useRef(null)

  // Content container ref
  const contentContainerRef = useRef(null)

  useEffect(() => {
    const fetchRestaurantProfile = async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant()
        const profile =
          response?.data?.data?.restaurant ||
          response?.data?.restaurant ||
          response?.data?.data ||
          null
        setRestaurantProfile(profile)
      } catch (error) {
        debugWarn("Failed to load restaurant profile for stock rules:", error)
      }
    }

    fetchRestaurantProfile()
  }, [])

  // Fetch menu items from API and convert to inventory format
  useEffect(() => {
    const fetchMenuData = async () => {
      try {
        setLoadingInventory(true)

        // Fetch menu from API
        const menuResponse = await restaurantAPI.getMenu()

        if (menuResponse.data && menuResponse.data.success && menuResponse.data.data && menuResponse.data.data.menu) {
          const menuSections = menuResponse.data.data.menu.sections || []

          // Convert menu sections to inventory categories
          const convertedCategories = menuSections.map((section, sectionIndex) => {
            // Collect all items from section and subsections
            const allItems = []

            // Add direct items from section
            if (Array.isArray(section.items)) {
              section.items.forEach(item => {
                allItems.push({
                  id: String(item.id || Date.now() + Math.random()),
                  name: item.name || "Unnamed Item",
                  description: item.description || "",
                  image: item.image || "",
                  images: item.image ? [item.image] : [],
                  price: item.price ?? "",
                  variants: Array.isArray(item.variants) ? item.variants : (Array.isArray(item.variations) ? item.variations : []),
                  category: section.name || "",
                  categoryId: section.categoryId || section.id || "",
                  inStock: item.isAvailable !== undefined ? item.isAvailable : true,
                  isAvailable: item.isAvailable !== undefined ? item.isAvailable : true,
                  isVeg: item.foodType === "Veg",
                  foodType: item.foodType || "Non-Veg",
                  approvalStatus: String(item.approvalStatus || "approved").toLowerCase(),
                  rejectionReason: item.rejectionReason || "",
                  // Backend menu is generated from food_items and currently doesn't persist "recommended".
                  // Keep as a local UI preference keyed by food item id.
                  isRecommended: Boolean(recommendedMap?.[String(item.id)]),
                  stockQuantity: item.stock || "Unlimited",
                  unit: item.itemSizeUnit || "piece",
                  expiryDate: null,
                  lastRestocked: null,
                })
              })
            }

            // Add items from subsections
            if (Array.isArray(section.subsections)) {
              section.subsections.forEach(subsection => {
                if (Array.isArray(subsection.items)) {
                  subsection.items.forEach(item => {
                    allItems.push({
                      id: String(item.id || Date.now() + Math.random()),
                      name: item.name || "Unnamed Item",
                      description: item.description || "",
                      image: item.image || "",
                      images: item.image ? [item.image] : [],
                      price: item.price ?? "",
                      variants: Array.isArray(item.variants) ? item.variants : (Array.isArray(item.variations) ? item.variations : []),
                      category: section.name || subsection.name || "",
                      categoryId: section.categoryId || section.id || "",
                      inStock: item.isAvailable !== undefined ? item.isAvailable : true,
                      isAvailable: item.isAvailable !== undefined ? item.isAvailable : true,
                      isVeg: item.foodType === "Veg",
                      foodType: item.foodType || "Non-Veg",
                      approvalStatus: String(item.approvalStatus || "approved").toLowerCase(),
                      rejectionReason: item.rejectionReason || "",
                      isRecommended: Boolean(recommendedMap?.[String(item.id)]),
                      stockQuantity: item.stock || "Unlimited",
                      unit: item.itemSizeUnit || "piece",
                      expiryDate: null,
                      lastRestocked: null,
                    })
                  })
                }
              })
            }

            // Use category's isEnabled from menu API, not calculated from items
            // Category toggle should be independent of item toggles
            // Menu snapshots are disabled on backend; treat category toggle as derived from items (all in stock).
            const categoryInStock = allItems.length > 0 ? allItems.every(i => i.inStock) : true
            const itemCount = allItems.length

            return {
              id: section.id || `category-${sectionIndex}`,
              name: section.name || "Unnamed Category",
              description: section.description || "",
              itemCount: itemCount,
              inStock: categoryInStock,
              items: allItems,
              order: section.order !== undefined ? section.order : sectionIndex,
            }
          })

          const nowMs = Date.now()
          const withStockRules = convertedCategories.map((category) => {
            const ruledItems = (category.items || []).map((item) => {
              const rule = stockRules?.[String(item.id)] || null
              const isActiveRule =
                rule &&
                (rule.mode === "manual" ||
                  (rule.resumeAt && new Date(rule.resumeAt).getTime() > nowMs))

              if (!isActiveRule) return item
              return {
                ...item,
                inStock: false,
                isAvailable: false,
                stockRule: rule,
              }
            })

            return {
              ...category,
              items: ruledItems,
              itemCount: ruledItems.length,
              inStock: ruledItems.length > 0 ? ruledItems.every((item) => item.inStock) : true,
            }
          })

          setCategories(withStockRules)
          setExpandedCategories(withStockRules.map(c => c.id))
        } else {
          // Empty menu - start fresh
          setCategories([])
          setExpandedCategories([])
        }
      } catch (error) {
        // Only log and show toast if it's not a network/timeout error
        if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
          debugError('Error fetching menu data:', error)
          toast.error('Failed to load menu data')
        } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          // Silently handle network errors - backend is not running
          // The axios interceptor already handles these with proper error messages
        }
        setCategories([])
        setExpandedCategories([])
      } finally {
        setLoadingInventory(false)
      }
    }

    fetchMenuData()
  }, [recommendedMap])

  // Note: Menu items are now displayed from menu API
  // Stock status updates should be managed through the menu API, not inventory API
  // Auto-save disabled since we're displaying menu data, not inventory data

  // Fetch add-ons when add-ons tab is active
  const fetchAddons = async (showLoading = true) => {
    try {
      if (showLoading) setLoadingAddons(true)
      const response = await restaurantAPI.getAddons()
      const data = response?.data?.data?.addons || response?.data?.addons || []
      const getAddonCreatedMs = (addon = {}) => {
        const candidates = [addon.requestedAt, addon.createdAt, addon.updatedAt]
          .map((v) => new Date(v).getTime())
          .find((ms) => Number.isFinite(ms) && ms > 0)
        if (candidates) return candidates
        const rawId = String(addon.id || "")
        const match = rawId.match(/\d{10,}/)
        if (!match) return 0
        const fromId = Number(match[0])
        return Number.isFinite(fromId) ? fromId : 0
      }
      const sortedAddons = [...data].sort((a, b) => getAddonCreatedMs(b) - getAddonCreatedMs(a))
      setAddons(sortedAddons)
    } catch (error) {
      debugError('Error fetching add-ons:', error)
      toast.error('Failed to load add-ons')
      setAddons([])
    } finally {
      if (showLoading) setLoadingAddons(false)
    }
  }

  useEffect(() => {
    if (activeTab === "add-ons") {
      fetchAddons(true)
    }
  }, [activeTab])

  // Persist active tab
  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      localStorage.setItem(INVENTORY_ACTIVE_TAB_KEY, activeTab)
    } catch { }
  }, [activeTab])

  // Load persisted add-on form
  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      const raw = localStorage.getItem(INVENTORY_ADDON_FORM_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        setAddonName(parsed?.name || "")
        setAddonDescription(parsed?.description || "")
        setAddonPrice(parsed?.price || "")
        if (parsed?.isOpen) setIsAddAddonOpen(true)
        if (parsed?.preview) {
          setAddonImagePreview(parsed.preview)
        }
      }
    } catch { }
  }, [])

  // Persist form state
  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      const payload = {
        name: addonName,
        description: addonDescription,
        price: addonPrice,
        preview: addonImagePreview,
        isOpen: isAddAddonOpen
      }
      localStorage.setItem(INVENTORY_ADDON_FORM_KEY, JSON.stringify(payload))
    } catch { }
  }, [addonName, addonDescription, addonPrice, addonImagePreview, isAddAddonOpen])

  const resetAddonForm = () => {
    if (addonImagePreview && addonImagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(addonImagePreview)
    }
    setAddonName("")
    setAddonDescription("")
    setAddonPrice("")
    setAddonImageFile(null)
    setAddonImagePreview("")
    if (addonImageInputRef.current) {
      addonImageInputRef.current.value = ""
    }
    setIsAddAddonOpen(false)
    localStorage.removeItem(INVENTORY_ADDON_FORM_KEY)
  }

  const handleAddonImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "image/heif"]
    if (!allowed.includes(file.type)) {
      toast.error("Invalid image type. Please use PNG, JPG, JPEG, WEBP, HEIC, or HEIF.")
      e.target.value = ""
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB.")
      e.target.value = ""
      return
    }
    if (addonImagePreview && addonImagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(addonImagePreview)
    }
    const preview = URL.createObjectURL(file)
    setAddonImageFile(file)
    setAddonImagePreview(preview)
    e.target.value = ""
  }

  const handleSaveAddon = async () => {
    if (!addonName.trim()) {
      toast.error("Please enter add-on name")
      return
    }
    const parsedPrice = parseFloat(addonPrice)
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error("Please enter a valid price")
      return
    }
    setSavingAddon(true)
    try {
      let imageUrl = ""
      if (addonImageFile) {
        const uploadRes = await uploadAPI.uploadMedia(addonImageFile, { folder: "appzeto/restaurant/addons" })
        imageUrl = uploadRes?.data?.data?.url || uploadRes?.data?.url || ""
      }
      const payload = {
        name: addonName.trim(),
        description: addonDescription.trim(),
        price: parsedPrice,
        image: imageUrl,
        images: imageUrl ? [imageUrl] : [],
      }
      await restaurantAPI.addAddon(payload)
      toast.success("Add-on submitted to admin for approval")
      resetAddonForm()
      setIsAddAddonOpen(false)
      fetchAddons(true)
    } catch (error) {
      debugError("Error saving add-on:", error)
      toast.error(error?.response?.data?.message || "Failed to save add-on")
    } finally {
      setSavingAddon(false)
    }
  }

  // Handle addon toggle
  const handleAddonToggle = async (addonId, isAvailable) => {
    try {
      // Update addon availability via API
      await restaurantAPI.updateAddon(addonId, {
        isAvailable: isAvailable
      })

      // Update local state
      setAddons(prev => prev.map(a =>
        a.id === addonId ? { ...a, isAvailable } : a
      ))

      toast.success(`Add-on ${isAvailable ? 'enabled' : 'disabled'} successfully`)
    } catch (error) {
      debugError('Error toggling addon:', error)
      toast.error('Failed to update add-on availability')
    }
  }

  // Handle swipe gestures
  const handleTouchStart = (e) => {
    const target = e.target
    const startX = e.touches[0].clientX
    const viewportWidth =
      typeof window !== "undefined" ? window.innerWidth || document.documentElement.clientWidth || 0 : 0
    const edgeThreshold = 28

    blockTabSwipeRef.current = false

    // Let native Android/iOS edge-back gestures win instead of switching inventory tabs.
    if (
      startX <= edgeThreshold ||
      (viewportWidth > 0 && startX >= viewportWidth - edgeThreshold)
    ) {
      blockTabSwipeRef.current = true
      return
    }

    // Don't handle swipe if starting on topbar or horizontal filter chips
    if (tabBarRef.current?.contains(target) || filterChipsRef.current?.contains(target)) return

    touchStartX.current = startX
    touchStartY.current = e.touches[0].clientY
    touchEndX.current = e.touches[0].clientX
    isSwiping.current = false
  }

  const handleTouchMove = (e) => {
    if (blockTabSwipeRef.current) return

    if (!isSwiping.current) {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current)
      const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current)

      // Determine if this is a horizontal swipe
      if (deltaX > deltaY && deltaX > 10) {
        isSwiping.current = true
      }
    }

    if (isSwiping.current) {
      touchEndX.current = e.touches[0].clientX
    }
  }

  const handleTouchEnd = () => {
    if (blockTabSwipeRef.current) {
      touchStartX.current = 0
      touchEndX.current = 0
      touchStartY.current = 0
      isSwiping.current = false
      blockTabSwipeRef.current = false
      return
    }

    if (!isSwiping.current) {
      touchStartX.current = 0
      touchEndX.current = 0
      return
    }

    const swipeDistance = touchStartX.current - touchEndX.current
    const minSwipeDistance = 50
    const swipeVelocity = Math.abs(swipeDistance)

    if (swipeVelocity > minSwipeDistance && !isTransitioning) {
      const currentIndex = inventoryTabs.findIndex(tab => tab === activeTab)
      let newIndex = currentIndex

      if (swipeDistance > 0 && currentIndex < inventoryTabs.length - 1) {
        // Swipe left - go to next tab
        newIndex = currentIndex + 1
      } else if (swipeDistance < 0 && currentIndex > 0) {
        // Swipe right - go to previous tab
        newIndex = currentIndex - 1
      }

      if (newIndex !== currentIndex) {
        setIsTransitioning(true)

        // Smooth transition with animation
        setTimeout(() => {
          setActiveTab(inventoryTabs[newIndex])

          // Reset transition state after animation
          setTimeout(() => {
            setIsTransitioning(false)
          }, 300)
        }, 50)
      }
    }

    // Reset touch positions
    touchStartX.current = 0
    touchEndX.current = 0
    touchStartY.current = 0
    isSwiping.current = false
    blockTabSwipeRef.current = false
  }

  // Persist categories to localStorage whenever they change
  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(categories))
    } catch (error) {
      debugError("Error saving inventory to storage:", error)
    }
  }, [categories])

  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      localStorage.setItem(INVENTORY_STOCK_RULES_KEY, JSON.stringify(stockRules))
    } catch (error) {
      debugWarn("Failed to save stock rules:", error)
    }
  }, [stockRules])

  useEffect(() => {
    if (!stockRules || Object.keys(stockRules).length === 0) return

    const runExpiryCheck = async () => {
      const nowMs = Date.now()
      const expiredItemIds = Object.entries(stockRules)
        .filter(([, rule]) => rule?.mode !== "manual")
        .filter(([, rule]) => {
          const resumeAtMs = new Date(rule?.resumeAt || "").getTime()
          return Number.isFinite(resumeAtMs) && resumeAtMs <= nowMs
        })
        .map(([itemId]) => itemId)

      if (expiredItemIds.length === 0) return

      const affectedByCategory = new Map()
      setCategories((prev) =>
        prev.map((category) => {
          let changed = false
          const updatedItems = (category.items || []).map((item) => {
            if (!expiredItemIds.includes(String(item.id))) return item
            changed = true
            affectedByCategory.set(String(item.id), category.id)
            return {
              ...item,
              inStock: true,
              isAvailable: true,
              stockRule: null,
            }
          })

          if (!changed) return category
          return {
            ...category,
            items: updatedItems,
            inStock: updatedItems.every((item) => item.inStock),
          }
        }),
      )

      setStockRules((prev) => {
        const next = { ...prev }
        expiredItemIds.forEach((itemId) => {
          delete next[itemId]
        })
        return next
      })

      await Promise.all(
        expiredItemIds.map(async (itemId) => {
          try {
            const categoryId = affectedByCategory.get(String(itemId))
            await updateAvailabilityAPI(categoryId, itemId, true)
          } catch (error) {
            debugWarn("Failed to auto-enable scheduled inventory item:", error)
          }
        }),
      )
    }

    runExpiryCheck()
    const intervalId = setInterval(runExpiryCheck, 15000)
    return () => clearInterval(intervalId)
  }, [stockRules])

  // Calculate total items
  const totalItems = useMemo(
    () => categories.reduce((sum, cat) => sum + (cat.itemCount || (cat.items?.length || 0)), 0),
    [categories]
  )

  const activeFilterOptions = useMemo(() => {
    if (activeTab === "add-ons") return ADDON_FILTER_OPTIONS
    if (!isPureVegRestaurant) return MENU_FILTER_OPTIONS
    return MENU_FILTER_OPTIONS.filter((option) => option.value !== "non-veg")
  }, [activeTab, isPureVegRestaurant])

  useEffect(() => {
    if (!activeFilterOptions.some((option) => option.value === selectedFilter)) {
      setSelectedFilter("all")
    }
  }, [activeFilterOptions, selectedFilter])

  const filterMenuItems = (items = [], filterValue = "all") => {
    if (filterValue === "all") return items
    if (filterValue === "in-stock") return items.filter((item) => item.inStock)
    if (filterValue === "out-of-stock") return items.filter((item) => !item.inStock)
    if (filterValue === "recommended") return items.filter((item) => item.isRecommended)
    if (filterValue === "veg") return items.filter((item) => item.isVeg)
    if (filterValue === "non-veg") return items.filter((item) => !item.isVeg)
    return items
  }

  const filterAddonsList = (items = [], filterValue = "all") => {
    if (filterValue === "all") return items
    if (filterValue === "available") return items.filter((item) => item.isAvailable !== false)
    if (filterValue === "unavailable") return items.filter((item) => item.isAvailable === false)
    if (filterValue === "approved") return items.filter((item) => item.approvalStatus === "approved")
    if (filterValue === "pending") return items.filter((item) => item.approvalStatus === "pending")
    if (filterValue === "rejected") return items.filter((item) => item.approvalStatus === "rejected")
    return items
  }

  const menuFilterCounts = useMemo(
    () =>
      MENU_FILTER_OPTIONS.reduce((acc, option) => {
        acc[option.value] = categories.reduce(
          (sum, category) => sum + filterMenuItems(category.items || [], option.value).length,
          0
        )
        return acc
      }, {}),
    [categories]
  )

  const addonFilterCounts = useMemo(
    () =>
      ADDON_FILTER_OPTIONS.reduce((acc, option) => {
        acc[option.value] = filterAddonsList(addons, option.value).length
        return acc
      }, {}),
    [addons]
  )

  // Filter categories based on selected filter
  const statusFilteredCategories = useMemo(() => {
    return categories
      .map((category) => {
        const filteredItems = filterMenuItems(category.items || [], selectedFilter)
        if (filteredItems.length === 0) return null

        return {
          ...category,
          items: filteredItems,
          itemCount: filteredItems.length,
          inStock: filteredItems.every((item) => item.inStock),
        }
      })
      .filter(Boolean)
  }, [categories, selectedFilter])

  // Apply text search on categories & items
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return statusFilteredCategories

    return statusFilteredCategories
      .map(category => {
        const items = category.items || []
        const matchesCategory =
          category.name?.toLowerCase().includes(q) ||
          (category.description || "").toLowerCase().includes(q)

        const matchingItems = items.filter(item =>
          item.name?.toLowerCase().includes(q)
        )

        if (!matchesCategory && matchingItems.length === 0) {
          return null
        }

        return {
          ...category,
          items: matchingItems.length > 0 ? matchingItems : items,
          itemCount: matchingItems.length > 0 ? matchingItems.length : items.length,
          inStock: (matchingItems.length > 0 ? matchingItems : items).every((item) => item.inStock),
        }
      })
      .filter(Boolean)
  }, [statusFilteredCategories, searchQuery])

  const filteredAddons = useMemo(() => {
    const byFilter = filterAddonsList(addons, selectedFilter)
    const q = searchQuery.trim().toLowerCase()
    if (!q) return byFilter

    return byFilter.filter((addon) => {
      const status = String(addon?.approvalStatus || "").toLowerCase()
      return (
        String(addon?.name || "").toLowerCase().includes(q) ||
        String(addon?.description || "").toLowerCase().includes(q) ||
        status.includes(q)
      )
    })
  }, [addons, searchQuery, selectedFilter])

  // When on Add-ons tab, keep the list empty (no items shown)
  const listToRender = activeTab === "add-ons" ? [] : filteredCategories

  const activeFilterCount = activeTab === "add-ons"
    ? (addonFilterCounts[selectedFilter] || 0)
    : (menuFilterCounts[selectedFilter] || 0)

  const hasActiveTools = searchQuery.trim().length > 0 || selectedFilter !== "all"

  // Calculate out of stock count for a category
  const getOutOfStockCount = (category) => {
    return category.items.filter(item => !item.inStock).length
  }

  // Handle filter apply
  const handleFilterApply = () => {
    setIsLoading(true)
    setFilterOpen(false)

    // Simulate loading
    setTimeout(() => {
      setIsLoading(false)
    }, 1500)
  }

  // Handle filter clear
  const handleFilterClear = () => {
    setSelectedFilter("all")
    setFilterOpen(false)
  }

  // Update menu API when category/item toggles change
  const updateAvailabilityAPI = async (categoryId, itemId, isAvailable) => {
    try {
      if (!categoryId) return

      // Backend source of truth is food_items. Update availability via /food/restaurant/foods/:id.
      if (itemId) {
        await restaurantAPI.updateFood(itemId, { isAvailable: Boolean(isAvailable) })
        return
      }

      const category = categories.find((c) => c.id === categoryId)
      const items = category?.items || []
      // Bulk update all items in a category.
      await Promise.all(
        items.map((it) =>
          restaurantAPI.updateFood(it.id, { isAvailable: Boolean(isAvailable) }),
        ),
      )
    } catch (error) {
      debugError('Error updating availability:', error)
      toast.error(error?.response?.data?.message || 'Failed to update availability')
    }
  }

  const getTargetItemIds = (type, categoryId, itemId) => {
    const category = categories.find((entry) => entry.id === categoryId)
    const items = Array.isArray(category?.items) ? category.items : []

    if (type === "category") {
      return items.map((item) => String(item.id)).filter(Boolean)
    }

    return itemId ? [String(itemId)] : []
  }

  // Handle toggle click
  const handleToggleChange = async (type, categoryId, itemId, nextChecked) => {
    if (nextChecked) {
      const targetItemIds = getTargetItemIds(type, categoryId, itemId)

      // Turning ON - apply immediately without popup
      setCategories(prev =>
        prev.map(category => {
          if (category.id !== categoryId) return category
          const items = category.items || []

          if (type === "category") {
            const updatedItems = items.map(item => ({
              ...item,
              inStock: true,
              isAvailable: true,
              stockRule: null,
            }))
            return {
              ...category,
              inStock: true,
              items: updatedItems,
            }
          }

          const updatedItems = items.map(item =>
            item.id === itemId
              ? { ...item, inStock: true, isAvailable: true, stockRule: null }
              : item
          )
          // Don't automatically update category inStock when item is toggled
          // Category toggle should be independent
          return {
            ...category,
            items: updatedItems,
          }
        })
      )

      setStockRules((prev) => {
        const next = { ...prev }
        targetItemIds.forEach((id) => {
          delete next[id]
        })
        return next
      })

      // Update menu API
      if (type === "category") {
        await updateAvailabilityAPI(categoryId, null, true)
      } else {
        await updateAvailabilityAPI(categoryId, itemId, true)
      }
      return
    }

    // Turning OFF - open popup and wait for confirmation
    setToggleTarget({ type, categoryId, itemId })
    setSelectedOption("specific-time")
    setHours(3)
    setSelectedDate(null)
    setSelectedTime({ hour: "2", minute: "30", period: "pm" })
    setShowCalendar(false)
    setShowTimePicker(false)
    setTogglePopupOpen(true)
  }

  // Handle toggle confirm
  const handleToggleConfirm = async () => {
    if (!toggleTarget) {
      setTogglePopupOpen(false)
      return
    }

    const { type, categoryId, itemId } = toggleTarget
    const targetItemIds = getTargetItemIds(type, categoryId, itemId)
    const nextRule = buildStockRule({
      selectedOption,
      hours,
      selectedDate,
      selectedTime,
      restaurantProfile,
    })

    if (selectedOption === "custom-date-time") {
      if (!nextRule.resumeAt) {
        toast.error("Please select a valid custom date and time")
        return
      }

      if (new Date(nextRule.resumeAt).getTime() <= Date.now()) {
        toast.error("Custom date & time must be in the future")
        return
      }
    }

    // Apply OFF state for item or category
    setCategories(prev =>
      prev.map(category => {
        if (category.id !== categoryId) return category
        const items = category.items || []

        if (type === "category") {
          const updatedItems = items.map(item => ({
            ...item,
            inStock: false,
            isAvailable: false,
            stockRule: nextRule,
          }))
          return {
            ...category,
            inStock: false,
            items: updatedItems,
          }
        }

        const updatedItems = items.map(item =>
          item.id === itemId
            ? { ...item, inStock: false, isAvailable: false, stockRule: nextRule }
            : item
        )
        // Don't automatically update category inStock when item is toggled
        // Category toggle should be independent
        return {
          ...category,
          items: updatedItems,
        }
      })
    )

    setStockRules((prev) => {
      const next = { ...prev }
      targetItemIds.forEach((id) => {
        next[id] = nextRule
      })
      return next
    })

    // Update menu API
    if (type === "category") {
      await updateAvailabilityAPI(categoryId, null, false)
    } else {
      await updateAvailabilityAPI(categoryId, itemId, false)
    }

    setTogglePopupOpen(false)
    setToggleTarget(null)
  }

  // Get category data for popup
  const getCategoryData = () => {
    if (!toggleTarget || toggleTarget.type !== 'category') return null
    return categories.find(cat => cat.id === toggleTarget.categoryId)
  }

  // Format date for display
  const formatDate = (date) => {
    if (!date) return ""
    const day = date.getDate()
    const month = date.toLocaleString('en-US', { month: 'short' })
    const year = date.getFullYear()
    return `${day} ${month} ${year}`
  }

  // Format time for display
  const formatTime = (time) => {
    if (!time) return ""
    const minute = time.minute.padStart(2, '0')
    const period = time.period.toUpperCase()
    return `${time.hour}:${minute} ${period}`
  }

  // Handle time picker confirm
  const handleTimePickerConfirm = (hour, minute, period) => {
    setSelectedTime({ hour, minute, period })
    setShowTimePicker(false)
  }

  // Toggle category expansion
  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  // Update menu API when recommendation toggle changes
  // Handle item recommendation toggle
  const handleRecommendToggle = async (categoryId, itemId) => {
    // Find current recommendation status
    const category = categories.find(cat => cat.id === categoryId)
    const item = category?.items.find(i => i.id === itemId)
    const newRecommendationStatus = !item?.isRecommended

    // Update local state
    setCategories(prev =>
      prev.map(category => {
        if (category.id !== categoryId) return category
        const updatedItems = category.items.map(item =>
          item.id === itemId ? { ...item, isRecommended: newRecommendationStatus } : item
        )
        return {
          ...category,
          items: updatedItems,
        }
      })
    )

    // Persist local recommended preference (backend doesn't support it yet).
    try {
      setRecommendedMap((prev) => {
        const next = { ...(prev || {}) }
        next[String(itemId)] = Boolean(newRecommendationStatus)
        localStorage.setItem(INVENTORY_RECOMMENDED_KEY, JSON.stringify(next))
        return next
      })
    } catch (error) {
      debugWarn("Failed to persist recommended state:", error)
    }
  }

  const scrollToCategory = (categoryId) => {
    const el = categoryRefs.current[categoryId]
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }

    window.scrollTo({ top: el.offsetTop - 100, behavior: "smooth" })
  }

  const handleEditItem = (category, item) => {
    if (!item?.id) return

    navigate(`/food/restaurant/hub-menu/item/${item.id}`, {
      state: {
        backTo: "/food/restaurant/inventory",
        item: {
          ...item,
          category: category?.name || "",
          categoryId: category?.id || category?.categoryId || "",
          isAvailable: item.inStock,
        },
        category: category?.name || "",
        categoryId: category?.id || category?.categoryId || "",
        groupId: category?.id || category?.categoryId || "",
      },
    })
  }

  return (
    <div className="min-h-screen bg-[#f3f5f8] flex flex-col">
      {/* Navbar */}
      <div className="sticky top-0 z-50 bg-white">
        <RestaurantNavbar
          showSearch={false}
          showOfflineOnlineTag={false}
          showNotifications={false}
        />
      </div>

      {/* Tabs */}
      <div className="bg-[#f3f5f8] px-4 pt-4 pb-4">
        <div ref={tabBarRef} className="grid grid-cols-2 gap-3">
          <motion.button
            onClick={() => setActiveTab("all-items")}
            className={`relative overflow-hidden rounded-[24px] border px-4 py-3 text-sm font-semibold whitespace-nowrap ${activeTab === "all-items"
                ? "border-[#FE5502] text-white shadow-[0_18px_32px_-24px_rgba(73,171,20,0.8)]"
                : "border-white/80 bg-white/80 text-slate-700 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.45)]"
              }`}
            animate={{
              scale: activeTab === "all-items" ? 1.02 : 1,
            }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "all-items" && (
              <motion.div
                layoutId="activeTabBackground"
                className="absolute inset-0 rounded-[24px] bg-[#FE5502] -z-10"
                initial={false}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30
                }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-2">
              <span>All items</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${activeTab === "all-items" ? "bg-white text-[#FE5502]" : "bg-slate-100 text-slate-600"
                }`}>
                {totalItems}
              </span>
            </span>
          </motion.button>

          <motion.button
            onClick={() => setActiveTab("add-ons")}
            className={`relative overflow-hidden rounded-[24px] border px-4 py-3 text-sm font-semibold whitespace-nowrap ${activeTab === "add-ons"
                ? "border-[#FE5502] text-white shadow-[0_18px_32px_-24px_rgba(73,171,20,0.8)]"
                : "border-white/80 bg-white/80 text-slate-700 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.45)]"
              }`}
            animate={{
              scale: activeTab === "add-ons" ? 1.02 : 1,
            }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "add-ons" && (
              <motion.div
                layoutId="activeTabBackground"
                className="absolute inset-0 rounded-[24px] bg-[#FE5502] -z-10"
                initial={false}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30
                }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-2">
              <span>Add ons</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${activeTab === "add-ons" ? "bg-white text-slate-950" : "bg-slate-100 text-slate-600"
                }`}>
                {addons.length}
              </span>
            </span>
          </motion.button>
        </div>
      </div>

      {/* Main Content */}
      <div
        ref={contentContainerRef}
        className="flex-1 overflow-y-auto px-4 pb-32"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={(e) => {
          const target = e.target
          // Don't handle swipe if starting on topbar or horizontal filter chips
          if (tabBarRef.current?.contains(target) || filterChipsRef.current?.contains(target)) return

          mouseStartX.current = e.clientX
          mouseEndX.current = e.clientX
          isMouseDown.current = true
          isSwiping.current = false
        }}
        onMouseMove={(e) => {
          if (isMouseDown.current) {
            if (!isSwiping.current) {
              const deltaX = Math.abs(e.clientX - mouseStartX.current)
              if (deltaX > 10) {
                isSwiping.current = true
              }
            }
            if (isSwiping.current) {
              mouseEndX.current = e.clientX
            }
          }
        }}
        onMouseUp={() => {
          if (isMouseDown.current && isSwiping.current) {
            const swipeDistance = mouseStartX.current - mouseEndX.current
            const minSwipeDistance = 50

            if (Math.abs(swipeDistance) > minSwipeDistance && !isTransitioning) {
              const currentIndex = inventoryTabs.findIndex(tab => tab === activeTab)
              let newIndex = currentIndex

              if (swipeDistance > 0 && currentIndex < inventoryTabs.length - 1) {
                newIndex = currentIndex + 1
              } else if (swipeDistance < 0 && currentIndex > 0) {
                newIndex = currentIndex - 1
              }

              if (newIndex !== currentIndex) {
                setIsTransitioning(true)
                setTimeout(() => {
                  setActiveTab(inventoryTabs[newIndex])
                  setTimeout(() => setIsTransitioning(false), 300)
                }, 50)
              }
            }
          }

          isMouseDown.current = false
          isSwiping.current = false
          mouseStartX.current = 0
          mouseEndX.current = 0
        }}
        onMouseLeave={() => {
          isMouseDown.current = false
          isSwiping.current = false
        }}
      >
        {/* Search and Filter */}
        <div className="sticky top-0 z-30 -mx-4 px-4 pb-4 bg-[#f3f5f8]/95 backdrop-blur supports-[backdrop-filter]:bg-[#f3f5f8]/80">
          <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/90 p-3 sm:p-4 shadow-[0_20px_48px_-34px_rgba(15,23,42,0.45)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  {activeTab === "add-ons" ? "Search and review add-ons" : "Search and manage menu inventory"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {activeTab === "add-ons"
                    ? `${filteredAddons.length} add-on${filteredAddons.length !== 1 ? "s" : ""} in this view`
                    : `${listToRender.length} categor${listToRender.length !== 1 ? "ies" : "y"} and ${activeFilterCount} item${activeFilterCount !== 1 ? "s" : ""} in focus`}
                </p>
              </div>
              {hasActiveTools ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("")
                    setSelectedFilter("all")
                  }}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  Clear all
                </button>
              ) : null}
            </div>

            <div className="mt-4 flex gap-2 flex-wrap">
              <div className="flex-1 min-w-[220px] relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={activeTab === "add-ons" ? "Search add-ons..." : "Search menu items..."}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : null}
              </div>

              <button
                onClick={() => setFilterOpen(true)}
                className="relative flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                <SlidersHorizontal className="w-4 h-4 text-slate-700" />
                <span>Filters</span>
                {selectedFilter !== "all" && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-slate-950" />
                )}
              </button>

            </div>

            <div
              ref={filterChipsRef}
              className="inventory-filter-scroll mt-4 flex gap-2 overflow-x-auto scrollbar-hide pb-1"
            >
              {activeFilterOptions.map((option) => {
                const count = activeTab === "add-ons"
                  ? (addonFilterCounts[option.value] || 0)
                  : (menuFilterCounts[option.value] || 0)

                const isActive = selectedFilter === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedFilter(option.value)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${isActive
                        ? "border-slate-950 bg-slate-950 text-white shadow-[0_14px_28px_-24px_rgba(15,23,42,0.9)]"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                      }`}
                  >
                    <span>{option.label}</span>
                    <span className={`ml-2 inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] ${isActive ? "bg-white/15 text-white" : "bg-white text-slate-500"
                      }`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Categories Accordions */}
        <div className="space-y-4 mb-6">
          {activeTab === "add-ons" && (
            <>
              {isAddAddonOpen && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Add-on Name *</label>
                      <input
                        type="text"
                        value={addonName}
                        onChange={(e) => setAddonName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                        placeholder="e.g., Coke, Chips"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={addonDescription}
                        onChange={(e) => setAddonDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black focus:outline-none resize-none"
                        rows={3}
                        placeholder="Describe the add-on..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹) *</label>
                      <input
                        type="number"
                        value={addonPrice}
                        onChange={(e) => setAddonPrice(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Image (1 only)</label>
                      {addonImagePreview && (
                        <div className="mb-2">
                          <img
                            src={addonImagePreview}
                            alt="Preview"
                            className="w-24 h-24 object-cover rounded border"
                            onError={(e) => (e.target.style.display = "none")}
                          />
                        </div>
                      )}
                      <input
                        ref={addonImageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAddonImageSelect}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => addonImageInputRef.current?.click()}
                        className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-3 text-left transition-colors hover:bg-gray-100"
                      >
                        <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
                          <Upload className="h-4 w-4 text-gray-500" />
                          {addonImageFile?.name || "Upload image"}
                        </span>
                        <span className="mt-1 block text-xs text-gray-500">
                          {addonImageFile ? "Image selected successfully" : "Tap to choose 1 image from your device"}
                        </span>
                      </button>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG, WEBP, HEIC up to 5MB.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          resetAddonForm()
                          setIsAddAddonOpen(false)
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveAddon}
                        disabled={savingAddon}
                        className="px-4 py-2 bg-[#FE5502] text-white rounded-md text-sm font-medium hover:bg-[#E64D02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {savingAddon && <Loader2 className="h-4 w-4 animate-spin" />}
                        <span>{savingAddon ? "Saving..." : "Submit for approval"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {loadingAddons ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : filteredAddons.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-slate-200 bg-white/70 px-4 py-20 text-center shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)]">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-slate-700">
                      {hasActiveTools ? "No matching add-ons found" : "No add-ons available"}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {hasActiveTools ? "Try changing your search or filters" : "All add-ons will appear here"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAddons.map((addon) => (
                    <div
                      key={addon.id}
                      className="rounded-2xl border border-white/80 bg-white p-3 sm:p-4 shadow-[0_20px_48px_-34px_rgba(15,23,42,0.45)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="mb-2 flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-slate-950">{addon.name}</h3>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${addon.isAvailable !== false
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                              }`}>
                              {addon.isAvailable !== false ? "Live" : "Paused"}
                            </span>
                            {addon.approvalStatus === 'approved' && (
                              <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-semibold text-green-800">Approved</span>
                            )}
                            {addon.approvalStatus === 'pending' && (
                              <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-[11px] font-semibold text-yellow-800">Pending</span>
                            )}
                            {addon.approvalStatus === 'rejected' && (
                              <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-800">Rejected</span>
                            )}
                          </div>
                          {addon.description && (
                            <p className="mb-2 text-sm leading-6 text-slate-600">{addon.description}</p>
                          )}
                          <p className="text-base font-bold text-slate-950">Rs. {addon.price}</p>
                          {addon.approvalStatus === 'rejected' && addon.rejectionReason && (
                            <p className="mt-2 text-xs font-medium text-red-600">Reason: {addon.rejectionReason}</p>
                          )}
                        </div>
                        <div className="flex items-start gap-3">
                          {addon.images && addon.images.length > 0 && addon.images[0] && (
                            <img
                              src={addon.images[0]}
                              alt={addon.name}
                              className="h-20 w-20 rounded-2xl object-cover ring-1 ring-slate-200"
                              onError={(e) => {
                                e.target.style.display = 'none'
                              }}
                            />
                          )}
                          <div className="flex items-center rounded-full bg-slate-100 px-2 py-1">
                            <Switch
                              checked={addon.isAvailable !== false}
                              onCheckedChange={(checked) =>
                                handleAddonToggle(addon.id, checked)
                              }
                              className="data-[state=checked]:bg-[#FE5502]"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {activeTab !== "add-ons" && !loadingInventory && listToRender.length === 0 && (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-white/70 px-6 py-16 text-center shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)]">
              <p className="text-lg font-semibold text-slate-700">
                {hasActiveTools ? "No matching categories or items found" : "No menu categories available"}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {hasActiveTools ? "Try adjusting your search or filters." : "Your menu categories will appear here once items are added."}
              </p>
            </div>
          )}
          {listToRender.map((category, index) => {
            const isExpanded = expandedCategories.includes(category.id)
            const categoryItems = category.items || []

            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: isLoading ? 0.6 : 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_22px_52px_-36px_rgba(15,23,42,0.45)]"
                ref={(el) => {
                  if (el) {
                    categoryRefs.current[category.id] = el
                  }
                }}
              >
                {/* Loading Overlay */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 z-10 flex items-center justify-center rounded-[30px] bg-white/80"
                  >
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  </motion.div>
                )}

                {/* Category Header - Clickable */}
                <div
                  className="cursor-pointer bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_58%,#f1f5f9_100%)] p-3 sm:p-4"
                  onClick={() => toggleCategory(category.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-bold tracking-[-0.02em] text-slate-950">
                          {category.name}
                        </h3>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                          {category.items?.length || category.itemCount || 0} items
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${category.inStock
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                          }`}>
                          {category.inStock ? "Healthy" : "Needs attention"}
                        </span>
                      </div>
                      {category.description ? (
                        <p className="text-sm leading-6 text-slate-500">{category.description}</p>
                      ) : null}
                      <div className="mt-4 flex items-center gap-2 flex-wrap">
                        {category.inStock ? (
                          <p className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            All visible items are in stock
                          </p>
                        ) : (
                          <p className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                            {getOutOfStockCount(category)} out of {(category.items?.length || category.itemCount || 0)} item{(category.items?.length || category.itemCount || 0) !== 1 ? 's' : ''} out of stock
                          </p>
                        )}
                        <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {(categoryItems.filter((item) => item.isRecommended).length)} recommended
                        </p>
                      </div>
                    </div>

                    <div className="ml-2 flex flex-col items-center gap-3">
                      {/* Category Toggle Switch */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-full bg-slate-100 px-2 py-1 shadow-inner"
                      >
                        <Switch
                          checked={category.inStock}
                          onCheckedChange={(checked) =>
                            handleToggleChange("category", category.id, null, checked)
                          }
                          className="data-[state=checked]:bg-[#FE5502]"
                        />
                      </div>

                      {/* Expand/Collapse Button - Right of In stock */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleCategory(category.id)
                        }}
                        className="rounded-full border border-slate-200 bg-white p-2 transition-colors hover:border-slate-300 hover:bg-slate-50"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-600" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-600" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Category Items */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      {/* Divider */}
                      <div className="mx-3 sm:mx-4 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
                      <div className="space-y-2 px-3 sm:px-4 pb-3 sm:pb-4 pt-3">
                        {categoryItems.map((item) => {
                          const approvalMeta = getApprovalDisplayMeta(item.approvalStatus)
                          const isRejectedItem = item.approvalStatus === "rejected"

                          return (
                            <div key={item.id}>
                              <div className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                                <div className="flex flex-1 items-center gap-3 min-w-0">
                                  {item.image || (item.images && item.images[0]) ? (
                                    <img
                                      src={item.image || item.images[0]}
                                      alt={item.name}
                                      className="h-16 w-16 shrink-0 rounded-lg object-cover border border-slate-200"
                                      onError={(e) => {
                                        e.target.style.display = 'none'
                                      }}
                                    />
                                  ) : null}
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-bold text-slate-950 mb-1.5">{item.name}</p>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 ${item.isVeg
                                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                          : "bg-rose-50 text-rose-700 border border-rose-100"
                                        }`}>
                                        <div className={`h-2.5 w-2.5 shrink-0 rounded-sm border flex items-center justify-center ${item.isVeg ? 'border-green-600' : 'border-red-500'}`}>
                                          <div className={`h-1 w-1 rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-500'}`} />
                                        </div>
                                        {item.isVeg ? "VEG" : "NON-VEG"}
                                      </span>
                                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${approvalMeta.className}`}>
                                        {approvalMeta.label.toUpperCase()}
                                      </span>
                                      {item.isRecommended ? (
                                        <span className="rounded-full bg-orange-50 border border-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                                          RECOMMENDED
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className={`mt-1 text-xs font-medium ${item.inStock ? "text-green-600" : "text-rose-600"
                                      }`}>
                                      {item.inStock ? "In stock" : getRuleStatusLabel(item.stockRule)}
                                    </p>
                                    {item.approvalStatus === "rejected" && item.rejectionReason ? (
                                      <p className="mt-1 line-clamp-2 text-[11px] font-medium text-red-600">
                                        Reason: {item.rejectionReason}
                                      </p>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() => handleEditItem(category, item)}
                                      className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${isRejectedItem
                                          ? "bg-red-600 text-white hover:bg-red-700"
                                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                                        }`}
                                    >
                                      <Pencil className="h-3 w-3" />
                                      {isRejectedItem ? "Fix & resubmit" : "Edit"}
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  {/* Recommend Thumb Icon */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleRecommendToggle(category.id, item.id)
                                    }}
                                    className={`rounded-2xl p-2 transition-colors ${item.isRecommended
                                        ? "bg-orange-100 text-primary"
                                        : "bg-white text-gray-400 hover:bg-slate-100"
                                      }`}
                                    title={item.isRecommended ? "Recommended" : "Click to recommend"}
                                  >
                                    <ThumbsUp className="w-4 h-4" />
                                  </button>
                                  {/* Item Toggle Switch */}
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="rounded-full bg-white px-2 py-1 shadow-inner"
                                  >
                                    <Switch
                                      checked={item.inStock}
                                      onCheckedChange={(checked) =>
                                        handleToggleChange("item", category.id, item.id, checked)
                                      }
                                      className="data-[state=checked]:bg-[#FE5502]"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Filter Popup */}
      <AnimatePresence>
        {filterOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setFilterOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Filters</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {activeTab === "add-ons"
                        ? "Refine the add-ons list by availability or approval status."
                        : "Refine your inventory by stock state, recommendation, or food type."}
                    </p>
                  </div>
                  {selectedFilter !== "all" ? (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      Active
                    </span>
                  ) : null}
                </div>

                <div className="space-y-4 mb-6">
                  {activeFilterOptions.map((option) => {
                    const count = activeTab === "add-ons"
                      ? (addonFilterCounts[option.value] || 0)
                      : (menuFilterCounts[option.value] || 0)

                    return (
                      <label key={option.value} className="flex items-center justify-between gap-3 cursor-pointer rounded-xl border border-gray-200 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="filter"
                            checked={selectedFilter === option.value}
                            onChange={() => setSelectedFilter(option.value)}
                            className="w-5 h-5 text-black border-gray-300 focus:ring-black"
                          />
                          <span className="text-base text-gray-900">{option.label}</span>
                        </div>
                        <span className="min-w-[28px] h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-700">
                          {count}
                        </span>
                      </label>
                    )
                  })}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setSelectedFilter("all")
                      setFilterOpen(false)
                    }}
                    className="flex-1 border border-gray-300 text-gray-900 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleFilterApply}
                    className={`${selectedFilter !== "all" ? 'flex-1' : 'w-full'} bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors`}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toggle Popup */}
      <AnimatePresence>
        {togglePopupOpen && toggleTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setTogglePopupOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[90vh] overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom)+6rem)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                {/* Header */}
                <h2 className="text-lg font-bold text-gray-900 text-center mb-6">
                  {toggleTarget.type === "category" ? "Mark sub category out of stock" : "Mark item out of stock"}
                </h2>

                {/* Category Info - Only show for category toggles */}
                {toggleTarget.type === 'category' && (() => {
                  const categoryData = getCategoryData()
                  if (!categoryData) return null
                  return (
                    <div className="">
                      <h3 className="text-base font-bold text-gray-900 mb-3">{categoryData.name}</h3>
                      <ul className="space-y-1 text-sm text-gray-600">
                        <li>• {categoryData.name}</li>
                        <li>• Includes {categoryData.itemCount} item{categoryData.itemCount !== 1 ? 's' : ''}</li>
                      </ul>
                      <div className="border-t border-gray-200 mt-4"></div>
                    </div>
                  )
                })()}

                {/* Radio Options */}
                <div className="space-y-0 mb-6">
                  {/* Option 1: For specific time */}
                  <label className="flex items-center justify-between py-4 cursor-pointer border-b border-gray-200">
                    <div className="flex items-center gap-3 flex-1">

                      <span className="text-base text-gray-900">For specific time</span>
                      {selectedOption === "specific-time" && (
                        <div className="ml-auto py-3 flex items-center justify-center gap-4">
                          <button
                            onClick={() => setHours(Math.max(1, hours - 1))}
                            className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
                          >
                            <Minus className="w-4 h-4 text-gray-700" />
                          </button>
                          <span className="text-base font-medium text-gray-900 min-w-[60px] text-center">
                            {hours} hour{hours !== 1 ? 's' : ''}
                          </span>
                          <button
                            onClick={() => setHours(hours + 1)}
                            className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
                          >
                            <Plus className="w-4 h-4 text-gray-700" />
                          </button>
                        </div>
                      )}
                      <input
                        type="radio"
                        name="outOfStockOption"
                        checked={selectedOption === "specific-time"}
                        onChange={() => setSelectedOption("specific-time")}
                        style={{ accentColor: "#000000" }}
                        className="ml-auto w-5 h-5 !text-black !border-gray-300 !bg-black !focus:ring-black"
                      />
                    </div>
                  </label>

                  {/* Option 2: Next business day */}
                  <label className="flex items-center justify-between py-4 cursor-pointer border-b border-gray-200">
                    <div className="flex items-center gap-3 flex-1">

                      <span className="text-base text-gray-900">Next business day - Opening time</span>
                      <input
                        type="radio"
                        name="outOfStockOption"
                        checked={selectedOption === "next-business-day"}
                        onChange={() => setSelectedOption("next-business-day")}
                        style={{ accentColor: "#000000" }}
                        className="ml-auto w-5 h-5 !text-black !border-gray-300 !bg-black !focus:ring-black"
                      />
                    </div>
                  </label>

                  {/* Option 3: Custom date & time */}
                  <label className="flex items-center justify-between py-4 cursor-pointer border-b border-gray-200">
                    <div className="flex items-center gap-3 flex-1">

                      <span className="text-base text-gray-900">Custom date & time</span>
                      <input
                        type="radio"
                        name="outOfStockOption"
                        checked={selectedOption === "custom-date-time"}
                        onChange={() => setSelectedOption("custom-date-time")}
                        style={{ accentColor: "#000000" }}
                        className="ml-auto w-5 h-5 text-black border-gray-300 focus:ring-black"
                      />
                    </div>
                  </label>
                  {selectedOption === "custom-date-time" && (
                    <div className="ml-auto py-3 flex items-center justify-center gap-4">
                      <button
                        onClick={() => setShowCalendar(true)}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
                      >
                        <span>{selectedDate ? formatDate(selectedDate) : "15 Dec 2025"}</span>
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => setShowTimePicker(true)}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
                      >
                        <span>{formatTime(selectedTime)}</span>
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  )}

                  {/* Option 4: Manual */}
                  <label className="flex items-center justify-between py-4 cursor-pointer">
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex items-center gap-3">

                        <span className="text-base text-gray-900">I will turn it on manually</span>
                        <input
                          type="radio"
                          name="outOfStockOption"
                          checked={selectedOption === "manual"}
                          onChange={() => setSelectedOption("manual")}
                          style={{ accentColor: "#000000" }}
                          className="ml-auto w-5 h-5 !text-black !border-gray-300 !bg-black !focus:ring-black"
                        />
                      </div>
                      <p className="text-sm text-gray-500">
                        Item won't be visible to customers on Zomato app till you mark it back in stock
                      </p>
                    </div>
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setTogglePopupOpen(false)}
                    className="flex-1 border border-gray-300 text-gray-900 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleToggleConfirm}
                    className="flex-1 bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Calendar Popup */}
      <SimpleCalendar
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        isOpen={showCalendar}
        onClose={() => setShowCalendar(false)}
      />

      {/* Time Picker Popup */}
      <TimePickerWheel
        isOpen={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        initialHour={selectedTime.hour}
        initialMinute={selectedTime.minute}
        initialPeriod={selectedTime.period}
        onConfirm={handleTimePickerConfirm}
      />

      {/* Add Popup */}
      <AnimatePresence>
        {isAddPopupOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddPopupOpen(false)}
              className="fixed inset-0 bg-black/50 z-[70]"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-[71] max-h-[70vh] overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom)+5.5rem)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white px-4 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 text-center">Add item</h2>
              </div>
              <div className="px-4 py-4 space-y-2">
                <button
                  onClick={() => {
                    setIsAddPopupOpen(false)
                    navigate(`/food/restaurant/hub-menu/item/new`, {
                      state: {
                        backTo: "/food/restaurant/inventory",
                      },
                    })
                  }}
                  className="w-full py-3 px-4 text-left rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-900">Add item</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Action Buttons */}
      <div className="fixed right-4 bottom-24 z-30 flex flex-col items-end gap-2">
        {activeTab === "add-ons" ? (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              setIsAddAddonOpen(true)
              window.scrollTo({ top: 0, behavior: "smooth" })
            }}
            className="rounded-full bg-[#FE5502] px-5 py-3 text-sm font-semibold text-white shadow-[0_22px_40px_-24px_rgba(73,171,20,0.6)]"
          >
            + Add add-on
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              navigate(`/food/restaurant/hub-menu/item/new`, {
                state: {
                  backTo: "/food/restaurant/inventory",
                },
              })
            }}
            className="rounded-full bg-[#FE5502] px-5 py-3 text-sm font-semibold text-white shadow-[0_22px_40px_-24px_rgba(73,171,20,0.6)]"
          >
            + Add item
          </motion.button>
        )}

        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="flex items-center gap-2 rounded-full border border-white/80 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-800 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.55)]"
        >
          <span className="w-5 h-5 flex items-center justify-center">
            {isMenuOpen ? (
              <X className="w-4 h-4 text-slate-900" />
            ) : (
              <Utensils className="w-4 h-4 text-slate-900" />
            )}
          </span>
          <span>{isMenuOpen ? "Close" : "Menu"}</span>
        </motion.button>

        <AnimatePresence>
          {isMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                className="fixed inset-0 bg-black/40 z-30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMenuOpen(false)}
              />

              {/* Menu Popup */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.2 }}
                className="fixed right-4 bottom-36 z-30 h-[45vh] w-[60vw] max-w-sm overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_24px_60px_-30px_rgba(15,23,42,0.55)]"
              >
                <div className="h-full flex flex-col">
                  <div className="bg-[linear-gradient(135deg,#f8fbff_0%,#eef6ff_100%)] px-4 pt-4 pb-3">
                    <p className="text-sm font-semibold text-slate-950">Jump to category</p>
                  </div>
                  <div className="mx-4 h-px bg-slate-200" />
                  <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
                    {categories.map((category, index) => {
                      const itemCount =
                        category.itemCount || (category.items?.length || 0)
                      const isLast = index === categories.length - 1

                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false)
                            if (activeTab === "add-ons") {
                              setActiveTab("all-items")
                            }
                            setTimeout(() => scrollToCategory(category.id), 200)
                          }}
                          className="w-full text-left py-3 focus:outline-none"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-900">
                              {category.name}
                            </span>
                            <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                              {itemCount}
                            </span>
                          </div>
                          {!isLast && (
                            <div className="mt-3 border-t border-dashed border-slate-200" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <BottomNavOrders />
    </div>
  )
}

