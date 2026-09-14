import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { motion, AnimatePresence } from "framer-motion"
import Lenis from "lenis"
import { ArrowLeft, Truck, X, CheckCircle, AlertCircle } from "lucide-react"
import { Switch } from "@food/components/ui/switch"
import { Card, CardContent } from "@food/components/ui/card"
import { restaurantAPI } from "@food/api"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const DELIVERY_STATUS_KEY = "restaurant_delivery_status"
const RESTAURANT_ONLINE_STATUS_KEY = "restaurant_online_status"

export default function DeliverySettings() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [deliveryStatus, setDeliveryStatus] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingStatus, setPendingStatus] = useState(false)
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const [savingStatus, setSavingStatus] = useState(false)
  const [quickDeliveryEnabled, setQuickDeliveryEnabled] = useState(false)
  const [savingQuickDelivery, setSavingQuickDelivery] = useState(false)
  const [kitchenPrepMinutes, setKitchenPrepMinutes] = useState("")
  const [savingKitchenPrep, setSavingKitchenPrep] = useState(false)

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

  const syncStatusLocally = (status) => {
    const value = Boolean(status)
    try {
      localStorage.setItem(DELIVERY_STATUS_KEY, JSON.stringify(value))
      localStorage.setItem(RESTAURANT_ONLINE_STATUS_KEY, JSON.stringify(value))
    } catch (error) {
      debugError("Error saving delivery status locally:", error)
    }

    window.dispatchEvent(new CustomEvent("restaurantStatusChanged", {
      detail: { isOnline: value }
    }))
  }

  // Load delivery status from backend on mount
  useEffect(() => {
    let cancelled = false

    const loadDeliveryStatus = async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant()
        const restaurant =
          response?.data?.data?.restaurant ||
          response?.data?.restaurant ||
          response?.data?.data ||
          null
        const nextStatus = restaurant?.isAcceptingOrders === true
        if (!cancelled) {
          setDeliveryStatus(nextStatus)
          syncStatusLocally(nextStatus)
          setQuickDeliveryEnabled(restaurant?.quickDeliveryEnabled === true)
          const prep = restaurant?.kitchenPrepMinutes
          setKitchenPrepMinutes(
            prep == null || prep === "" ? "" : String(Math.round(Number(prep))),
          )
        }
      } catch (error) {
        try {
          const savedStatus = localStorage.getItem(DELIVERY_STATUS_KEY)
          if (!cancelled && savedStatus !== null) {
            setDeliveryStatus(JSON.parse(savedStatus))
          }
        } catch (_) {}

        if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
          debugError("Error loading delivery status:", error)
        }
      }
    }

    loadDeliveryStatus()

    return () => {
      cancelled = true
    }
  }, [])

  // Keep backward-compatible local key in sync if another screen updates it.
  useEffect(() => {
    try {
      const savedStatus = localStorage.getItem(DELIVERY_STATUS_KEY)
      if (savedStatus !== null) {
        setDeliveryStatus(JSON.parse(savedStatus))
      }
    } catch (error) {
      // Only log error if it's not a network/timeout error (backend might be down/slow)
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
        debugError("Error loading delivery status:", error)
      }
    }
  }, [])

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (showConfirmDialog) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showConfirmDialog])

  // Outlet timings are stored in DB now; this screen no longer gates delivery toggle by local schedule.
  const canEnableDelivery = true

  const showToast = (message) => {
    setToastMessage(message)
    setShowSuccessToast(true)
    setTimeout(() => setShowSuccessToast(false), 3000)
  }

  const saveDeliveryStatus = (status) => {
    const value = Boolean(status)
    setDeliveryStatus(value)
    syncStatusLocally(value)

    if (value) {
      showToast("Delivery is now ON - You're receiving orders")
    } else {
      showToast("Delivery is now OFF - Not receiving orders")
    }
  }

  const handleDeliveryStatusChange = (checked) => {
    if (savingStatus) return

    // If turning ON and outside outlet timings, show warning
    if (checked && !canEnableDelivery) {
      setPendingStatus(checked)
      setShowConfirmDialog(true)
      return
    }

    // If turning OFF, show confirmation
    if (!checked && deliveryStatus) {
      setPendingStatus(checked)
      setShowConfirmDialog(true)
      return
    }

    // Otherwise, update directly
    void saveDeliveryStatusToBackend(checked)
  }

  const saveDeliveryStatusToBackend = async (status) => {
    const previousStatus = deliveryStatus
    const nextStatus = Boolean(status)

    try {
      setSavingStatus(true)
      saveDeliveryStatus(nextStatus)
      await restaurantAPI.updateAcceptingOrders(nextStatus)
    } catch (error) {
      setDeliveryStatus(previousStatus)
      syncStatusLocally(previousStatus)
      debugError("Error updating delivery status:", error)
      showToast(error?.response?.data?.message || "Error updating delivery status")
      return
    } finally {
      setSavingStatus(false)
    }
  }

  const handleConfirmStatusChange = () => {
    void saveDeliveryStatusToBackend(pendingStatus)
    setShowConfirmDialog(false)
    
    // Show warning if enabled outside timings
    if (pendingStatus && !canEnableDelivery) {
      setShowWarning(true)
      setTimeout(() => setShowWarning(false), 5000)
    }
  }

  const handleCancelStatusChange = () => {
    setShowConfirmDialog(false)
    setPendingStatus(deliveryStatus)
  }

  const handleQuickDeliveryChange = async (checked) => {
    if (savingQuickDelivery) return
    const previous = quickDeliveryEnabled
    const next = Boolean(checked)
    setQuickDeliveryEnabled(next)
    setSavingQuickDelivery(true)
    try {
      await restaurantAPI.updateProfile({ quickDeliveryEnabled: next })
      showToast(
        next
          ? "Quick Delivery enabled for this restaurant"
          : "Quick Delivery disabled for this restaurant"
      )
    } catch (error) {
      setQuickDeliveryEnabled(previous)
      debugError("Error updating Quick Delivery:", error)
      showToast(error?.response?.data?.message || "Failed to update Quick Delivery")
    } finally {
      setSavingQuickDelivery(false)
    }
  }

  const handleSaveKitchenPrep = async () => {
    if (savingKitchenPrep) return
    const raw = String(kitchenPrepMinutes || "").trim()
    if (raw === "") {
      setSavingKitchenPrep(true)
      try {
        await restaurantAPI.updateProfile({ kitchenPrepMinutes: null })
        setKitchenPrepMinutes("")
        showToast("Kitchen prep cleared — platform default will be used")
      } catch (error) {
        debugError("Error clearing kitchen prep:", error)
        showToast(error?.response?.data?.message || "Failed to clear kitchen prep")
      } finally {
        setSavingKitchenPrep(false)
      }
      return
    }
    const n = Number(raw)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 90) {
      showToast("Kitchen prep must be a whole number between 1 and 90 minutes")
      return
    }
    setSavingKitchenPrep(true)
    try {
      const response = await restaurantAPI.updateProfile({ kitchenPrepMinutes: n })
      const saved =
        response?.data?.data?.restaurant?.kitchenPrepMinutes ??
        response?.data?.restaurant?.kitchenPrepMinutes ??
        n
      setKitchenPrepMinutes(String(Math.round(Number(saved))))
      showToast("Kitchen preparation time saved")
    } catch (error) {
      debugError("Error saving kitchen prep:", error)
      showToast(error?.response?.data?.message || "Failed to save kitchen prep")
    } finally {
      setSavingKitchenPrep(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
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
            <h1 className="text-lg font-bold text-gray-900">Delivery Settings</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage your delivery status</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Truck className="w-5 h-5 text-gray-900" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Delivery Status</h2>
                  <p className="text-sm text-gray-500">Control when you receive delivery orders</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-base font-bold text-gray-900 mb-1.5">Turn on delivery</p>
                  <motion.div 
                    className="flex items-center gap-2"
                    initial={false}
                    animate={{ scale: deliveryStatus ? 1.05 : 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className={`w-2 h-2 rounded-full ${deliveryStatus ? "bg-green-500 animate-pulse" : "bg-gray-600"}`}></div>
                    <p className="text-sm text-gray-500">
                      {deliveryStatus ? "Receiving orders" : "Not receiving orders"}
                    </p>
                  </motion.div>
                  <AnimatePresence>
                    {!canEnableDelivery && !deliveryStatus && (
                      <motion.p 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-xs text-red-600 mt-2 flex items-center gap-1"
                      >
                        <AlertCircle className="w-3 h-3" />
                        You are outside outlet timings
                      </motion.p>
                    )}
                    {showWarning && deliveryStatus && (
                      <motion.p 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-xs text-red-600 mt-2 animate-pulse flex items-center gap-1"
                      >
                        <AlertCircle className="w-3 h-3" />
                        Warning: Delivery enabled outside outlet timings!
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <Switch
                  checked={deliveryStatus}
                  onCheckedChange={handleDeliveryStatusChange}
                  disabled={savingStatus}
                  className="ml-4 data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="mt-4"
        >
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-base font-bold text-gray-900 mb-1">Quick Delivery</p>
                  <p className="text-sm text-gray-500">
                    Opt-in for this restaurant. Customers see Quick only when Admin Global Fee Settings and Zone are also enabled.
                  </p>
                </div>
                <Switch
                  checked={quickDeliveryEnabled}
                  onCheckedChange={handleQuickDeliveryChange}
                  disabled={savingQuickDelivery}
                  className="ml-4 shrink-0 data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
          className="mt-4"
        >
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-base font-bold text-gray-900 mb-1">Kitchen preparation (minutes)</p>
                <p className="text-sm text-gray-500">
                  This is average kitchen preparation time only. Do not include rider travel or delivery time.
                  Leave blank to use the platform default from Admin Fee Settings.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={90}
                  step={1}
                  value={kitchenPrepMinutes}
                  onChange={(e) => setKitchenPrepMinutes(e.target.value)}
                  placeholder="Platform default"
                  className="w-32 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  disabled={savingKitchenPrep}
                />
                <button
                  type="button"
                  onClick={handleSaveKitchenPrep}
                  disabled={savingKitchenPrep}
                  className="px-4 py-2 rounded-lg bg-[#118A42] text-white text-sm font-semibold disabled:opacity-60"
                >
                  {savingKitchenPrep ? "Saving…" : "Save"}
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mt-4"
        >
          <Card className="bg-blue-50 border-blue-200 shadow-sm">
            <CardContent className="p-4">
              <p className="text-sm text-gray-700">
                <strong>Note:</strong> When delivery is turned off, customers won't be able to place delivery orders from your restaurant. You can turn it back on anytime.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {showConfirmDialog && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-[100]"
              onClick={handleCancelStatusChange}
            />
            
            {/* Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-0 flex items-center justify-center z-[100] px-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
                <div className="flex justify-center mb-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    pendingStatus ? "bg-red-100" : "bg-red-100"
                  }`}>
                    <AlertCircle className={`w-10 h-10 ${
                      pendingStatus ? "text-red-600" : "text-red-600"
                    }`} />
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
                  {pendingStatus ? "Enable Delivery?" : "Disable Delivery?"}
                </h3>
                
                <p className="text-sm text-gray-600 mb-6 text-center">
                  {pendingStatus ? (
                    !canEnableDelivery ? (
                      <>You are currently outside your outlet timings. Are you sure you want to enable delivery?</>
                    ) : (
                      <>You will start receiving delivery orders. Make sure you're ready to accept orders.</>
                    )
                  ) : (
                    <>Customers won't be able to place delivery orders. You can turn it back on anytime.</>
                  )}
                </p>
                
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelStatusChange}
                    className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmStatusChange}
                    className={`flex-1 px-4 py-3 font-semibold rounded-lg transition-colors ${
                      pendingStatus 
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-red-600 hover:bg-red-700 text-white"
                    }`}
                  >
                    {pendingStatus ? "Enable" : "Disable"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Success Toast */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-4 w-full max-w-md"
          >
            <div className="bg-gray-900 text-white px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
              <p className="text-sm font-medium flex-1">{toastMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

