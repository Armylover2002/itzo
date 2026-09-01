import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import Lenis from "lenis"
import { ArrowLeft, Settings, ChevronRight, Clock } from "lucide-react"
import { Switch } from "@food/components/ui/switch"
import { toast } from "react-hot-toast"
import { Card, CardContent } from "@food/components/ui/card"
import { restaurantAPI } from "@food/api"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const RESTAURANT_ONLINE_STATUS_KEY = "restaurant_online_status"

const persistRestaurantOnlineStatus = (isOnline) => {
  try {
    localStorage.setItem(RESTAURANT_ONLINE_STATUS_KEY, JSON.stringify(Boolean(isOnline)))
  } catch (error) {
    debugError("Error persisting restaurant online status:", error)
  }
}


export default function RestaurantStatus() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [deliveryStatus, setDeliveryStatus] = useState(false)
  const [restaurantData, setRestaurantData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentDateTime, setCurrentDateTime] = useState(new Date())
  const [isWithinTimings, setIsWithinTimings] = useState(null) // null = not calculated yet
  const [showOutletClosedDialog, setShowOutletClosedDialog] = useState(false)
  const [showOutsideTimingsDialog, setShowOutsideTimingsDialog] = useState(false)
  const [isDayClosed, setIsDayClosed] = useState(false)
  const [outletTimings, setOutletTimings] = useState(null)
  const [showDailyPassConfirmModal, setShowDailyPassConfirmModal] = useState(false)
  const [showLowBalanceModal, setShowLowBalanceModal] = useState(false)
  const [eligibilityData, setEligibilityData] = useState(null)
  const [pendingToggle, setPendingToggle] = useState(false)

  // Update current date/time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDateTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  // Fetch restaurant data from backend
  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setLoading(true)
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
        setLoading(false)
      }
    }

    fetchRestaurantData()
  }, [])

  // Load outlet timings from backend (DB)
  useEffect(() => {
    const loadOutletTimings = () => {
      restaurantAPI
        .getOutletTimings()
        .then((res) => {
          const data = res?.data?.data?.outletTimings || res?.data?.outletTimings
          if (data) setOutletTimings(data)
        })
        .catch((error) => {
          debugError("Error loading outlet timings:", error)
        })
    }

    loadOutletTimings()

    // Listen for outlet timings updates
    window.addEventListener("outletTimingsUpdated", loadOutletTimings)
    
    return () => {
      window.removeEventListener("outletTimingsUpdated", loadOutletTimings)
    }
  }, [])

  // Check if restaurant is currently open based on outlet timings only
  useEffect(() => {
    const handleAutoTurnOff = async () => {
      setDeliveryStatus(false)
      try {
        await restaurantAPI.updateAcceptingOrders(false)
        persistRestaurantOnlineStatus(false)
        window.dispatchEvent(new CustomEvent('restaurantStatusChanged', { 
          detail: { isOnline: false } 
        }))
      } catch (e) {
        debugError("Auto turn off failed:", e)
      }
    }

    const checkIfOpen = () => {
      const now = new Date()
      const currentDayFull = now.toLocaleDateString('en-US', { weekday: 'long' }) // "Monday", "Tuesday", etc.
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()
      const currentTimeInMinutes = currentHour * 60 + currentMinute

      const outletTimingsData = outletTimings

      if (!outletTimingsData || !outletTimingsData[currentDayFull]) {
        // No outlet timings configured for today yet
        setIsDayClosed(false)
        setIsWithinTimings(true)
        return
      }

      const dayData = outletTimingsData[currentDayFull]
      if (dayData.isOpen === false) {
        setIsDayClosed(true)
        setIsWithinTimings(false)
        // Show dialog only if it was online, to prevent annoying popups every minute
        if (deliveryStatus) {
          setShowOutletClosedDialog(true)
          handleAutoTurnOff()
        }
        return
      }

      if (!dayData.openingTime || !dayData.closingTime) {
        setIsDayClosed(false)
        setIsWithinTimings(true)
        return
      }

      const [openHour, openMinute] = dayData.openingTime.split(':').map(Number)
      const [closeHour, closeMinute] = dayData.closingTime.split(':').map(Number)
      
      const openingTimeInMinutes = openHour * 60 + openMinute
      const closingTimeInMinutes = closeHour * 60 + closeMinute

      let isWithin = false
      if (closingTimeInMinutes > openingTimeInMinutes) {
        isWithin = currentTimeInMinutes >= openingTimeInMinutes && currentTimeInMinutes <= closingTimeInMinutes
      } else {
        isWithin = currentTimeInMinutes >= openingTimeInMinutes || currentTimeInMinutes <= closingTimeInMinutes
      }

      setIsDayClosed(false)
      setIsWithinTimings(isWithin)

      if (!isWithin && deliveryStatus) {
        handleAutoTurnOff()
      }
    }

    checkIfOpen()
    // Recheck every minute
    const interval = setInterval(checkIfOpen, 60000)
    
    // Listen for outlet timings updates
    const handleOutletTimingsUpdate = () => {
      checkIfOpen()
    }
    window.addEventListener("outletTimingsUpdated", handleOutletTimingsUpdate)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener("outletTimingsUpdated", handleOutletTimingsUpdate)
    }
  }, [currentDateTime, outletTimings, deliveryStatus])

  // Note: Delivery status is now manually controlled by user via toggle
  // We don't automatically set it based on timings anymore
  // The isWithinTimings is only used to show warning messages

  // Load delivery status from backend
  useEffect(() => {
    const loadDeliveryStatus = async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant()
        const restaurant = response?.data?.data?.restaurant || response?.data?.restaurant
        if (restaurant?.isAcceptingOrders !== undefined) {
          setDeliveryStatus(restaurant.isAcceptingOrders)
          try {
            localStorage.setItem('restaurant_online_status', JSON.stringify(Boolean(restaurant.isAcceptingOrders)))
          } catch {}
          persistRestaurantOnlineStatus(restaurant.isAcceptingOrders)
          // Dispatch event to update navbar
          window.dispatchEvent(new CustomEvent('restaurantStatusChanged', { 
            detail: { isOnline: restaurant.isAcceptingOrders } 
          }))
        } else {
          setDeliveryStatus(false)
          try {
            localStorage.setItem('restaurant_online_status', JSON.stringify(false))
          } catch {}
          persistRestaurantOnlineStatus(false)
          window.dispatchEvent(new CustomEvent('restaurantStatusChanged', { 
            detail: { isOnline: false } 
          }))
        }
      } catch (error) {
        // Only log error if it's not a network/timeout error (backend might be down/slow)
        if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
          debugError("Error loading delivery status:", error)
        }
        setDeliveryStatus(false)
        try {
          localStorage.setItem('restaurant_online_status', JSON.stringify(false))
        } catch {}
        persistRestaurantOnlineStatus(false)
        window.dispatchEvent(new CustomEvent('restaurantStatusChanged', { 
          detail: { isOnline: false } 
        }))
      }
    }

    loadDeliveryStatus()
  }, [])

  // Handle delivery status change
  const handleDeliveryStatusChange = async (checked) => {
    // Going offline always works
    if (!checked) {
      setDeliveryStatus(false)
      try {
        await restaurantAPI.updateAcceptingOrders(false)
        persistRestaurantOnlineStatus(false)
        window.dispatchEvent(new CustomEvent('restaurantStatusChanged', { detail: { isOnline: false } }))
      } catch (apiError) {
        debugError('Error updating delivery status in backend:', apiError)
        setDeliveryStatus(true)
        persistRestaurantOnlineStatus(true)
      }
      return
    }

    // If day is closed in outlet timings, don't allow turning on
    if (isDayClosed) {
      setShowOutletClosedDialog(true)
      return
    }

    // If outside scheduled delivery timings, show popup
    if (isWithinTimings === false && !isDayClosed) {
      setShowOutsideTimingsDialog(true)
      return
    }

    // Check subscription eligibility before toggling ON
    try {
      const eligibilityRes = await restaurantAPI.checkSubscriptionEligibility()
      const eligibility = eligibilityRes?.data?.data

      if (!eligibility) {
        toast.error("Could not check subscription status")
        return
      }

      // Subscription not required (admin switched it off), or already covered by an
      // active plan / daily pass — toggle directly.
      if (
        eligibility.enforced === false ||
        eligibility.reason === 'ENFORCEMENT_DISABLED' ||
        eligibility.reason === 'RECURRING_ACTIVE' ||
        eligibility.reason === 'DAY_PASS_ACTIVE'
      ) {
        setDeliveryStatus(true)
        await restaurantAPI.updateAcceptingOrders(true)
        persistRestaurantOnlineStatus(true)
        window.dispatchEvent(new CustomEvent('restaurantStatusChanged', { detail: { isOnline: true } }))
        return
      }

      // Low balance — show blocking modal
      if (!eligibility.eligible && eligibility.reason === 'LOW_BALANCE') {
        setPendingToggle(true)
        setShowLowBalanceModal(true)
        return
      }

      // Requires daily pass deduction — show confirmation modal
      if (eligibility.shouldDeduct && eligibility.reason === 'REQUIRES_DAY_DEDUCTION') {
        setPendingToggle(true)
        setEligibilityData(eligibility)
        setShowDailyPassConfirmModal(true)
        return
      }

      // Fallback — should not reach here
      toast.error("Unable to determine subscription status")
    } catch (error) {
      debugError("Error checking eligibility:", error)
      toast.error("Failed to check subscription status")
    }
  }

  // Confirm daily pass activation
  const handleConfirmDailyPass = async () => {
    setShowDailyPassConfirmModal(false)
    setDeliveryStatus(true)
    try {
      await restaurantAPI.updateAcceptingOrders(true)
      persistRestaurantOnlineStatus(true)
      window.dispatchEvent(new CustomEvent('restaurantStatusChanged', { detail: { isOnline: true } }))
      toast.success("Daily pass activated! You are now online.")
    } catch (apiError) {
      debugError('Error activating daily pass:', apiError)
      setDeliveryStatus(false)
      persistRestaurantOnlineStatus(false)
      toast.error(apiError?.response?.data?.message || "Failed to activate daily pass")
    }
    setPendingToggle(false)
    setEligibilityData(null)
  }

  // Cancel daily pass modal
  const handleCancelDailyPass = () => {
    setShowDailyPassConfirmModal(false)
    setPendingToggle(false)
    setEligibilityData(null)
  }

  // Cancel low balance modal
  const handleCancelLowBalance = () => {
    setShowLowBalanceModal(false)
    setPendingToggle(false)
  }

  // Handle dialog close and navigate to outlet timings
  const handleGoToOutletTimings = () => {
    setShowOutletClosedDialog(false)
    navigate("/restaurant/outlet-timings")
  }

  // Format time from 24-hour to 12-hour format
  const formatTime12Hour = (time24) => {
    if (!time24) return ""
    const [hours, minutes] = time24.split(':').map(Number)
    const period = hours >= 12 ? 'pm' : 'am'
    const hours12 = hours % 12 || 12
    const minutesStr = minutes.toString().padStart(2, '0')
    return `${hours12}:${minutesStr} ${period}`
  }

  // Format current date and time
  const formatCurrentDateTime = () => {
    const now = currentDateTime
    const dateStr = now.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
    const timeStr = now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
    return `${dateStr}, ${timeStr}`
  }

  // Get delivery timings for current day (outlet timings only)
  const getCurrentDayTimings = () => {
    const now = new Date()
    const currentDayFull = now.toLocaleDateString('en-US', { weekday: 'long' }) // "Monday", "Tuesday", etc.
    
    // Single source of truth: outlet timings
    if (outletTimings && outletTimings[currentDayFull]) {
      const dayData = outletTimings[currentDayFull]
      if (dayData.isOpen && dayData.openingTime && dayData.closingTime) {
        return {
          openingTime: formatTime12Hour(dayData.openingTime),
          closingTime: formatTime12Hour(dayData.closingTime)
        }
      }
    }

    return null
  }

  // Format address
  const formatAddress = (location) => {
    if (!location) return ""
    const parts = []
    if (location.area) parts.push(location.area.trim())
    if (location.city) parts.push(location.city.trim())
    return parts.join(", ") || ""
  }

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

  return (
    <div className="min-h-screen bg-gray-100 overflow-x-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button 
            onClick={goBack}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">Restaurant status</h1>

          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-6">
        {/* Restaurant Information Card */}
        <Card className="bg-gray-50 border-none py-0 shadow-sm rounded-b-none rounded-t-lg">
          <CardContent className="p-4 gap-6 flex flex-col">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-gray-900 mb-1">
                  {loading ? "Loading..." : (restaurantData?.name || "Restaurant")}
                </h2>
                <p className="text-sm text-gray-500">
                  {loading ? "Loading..." : (
                    <>
                      {restaurantData?.id ? `ID: ${String(restaurantData.id).slice(-5)}` : ""}
                      {restaurantData?.location && formatAddress(restaurantData.location) ? (
                        <> | {formatAddress(restaurantData.location)}</>
                      ) : ""}
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={() => {
                  // Navigate to restaurant settings
                  navigate("/restaurant/explore")
                }}
                className="ml-3 p-2 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors shrink-0"
                aria-label="Explore more"
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-base font-bold text-gray-900 mb-1.5">Delivery status</p>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${deliveryStatus ? 'bg-[#FE5502]' : 'bg-gray-600'}`}></div>
                <p className="text-sm text-gray-500">
                  {deliveryStatus ? 'Receiving orders' : 'Not receiving orders'}
                </p>
              </div>
            </div>
            <Switch
              checked={deliveryStatus}
              onCheckedChange={handleDeliveryStatusChange}
              className="ml-4 data-[state=unchecked]:bg-gray-300 data-[state=checked]:bg-[#FE5502]"
            />
          </div>

          <p className="text-sm text-gray-700 mb-2">Current delivery slot</p>
          <div className="flex items-center justify-between">
            <p className="text-base font-bold text-gray-900">
              {loading ? "Loading..." : (
                (() => {
                  // If current day is closed, show "Today is Off"
                  if (isDayClosed) {
                    return "Today is Off"
                  }
                  const timings = getCurrentDayTimings()
                  if (timings) {
                    const dateStr = currentDateTime.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
                    return `${dateStr}, ${timings.openingTime} - ${timings.closingTime}`
                  }
                  return "Not configured"
                })()
              )}
            </p>
            {!isDayClosed && (
              <button
                onClick={() => navigate("/restaurant/outlet-timings")}
                className="flex items-center gap-1 text-primary hover:text-primary-hover text-sm font-medium"
              >
                Details
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          

          </CardContent>
        </Card>

  {/* Warning Message - Only show if outside timings AND day is not closed */}
  {!isWithinTimings && restaurantData && !isDayClosed && (
        <div className="bg-pink-50 rounded-b-lg rounded-t-none p-4 flex items-start gap-3">
          <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-white text-xs font-bold">!</span>
          </div>
          <p className="text-sm text-gray-700 flex-1">
            You are currently outside your scheduled delivery timings.
          </p>
        </div>
      )}

      {/* Outlet Closed Dialog */}
      <Dialog open={showOutletClosedDialog} onOpenChange={setShowOutletClosedDialog}>
        <DialogContent className="sm:max-w-md p-4 w-[90%] gap-2 flex flex-col">
          <DialogHeader className="text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
            <DialogTitle className="text-lg font-semibold text-gray-900 text-center">
              Outlet Timings Closed
            </DialogTitle>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => setShowOutletClosedDialog(false)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGoToOutletTimings}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white"
            >
              Go to Outlet Timings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outside Timings Dialog */}
      <Dialog open={showOutsideTimingsDialog} onOpenChange={setShowOutsideTimingsDialog}>
        <DialogContent className="sm:max-w-md p-4 w-[90%] gap-2 flex flex-col">
          <DialogHeader className="text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
              <span className="text-3xl">??</span>
            </div>
            <DialogTitle className="text-lg font-semibold text-gray-900 text-center">
              Outside Delivery Timings
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-gray-600">
              You are currently outside your scheduled delivery timings. Please change outlet timings to enable delivery status.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => setShowOutsideTimingsDialog(false)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowOutsideTimingsDialog(false)
                navigate("/restaurant/outlet-timings")
              }}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white"
            >
              Change Outlet Timings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Daily Pass Confirmation Dialog */}
      <Dialog open={showDailyPassConfirmModal} onOpenChange={setShowDailyPassConfirmModal}>
        <DialogContent className="sm:max-w-md p-4 w-[90%] gap-2 flex flex-col">
          <DialogHeader className="text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <span className="text-3xl">?</span>
            </div>
            <DialogTitle className="text-lg font-bold text-gray-900 text-center uppercase tracking-tight">
              Activate One-Day Pass?
            </DialogTitle>
            <DialogDescription className="mt-4 text-sm text-gray-600">
              One-Day Pass is activated automatically when you turn ON delivery.
              <br /><br />
              <span className="text-gray-900 font-semibold italic">If no active plan exists, a small daily fee will be deducted from your Subscription Wallet after confirmation.</span>
              <br /><br />
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Benefits</p>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FE5502]" />
                  <p className="text-xs text-slate-700">Start receiving orders immediately</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FE5502]" />
                  <p className="text-xs text-slate-700">Valid until midnight tonight</p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleCancelDailyPass}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDailyPass}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
            >
              Activate & Go Online
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Low Balance Dialog */}
      <Dialog open={showLowBalanceModal} onOpenChange={setShowLowBalanceModal}>
        <DialogContent className="sm:max-w-md p-4 w-[90%] gap-2 flex flex-col">
          <DialogHeader className="text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <span className="text-3xl">!</span>
            </div>
            <DialogTitle className="text-lg font-semibold text-gray-900 text-center">
              Insufficient Subscription Balance
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-gray-600">
              Minimum ₹1000 required to receive orders.
              <br /><br />
              Recharge your Subscription Wallet to continue.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleCancelLowBalance}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowLowBalanceModal(false)
                setPendingToggle(false)
                navigate("/food/restaurant/wallet")
              }}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white"
            >
              Recharge Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      </div>
    </div>
  )
}

