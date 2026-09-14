import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { X, Search, MapPin, Plus, Home } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "../../context/LocationContext";
import { loadGoogleMaps } from "@core/services/googleMapsLoader";
import { toast } from "sonner";

// ─── Constants (module-level, not re-created on each render) ─────────────────
const MIN_QUERY_LENGTH = 4;
const SEARCH_DEBOUNCE_MS = 450;
const MAX_SUGGESTIONS = 5;
const COMPONENT_TYPES = {
  city: ["locality"],
  state: ["administrative_area_level_1"],
  pincode: ["postal_code"],
};

// ─── Backdrop & Drawer animation variants (stable references) ────────────────
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};
const drawerVariants = {
  hidden: { y: "100%" },
  visible: { y: 0 },
};
const drawerTransition = { type: "spring", damping: 25, stiffness: 200 };

// ─── Pure helper (no closure deps) ───────────────────────────────────────────
function getComponent(components, types) {
  return components?.find((c) => types.every((t) => c.types.includes(t)))
    ?.long_name;
}

// ─── Sub-components (stable, no anonymous inline functions in JSX) ────────────
const CurrentLocationButton = React.memo(({ name, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-4 bg-gray-50 dark:bg-slate-900/50 p-4 rounded-2xl text-left w-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
  >
    <MapPin className="text-green-600" size={24} />
    <div className="flex-1">
      <h3 className="font-bold text-green-600 dark:text-emerald-500">
        Use current location
      </h3>
      <p className="text-sm text-gray-500 dark:text-slate-400 truncate">{name}</p>
    </div>
  </button>
));

const AddAddressButton = React.memo(({ onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-4 bg-gray-50 dark:bg-slate-900/50 p-4 rounded-2xl text-left w-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
  >
    <Plus className="text-green-600 dark:text-emerald-500" size={24} />
    <h3 className="font-bold text-green-600 dark:text-emerald-500">Add new address</h3>
  </button>
));

const SavedAddressItem = React.memo(({ addr, onSelect }) => {
  const handleClick = useCallback(() => onSelect(addr), [addr, onSelect]);
  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-4 bg-white dark:bg-slate-900/40 border border-gray-100 dark:border-white/5 p-4 rounded-2xl text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
    >
      <div className="bg-gray-50 dark:bg-slate-800 p-2 rounded-lg">
        <Home className="text-gray-400 dark:text-slate-500" size={20} />
      </div>
      <div className="flex-1">
        <h3 className="font-bold dark:text-slate-200">{addr.label}</h3>
        <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2">
          {addr.address}
        </p>
      </div>
    </button>
  );
});

const PlacePredictionItem = React.memo(({ prediction, onSelect }) => {
  const handleClick = useCallback(
    () => onSelect(prediction),
    [prediction, onSelect]
  );
  return (
    <button
      onClick={handleClick}
      className="p-3 text-left hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg text-sm border-b border-gray-50 dark:border-white/5 transition-colors"
    >
      <p className="font-bold dark:text-slate-200">
        {prediction.structured_formatting?.main_text}
      </p>
      <p className="text-xs text-gray-500 dark:text-slate-400">
        {prediction.structured_formatting?.secondary_text}
      </p>
    </button>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────
const LocationDrawer = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const {
    currentLocation,
    savedAddresses,
    updateLocation,
    refreshLocation,
    isFetchingLocation,
    locationError,
  } = useLocation();

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [placePredictions, setPlacePredictions] = useState([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [placesError, setPlacesError] = useState("");

  // Stable refs (never trigger re-renders)
  const mapsReadyRef = useRef(false);
  const autocompleteServiceRef = useRef(null);
  const geocoderRef = useRef(null);
  const latestPlacesRequestRef = useRef(0);
  const autocompleteSessionTokenRef = useRef(null);
  const prevFetchingRef = useRef(isFetchingLocation);

  // ─── Session token helpers ───────────────────────────────────────────────
  const resetAutocompleteSession = useCallback(() => {
    autocompleteSessionTokenRef.current = null;
  }, []);

  const getAutocompleteSessionToken = useCallback(() => {
    if (
      !autocompleteSessionTokenRef.current &&
      window.google?.maps?.places?.AutocompleteSessionToken
    ) {
      autocompleteSessionTokenRef.current =
        new window.google.maps.places.AutocompleteSessionToken();
    }
    return autocompleteSessionTokenRef.current;
  }, []);

  // ─── Google Maps init (lazy, once) ──────────────────────────────────────
  const initGooglePlaces = useCallback(async () => {
    if (mapsReadyRef.current) return true;

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setPlacesError("Google Maps API key is missing");
      return false;
    }
    try {
      await loadGoogleMaps(apiKey);
      if (!window.google?.maps?.places) {
        setPlacesError("Google Places library is unavailable");
        return false;
      }
      autocompleteServiceRef.current =
        new window.google.maps.places.AutocompleteService();
      geocoderRef.current = new window.google.maps.Geocoder();
      mapsReadyRef.current = true;
      return true;
    } catch (err) {
      setPlacesError(err?.message || "Unable to load Google search");
      return false;
    }
  }, []);

  // ─── Effects ────────────────────────────────────────────────────────────

  // Close drawer after successful location fetch
  useEffect(() => {
    if (prevFetchingRef.current && !isFetchingLocation && !locationError) {
      onClose();
    }
    prevFetchingRef.current = isFetchingLocation;
  }, [isFetchingLocation, locationError, onClose]);

  // Reset state when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setPlacePredictions([]);
      setIsSearchingPlaces(false);
      setPlacesError("");
      setIsSearchFocused(false);
      resetAutocompleteSession();
    }
  }, [isOpen, resetAutocompleteSession]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Debounced autocomplete search
  useEffect(() => {
    if (!isOpen || !isSearchFocused) return;

    const query = searchQuery.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      latestPlacesRequestRef.current += 1;
      setPlacePredictions([]);
      setIsSearchingPlaces(false);
      setPlacesError("");
      return;
    }

    const timer = setTimeout(async () => {
      const ready = await initGooglePlaces();
      if (!ready || !autocompleteServiceRef.current) return;

      const requestId = ++latestPlacesRequestRef.current;
      setIsSearchingPlaces(true);
      setPlacesError("");

      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: query,
          types: ["geocode"],
          componentRestrictions: { country: "in" },
          sessionToken: getAutocompleteSessionToken(),
        },
        (predictions, status) => {
          if (requestId !== latestPlacesRequestRef.current) return; // stale response
          setIsSearchingPlaces(false);
          if (status === window.google.maps.places.PlacesServiceStatus.OK) {
            setPlacePredictions(predictions.slice(0, MAX_SUGGESTIONS));
          } else {
            setPlacePredictions([]);
          }
        }
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [isOpen, isSearchFocused, searchQuery, getAutocompleteSessionToken, initGooglePlaces]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleSelectCurrentLocation = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    refreshLocation();
  }, [refreshLocation]);

  const handleSelectAddress = useCallback(
    (address) => {
      const lat = Number(address?.location?.lat);
      const lng = Number(address?.location?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        toast.error("This address has no map pin. Use current location or search a place.");
        return;
      }
      updateLocation(
        {
          name: address.address || address.formattedAddress || "Selected address",
          time: "12-15 mins",
          city: address.city || "",
          state: address.state || "",
          pincode: address.zipCode || address.pincode || "",
          latitude: lat,
          longitude: lng,
          selectedAddressId: address.id || null,
          type: address.type || "saved",
        },
        { persist: true }
      );
      onClose();
    },
    [updateLocation, onClose]
  );

  const handleAddAddress = useCallback(() => {
    onClose();
    navigate("/quick/addresses?add=1&from=cart");
  }, [onClose, navigate]);

  const handleSelectPlace = useCallback(
    (prediction) => {
      const geocoder = geocoderRef.current;
      if (!geocoder || !prediction?.place_id) return;

      geocoder.geocode({ placeId: prediction.place_id }, (results, status) => {
        if (status !== "OK" || !results?.[0]) {
          setPlacesError("Could not resolve selected location");
          return;
        }

        const result = results[0];
        const geometry = result.geometry?.location;
        if (!geometry) {
          setPlacesError("Location coordinates not available");
          return;
        }

        const components = result.address_components || [];
        updateLocation(
          {
            name: result.formatted_address || prediction.description,
            time: "12-15 mins",
            city: getComponent(components, COMPONENT_TYPES.city) || currentLocation.city,
            state: getComponent(components, COMPONENT_TYPES.state) || currentLocation.state,
            pincode: getComponent(components, COMPONENT_TYPES.pincode) || currentLocation.pincode,
            latitude: geometry.lat(),
            longitude: geometry.lng(),
          },
          { persist: true, updateSavedHome: false }
        );

        setSearchQuery("");
        setPlacePredictions([]);
        setPlacesError("");
        setIsSearchFocused(false);
        resetAutocompleteSession();
        onClose();
      });
    },
    [currentLocation, updateLocation, onClose, resetAutocompleteSession]
  );

  // ─── Memoized list renders ───────────────────────────────────────────────
  const savedAddressList = useMemo(
    () =>
      savedAddresses.map((addr) => (
        <SavedAddressItem key={addr.id} addr={addr} onSelect={handleSelectAddress} />
      )),
    [savedAddresses, handleSelectAddress]
  );

  const predictionList = useMemo(
    () =>
      placePredictions.map((p) => (
        <PlacePredictionItem key={p.place_id} prediction={p} onSelect={handleSelectPlace} />
      )),
    [placePredictions, handleSelectPlace]
  );

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[600]"
          />

          <motion.div
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={drawerTransition}
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-card rounded-t-[32px] z-[610] max-h-[90vh] overflow-y-auto outline-none shadow-2xl pb-8 transition-colors duration-500"
          >
            {/* Sticky Header */}
            <div className="sticky top-0 bg-white dark:bg-card px-6 pt-6 pb-4 flex flex-col gap-4 z-20 transition-colors duration-500">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-extrabold text-[#1A1A1A] dark:text-foreground">
                  Select delivery location
                </h2>
                <button
                  onClick={onClose}
                  className="h-10 w-10 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center dark:text-foreground"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="relative">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Search for area, street name.."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  className="w-full bg-gray-100 dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-semibold outline-none dark:text-foreground dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Body */}
            <div className="px-4 flex flex-col gap-3">
              <CurrentLocationButton
                name={currentLocation.name}
                onClick={handleSelectCurrentLocation}
              />
              <AddAddressButton onClick={handleAddAddress} />

              {savedAddresses.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase mb-3">
                    Saved addresses
                  </h4>
                  <div className="flex flex-col gap-3">{savedAddressList}</div>
                </div>
              )}

              {placePredictions.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">
                    Search results
                  </h4>
                  <div className="flex flex-col gap-2">{predictionList}</div>
                </div>
              )}

              {placesError ? (
                <p className="text-xs text-red-500 px-1">{placesError}</p>
              ) : null}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default React.memo(LocationDrawer);