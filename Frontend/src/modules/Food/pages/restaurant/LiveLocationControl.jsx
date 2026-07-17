import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { ArrowLeft, MapPin, Navigation, Map as MapIcon, WifiOff } from "lucide-react"
import { Switch } from "@food/components/ui/switch"
import { toast } from "react-hot-toast"
import { Card, CardContent } from "@food/components/ui/card"
import { restaurantAPI } from "@food/api"
import { writeRestaurantLocation } from "@food/realtimeTracking"

// Haversine distance in metres
function getDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const MIN_MOVEMENT_METERS = 15;
const MIN_TIME_MS = 10000;
const OFFLINE_QUEUE_KEY = 'vendor_offline_loc_queue';

export default function LiveLocationControl() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  
  const [restaurantData, setRestaurantData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [liveTrackingEnabled, setLiveTrackingEnabled] = useState(false)
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  
  const watchIdRef = useRef(null)
  const lastSentLocRef = useRef(null)
  const lastSentTimeRef = useRef(0)

  // ─── INIT ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchRestaurantData()
    
    const handleOnline = () => {
      setIsOffline(false)
      flushOfflineQueue()
    }
    const handleOffline = () => setIsOffline(true)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      stopGPSWatch()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const fetchRestaurantData = async () => {
    try {
      setLoading(true)
      const response = await restaurantAPI.getCurrentRestaurant()
      const data = response?.data?.data?.restaurant || response?.data?.restaurant
      if (data) {
        setRestaurantData(data)
        const isLive = data.liveTrackingEnabled === true;
        setLiveTrackingEnabled(isLive)
        
        if (data.currentLocation?.latitude && data.currentLocation?.longitude) {
          setCurrentLocation({
            latitude: Number(data.currentLocation.latitude),
            longitude: Number(data.currentLocation.longitude)
          })
        } else if (data.currentLocation?.coordinates?.length === 2) {
          setCurrentLocation({
            longitude: Number(data.currentLocation.coordinates[0]),
            latitude: Number(data.currentLocation.coordinates[1])
          })
        }

        // Auto-resume tracking if it was enabled in DB
        if (isLive && data.businessType === "Street Food Vendor") {
          startGPSWatch(data._id || data.id)
        }
      }
    } catch (error) {
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED') {
        console.error("Error fetching restaurant data:", error)
      }
    } finally {
      setLoading(false)
    }
  }

  // ─── GPS & API SYNC ───────────────────────────────────────────────────

  const handleToggleTracking = async (enabled) => {
    if (!restaurantData) return;
    try {
      setLiveTrackingEnabled(enabled)
      await restaurantAPI.updateLiveTrackingStatus(enabled)
      toast.success(enabled ? "Live tracking started" : "Live tracking stopped")
      
      if (enabled) {
        startGPSWatch(restaurantData._id || restaurantData.id)
      } else {
        stopGPSWatch()
      }
    } catch (error) {
      setLiveTrackingEnabled(!enabled)
      const errMsg = error.response?.data?.message || "Failed to update tracking status"
      toast.error(errMsg)
    }
  }

  const startGPSWatch = (restaurantId) => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported by your browser")
      setLiveTrackingEnabled(false)
      restaurantAPI.updateLiveTrackingStatus(false).catch(() => {})
      return
    }

    if (watchIdRef.current !== null) return; // already watching

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setCurrentLocation({ latitude, longitude })
        processNewLocation(latitude, longitude, restaurantId)
      },
      (error) => {
        console.error("Error watching location:", error)
        if (error.code === 1) { // PERMISSION_DENIED
          toast.error("Location permission denied. Please enable GPS in browser settings.", { duration: 5000 })
          handleToggleTracking(false) // Auto turn off
        } else if (error.code === 2) { // POSITION_UNAVAILABLE
          toast.error("GPS signal unavailable. Trying to reconnect...", { id: 'gps-warn' })
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )
  }

  const stopGPSWatch = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }

  const processNewLocation = async (lat, lng, restaurantId) => {
    const now = Date.now()
    
    // Throttling (10s max)
    if (now - lastSentTimeRef.current < MIN_TIME_MS) {
      return; 
    }

    // Movement threshold (15m)
    if (lastSentLocRef.current) {
      const dist = getDistance(lastSentLocRef.current.lat, lastSentLocRef.current.lng, lat, lng)
      if (dist < MIN_MOVEMENT_METERS) {
        return; 
      }
    }

    // If offline, queue it and return
    if (!navigator.onLine) {
      queueOfflineLocation(lat, lng)
      return;
    }

    await syncLocationToServer(lat, lng, restaurantId)
  }

  const syncLocationToServer = async (lat, lng, restaurantId) => {
    if (isUpdatingLocation) return
    try {
      setIsUpdatingLocation(true)
      
      // 1. Send to Backend API
      await restaurantAPI.updateLiveLocation(lat, lng)
      
      // 2. Fast-path write to Firebase RTDB for customers
      if (restaurantId) {
        writeRestaurantLocation(restaurantId, { lat, lng, isLive: true, locationSource: 'gps' })
          .catch(err => console.warn("Firebase RTDB fast-path write failed:", err))
      }

      // Success! Update refs
      lastSentLocRef.current = { lat, lng }
      lastSentTimeRef.current = Date.now()
      
      // Dispatch event to update OutletInfo UI instantly
      window.dispatchEvent(new Event("addressUpdated"))

    } catch (error) {
      const status = error.response?.status
      const errMsg = error.response?.data?.message || "Failed to update location"
      
      if (status === 403 && errMsg.toLowerCase().includes('zone')) {
        // ZONE EXIT ALERT!
        toast.error(`⚠️ ${errMsg}`, { duration: 6000 })
        handleToggleTracking(false) // force stop tracking
      } else if (error.code === 'ERR_NETWORK' || status === 429) {
        // Queue if network error or rate limited
        queueOfflineLocation(lat, lng)
      } else {
        console.error("GPS Sync Error:", errMsg)
      }
    } finally {
      setIsUpdatingLocation(false)
    }
  }

  // ─── OFFLINE QUEUE ────────────────────────────────────────────────────

  const queueOfflineLocation = (lat, lng) => {
    try {
      sessionStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify({ lat, lng, ts: Date.now() }))
    } catch (e) {
      // ignore quota errors
    }
  }

  const flushOfflineQueue = async () => {
    if (!restaurantData) return;
    try {
      const stored = sessionStorage.getItem(OFFLINE_QUEUE_KEY)
      if (!stored) return;
      const { lat, lng, ts } = JSON.parse(stored)
      
      // Only flush if it's less than 30 mins old
      if (Date.now() - ts < 30 * 60 * 1000) {
        await syncLocationToServer(lat, lng, restaurantData._id || restaurantData.id)
      }
      sessionStorage.removeItem(OFFLINE_QUEUE_KEY)
    } catch (e) {
      sessionStorage.removeItem(OFFLINE_QUEUE_KEY)
    }
  }

  // ─── MANUAL UPDATE (Fallback) ─────────────────────────────────────────

  const handleUpdateLocationManually = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported by your browser")
      return;
    }
    
    toast.loading("Fetching exact location...", { id: "gps-fetch" })
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        toast.dismiss("gps-fetch")
        const { latitude, longitude } = position.coords
        setCurrentLocation({ latitude, longitude })
        
        toast.loading("Updating location...", { id: "gps-update" })
        try {
          // Manual updates become truth instantly
          await restaurantAPI.updateLiveLocation(latitude, longitude)
          
          if (restaurantData) {
            writeRestaurantLocation(restaurantData._id || restaurantData.id, { 
              lat: latitude, lng: longitude, isLive: liveTrackingEnabled, locationSource: 'manual' 
            }).catch(()=>{})
          }

          lastSentLocRef.current = { lat: latitude, lng: longitude }
          lastSentTimeRef.current = Date.now()
          window.dispatchEvent(new Event("addressUpdated"))

          toast.success("Location updated successfully", { id: "gps-update" })
        } catch (error) {
          const errMsg = error.response?.data?.message || "Failed to update location"
          toast.error(errMsg, { id: "gps-update" })
        }
      },
      (error) => {
        toast.dismiss("gps-fetch")
        if (error.code === 1) toast.error("Location permission denied.")
        else toast.error("Failed to get location")
      },
      { enableHighAccuracy: true }
    )
  }

  // ─── RENDER ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (restaurantData?.businessType !== "Street Food Vendor") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 flex-1">Live Location</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <MapIcon className="w-16 h-16 text-gray-300 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Not Available</h2>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            Live location features are only available for Street Food Vendors. Your current business type is {restaurantData?.businessType || "Fixed Restaurant"}.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden pb-24 md:pb-6">
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Live Location</h1>
      </div>

      {isOffline && (
        <div className="bg-red-50 p-2 flex items-center justify-center gap-2 text-red-600 text-xs font-bold border-b border-red-100">
          <WifiOff className="w-3.5 h-3.5" />
          <span>You are offline. Location updates are paused.</span>
        </div>
      )}

      <div className="p-4 space-y-4 max-w-2xl mx-auto mt-4">
        <Card className="bg-white border-none shadow-sm overflow-hidden rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${liveTrackingEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                  <h3 className="text-base font-bold text-gray-900">Live GPS Tracking</h3>
                </div>
                <p className="text-sm text-gray-500 leading-snug pr-4">
                  Automatically update your location as you move within your zone. 
                  Keep this on while moving to serve customers.
                </p>
              </div>
              <Switch
                checked={liveTrackingEnabled}
                onCheckedChange={handleToggleTracking}
                className="data-[state=checked]:bg-emerald-500 shrink-0 mt-1"
              />
            </div>
            
            {liveTrackingEnabled && (
              <div className="mt-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-medium flex items-start gap-2 border border-emerald-100">
                <Navigation className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Location tracking is active. Customers can see your real-time movement on the map.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Current Position</h3>
                <p className="text-sm text-gray-500">
                  {currentLocation 
                    ? `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`
                    : "No location data available"}
                </p>
              </div>
            </div>

            <button
              onClick={handleUpdateLocationManually}
              disabled={isUpdatingLocation || isOffline}
              className={`w-full py-3.5 text-sm font-bold rounded-xl transition-colors shadow-sm shadow-orange-200 
                ${(isUpdatingLocation || isOffline)
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed shadow-none" 
                  : "bg-orange-500 hover:bg-orange-600 text-white"}`}
            >
              Update Location Now
            </button>
            <p className="text-[11px] text-gray-400 text-center mt-3">
              {liveTrackingEnabled 
                ? "Manual updates override live tracking temporarily."
                : "Tap to pin your exact location manually when parked."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
