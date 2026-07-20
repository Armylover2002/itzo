import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { restaurantAPI } from '@food/api';
import { writeRestaurantLocation } from '@food/realtimeTracking';
import { getCurrentUser } from '@food/utils/auth';
import { useLocation } from '@food/hooks/useLocation';

const LiveLocationContext = createContext(null);

// Haversine distance in metres
function getDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371e3;
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

export function LiveLocationProvider({ children }) {
  const [restaurantData, setRestaurantData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveTrackingEnabled, setLiveTrackingEnabled] = useState(false);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  const { reverseGeocode } = useLocation();

  const watchIdRef = useRef(null);
  const lastSentLocRef = useRef(null);
  const lastSentTimeRef = useRef(0);
  const authCheckIntervalRef = useRef(null);

  // ─── INIT ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchRestaurantData();

    const handleOnline = () => {
      setIsOffline(false);
      flushOfflineQueue();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('addressUpdated', fetchRestaurantData);

    // Periodically check if user is still logged in (to stop tracking on logout)
    authCheckIntervalRef.current = setInterval(() => {
      if (!getCurrentUser("restaurant")) {
        if (watchIdRef.current !== null) {
          stopGPSWatch();
        }
        setLiveTrackingEnabled(false);
        setRestaurantData(null);
      }
    }, 10000);

    return () => {
      stopGPSWatch();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('addressUpdated', fetchRestaurantData);
      if (authCheckIntervalRef.current) clearInterval(authCheckIntervalRef.current);
    };
  }, []);

  const fetchRestaurantData = async () => {
    try {
      setLoading(true);
      const response = await restaurantAPI.getCurrentRestaurant();
      const data = response?.data?.data?.restaurant || response?.data?.restaurant;
      if (data) {
        setRestaurantData(data);
        const isLive = data.liveTrackingEnabled === true;
        setLiveTrackingEnabled(isLive);

        if (data.currentLocation?.latitude && data.currentLocation?.longitude) {
          setCurrentLocation({
            latitude: Number(data.currentLocation.latitude),
            longitude: Number(data.currentLocation.longitude)
          });
        } else if (data.currentLocation?.coordinates?.length === 2) {
          setCurrentLocation({
            longitude: Number(data.currentLocation.coordinates[0]),
            latitude: Number(data.currentLocation.coordinates[1])
          });
        }

        // Auto-resume tracking if it was enabled in DB
        const isStreetFoodVendor = data.businessType === "Street Food Vendor" || 
                                   getCurrentUser("restaurant")?.businessType === "Street Food Vendor" || 
                                   (data.restaurantName || data.name || "").toLowerCase().includes("street food");

        if (isLive && isStreetFoodVendor) {
          startGPSWatch(data._id || data.id);
        }
      }
    } catch (error) {
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && error.response?.status !== 401) {
        console.error("Error fetching restaurant data for Live Location context:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── GPS & API SYNC ───────────────────────────────────────────────────
  const handleToggleTracking = async (enabled) => {
    if (!restaurantData) return;
    try {
      setLiveTrackingEnabled(enabled);
      await restaurantAPI.updateLiveTrackingStatus(enabled);
      toast.success(enabled ? "Live tracking started" : "Live tracking stopped");

      if (enabled) {
        startGPSWatch(restaurantData._id || restaurantData.id);
      } else {
        stopGPSWatch();
      }
    } catch (error) {
      setLiveTrackingEnabled(!enabled); // revert
      const errMsg = error.response?.data?.message || "Failed to update tracking status";
      toast.error(errMsg);
    }
  };

  const startGPSWatch = (restaurantId) => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported by your browser");
      setLiveTrackingEnabled(false);
      restaurantAPI.updateLiveTrackingStatus(false).catch(() => {});
      return;
    }

    if (watchIdRef.current !== null) return; // already watching

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation(prev => ({ ...prev, latitude, longitude }));
        
        let addressStr = "";
        try {
          const loc = await reverseGeocode(latitude, longitude);
          if (loc && loc.formattedAddress) {
            addressStr = loc.formattedAddress;
            setCurrentLocation(prev => ({
              latitude: prev?.latitude || latitude,
              longitude: prev?.longitude || longitude,
              address: loc.formattedAddress
            }));
          }
        } catch (err) {
          console.warn("LiveLocationContext reverse geocode failed:", err);
        }

        processNewLocation(latitude, longitude, restaurantId, addressStr);
      },
      (error) => {
        console.error("Error watching location:", error);
        if (error.code === 1) { // PERMISSION_DENIED
          toast.error("Location permission denied. Please enable GPS in browser settings.", { duration: 5000 });
          handleToggleTracking(false); // Auto turn off
        } else if (error.code === 2) { // POSITION_UNAVAILABLE
          toast.error("GPS signal unavailable. Trying to reconnect...", { id: 'gps-warn' });
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  };

  const stopGPSWatch = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const processNewLocation = async (lat, lng, restaurantId, address) => {
    const now = Date.now();
    
    // Throttling (10s max)
    if (now - lastSentTimeRef.current < MIN_TIME_MS) {
      return; 
    }

    // Movement threshold (15m)
    // BYPASS threshold if we have an address but the backend is missing it
    const hasMissingAddress = address && !restaurantData?.currentLocation?.formattedAddress;
    
    if (lastSentLocRef.current && !hasMissingAddress) {
      const dist = getDistance(lastSentLocRef.current.lat, lastSentLocRef.current.lng, lat, lng);
      if (dist < MIN_MOVEMENT_METERS) {
        return; 
      }
    }

    // If offline, queue it and return
    if (!navigator.onLine) {
      queueOfflineLocation(lat, lng, address);
      return;
    }

    await syncLocationToServer(lat, lng, restaurantId, address);
  };

  const syncLocationToServer = async (lat, lng, restaurantId, address) => {
    if (isUpdatingLocation) return;
    try {
      setIsUpdatingLocation(true);
      
      // 1. Send to Backend API
      await restaurantAPI.updateLiveLocation(lat, lng, address);
      
      // 2. Fast-path write to Firebase RTDB for customers
      if (restaurantId) {
        writeRestaurantLocation(restaurantId, { lat, lng, isLive: true, locationSource: 'gps' })
          .catch(err => console.warn("Firebase RTDB fast-path write failed:", err));
      }

      // Success! Update refs
      lastSentLocRef.current = { lat, lng };
      lastSentTimeRef.current = Date.now();

    } catch (error) {
      const status = error.response?.status;
      const errMsg = error.response?.data?.message || "Failed to update location";
      
      if (status === 403 && errMsg.toLowerCase().includes('zone')) {
        // ZONE EXIT ALERT!
        toast.error(`⚠️ ${errMsg}`, { duration: 6000 });
        handleToggleTracking(false); // force stop tracking
      } else if (error.code === 'ERR_NETWORK' || status === 429) {
        // Queue if network error or rate limited
        queueOfflineLocation(lat, lng);
      } else if (status !== 401) {
        console.error("GPS Sync Error:", errMsg);
      }
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  // ─── OFFLINE QUEUE ────────────────────────────────────────────────────
  const queueOfflineLocation = (lat, lng, address) => {
    try {
      sessionStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify({ lat, lng, address, ts: Date.now() }));
    } catch (e) {
      // ignore quota errors
    }
  };

  const flushOfflineQueue = async () => {
    if (!restaurantData) return;
    try {
      const stored = sessionStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!stored) return;
      const { lat, lng, address, ts } = JSON.parse(stored);
      
      // Only flush if it's less than 30 mins old
      if (Date.now() - ts < 30 * 60 * 1000) {
        await syncLocationToServer(lat, lng, restaurantData._id || restaurantData.id, address);
      }
      sessionStorage.removeItem(OFFLINE_QUEUE_KEY);
    } catch (e) {
      sessionStorage.removeItem(OFFLINE_QUEUE_KEY);
    }
  };

  // ─── MANUAL UPDATE (Fallback) ─────────────────────────────────────────
  const handleUpdateLocationManually = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    
    toast.loading("Fetching exact location...", { id: "gps-fetch" });
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        toast.dismiss("gps-fetch");
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ latitude, longitude });
        
        toast.loading("Updating location...", { id: "gps-update" });
        try {
          // Manual updates become truth instantly
          await restaurantAPI.updateLiveLocation(latitude, longitude);
          
          if (restaurantData) {
            writeRestaurantLocation(restaurantData._id || restaurantData.id, { 
              lat: latitude, lng: longitude, isLive: liveTrackingEnabled, locationSource: 'manual' 
            }).catch(()=>{});
          }

          lastSentLocRef.current = { lat: latitude, lng: longitude };
          lastSentTimeRef.current = Date.now();

          toast.success("Location updated successfully", { id: "gps-update" });
        } catch (error) {
          const errMsg = error.response?.data?.message || "Failed to update location";
          toast.error(errMsg, { id: "gps-update" });
        }
      },
      (error) => {
        toast.dismiss("gps-fetch");
        if (error.code === 1) toast.error("Location permission denied.");
        else toast.error("Failed to get location");
      },
      { enableHighAccuracy: true }
    );
  };

  const value = {
    restaurantData,
    loading,
    liveTrackingEnabled,
    isUpdatingLocation,
    currentLocation,
    isOffline,
    handleToggleTracking,
    handleUpdateLocationManually,
    refreshLocationData: fetchRestaurantData // Allows components to force a re-fetch
  };

  return (
    <LiveLocationContext.Provider value={value}>
      {children}
    </LiveLocationContext.Provider>
  );
}

export function useLiveLocation() {
  const context = useContext(LiveLocationContext);
  if (!context) {
    throw new Error('useLiveLocation must be used within a LiveLocationProvider');
  }
  return context;
}
