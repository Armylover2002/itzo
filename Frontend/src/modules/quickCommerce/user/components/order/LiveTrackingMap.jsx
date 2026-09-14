import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";
import { motion } from "framer-motion";
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

// ─── Constants ────────────────────────────────────────────────────────────────
const libraries = ["geometry"];

const containerStyle = { width: "100%", height: "100%", minHeight: "350px" };

const RECENTER_INTERVAL_MS = 15000;
const RIDER_FOCUS_RADIUS_M = 500;
const RADAR_RINGS = [1, 2, 3]; // Static array — avoids recreation every render

const SEARCHING_STATUSES = new Set([
  "pending",
  "confirmed",
  "delivery_search",
  "DELIVERY_SEARCH",
  "seller_accepted",
  "SELLER_ACCEPTED",
  "created",
  "CREATED",
]);

// ─── Map options (defined once outside component — no allocation per render) ──
const MAP_OPTIONS = {
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
};

// ─── Polyline options (defined once outside component) ────────────────────────
const ROUTE_POLYLINE_OPTIONS = {
  strokeColor: "#0c831f",
  strokeOpacity: 0.8,
  strokeWeight: 4,
  geodesic: false,
};

const FALLBACK_POLYLINE_OPTIONS = {
  strokeColor: "#0c831f",
  strokeOpacity: 0.6,
  strokeWeight: 3,
  geodesic: true,
};

// ─── Default map center (India centroid) ──────────────────────────────────────
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };

// ─── Pure helper (no closure deps — safe to define outside component) ─────────
function hasValidLatLng(location) {
  return (
    location &&
    typeof location.lat === "number" &&
    typeof location.lng === "number" &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng)
  );
}

// ─── Sub-components (extracted to avoid inline JSX recreation) ────────────────

const CancelledState = () => (
  <div className="relative w-full min-h-[220px] bg-gradient-to-br from-slate-100 to-slate-50 overflow-hidden rounded-b-[2rem] flex flex-col items-center justify-center gap-3 px-6 py-10 border-b border-slate-200">
    <div className="h-14 w-14 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
      <Clock size={28} />
    </div>
    <h3 className="text-lg font-black text-slate-800 text-center">Order cancelled</h3>
    <p className="text-sm text-slate-500 text-center max-w-sm font-medium">
      This order is closed. If payment was reserved, any applicable refund follows your store
      policy.
    </p>
  </div>
);

const SellerPendingState = () => (
  <div className="relative w-full min-h-[260px] bg-gradient-to-br from-[#f0faf4] to-[#e8f5e9] overflow-hidden rounded-b-[2rem] flex flex-col items-center justify-center gap-3 px-6 py-10 border-b border-emerald-100">
    <motion.div
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 2, repeat: Infinity }}
      className="h-16 w-16 bg-[#0c831f] rounded-full flex items-center justify-center shadow-lg shadow-green-200"
    >
      <Clock size={30} className="text-white" />
    </motion.div>
    <h3 className="text-lg font-black text-gray-800 text-center">
      Waiting for seller to accept
    </h3>
    <p className="text-sm text-gray-500 text-center max-w-sm font-medium">
      The store has up to 60 seconds to confirm. If they don&apos;t, your order will be cancelled
      automatically.
    </p>
  </div>
);

// Dots animation extracted — avoids re-rendering parent for dot changes
const SearchingDots = () => {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const id = setInterval(
      () => setDots((prev) => (prev.length >= 3 ? "" : prev + ".")),
      500,
    );
    return () => clearInterval(id);
  }, []);
  return <>{dots}</>;
};

const SearchingState = ({ status }) => (
  <div className="relative w-full h-[320px] bg-gradient-to-br from-[#f0faf4] to-[#e8f5e9] overflow-hidden rounded-b-[2rem] flex flex-col items-center justify-center gap-4">
    {RADAR_RINGS.map((i) => (
      <motion.div
        key={i}
        className="absolute rounded-full border-2 border-[#0c831f]/20"
        initial={{ width: 60, height: 60, opacity: 0.8 }}
        animate={{ width: 60 + i * 70, height: 60 + i * 70, opacity: 0 }}
        transition={{ duration: 2, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
      />
    ))}
    <motion.div
      animate={{ scale: [1, 1.1, 1] }}
      transition={{ duration: 1.5, repeat: Infinity }}
      className="relative z-10 h-16 w-16 bg-[#0c831f] rounded-full flex items-center justify-center shadow-xl shadow-green-200"
    >
      <Search size={28} className="text-white" />
    </motion.div>
    <div className="relative z-10 text-center px-6">
      <h3 className="text-lg font-black text-gray-800">
        Searching for delivery partner
        <SearchingDots />
      </h3>
      <p className="text-sm text-gray-500 mt-1 font-medium">
        Hang tight! We're finding the best rider near you.
      </p>
    </div>
    <motion.div
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 2, repeat: Infinity }}
      className="relative z-10 bg-white px-4 py-2 rounded-full shadow-md border border-green-100 flex items-center gap-2"
    >
      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
      <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
        {status === "confirmed"
          ? "Order Confirmed · Assigning Rider"
          : "Order Placed · Finding Rider"}
      </span>
    </motion.div>
  </div>
);

// ─── ETA overlay — memoized separately so rider-location updates don't re-render it ──
const EtaCard = memo(({ eta, onOpenInMaps, riderLocation, destinationLocation }) => (
  <div className="absolute top-4 left-4 right-4 z-40 flex justify-between items-start">
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-white/90 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-white/50 flex items-center gap-3"
    >
      <div className="h-10 w-10 bg-green-50 rounded-xl flex items-center justify-center text-[#0c831f]">
        <Clock size={20} strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
          Arriving in
        </p>
        <h2 className="text-xl font-black text-gray-900 leading-none">{eta}</h2>
      </div>
    </motion.div>
    <button
      type="button"
      className="bg-white/90 backdrop-blur-md rounded-full px-3 py-2 shadow-lg border border-white/50 cursor-pointer hover:bg-white transition-colors flex items-center gap-1.5 text-[10px] font-bold text-slate-700"
      onClick={() => onOpenInMaps?.({ riderLocation, destinationLocation })}
    >
      <MapPin size={14} className="text-[#0c831f]" />
      Open in Maps
    </button>
  </div>
));
EtaCard.displayName = "EtaCard";

// ─── Rider info card — memoized separately ────────────────────────────────────
const RiderCard = memo(({ riderName }) => (
  <div className="absolute bottom-2 left-2 right-2 z-40">
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-white/50"
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="h-10 w-10 rounded-full bg-gray-100 overflow-hidden border-2 border-white shadow-sm">
            <img
              src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&auto=format&fit=crop&q=60"
              alt="Rider"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 bg-[#0c831f] text-white text-[7px] font-bold px-1 py-0.5 rounded-full flex items-center gap-0.5">
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
          <button className="h-8 w-8 rounded-full bg-green-50 flex items-center justify-center text-[#0c831f] hover:bg-green-100 transition-colors">
            <Phone size={14} />
          </button>
          <button className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors">
            <MessageSquare size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  </div>
));
RiderCard.displayName = "RiderCard";

// ─── Main Component ───────────────────────────────────────────────────────────
const LiveTrackingMap = memo(
  ({
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
    // Removed unused `mapInstance` state — was set but never read
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

    const norm = status?.toLowerCase?.() ?? "";
    const isSearching = SEARCHING_STATUSES.has(norm); // O(1) Set lookup vs O(n) Array.includes

    const { isLoaded, loadError } = useJsApiLoader({
      id: "customer-tracking-map",
      googleMapsApiKey: apiKey,
      libraries, // stable reference — defined outside component
    });

    // ── Derived booleans ───────────────────────────────────────────────────
    const shouldShowStoreMarker =
      routePhase === "pickup" && hasValidLatLng(sellerLocation);
    const shouldShowCustomerMarker =
      routePhase === "delivery" && hasValidLatLng(destinationLocation);

    const activeTargetLocation =
      routePhase === "delivery" ? destinationLocation : sellerLocation;

    // ── Map icon memos ─────────────────────────────────────────────────────
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

    // ── Map center ─────────────────────────────────────────────────────────
    const mapCenter = useMemo(() => {
      if (hasValidLatLng(riderLocation)) return riderLocation;
      if (hasValidLatLng(activeTargetLocation)) return activeTargetLocation;
      return DEFAULT_CENTER;
    }, [
      // Primitive deps — prevents stale equality checks on object references
      riderLocation?.lat,
      riderLocation?.lng,
      activeTargetLocation?.lat,
      activeTargetLocation?.lng,
    ]);

    // ── Polyline decode ────────────────────────────────────────────────────
    const decodedPath = useMemo(() => {
      if (!routePolyline?.polyline || !isLoaded || !window.google?.maps?.geometry?.encoding) {
        return null;
      }
      try {
        const decoded = window.google.maps.geometry.encoding.decodePath(
          routePolyline.polyline,
        );
        return decoded;
      } catch (err) {
        console.error("[LiveTrackingMap] Error decoding polyline:", err);
        return null;
      }
    }, [routePolyline?.polyline, isLoaded]); // only re-decode when polyline string changes

    // ── focusOnRider — stable callback ─────────────────────────────────────
    const focusOnRider500m = useCallback((map, rider) => {
      if (!map || !window.google || !hasValidLatLng(rider)) return;
      const center = new window.google.maps.LatLng(rider.lat, rider.lng);
      const bounds = new window.google.maps.LatLngBounds();
      [0, 90, 180, 270].forEach((heading) => {
        bounds.extend(
          window.google.maps.geometry.spherical.computeOffset(
            center,
            RIDER_FOCUS_RADIUS_M,
            heading,
          ),
        );
      });
      map.fitBounds(bounds, 24);
    }, []); // no deps — uses only stable globals

    // ── onMapLoad ─────────────────────────────────────────────────────────
    const onMapLoad = useCallback((map) => {
      mapRef.current = map;
    }, []);

    // ── Fit bounds on location / route change ──────────────────────────────
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

        if (decodedPath?.length) {
          decodedPath.forEach((point) => bounds.extend(point));
          hasPoints = true;
        } else {
          if (hasValidLatLng(riderLocation)) {
            bounds.extend(riderLocation);
            hasPoints = true;
          }
          if (hasValidLatLng(activeTargetLocation)) {
            bounds.extend(activeTargetLocation);
            hasPoints = true;
          }
        }

        if (hasPoints) map.fitBounds(bounds, 60);
      } catch (err) {
        console.error("Error fitting bounds:", err);
      }
    }, [
      riderLocation?.lat,
      riderLocation?.lng,
      activeTargetLocation?.lat,
      activeTargetLocation?.lng,
      decodedPath,
      focusOnRider500m,
    ]);

    // ── Periodic re-center on rider ────────────────────────────────────────
    useEffect(() => {
      if (!isLoaded || !hasValidLatLng(riderLocation)) return;

      const id = setInterval(() => {
        const map = mapRef.current;
        if (!map || !hasValidLatLng(riderLocation)) return;
        map.panTo(riderLocation);
        focusOnRider500m(map, riderLocation);
      }, RECENTER_INTERVAL_MS);

      return () => clearInterval(id);
    }, [isLoaded, riderLocation?.lat, riderLocation?.lng, focusOnRider500m]);

    // ─── Fallback polyline path — memoized to avoid array recreation ───────
    const fallbackPolylinePath = useMemo(() => {
      if (!riderLocation || !hasValidLatLng(activeTargetLocation)) return null;
      return [riderLocation, activeTargetLocation];
    }, [
      riderLocation?.lat,
      riderLocation?.lng,
      activeTargetLocation?.lat,
      activeTargetLocation?.lng,
    ]);

    // ─── Early returns for non-map states ─────────────────────────────────
    if (norm === "cancelled" || norm === "canceled") return <CancelledState />;
    if (norm === "seller_pending") return <SellerPendingState />;
    if (isSearching) return <SearchingState status={status} />;

    // ─── API key / load guards ─────────────────────────────────────────────
    if (!apiKey) {
      return (
        <div className="relative w-full h-[350px] bg-slate-100 rounded-b-[2rem] flex items-center justify-center text-center px-4">
          <p className="text-xs text-slate-500">
            Set <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> to show live
            tracking.
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

    // ─── Live tracking map ─────────────────────────────────────────────────
    return (
      <div className="relative w-full h-[350px] bg-[#E5E3DF] overflow-hidden rounded-b-[2rem] shadow-md border-b border-gray-200">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={mapCenter}
          zoom={14}
          onLoad={onMapLoad}
          options={MAP_OPTIONS} // stable reference — no new object per render
        >
          {riderLocation && (
            <Marker position={riderLocation} title="Delivery Partner" icon={riderMarkerIcon} />
          )}

          {shouldShowStoreMarker && (
            <Marker position={sellerLocation} title="Store Location" icon={storeMarkerIcon} />
          )}

          {shouldShowCustomerMarker && (
            <Marker
              position={destinationLocation}
              title="Your Location"
              icon={customerMarkerIcon}
            />
          )}

          {decodedPath?.length ? (
            <Polyline path={decodedPath} options={ROUTE_POLYLINE_OPTIONS} />
          ) : fallbackPolylinePath ? (
            <Polyline path={fallbackPolylinePath} options={FALLBACK_POLYLINE_OPTIONS} />
          ) : null}
        </GoogleMap>

        <EtaCard
          eta={eta}
          onOpenInMaps={onOpenInMaps}
          riderLocation={riderLocation}
          destinationLocation={destinationLocation}
        />

        {riderName && <RiderCard riderName={riderName} />}

        {!riderLocation && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-amber-50/95 text-amber-900 text-xs px-3 py-2 rounded-lg border border-amber-200 shadow-sm">
            Waiting for rider location...
          </div>
        )}

        {routePolyline && (
          <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur px-2 py-1 rounded-md text-[10px] text-slate-600 font-bold border border-slate-200 shadow-sm">
            Route cached • Reduced API cost
          </div>
        )}
      </div>
    );
  },
  // ── Custom memo comparator ─────────────────────────────────────────────────
  (prev, next) =>
    prev.status === next.status &&
    prev.eta === next.eta &&
    prev.riderName === next.riderName &&
    prev.riderLocation?.lat === next.riderLocation?.lat &&
    prev.riderLocation?.lng === next.riderLocation?.lng &&
    prev.sellerLocation?.lat === next.sellerLocation?.lat &&
    prev.sellerLocation?.lng === next.sellerLocation?.lng &&
    prev.destinationLocation?.lat === next.destinationLocation?.lat &&
    prev.destinationLocation?.lng === next.destinationLocation?.lng &&
    prev.routePhase === next.routePhase &&
    prev.routePolyline?.phase === next.routePolyline?.phase &&
    prev.routePolyline?.polyline === next.routePolyline?.polyline &&
    prev.routePolyline?.cachedAt === next.routePolyline?.cachedAt,
);

LiveTrackingMap.displayName = "LiveTrackingMap";

export default LiveTrackingMap;