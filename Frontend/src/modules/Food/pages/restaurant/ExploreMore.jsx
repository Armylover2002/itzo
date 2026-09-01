import { useState, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import Lenis from "lenis"
import {
  ArrowLeft,
  Search,
  User,
  UserRound,
  Store,
  ChevronRight,
  Info,
  Clock,
  Settings,
  Bell,
  Truck,
  FileText,
  Star,
  MessageSquare,
  LifeBuoy,
  Lightbulb,
  Edit,
  IndianRupee,
  Receipt,
  FileCheck,
  Building2,
  X,
  CheckCircle,
  Calendar,
  MapPin,
  LogOut,
  Gift,
  Crown,
  Wallet,
} from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import { DateRangeCalendar } from "@food/components/ui/date-range-calendar"
import { clearModuleAuth, clearAuthData, getCurrentUser } from "@food/utils/auth"
import { restaurantAPI } from "@food/api"
import { firebaseAuth, ensureFirebaseInitialized } from "@food/firebase"
import BottomNavOrders from "@food/components/restaurant/BottomNavOrders"
import RestaurantProfile from "@food/pages/restaurant/RestaurantProfile"
import { useLiveLocation } from "@food/contexts/LiveLocationContext"
import { useSubscriptionRequired } from "@common/hooks/useSubscriptionRequired"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


// Time Picker Wheel Component
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

        const minuteIndex = parsedMinute
        const minuteScrollPos = padding + (minuteIndex * itemHeight)
        if (minuteRef.current) {
          minuteRef.current.scrollTop = minuteScrollPos
          setSelectedMinute(parsedMinute)
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
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen, parsedHour, parsedMinute, parsedPeriod])

  const handleScroll = (container, setValue, values, itemHeight) => {
    if (!container) return

    const padding = 80
    const itemCenterOffset = itemHeight / 2
    const scrollTop = container.scrollTop
    const containerCenter = scrollTop + container.clientHeight / 2

    const index = Math.round(
      (containerCenter - padding - itemCenterOffset) / itemHeight
    )

    const clampedIndex = Math.max(0, Math.min(index, values.length - 1))
    const newValue = values[clampedIndex]

    if (newValue !== undefined) {
      setValue(newValue)
    }
  }

  const snapToCenter = (container, setValue, values, itemHeight) => {
    if (!container) return

    const padding = 80
    const itemCenterOffset = itemHeight / 2
    const scrollTop = container.scrollTop
    const containerCenter = scrollTop + container.clientHeight / 2

    const index = Math.round(
      (containerCenter - padding - itemCenterOffset) / itemHeight
    )
    const clampedIndex = Math.max(0, Math.min(index, values.length - 1))

    const snapPosition = padding + clampedIndex * itemHeight
    container.scrollTo({
      top: snapPosition,
      behavior: "smooth",
    })

    if (values[clampedIndex] !== undefined) {
      setValue(values[clampedIndex])
    }
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
                onTouchEnd={() => snapToCenter(hourRef.current, setSelectedHour, hours, 40)}
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
                          ? "font-bold text-gray-900 text-xl"
                          : "font-normal text-gray-400 text-base"
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
                onTouchEnd={() => snapToCenter(minuteRef.current, setSelectedMinute, minutes, 40)}
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
                          ? "font-bold text-gray-900 text-xl"
                          : "font-normal text-gray-400 text-base"
                        }`}
                    >
                      {minute.toString().padStart(2, "0")}
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
                onTouchEnd={() => snapToCenter(periodRef.current, setSelectedPeriod, periods, 40)}
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
                          ? "font-bold text-gray-900 text-xl"
                          : "font-normal text-gray-400 text-base"
                        }`}
                    >
                      {period.toUpperCase()}
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

export default function ExploreMore() {
  const navigate = useNavigate()
  const subscriptionRequired = useSubscriptionRequired("RESTAURANT")
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const { liveTrackingEnabled, currentLocation } = useLiveLocation()

  // Schedule off states
  const [scheduleOffOpen, setScheduleOffOpen] = useState(false)
  const [dateTimePickerOpen, setDateTimePickerOpen] = useState(false)
  const [successPopupOpen, setSuccessPopupOpen] = useState(false)
  const [existingScheduleOpen, setExistingScheduleOpen] = useState(false)
  const [selectedReason, setSelectedReason] = useState(null)
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [startTime, setStartTime] = useState({ hour: "9", minute: "00", period: "am" })
  const [endTime, setEndTime] = useState({ hour: "5", minute: "00", period: "pm" })
  const [showStartTimePicker, setShowStartTimePicker] = useState(false)
  const [showEndTimePicker, setShowEndTimePicker] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [existingSchedule, setExistingSchedule] = useState(null)

  const STORAGE_KEY = "restaurant_schedule_off"

  // Restaurant data state
  const [restaurantData, setRestaurantData] = useState(null)
  const [loadingRestaurant, setLoadingRestaurant] = useState(true)

  // Fetch restaurant data on mount
  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setLoadingRestaurant(true)
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (data) {
          setRestaurantData(data)
        }
      } catch (error) {
        // Only log error if it's not a network/timeout error (backend might be down/slow)
        if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
          debugError("Error fetching restaurant data:", error)
        }
        // Continue with default values if fetch fails
      } finally {
        setLoadingRestaurant(false)
      }
    }

    fetchRestaurantData()
  }, [])

  // Format address from location object
  const formatAddress = (location) => {
    if (!location) return ""

    if (location.formattedAddress && location.formattedAddress.trim() !== "" && location.formattedAddress !== "Select location") {
      return location.formattedAddress.trim()
    }

    if (location.address && location.address.trim() !== "") {
      return location.address.trim()
    }

    const parts = []

    if (location.addressLine1) {
      parts.push(location.addressLine1.trim())
    } else if (location.street) {
      parts.push(location.street.trim())
    }

    if (location.addressLine2) {
      parts.push(location.addressLine2.trim())
    }

    if (location.area) {
      parts.push(location.area.trim())
    }

    if (location.landmark) {
      parts.push(location.landmark.trim())
    }

    if (location.city) {
      const city = location.city.trim()
      if (!parts.some((part) => part.includes(city))) {
        parts.push(city)
      }
    }

    if (location.state) {
      const state = location.state.trim()
      if (!parts.some((part) => part.includes(state))) {
        parts.push(state)
      }
    }

    if (location.zipCode || location.pincode || location.postalCode) {
      parts.push((location.zipCode || location.pincode || location.postalCode).trim())
    }

    return parts.join(", ") || ""
  }

  // Get user data from logged in session and restaurant data
  const userData = useMemo(() => {
    const sessionUser = getCurrentUser("restaurant")
    
    // Priority 1: Data from the currently logged in session user
    if (sessionUser && sessionUser.name && sessionUser.role) {
      return {
        name: sessionUser.name,
        phone: sessionUser.phone || restaurantData?.ownerPhone || restaurantData?.phone || "N/A",
        email: sessionUser.email || restaurantData?.ownerEmail || restaurantData?.email || "N/A",
        role: sessionUser.role.toUpperCase(),
        profileImage: sessionUser.profileImage || restaurantData?.profileImage
      }
    }
    
    // Priority 2: Data from the restaurant document owner fields
    if (restaurantData) {
      return {
        name: restaurantData.ownerName || restaurantData.name || "Restaurant Owner",
        phone: restaurantData.ownerPhone || restaurantData.phone || "N/A",
        email: restaurantData.ownerEmail || restaurantData.email || "N/A",
        role: "OWNER",
        profileImage: restaurantData.profileImage
      }
    }
    
    // Priority 3: Loading / Initial state
    return {
      name: loadingRestaurant ? "Loading..." : "Restaurant Owner",
      phone: "",
      email: "",
      role: "OWNER"
    }
  }, [restaurantData, loadingRestaurant])

  // Get restaurant display data
  const restaurantDisplayName = restaurantData?.name || "Loading..."
  
  let restaurantDisplayAddress = restaurantData?.location ? formatAddress(restaurantData.location) : ""
  if (liveTrackingEnabled && currentLocation?.latitude && currentLocation?.longitude) {
    restaurantDisplayAddress = currentLocation.address || `${Number(currentLocation.latitude).toFixed(6)}, ${Number(currentLocation.longitude).toFixed(6)}`
  }

  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  const handleLogout = async () => {
    if (isLoggingOut) return // Prevent multiple clicks

    setIsLoggingOut(true)
    setProfileOpen(false)

    try {
      // Call backend logout API to invalidate refresh token
      try {
        await restaurantAPI.logout()
      } catch (apiError) {
        // Continue with logout even if API call fails (network issues, etc.)
        debugWarn("Logout API call failed, continuing with local cleanup:", apiError)
      }

      // Sign out from Firebase if restaurant logged in via Google
      try {
        const { signOut } = await import("firebase/auth")
        // Firebase Auth is lazy-initialized now; ensure it before accessing firebaseAuth.currentUser
        ensureFirebaseInitialized({ enableAuth: true, enableRealtimeDb: false })
        const currentUser = firebaseAuth.currentUser
        if (currentUser) {
          await signOut(firebaseAuth)
        }
      } catch (firebaseError) {
        // Continue even if Firebase logout fails
        debugWarn("Firebase logout failed, continuing with local cleanup:", firebaseError)
      }

      // Clear restaurant module authentication data
      clearModuleAuth("restaurant")

      // Clear any onboarding data from localStorage
      localStorage.removeItem("restaurant_onboarding")
      localStorage.removeItem("restaurant_accessToken")
      localStorage.removeItem("restaurant_authenticated")
      localStorage.removeItem("restaurant_user")

      // Clear sessionStorage
      sessionStorage.removeItem("restaurantAuthData")

      // Dispatch auth change event to notify other components
      window.dispatchEvent(new Event("restaurantAuthChanged"))

      // Small delay for UX, then navigate to welcome page
      setTimeout(() => {
        navigate("/food/restaurant/login", { replace: true })
      }, 300)
    } catch (error) {
      // Even if there's an error, we should still clear local data and logout
      debugError("Error during logout:", error)
      clearModuleAuth("restaurant")
      localStorage.removeItem("restaurant_onboarding")
      localStorage.removeItem("restaurant_accessToken")
      localStorage.removeItem("restaurant_authenticated")
      localStorage.removeItem("restaurant_user")
      sessionStorage.removeItem("restaurantAuthData")
      window.dispatchEvent(new Event("restaurantAuthChanged"))
      navigate("/restaurant/welcome", { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleLogoutAllDevices = async () => {
    if (isLoggingOut) return // Prevent multiple clicks

    setIsLoggingOut(true)
    setProfileOpen(false)

    try {
      // Call backend logout API to invalidate refresh token
      try {
        await restaurantAPI.logoutAll()
      } catch (apiError) {
        // Continue with logout even if API call fails (network issues, etc.)
        debugWarn("Logout All API call failed, continuing with local cleanup:", apiError)
      }

      // Sign out from Firebase if restaurant logged in via Google
      try {
        const { signOut } = await import("firebase/auth")
        // Firebase Auth is lazy-initialized now; ensure it before accessing firebaseAuth.currentUser
        ensureFirebaseInitialized({ enableAuth: true, enableRealtimeDb: false })
        const currentUser = firebaseAuth.currentUser
        if (currentUser) {
          await signOut(firebaseAuth)
        }
      } catch (firebaseError) {
        // Continue even if Firebase logout fails
        debugWarn("Firebase logout failed, continuing with local cleanup:", firebaseError)
      }

      // Clear auth for all modules (admin, restaurant, delivery, user)
      clearAuthData()

      // Clear any onboarding data from localStorage
      localStorage.removeItem("restaurant_onboarding")

      // Clear sessionStorage for all modules
      sessionStorage.removeItem("restaurantAuthData")
      sessionStorage.removeItem("adminAuthData")
      sessionStorage.removeItem("deliveryAuthData")
      sessionStorage.removeItem("userAuthData")

      // Dispatch auth change events to notify other components
      window.dispatchEvent(new Event("restaurantAuthChanged"))
      window.dispatchEvent(new Event("adminAuthChanged"))
      window.dispatchEvent(new Event("deliveryAuthChanged"))
      window.dispatchEvent(new Event("userAuthChanged"))

      // Small delay for UX, then navigate to welcome page
      setTimeout(() => {
        navigate("/food/restaurant/login", { replace: true })
      }, 300)
    } catch (error) {
      // Even if there's an error, we should still clear local data and logout
      debugError("Error during logout from all devices:", error)
      clearAuthData()
      localStorage.removeItem("restaurant_onboarding")
      sessionStorage.removeItem("restaurantAuthData")
      sessionStorage.removeItem("adminAuthData")
      sessionStorage.removeItem("deliveryAuthData")
      sessionStorage.removeItem("userAuthData")
      window.dispatchEvent(new Event("restaurantAuthChanged"))
      navigate("/restaurant/welcome", { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const scheduleOffReasons = [
    "renovation or relocation of restaurant",
    "closed dur to festival",
    "permanently shut",
    "staff avaibility issues",
    "going out of station",
    "other"
  ]

  // Load existing schedule from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const schedule = JSON.parse(saved)
        // Convert date strings back to Date objects
        if (schedule.startDate) schedule.startDate = new Date(schedule.startDate)
        if (schedule.endDate) schedule.endDate = new Date(schedule.endDate)
        setExistingSchedule(schedule)
      }
    } catch (error) {
      debugError("Error loading schedule from localStorage:", error)
    }
  }, [])

  const handleScheduleOffClick = () => {
    // Check if there's an existing schedule
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const schedule = JSON.parse(saved)
        // Convert date strings back to Date objects
        if (schedule.startDate) schedule.startDate = new Date(schedule.startDate)
        if (schedule.endDate) schedule.endDate = new Date(schedule.endDate)
        setExistingSchedule(schedule)
        setExistingScheduleOpen(true)
      } else {
        setScheduleOffOpen(true)
      }
    } catch (error) {
      debugError("Error checking schedule:", error)
      setScheduleOffOpen(true)
    }
  }

  const handleDeleteSchedule = () => {
    localStorage.removeItem(STORAGE_KEY)
    setExistingSchedule(null)
    setExistingScheduleOpen(false)
  }

  const handleReasonSelect = (reason) => {
    setSelectedReason(reason)
    setScheduleOffOpen(false)
    setDateTimePickerOpen(true)
  }

  const handleDateRangeChange = (start, end) => {
    setStartDate(start)
    setEndDate(end)
  }

  const handleStartTimeConfirm = (hour, minute, period) => {
    setStartTime({ hour, minute, period })
  }

  const handleEndTimeConfirm = (hour, minute, period) => {
    setEndTime({ hour, minute, period })
  }

  const formatTime = (time) => {
    return `${time.hour}:${time.minute} ${time.period.toUpperCase()}`
  }

  const formatDate = (date) => {
    if (!date) return "Select date"
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const handleSubmitScheduleOff = () => {
    if (!startDate || !endDate) {
      alert("Please select start and end dates")
      return
    }
    setDateTimePickerOpen(false)
    setSuccessPopupOpen(true)
  }

  // Prevent body scroll when popup is open
  useEffect(() => {
    if (profileOpen || scheduleOffOpen || dateTimePickerOpen || successPopupOpen || existingScheduleOpen || searchOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [profileOpen, scheduleOffOpen, dateTimePickerOpen, successPopupOpen, existingScheduleOpen, searchOpen])

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  // Section data
  const manageOutletItems = [
    { id: 1, label: "Outlet info", icon: Info, route: "/restaurant/outlet-info" },
    { id: 2, label: "Outlet timings", icon: Clock, route: "/restaurant/outlet-timings" },
    { id: 3, label: "Dining Reservations", icon: Calendar, route: "/restaurant/reservations" },
    { id: 4, label: "Menu categories", icon: Settings, route: "/restaurant/menu-categories" },
    // Hidden when the admin has switched off the subscription requirement.
    ...(subscriptionRequired
      ? [{ id: 5, label: "Business Plan", icon: Crown, route: "/restaurant/business-plan" }]
      : []),
  ]

  const settingsItems = [
    { id: 3, label: "Delivery settings", icon: Truck, route: "/restaurant/delivery-settings" },
    { id: 4, label: "Zone Setup", icon: MapPin, route: "/restaurant/zone-setup" },
    { id: 10, label: "Refer & Earn", icon: Gift, route: "/restaurant/refer-earn" },
    ...(restaurantData?.businessType === "Street Food Vendor" 
      ? [{ id: 11, label: "Live Location Control", icon: MapPin, route: "/food/restaurant/live-location" }] 
      : [])
  ]

  const ordersItems = [
    { id: 1, label: "Order history", icon: FileText, route: "/restaurant/orders/all" },
    { id: 2, label: "Complaints", icon: Star, route: "/restaurant/feedback?tab=complaints" },
    { id: 3, label: "Reviews", icon: MessageSquare, route: "/restaurant/feedback" },
  ]

  const helpItems = [
    { id: 1, label: "Support", icon: LifeBuoy, route: "/restaurant/help-centre/support" },
    { id: 2, label: "Share your feedback", icon: Edit, route: "/restaurant/Share-Feedback" },
  ]

  const accountingItems = [
    { id: 1, label: "Payout", icon: IndianRupee, route: "/restaurant/hub-finance" },
    { id: 2, label: "Invoices", icon: Receipt, route: "/restaurant/hub-finance?tab=invoices" },
    { id: 3, label: "Bank details", icon: Building2, route: "/restaurant/update-bank-details" },
    // Hidden when the admin has switched off the subscription requirement.
    ...(subscriptionRequired
      ? [{ id: 4, label: "Subscription Center", icon: Wallet, route: "/food/restaurant/wallet" }]
      : []),
  ]

  // All sections with their items
  const allSections = [
    { title: "Manage outlet", items: manageOutletItems, key: "manage-outlet" },
    { title: "Settings", items: settingsItems, key: "settings" },
    { title: "Orders", items: ordersItems, key: "orders" },
    { title: "Help", items: helpItems, key: "help" },
    { title: "Finance", items: accountingItems, key: "accounting" },
  ]

  // Filter logic
  const getFilteredSections = () => {
    if (!searchQuery.trim()) {
      return allSections
    }

    const query = searchQuery.toLowerCase()
    return allSections
      .map(section => ({
        ...section,
        items: section.items.filter(item =>
          item.label.toLowerCase().includes(query)
        )
      }))
      .filter(section => section.items.length > 0)
  }

  const filteredSections = getFilteredSections()

  const renderSection = (title, items, delay = 0) => (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay,
        ease: [0.25, 0.1, 0.25, 1]
      }}
      className="mb-8"
    >
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: delay + 0.05 }}
        className="text-base font-bold text-gray-900 mb-4"
      >
        {title}
      </motion.h2>
      <div className="grid grid-cols-3 gap-4">
        {items.map((item, index) => {
          const IconComponent = item.icon
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.25,
                delay: delay + 0.1 + (index * 0.02),
                ease: [0.25, 0.1, 0.25, 1]
              }}
              className="flex flex-col items-center"
            >
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (item.route) {
                    navigate(item.route)
                  }
                }}
                className="w-full flex items-center justify-center p-6 bg-white rounded-lg shadow-md border-2 border-gray-200 hover:shadow-md transition-shadow duration-200 min-h-[110px]"
              >
                <div className="relative flex items-center justify-center">
                  {item.customIcon ? (
                    <div className="w-12 h-12 flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-900">hp</span>
                    </div>
                  ) : (
                    <IconComponent className="w-8 h-8 text-gray-900" strokeWidth={1.5} />
                  )}
                  {item.badge && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: delay + 0.15 + (index * 0.02), type: "spring", stiffness: 500 }}
                      className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    >
                      {item.badge}
                    </motion.span>
                  )}
                </div>
              </motion.button>
              <span className="text-sm text-gray-700 text-center leading-tight font-normal mt-3">
                {item.label}
              </span>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.2,
        ease: [0.25, 0.1, 0.25, 1]
      }}
      className="min-h-screen bg-white overflow-x-hidden pb-24"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.25,
          ease: [0.25, 0.1, 0.25, 1]
        }}
        className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => navigate("/food/restaurant")}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-6 h-6 text-gray-900" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Explore more</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5 text-gray-900" />
            </button>
            <button
              onClick={() => setProfileOpen(true)}
              className="p-2 hover:bg-gray-100 bg-gray-200 rounded-full transition-colors overflow-hidden flex items-center justify-center"
              aria-label="Profile"
            >
              {userData.profileImage?.url ? (
                <img src={userData.profileImage.url} alt="Profile" className="w-5 h-5 object-cover rounded-full" />
              ) : (
                <UserRound className="w-5 h-5 text-gray-900" />
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="px-4 py-6">
        {/* Restaurant Information Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.3,
            delay: 0.05,
            ease: [0.25, 0.1, 0.25, 1]
          }}
        >
          <Card className="bg-white border-gray-200 py-3 mb-6 rounded-lg shadow-0">
            <CardContent className="px-4">
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Store className="w-5 h-5 text-gray-900" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <h2 className="text-base font-semibold text-gray-900 mb-0.5 flex items-center gap-2">
                      {restaurantDisplayName}
                      {liveTrackingEnabled && (
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-bold rounded-full uppercase">Live</span>
                      )}
                    </h2>
                    {restaurantDisplayAddress && (
                      <p className="text-sm text-gray-500 break-words text-wrap">
                        {restaurantDisplayAddress}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Sections */}
        {filteredSections.length > 0 ? (
          filteredSections.map((section, index) => (
            <div key={section.key}>
              {renderSection(section.title, section.items, 0.1 + (index * 0.05))}
              {index < filteredSections.length - 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 + (index * 0.05), duration: 0.2 }}
                  className="border-t border-gray-200 my-6"
                />
              )}
            </div>
          ))
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center py-12"
          >
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-900 mb-2">No results found</p>
            <p className="text-sm text-gray-500">Try searching with different keywords</p>
          </motion.div>
        )}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.2 }}
          className="border-t border-gray-200 my-6"
        />

        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.25 }}
          onClick={() => setLogoutConfirmOpen(true)}
          className="w-full flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100">
              <LogOut className="w-5 h-5 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-red-700">Logout</p>
              <p className="text-sm text-red-500">Tap to sign out from this device</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-red-400 shrink-0" />
        </motion.button>
      </div>

      {/* Search Popup */}
      <AnimatePresence>
        {logoutConfirmOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-[60]"
              onClick={() => {
                if (!isLoggingOut) setLogoutConfirmOpen(false)
              }}
            />

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.22 }}
              className="fixed inset-x-4 bottom-28 z-[61] mx-auto w-auto max-w-md rounded-3xl bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                  <LogOut className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Logout?</h3>
                <p className="mt-1 text-sm text-gray-500">Are you sure you want to logout?</p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setLogoutConfirmOpen(false)}
                  disabled={isLoggingOut}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await handleLogout()
                    setLogoutConfirmOpen(false)
                  }}
                  disabled={isLoggingOut}
                  className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {isLoggingOut ? "Logging out..." : "Yes"}
                </button>
              </div>
            </motion.div>
          </>
        )}

        {searchOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => {
                setSearchOpen(false)
                setSearchQuery("")
              }}
            />

            {/* Search Modal */}
            <motion.div
              initial={{ y: "-100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-100%" }}
              transition={{
                type: "spring",
                damping: 30,
                stiffness: 300
              }}
              className="fixed top-0 left-0 right-0 bg-white shadow-lg z-50 h-screen"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
                <button
                  onClick={() => {
                    setSearchOpen(false)
                    setSearchQuery("")
                  }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close search"
                >
                  <ArrowLeft className="w-6 h-6 text-gray-900" />
                </button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Search features..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full px-4 py-2 pr-10 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-gray-900 placeholder-gray-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4 text-gray-600" />
                    </button>
                  )}
                </div>
              </div>

              {/* Search Results */}
              <div className="max-h-[70vh] overflow-y-auto">
                {searchQuery.trim() ? (
                  getFilteredSections().length > 0 ? (
                    <div className="px-4 py-4">
                      {getFilteredSections().map((section) => (
                        <div key={section.key} className="mb-6 last:mb-0">
                          <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
                            {section.title}
                          </h3>
                          <div className="space-y-2">
                            {section.items.map((item) => {
                              const IconComponent = item.icon
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => {
                                    if (item.id === 5) {
                                      handleScheduleOffClick()
                                    } else if (item.route) {
                                      navigate(item.route)
                                    }
                                    setSearchOpen(false)
                                    setSearchQuery("")
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
                                >
                                  <div className="p-2 bg-gray-100 rounded-lg">
                                    <IconComponent className="w-5 h-5 text-gray-900" />
                                  </div>
                                  <span className="flex-1 text-base text-gray-900">{item.label}</span>
                                  {item.badge && (
                                    <span className="bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded">
                                      {item.badge}
                                    </span>
                                  )}
                                  <ChevronRight className="w-5 h-5 text-gray-400" />
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 px-4">
                      <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-lg font-semibold text-gray-900 mb-2">No results found</p>
                      <p className="text-sm text-gray-500">Try searching with different keywords</p>
                    </div>
                  )
                ) : (
                  <div className="text-center py-12 px-4">
                    <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-base font-medium text-gray-900 mb-1">Search for features</p>
                    <p className="text-sm text-gray-500">Type to search for outlet settings, orders, and more</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Profile Popup */}
      <RestaurantProfile isOpen={profileOpen} onClose={() => setProfileOpen(false)} />

      {/* Schedule Off Reason Selection Popup */}
      <AnimatePresence>
        {scheduleOffOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setScheduleOffOpen(false)}
            />

            {/* Popup Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{
                type: "spring",
                damping: 30,
                stiffness: 300
              }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
                <h2 className="text-lg font-bold text-gray-900">Select reason</h2>
                <button
                  onClick={() => setScheduleOffOpen(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-900" />
                </button>
              </div>

              {/* Reason Options */}
              <div className="px-6 py-4">
                {scheduleOffReasons.map((reason, index) => (
                  <button
                    key={index}
                    onClick={() => handleReasonSelect(reason)}
                    className="w-full text-left py-4 px-4 rounded-lg hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <span className="text-base text-gray-900">{reason}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Date and Time Picker Popup */}
      <AnimatePresence>
        {dateTimePickerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setDateTimePickerOpen(false)}
            />

            {/* Popup Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{
                type: "spring",
                damping: 30,
                stiffness: 300
              }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
                <h2 className="text-lg font-bold text-gray-900">Schedule off</h2>
                <button
                  onClick={() => setDateTimePickerOpen(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-900" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-6 space-y-6">
                {/* Selected Reason */}
                {selectedReason && (
                  <div className="pb-4 border-b border-gray-200">
                    <p className="text-sm text-gray-500 mb-1">Reason</p>
                    <p className="text-base font-medium text-gray-900">{selectedReason}</p>
                  </div>
                )}

                {/* Date Selection */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Select dates</p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">Start date</label>
                      <button
                        onClick={() => setShowCalendar(true)}
                        className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-gray-900">{formatDate(startDate)}</span>
                        <Calendar className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">End date</label>
                      <button
                        onClick={() => setShowCalendar(true)}
                        className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-gray-900">{formatDate(endDate)}</span>
                        <Calendar className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Time Selection */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Select times</p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">Start time</label>
                      <button
                        onClick={() => setShowStartTimePicker(true)}
                        className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-gray-900">{formatTime(startTime)}</span>
                        <Clock className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">End time</label>
                      <button
                        onClick={() => setShowEndTimePicker(true)}
                        className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-gray-900">{formatTime(endTime)}</span>
                        <Clock className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleSubmitScheduleOff}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors mt-4"
                >
                  Submit
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Calendar Popup */}
      {showCalendar && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowCalendar(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg shadow-lg">
            <DateRangeCalendar
              startDate={startDate}
              endDate={endDate}
              onDateRangeChange={handleDateRangeChange}
              onClose={() => setShowCalendar(false)}
            />
          </div>
        </div>
      )}

      {/* Start Time Picker */}
      <TimePickerWheel
        isOpen={showStartTimePicker}
        onClose={() => setShowStartTimePicker(false)}
        initialHour={startTime.hour}
        initialMinute={startTime.minute}
        initialPeriod={startTime.period}
        onConfirm={handleStartTimeConfirm}
      />

      {/* End Time Picker */}
      <TimePickerWheel
        isOpen={showEndTimePicker}
        onClose={() => setShowEndTimePicker(false)}
        initialHour={endTime.hour}
        initialMinute={endTime.minute}
        initialPeriod={endTime.period}
        onConfirm={handleEndTimeConfirm}
      />

      {/* Success Popup */}
      <AnimatePresence>
        {successPopupOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSuccessPopupOpen(false)}
              className="fixed inset-0 bg-black/50 z-[10000]"
            />

            {/* Success Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-0 flex items-center justify-center z-[10000] px-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Success!</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Restaurant is marked offline
                </p>
                <button
                  onClick={() => {
                    setSuccessPopupOpen(false)
                    // Reset states
                    setSelectedReason(null)
                    setStartDate(null)
                    setEndDate(null)
                    setStartTime({ hour: "9", minute: "00", period: "am" })
                    setEndTime({ hour: "5", minute: "00", period: "pm" })
                  }}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold text-sm hover:bg-green-700 transition-colors"
                >
                  Done 
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Existing Schedule Popup */}
      <AnimatePresence>
        {existingScheduleOpen && existingSchedule && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setExistingScheduleOpen(false)}
            />

            {/* Popup Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{
                type: "spring",
                damping: 30,
                stiffness: 300
              }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
                <h2 className="text-lg font-bold text-gray-900">Schedule off</h2>
                <button
                  onClick={() => setExistingScheduleOpen(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-900" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-6">
                {/* Status Message */}
                <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-base font-semibold text-gray-900 mb-1">
                    Restaurant is scheduled off
                  </p>
                  <p className="text-sm text-gray-600">
                    Your restaurant is currently marked as offline
                  </p>
                </div>

                {/* Schedule Details */}
                <div className="space-y-4 mb-6">
                  {/* Reason */}
                  {existingSchedule.reason && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Reason</p>
                      <p className="text-base font-medium text-gray-900">{existingSchedule.reason}</p>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Start date</p>
                      <p className="text-base font-medium text-gray-900">
                        {formatDate(existingSchedule.startDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">End date</p>
                      <p className="text-base font-medium text-gray-900">
                        {formatDate(existingSchedule.endDate)}
                      </p>
                    </div>
                  </div>

                  {/* Times */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Start time</p>
                      <p className="text-base font-medium text-gray-900">
                        {formatTime(existingSchedule.startTime)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">End time</p>
                      <p className="text-base font-medium text-gray-900">
                        {formatTime(existingSchedule.endTime)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Delete Button */}
                <button
                  onClick={() => {
                    handleDeleteSchedule()
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Delete Schedule
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <BottomNavOrders />
    </motion.div>
  )
}

