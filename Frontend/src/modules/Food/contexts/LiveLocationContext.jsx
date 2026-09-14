import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { restaurantAPI } from "@food/api"
import { useLocation as useFoodLocation } from "@food/hooks/useLocation"
import { getCurrentUser } from "@food/utils/auth"

const LiveLocationContext = createContext(null)

const MIN_MOVEMENT_METERS = 15
const MIN_TIME_MS = 10000
const OFFLINE_QUEUE_KEY = "vendor_offline_loc_queue"
const OFFLINE_QUEUE_TTL_MS = 30 * 60 * 1000

const distanceMeters = (lat1, lng1, lat2, lng2) => {
  if (![lat1, lng1, lat2, lng2].every((n) => Number.isFinite(n))) return Infinity
  const R = 6371000
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const extractRestaurantPayload = (response) =>
  response?.data?.data?.restaurant ||
  response?.data?.restaurant ||
  response?.data?.data?.user ||
  response?.data?.user ||
  response?.data?.data ||
  null

export const LiveLocationProvider = ({ children }) => {
  const { reverseGeocode } = useFoodLocation()
  const [restaurantData, setRestaurantData] = useState(null)
  const [liveTrackingEnabled, setLiveTrackingEnabled] = useState(false)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [lastLocationUpdate, setLastLocationUpdate] = useState(null)
  const [isOffline, setIsOffline] = useState(false)

  const watchIdRef = useRef(null)
  const lastSyncRef = useRef({ lat: null, lng: null, at: 0 })
  const restaurantIdRef = useRef(null)

  const queueOfflineLocation = useCallback((payload) => {
    try {
      const raw = sessionStorage.getItem(OFFLINE_QUEUE_KEY)
      const queue = raw ? JSON.parse(raw) : []
      queue.push({ ...payload, queuedAt: Date.now() })
      sessionStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue.slice(-20)))
    } catch {
      // sessionStorage unavailable — drop silently, next sync will pick up latest position anyway.
    }
  }, [])

  const flushOfflineQueue = useCallback(async () => {
    let queue = []
    try {
      const raw = sessionStorage.getItem(OFFLINE_QUEUE_KEY)
      queue = raw ? JSON.parse(raw) : []
    } catch {
      queue = []
    }
    if (!queue.length) return

    const fresh = queue.filter((item) => Date.now() - (item.queuedAt || 0) < OFFLINE_QUEUE_TTL_MS)
    const last = fresh[fresh.length - 1]
    sessionStorage.removeItem(OFFLINE_QUEUE_KEY)
    if (!last) return

    try {
      await restaurantAPI.updateLiveLocation(last.lat, last.lng, last.address)
    } catch {
      // Best-effort — next GPS tick will retry with a current position anyway.
    }
  }, [])

  const syncLocationToServer = useCallback(
    async (lat, lng, locationSource) => {
      let address = ""
      try {
        const geocoded = await reverseGeocode(lat, lng)
        address = geocoded?.formattedAddress || geocoded?.address || ""
      } catch {
        // Reverse geocoding is best-effort — location update still proceeds without an address.
      }

      try {
        await restaurantAPI.updateLiveLocation(lat, lng, address)
        setCurrentLocation({ latitude: lat, longitude: lng, formattedAddress: address, address })
        setLastLocationUpdate(new Date())
        setIsOffline(false)
        flushOfflineQueue()
      } catch (err) {
        const message = err?.response?.data?.message || ""
        if (err?.response?.status === 403 && /zone/i.test(message)) {
          toast.error(message || "You have moved outside your assigned zone. Live tracking stopped.")
          setLiveTrackingEnabled(false)
          if (watchIdRef.current != null) {
            navigator.geolocation.clearWatch(watchIdRef.current)
            watchIdRef.current = null
          }
          try {
            await restaurantAPI.updateLiveTrackingStatus(false)
          } catch {
            // Already stopping locally — a failed server sync isn't fatal here.
          }
          return
        }
        setIsOffline(true)
        queueOfflineLocation({ lat, lng, address, locationSource })
      }
    },
    [reverseGeocode, flushOfflineQueue, queueOfflineLocation],
  )

  const processNewLocation = useCallback(
    (position) => {
      const lat = position.coords.latitude
      const lng = position.coords.longitude
      const now = Date.now()

      const moved = distanceMeters(lastSyncRef.current.lat, lastSyncRef.current.lng, lat, lng)
      const elapsed = now - lastSyncRef.current.at
      if (lastSyncRef.current.at && moved < MIN_MOVEMENT_METERS && elapsed < MIN_TIME_MS) {
        return
      }

      lastSyncRef.current = { lat, lng, at: now }
      syncLocationToServer(lat, lng, "gps")
    },
    [syncLocationToServer],
  )

  const startGPSWatch = useCallback(() => {
    if (!navigator.geolocation || watchIdRef.current != null) return
    watchIdRef.current = navigator.geolocation.watchPosition(
      processNewLocation,
      (err) => {
        if (err?.code === err?.PERMISSION_DENIED) {
          toast.error("Location permission denied. Live tracking has been turned off.")
          setLiveTrackingEnabled(false)
          restaurantAPI.updateLiveTrackingStatus(false).catch(() => {})
          if (watchIdRef.current != null) {
            navigator.geolocation.clearWatch(watchIdRef.current)
            watchIdRef.current = null
          }
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    )
  }, [processNewLocation])

  const stopGPSWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const handleToggleTracking = useCallback(
    async (enabled) => {
      const previous = liveTrackingEnabled
      setLiveTrackingEnabled(enabled)
      try {
        await restaurantAPI.updateLiveTrackingStatus(enabled)
        if (enabled) startGPSWatch()
        else stopGPSWatch()
      } catch (err) {
        setLiveTrackingEnabled(previous)
        toast.error(err?.response?.data?.message || "Failed to update live tracking status")
      }
    },
    [liveTrackingEnabled, startGPSWatch, stopGPSWatch],
  )

  const handleUpdateLocationManually = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported on this device")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        syncLocationToServer(position.coords.latitude, position.coords.longitude, "manual")
      },
      () => toast.error("Unable to fetch current location"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }, [syncLocationToServer])

  const fetchRestaurantData = useCallback(async () => {
    try {
      const response = await restaurantAPI.getCurrentRestaurant()
      const data = extractRestaurantPayload(response)
      if (!data) return
      setRestaurantData(data)
      restaurantIdRef.current = data._id || data.id || null

      const isLive = Boolean(data.liveTrackingEnabled)
      setLiveTrackingEnabled(isLive)
      if (data.currentLocation) {
        setCurrentLocation(data.currentLocation)
      }
      if (data.lastLocationUpdate) {
        setLastLocationUpdate(new Date(data.lastLocationUpdate))
      }

      const isStreetFoodVendor =
        data.businessType === "Street Food Vendor" ||
        getCurrentUser("restaurant")?.businessType === "Street Food Vendor"
      if (isLive && isStreetFoodVendor) startGPSWatch()
    } catch {
      // Non-fatal — dashboard will simply show defaults until the next successful fetch.
    }
  }, [startGPSWatch])

  useEffect(() => {
    fetchRestaurantData()
    return () => stopGPSWatch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = {
    restaurantData,
    liveTrackingEnabled,
    currentLocation,
    lastLocationUpdate,
    isOffline,
    handleToggleTracking,
    handleUpdateLocationManually,
    refreshRestaurantData: fetchRestaurantData,
  }

  return <LiveLocationContext.Provider value={value}>{children}</LiveLocationContext.Provider>
}

export const useLiveLocation = () => {
  const ctx = useContext(LiveLocationContext)
  if (!ctx) {
    throw new Error("useLiveLocation must be used within a LiveLocationProvider")
  }
  return ctx
}
