import React, { useEffect, useState, useRef, useMemo, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleMap, useJsApiLoader, Marker, Polyline } from "@react-google-maps/api";
import {
  MapPin,
  Navigation,
  Phone,
  MessageSquare,
  Shield,
  Clock,
  Star,
  Search,
  Loader2,
} from "lucide-react";
import customerPin from "@/assets/customer-pin.png";
import deliveryIcon from "@/assets/deliveryIcon.png";
import storePin from "@/assets/store-pin.png";

const libraries = ["geometry"];

const containerStyle = {
  width: "100%",
  height: "100%",
  minHeight: "350px",
};
const RECENTER_INTERVAL_MS = 15000;
const RIDER_FOCUS_RADIUS_M = 500;

/** Delivery / rider search — not the same as waiting for seller acceptance */
const SEARCHING_STATUSES = [
  "pending",
  "confirmed",
  "delivery_search",
  "DELIVERY_SEARCH",
  "seller_accepted",
  "SELLER_ACCEPTED",
  "created",
  "CREATED",
];

function hasValidLatLng(location) {
  return (
    location &&
    typeof location.lat === "number" &&
    typeof location.lng === "number" &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng)
  );
}

const LiveTrackingMap = memo(({
  status = "out for delivery",
  eta = "8 mins",
  riderName = "Ramesh Kumar",
  riderLocation,
  sellerLocation,
  destinationLocation,
  routePhase = "pickup",
  routePolyline,
  onOpenInMaps,
}) => {
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const isSearching = SEARCHING_STATUSES.includes(status?.toLowerCase());
  const [progress, setProgress] = useState(0);
  const [dots, setDots] = useState("");

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  const { isLoaded, loadError } = useJsApiLoader({
    id: "customer-tracking-map",
    googleMapsApiKey: apiKey,
    libraries,
  });

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    setMapInstance(map);
  }, []);

  const focusOnRider500m = useCallback((map, rider) => {
    if (!map || !window.google || !hasValidLatLng(rider)) return;
    const center = new window.google.maps.LatLng(rider.lat, rider.lng);
    const bounds = new window.google.maps.LatLngBounds();
    const offsets = [0, 90, 180, 270];
    offsets.forEach((heading) => {
      const point = window.google.maps.geometry.spherical.computeOffset(
        center,
        RIDER_FOCUS_RADIUS_M,
        heading,
      );
      bounds.extend(point);
    });
    map.fitBounds(bounds, 24);
  }, []);

  const activeTargetLocation = routePhase === "delivery" ? destinationLocation : sellerLocation;
  const shouldShowStoreMarker =
    routePhase === "pickup" && hasValidLatLng(sellerLocation);
  const shouldShowCustomerMarker =
    routePhase === "delivery" && hasValidLatLng(destinationLocation);

  // Decode polyline from Firebase
  const decodedPath = useMemo(() => {
    if (!routePolyline?.polyline || !isLoaded || !window.google?.maps?.geometry?.encoding) {
      if (routePolyline && !routePolyline.polyline) {
        console.log("[LiveTrackingMap] Route data exists but no polyline:", routePolyline);
      }
      return null;
    }
    try {
      const decoded = window.google.maps.geometry.encoding.decodePath(routePolyline.polyline);
      console.log(`[LiveTrackingMap] ✓ Decoded polyline with ${decoded.length} points`);
      return decoded;
    } catch (err) {
      console.error("[LiveTrackingMap] Error decoding polyline:", err);
      return null;
    }
  }, [routePolyline, isLoaded]);

  const riderMarkerIcon = useMemo(() => {
    if (!isLoaded || !window.google?.maps) return undefined;

    return {
      url: deliveryIcon,
      scaledSize: new window.google.maps.Size(44, 64),
      anchor: new window.google.maps.Point(22, 64),
    };
  }, [isLoaded]);

  const customerMarkerIcon = useMemo(() => {
    if (!isLoaded || !window.google?.maps) return undefined;

    return {
      url: customerPin,
      scaledSize: new window.google.maps.Size(40, 40),
      anchor: new window.google.maps.Point(20, 40),
    };
  }, [isLoaded]);

  const storeMarkerIcon = useMemo(() => {
    if (!isLoaded || !window.google?.maps) return undefined;

    return {
      url: storePin,
      scaledSize: new window.google.maps.Size(40, 40),
      anchor: new window.google.maps.Point(20, 40),
    };
  }, [isLoaded]);

  // Calculate map center and bounds
  const mapCenter = useMemo(() => {
    if (riderLocation) return riderLocation;
    if (hasValidLatLng(activeTargetLocation)) return activeTargetLocation;
    return { lat: 20.5937, lng: 78.9629 };
  }, [activeTargetLocation, riderLocation]);

  // Fit bounds when locations or route change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;

    if (hasValidLatLng(riderLocation)) {
      focusOnRider500m(map, riderLocation);
      return;
    }
    
    try {
      const bounds = new window.google.maps.LatLngBounds();
      let hasPoints = false;
      
      // Add route points if available
      if (decodedPath && decodedPath.length > 0) {
        decodedPath.forEach((point) => bounds.extend(point));
        hasPoints = true;
      } else {
        // Fallback to rider and current phase destination
        if (riderLocation) {
          bounds.extend(riderLocation);
          hasPoints = true;
        }
        if (hasValidLatLng(activeTargetLocation)) {
          bounds.extend(activeTargetLocation);
          hasPoints = true;
        }
      }
      
      if (hasPoints) {
        map.fitBounds(bounds, 60);
      }
    } catch (err) {
      console.error("Error fitting bounds:", err);
    }
  }, [activeTargetLocation, riderLocation, decodedPath, focusOnRider500m]);

  // Keep rider centered during live tracking with a smooth map pan.
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !hasValidLatLng(riderLocation)) return undefined;

    const intervalId = setInterval(() => {
      const map = mapRef.current;
      if (!map || !hasValidLatLng(riderLocation)) return;
      map.panTo(riderLocation);
      focusOnRider500m(map, riderLocation);
    }, RECENTER_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isLoaded, riderLocation?.lat, riderLocation?.lng, focusOnRider500m]);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev + 0.5) % 100);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isSearching) return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [isSearching]);

  const norm = status?.toLowerCase?.() || "";
  if (norm === "cancelled" || norm === "canceled") {
    return (
      <div className="relative w-full min-h-[220px] bg-gradient-to-br from-slate-100 to-slate-50 overflow-hidden rounded-b-[2rem] flex flex-col items-center justify-center gap-3 px-6 py-10 border-b border-slate-200">
        <div className="h-14 w-14 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
          <Clock size={28} />
        </div>
        <h3 className="text-lg font-black text-slate-800 text-center">
          Order cancelled
        </h3>
        <p className="text-sm text-slate-500 text-center max-w-sm font-medium">
          This order is closed. If payment was reserved, any applicable refund
          follows your store policy.
        </p>
      </div>
    );
  }

  if (norm === "seller_pending") {
    return (
      <div className="relative w-full min-h-[260px] bg-gradient-to-br from-[#f0faf4] to-[#e8f5e9] overflow-hidden rounded-b-[2rem] flex flex-col items-center justify-center gap-3 px-6 py-10 border-b border-emerald-100">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="h-16 w-16 bg-[#FE5502] rounded-full flex items-center justify-center shadow-lg shadow-green-200">
          <Clock size={30} className="text-white" />
        </motion.div>
        <h3 className="text-lg font-black text-gray-800 text-center">
          Waiting for seller to accept
        </h3>
        <p className="text-sm text-gray-500 text-center max-w-sm font-medium">
          The store has up to 60 seconds to confirm. If they don&apos;t, your
          order will be cancelled automatically.
        </p>
      </div>
    );
  }

  // ─── SEARCHING STATE ───────────────────────────────────────────────────
  if (isSearching) {
    return (
      <div className="relative w-full h-[320px] bg-gradient-to-br from-[#f0faf4] to-[#e8f5e9] overflow-hidden rounded-b-[2rem] flex flex-col items-center justify-center gap-4">
        {/* Animated radar rings */}
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border-2 border-[#FE5502]/20"
            initial={{ width: 60, height: 60, opacity: 0.8 }}
            animate={{ width: 60 + i * 70, height: 60 + i * 70, opacity: 0 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.5,
              ease: "easeOut",
            }}
          />
        ))}

        {/* Center dot */}
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="relative z-10 h-16 w-16 bg-[#FE5502] rounded-full flex items-center justify-center shadow-xl shadow-green-200">
          <Search size={28} className="text-white" />
        </motion.div>

        {/* Text */}
        <div className="relative z-10 text-center px-6">
          <h3 className="text-lg font-black text-gray-800">
            Searching for delivery partner{dots}
          </h3>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Hang tight! We're finding the best rider near you.
          </p>
        </div>

        {/* Status pill */}
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="relative z-10 bg-white px-4 py-2 rounded-full shadow-md border border-green-100 flex items-center gap-2">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
            {status === "confirmed"
              ? "Order Confirmed · Assigning Rider"
              : "Order Placed · Finding Rider"}
          </span>
        </motion.div>
      </div>
    );
  }

  // ─── LIVE TRACKING STATE ───────────────────────────────────────────────
  
  // If Google Maps is not loaded or no API key
  if (!apiKey) {
    return (
      <div className="relative w-full h-[350px] bg-slate-100 rounded-b-[2rem] flex items-center justify-center text-center px-4">
        <p className="text-xs text-slate-500">
          Set <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> to show live tracking.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="relative w-full h-[350px] bg-rose-50 rounded-b-[2rem] flex items-center justify-center text-xs text-rose-700 px-4">
        Map failed to load. Check the API key and billing.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="relative w-full h-[350px] bg-slate-50 rounded-b-[2rem] flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-600" size={28} />
      </div>
    );
  }

  return (
    <div className="relative w-full h-[350px] bg-[#E5E3DF] overflow-hidden rounded-b-[2rem] shadow-md border-b border-gray-200">
      {/* Google Map */}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={14}
        onLoad={onMapLoad}
        options={{
          disableDefaultUI: true,
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        }}
      >
        {/* Rider Location Marker */}
        {riderLocation && (
          <Marker
            position={riderLocation}
            title="Delivery Partner"
            icon={riderMarkerIcon}
          />
        )}

        {/* Store Marker */}
        {shouldShowStoreMarker && (
          <Marker
            position={sellerLocation}
            title="Store Location"
            icon={storeMarkerIcon}
          />
        )}

        {/* Destination Marker */}
        {shouldShowCustomerMarker && (
          <Marker
            position={destinationLocation}
            title="Your Location"
            icon={customerMarkerIcon}
          />
        )}

        {/* Line connecting rider to destination - use cached polyline if available */}
        {decodedPath && decodedPath.length > 0 ? (
          <Polyline
            path={decodedPath}
            options={{
              strokeColor: "#FE5502",
              strokeOpacity: 0.8,
              strokeWeight: 4,
              geodesic: false,
            }}
          />
        ) : riderLocation && hasValidLatLng(activeTargetLocation) ? (
          <Polyline
            path={[riderLocation, activeTargetLocation]}
            options={{
              strokeColor: "#FE5502",
              strokeOpacity: 0.6,
              strokeWeight: 3,
              geodesic: true,
            }}
          />
        ) : null}
      </GoogleMap>

      {/* 3. Floating Overlay Cards */}
      <div className="absolute top-4 left-4 right-4 z-40 flex justify-between items-start">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white/90 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-white/50 flex items-center gap-3">
          <div className="h-10 w-10 bg-green-50 rounded-xl flex items-center justify-center text-[#FE5502]">
            <Clock size={20} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Arriving in
            </p>
            <h2 className="text-xl font-black text-gray-900 leading-none">
              {eta}
            </h2>
          </div>
        </motion.div>
        <button
          type="button"
          className="bg-white/90 backdrop-blur-md rounded-full px-3 py-2 shadow-lg border border-white/50 cursor-pointer hover:bg-white transition-colors flex items-center gap-1.5 text-[10px] font-bold text-slate-700"
          onClick={() => {
            if (typeof onOpenInMaps === "function") {
              onOpenInMaps({ riderLocation, destinationLocation });
            }
          }}
        >
          <MapPin size={14} className="text-[#FE5502]" />
          Open in Maps
        </button>
      </div>

      {/* 4. Rider Info Card (Compact Bottom) */}
      {riderName && (
        <div className="absolute bottom-2 left-2 right-2 z-40">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-white/50">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-10 w-10 rounded-full bg-gray-100 overflow-hidden border-2 border-white shadow-sm">
                  <img
                    src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&auto=format&fit=crop&q=60"
                    alt="Rider"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 bg-[#FE5502] text-white text-[7px] font-bold px-1 py-0.5 rounded-full flex items-center gap-0.5">
                  4.8 <Star size={5} fill="white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-xs truncate">{riderName}</h3>
                <p className="text-[10px] text-gray-500 flex items-center gap-1">
                  <Shield size={8} />
                  Vaccinated
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button className="h-8 w-8 rounded-full bg-green-50 flex items-center justify-center text-[#FE5502] hover:bg-green-100 transition-colors">
                  <Phone size={14} />
                </button>
                <button className="h-8 w-8 rounded-full bg-orange-50 flex items-center justify-center text-primary hover:bg-orange-100 transition-colors">
                  <MessageSquare size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Location status indicator */}
      {!riderLocation && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-amber-50/95 text-amber-900 text-xs px-3 py-2 rounded-lg border border-amber-200 shadow-sm">
          Waiting for rider location...
        </div>
      )}

      {/* Route cache indicator */}
      {routePolyline && (
        <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur px-2 py-1 rounded-md text-[10px] text-slate-600 font-bold border border-slate-200 shadow-sm">
          Route cached • Reduced API cost
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo
  // Only re-render if these props actually change
  return (
    prevProps.status === nextProps.status &&
    prevProps.eta === nextProps.eta &&
    prevProps.riderName === nextProps.riderName &&
    prevProps.riderLocation?.lat === nextProps.riderLocation?.lat &&
    prevProps.riderLocation?.lng === nextProps.riderLocation?.lng &&
    prevProps.sellerLocation?.lat === nextProps.sellerLocation?.lat &&
    prevProps.sellerLocation?.lng === nextProps.sellerLocation?.lng &&
    prevProps.destinationLocation?.lat === nextProps.destinationLocation?.lat &&
    prevProps.destinationLocation?.lng === nextProps.destinationLocation?.lng &&
    prevProps.routePhase === nextProps.routePhase &&
    prevProps.routePolyline?.phase === nextProps.routePolyline?.phase &&
    prevProps.routePolyline?.polyline === nextProps.routePolyline?.polyline &&
    prevProps.routePolyline?.cachedAt === nextProps.routePolyline?.cachedAt
  );
});

LiveTrackingMap.displayName = 'LiveTrackingMap';

export default LiveTrackingMap;
