import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { customerApi } from "../services/customerApi";
import { useAuth } from "@core/context/AuthContext";
import { userAPI } from "@food/api";
import { getCachedUserAddresses } from "@food/utils/userSessionCache";

const LocationContext = createContext(undefined);
// v2 key to force one-time refresh from Google Maps for users
// who previously only had the default/static location cached.
const STORAGE_KEY = "location_v2";
/** Food module key — QC must also read this so shared location works across /food and /quick. */
const FOOD_STORAGE_KEY = "userLocation";

const EMPTY_LOCATION = {
  name: "Select delivery location",
  time: "",
  city: "",
  state: "",
  pincode: "",
  latitude: null,
  longitude: null,
};

/** Coerce string/number coords so localStorage + API addresses always validate. */
const toCoord = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const hasValidCoordinates = (location) => {
  const lat = toCoord(location?.latitude ?? location?.lat);
  const lng = toCoord(location?.longitude ?? location?.lng);
  return lat !== null && lng !== null;
};

const normalizeLocationCoords = (location = {}) => {
  const latitude = toCoord(location.latitude ?? location.lat);
  const longitude = toCoord(location.longitude ?? location.lng);
  return {
    ...location,
    latitude,
    longitude,
  };
};

/** Build currentLocation shape from either QC (`location_v2`) or Food (`userLocation`) payloads. */
const locationFromStoredPayload = (parsed) => {
  if (!parsed || typeof parsed !== "object") return null;
  const normalized = normalizeLocationCoords(parsed);
  if (!hasValidCoordinates(normalized)) return null;

  const name =
    parsed.address ||
    parsed.name ||
    parsed.formattedAddress ||
    `Lat ${Number(normalized.latitude).toFixed(5)}, Lng ${Number(normalized.longitude).toFixed(5)}`;

  return {
    name,
    time: normalized.time || "12-15 mins",
    city: normalized.city || "",
    state: normalized.state || "",
    pincode: normalized.pincode || "",
    latitude: normalized.latitude,
    longitude: normalized.longitude,
    type: normalized.type,
    selectedAddressId: normalized.selectedAddressId || null,
    formattedAddress: normalized.formattedAddress || name,
    street: normalized.street || "",
    additionalDetails: normalized.additionalDetails || "",
  };
};

const readStoredLocationSync = () => {
  if (typeof window === "undefined") return EMPTY_LOCATION;
  try {
    const qcRaw = window.localStorage.getItem(STORAGE_KEY);
    if (qcRaw) {
      const fromQc = locationFromStoredPayload(JSON.parse(qcRaw));
      if (fromQc) return fromQc;
    }
    const foodRaw = window.localStorage.getItem(FOOD_STORAGE_KEY);
    if (foodRaw) {
      const fromFood = locationFromStoredPayload(JSON.parse(foodRaw));
      if (fromFood) return fromFood;
    }
  } catch {
    // ignore corrupt storage
  }
  return EMPTY_LOCATION;
};

const persistLocationToStorage = (normalized) => {
  if (typeof window === "undefined" || !hasValidCoordinates(normalized)) return;
  const name =
    normalized.name ||
    normalized.formattedAddress ||
    `Lat ${Number(normalized.latitude).toFixed(5)}, Lng ${Number(normalized.longitude).toFixed(5)}`;
  const qcPayload = {
    address: name,
    city: normalized.city || "",
    state: normalized.state || "",
    pincode: normalized.pincode || "",
    latitude: normalized.latitude,
    longitude: normalized.longitude,
    time: normalized.time || "12-15 mins",
    type: normalized.type,
    selectedAddressId: normalized.selectedAddressId || null,
    formattedAddress: normalized.formattedAddress || name,
    street: normalized.street || "",
    additionalDetails: normalized.additionalDetails || "",
  };
  const foodPayload = {
    ...qcPayload,
    address: name,
    formattedAddress: normalized.formattedAddress || name,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(qcPayload));
    window.localStorage.setItem(FOOD_STORAGE_KEY, JSON.stringify(foodPayload));
  } catch {
    // ignore quota / private mode
  }
};

const isCurrentLocationAddress = (addr = {}) => {
  const label = String(addr?.label || "").trim().toLowerCase();
  return addr?.type === "current" || label === "current location";
};

const normalizeAddressLabel = (label = "", addr = {}) => {
  if (isCurrentLocationAddress({ ...addr, label })) return "Current Location";
  const normalized = String(label || "").trim().toLowerCase();
  if (normalized === "home") return "Home";
  if (normalized === "office" || normalized === "work") return "Office";
  return "Other";
};

const mapSharedAddress = (addr = {}, idx = 0, profile = {}) => {
  const geoCoords = Array.isArray(addr?.location?.coordinates)
    ? addr.location.coordinates
    : null;
  const geoLat = toCoord(geoCoords?.[1]);
  const geoLng = toCoord(geoCoords?.[0]);

  const location =
    addr?.location &&
    toCoord(addr.location.lat) !== null &&
    toCoord(addr.location.lng) !== null
      ? { lat: toCoord(addr.location.lat), lng: toCoord(addr.location.lng) }
      : geoLat !== null && geoLng !== null
        ? { lat: geoLat, lng: geoLng }
        : null;

  const addressText =
    addr.formattedAddress ||
    addr.address ||
    addr.fullAddress ||
    [
      addr.additionalDetails,
      addr.street,
      addr.landmark,
      addr.city,
      addr.state,
      addr.zipCode || addr.pincode,
    ]
      .filter(Boolean)
      .join(", ") ||
    "";

  const isCurrent = isCurrentLocationAddress(addr);

  return {
    id: addr._id ?? addr.id ?? String(idx),
    label: normalizeAddressLabel(addr.label, addr),
    address: addressText,
    formattedAddress: addr.formattedAddress || addressText,
    street: addr.street || "",
    additionalDetails: addr.additionalDetails || "",
    city: addr.city || "",
    state: addr.state || "",
    zipCode: addr.zipCode || addr.pincode || "",
    location,
    placeId: typeof addr?.placeId === "string" ? addr.placeId : null,
    phone: profile?.phone ?? addr?.phone ?? "",
    name: profile?.name ?? addr?.name ?? addr?.fullName ?? "",
    type: isCurrent ? "current" : "saved",
    isCurrent: isCurrent || addr.isDefault === true || idx === 0,
    isDefault: addr.isDefault === true,
  };
};

export const LocationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  // Sync read so first QC bootstrap already has lat/lng (avoids LOCATION_REQUIRED flash).
  const [currentLocation, setCurrentLocation] = useState(readStoredLocationSync);

  // Address list for drawer UI – will be hydrated from profile API.
  const [savedAddresses, setSavedAddresses] = useState([]);

  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);

  // Update the current location.
  // By default this does NOT change saved addresses; only explicit
  // address actions should touch the saved list.
  const updateLocation = (
    newLoc,
    { persist = true, updateSavedHome = false } = {},
  ) => {
    const normalized = normalizeLocationCoords(newLoc || {});
    setCurrentLocation(normalized);

    if (updateSavedHome) {
      setSavedAddresses((prev) =>
        prev.map((addr) =>
          addr.label === "Home" ? { ...addr, address: normalized.name } : addr,
        ),
      );
    }

    if (persist && typeof window !== "undefined") {
      try {
        if (hasValidCoordinates(normalized)) {
          persistLocationToStorage(normalized);
          window.dispatchEvent(
            new CustomEvent("quickLocationChanged", {
              detail: { location: normalized },
            }),
          );
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // ignore storage errors
      }
    }
  };

  const addAddress = (newAddress) => {
    setSavedAddresses((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        label: newAddress.label || "Other",
        address: newAddress.address,
        phone: newAddress.phone || "N/A",
        isCurrent: false,
      },
    ]);
  };

  // Resolve location once using browser geolocation + Google Maps Geocoding.
  // Must be called directly from a user gesture (click/tap) for the browser to show the permission prompt.
  const fetchAndCacheLocation = () =>
    new Promise((resolve) => {
      if (
        typeof window === "undefined" ||
        !("navigator" in window) ||
        !navigator.geolocation
      ) {
        resolve({
          ok: false,
          error: "Geolocation is not supported on this device",
        });
        return;
      }

      setIsFetchingLocation(true);
      setLocationError(null);

      // Call getCurrentPosition immediately - must run in same synchronous stack as user click
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const fallbackFromCoords = (latitude, longitude) => ({
            name: `Lat ${Number(latitude).toFixed(5)}, Lng ${Number(longitude).toFixed(5)}`,
            time: "12-15 mins",
            city: "",
            state: "",
            pincode: "",
            latitude,
            longitude,
          });

          try {
            const { latitude, longitude } = position.coords;

            // Always succeed with coordinates (needed for delivery fee calculation),
            // even if reverse geocoding fails (key missing / quota / restrictions).
            let liveLocation = {
              ...fallbackFromCoords(latitude, longitude),
              type: "current"
            };

            try {
              const response = await customerApi.reverseGeocode(latitude, longitude);
              const geo = response?.data?.data;
              if (geo?.formattedAddress) {
                liveLocation = {
                  name: geo.formattedAddress,
                  time: "12-15 mins",
                  city: geo.city || liveLocation.city,
                  state: geo.state || liveLocation.state,
                  pincode: geo.pincode || liveLocation.pincode,
                  latitude,
                  longitude,
                  type: "current"
                };
              }
            } catch (geocodeErr) {
              console.warn("Reverse geocode failed, using coordinates only:", geocodeErr?.message);
            }

            updateLocation(liveLocation, {
              persist: true,
              updateSavedHome: false,
            });
            resolve({ ok: true, location: liveLocation });
          } catch (err) {
            // Coordinates were obtained, but reverse geocoding failed.
            // Still treat this as success so downstream pricing can use lat/lng.
            const { latitude, longitude } = position.coords;
            const loc = fallbackFromCoords(latitude, longitude);
            updateLocation(loc, { persist: true, updateSavedHome: false });
            resolve({
              ok: true,
              location: loc,
              warning: err?.message || "Unable to fetch address",
            });
          } finally {
            setIsFetchingLocation(false);
          }
        },
        (error) => {
          const message = error.message || "Location permission denied";
          setLocationError(message);
          setIsFetchingLocation(false);
          resolve({ ok: false, error: message });
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        },
      );
    });

  const refreshAddresses = useCallback(async (forceRefresh = false) => {
    if (!isAuthenticated) {
      setSavedAddresses([]);
      return [];
    }

    const userId = user?._id?.toString() || user?.userId || user?.id || null;

    if (!forceRefresh) {
      const sessionCached = getCachedUserAddresses();
      if (sessionCached?.length) {
        const normalized = sessionCached.map((addr, idx) =>
          mapSharedAddress(addr, idx, user || {}),
        );
        setSavedAddresses(normalized);
        return normalized;
      }
    }

    try {
      if (forceRefresh) {
        userAPI.getAddresses.invalidateCache?.();
      }
      const addressesResponse = await userAPI.getAddresses();
      const sharedAddresses =
        addressesResponse?.data?.data?.addresses ||
        addressesResponse?.data?.addresses ||
        [];
      const normalizedShared = Array.isArray(sharedAddresses)
        ? sharedAddresses.map((addr, idx) => mapSharedAddress(addr, idx, user))
        : [];

      setSavedAddresses(normalizedShared);
      return normalizedShared;
    } catch {
      try {
        const { data } = await customerApi.getProfile();
        const profile = data?.result ?? data?.data ?? data;
        const raw = Array.isArray(profile?.addresses) ? profile.addresses : [];
        const normalizedProfile = raw.map((addr, idx) =>
          mapSharedAddress(addr, idx, profile || user || {}),
        );
        setSavedAddresses(normalizedProfile);
        return normalizedProfile;
      } catch {
        try {
          const rawStored = localStorage.getItem("userAddresses");
          const parsedStored = rawStored ? JSON.parse(rawStored) : [];
          const normalizedStored = Array.isArray(parsedStored)
            ? parsedStored.map((addr, idx) => mapSharedAddress(addr, idx, user || {}))
            : [];
          setSavedAddresses(normalizedStored);
          return normalizedStored;
        } catch {
          setSavedAddresses([]);
          return [];
        }
      }
    }
  }, [isAuthenticated, user?._id, user?.userId, user?.id]);

  // On mount: hydrate saved addresses from profile (only when customer is logged in)
  useEffect(() => {
    refreshAddresses();
  }, [refreshAddresses]);

  // On mount: restore from QC cache, then Food `userLocation` fallback.
  // Do NOT auto-fetch GPS – browsers block the prompt unless user gesture.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasValidCoordinates(currentLocation)) {
      // Ensure both storage keys stay aligned when we hydrated from Food only.
      persistLocationToStorage(currentLocation);
      return;
    }

    const restored = readStoredLocationSync();
    if (hasValidCoordinates(restored)) {
      updateLocation(restored, { persist: true, updateSavedHome: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen to geolocation permission status changes
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.permissions || !navigator.permissions.query) return;

    let active = true;
    let permStatusObj = null;
    let permListener = null;

    navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      if (!active) return;
      permStatusObj = status;
      permListener = () => {
        if (status.state === 'granted') {
          fetchAndCacheLocation().then((res) => {
            if (res && res.ok && res.location) {
              // Notify other hooks
              const mappedLoc = {
                latitude: res.location.latitude,
                longitude: res.location.longitude,
                city: res.location.city,
                state: res.location.state,
                pincode: res.location.pincode,
                address: res.location.name,
                formattedAddress: res.location.name
              };
              window.dispatchEvent(new CustomEvent("userLocationUpdated", { detail: { location: mappedLoc } }));
            }
          }).catch(() => {});
        }
      };

      status.addEventListener('change', permListener);
      status.onchange = permListener;
    }).catch(() => {});

    return () => {
      active = false;
      if (permStatusObj && permListener) {
        permStatusObj.removeEventListener('change', permListener);
        permStatusObj.onchange = null;
      }
    };
  }, []);

  // Sync with external updates
  useEffect(() => {
    if (typeof window === "undefined") return;

    const applyExternalLocationUpdate = (event) => {
      try {
        const nextLocation = event?.detail?.location || JSON.parse(localStorage.getItem("userLocation") || "null");
        if (nextLocation && typeof nextLocation === "object" && hasValidCoordinates(nextLocation)) {
          updateLocation(
            {
              name: nextLocation.formattedAddress || nextLocation.address || `Lat ${Number(nextLocation.latitude).toFixed(5)}, Lng ${Number(nextLocation.longitude).toFixed(5)}`,
              time: "12-15 mins",
              city: nextLocation.city || "",
              state: nextLocation.state || "",
              pincode: nextLocation.pincode || "",
              latitude: nextLocation.latitude,
              longitude: nextLocation.longitude,
            },
            { persist: true, updateSavedHome: false }
          );
        }
      } catch (err) {
        console.warn("Failed to apply external location update in LocationContext:", err);
      }
    };

    window.addEventListener("userLocationUpdated", applyExternalLocationUpdate);
    return () => {
      window.removeEventListener("userLocationUpdated", applyExternalLocationUpdate);
    };
  }, []);

  return (
    <LocationContext.Provider
      value={{
        currentLocation,
        hasValidLocation: hasValidCoordinates(currentLocation),
        savedAddresses,
        updateLocation,
        addAddress,
        refreshAddresses,
        isFetchingLocation,
        locationError,
        refreshLocation: fetchAndCacheLocation,
      }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
};
