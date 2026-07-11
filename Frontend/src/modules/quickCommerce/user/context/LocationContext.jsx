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

const LocationContext = createContext(undefined);
// v2 key to force one-time refresh from Google Maps for users
// who previously only had the default/static location cached.
const STORAGE_KEY = "location_v2";

const normalizeAddressLabel = (label = "") => {
  const normalized = String(label || "").trim().toLowerCase();
  if (normalized === "home") return "Home";
  if (normalized === "office" || normalized === "work") return "Office";
  return "Other";
};

const mapSharedAddress = (addr = {}, idx = 0, profile = {}) => {
  const geoCoords = Array.isArray(addr?.location?.coordinates)
    ? addr.location.coordinates
    : null;
  const geoLat =
    typeof geoCoords?.[1] === "number" && Number.isFinite(geoCoords[1])
      ? geoCoords[1]
      : null;
  const geoLng =
    typeof geoCoords?.[0] === "number" && Number.isFinite(geoCoords[0])
      ? geoCoords[0]
      : null;

  const location =
    addr?.location &&
    typeof addr.location.lat === "number" &&
    typeof addr.location.lng === "number" &&
    Number.isFinite(addr.location.lat) &&
    Number.isFinite(addr.location.lng)
      ? { lat: addr.location.lat, lng: addr.location.lng }
      : geoLat !== null && geoLng !== null
        ? { lat: geoLat, lng: geoLng }
        : null;

  const addressText =
    addr.formattedAddress ||
    addr.address ||
    addr.fullAddress ||
    [
      addr.label,
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

  return {
    id: addr._id ?? addr.id ?? String(idx),
    label: normalizeAddressLabel(addr.label),
    address: addressText,
    location,
    placeId: typeof addr?.placeId === "string" ? addr.placeId : null,
    phone: profile?.phone ?? addr?.phone ?? "",
    name: profile?.name ?? addr?.name ?? addr?.fullName ?? "",
    isCurrent: addr.isDefault === true || idx === 0,
    isDefault: addr.isDefault === true,
  };
};

export const LocationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  // Default location (used until we can resolve a better one)
  const [currentLocation, setCurrentLocation] = useState({
    name: "214, Rajshri Palace Colony, Pipliyahana, Indore, Madhya Pradesh 452018, India",
    time: "12-15 mins",
    city: "Indore",
    state: "Madhya Pradesh",
    pincode: "452018",
    latitude: 22.711140989838025,
    longitude: 75.9001552518043,
  });

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
    setCurrentLocation(newLoc);

    if (updateSavedHome) {
      setSavedAddresses((prev) =>
        prev.map((addr) =>
          addr.label === "Home" ? { ...addr, address: newLoc.name } : addr,
        ),
      );
    }

    if (persist && typeof window !== "undefined") {
      try {
        const payload = {
          address: newLoc.name,
          city: newLoc.city,
          state: newLoc.state,
          pincode: newLoc.pincode,
          latitude: newLoc.latitude,
          longitude: newLoc.longitude,
          // Internal app properties
          time: newLoc.time,
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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
            city: currentLocation?.city || "Indore",
            state: currentLocation?.state || "Madhya Pradesh",
            pincode: currentLocation?.pincode || "452018",
            latitude,
            longitude,
          });

          try {
            const { latitude, longitude } = position.coords;

            // Always succeed with coordinates (needed for delivery fee calculation),
            // even if reverse geocoding fails (key missing / quota / restrictions).
            let liveLocation = fallbackFromCoords(latitude, longitude);

            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

            if (apiKey) {
              const params = new URLSearchParams({
                latlng: `${latitude},${longitude}`,
                key: apiKey,
              });

              const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
              );

              if (!response.ok) {
                throw new Error("Failed to fetch address from Google Maps");
              }

              const data = await response.json();

              // Handle Google Geocoding API error responses
              if (data.status === "REQUEST_DENIED") {
                const msg =
                  data.error_message ||
                  "Geocoding API rejected (check API key restrictions)";
                throw new Error(msg);
              }
              if (data.status === "OVER_QUERY_LIMIT") {
                throw new Error("Geocoding API quota exceeded");
              }
              if (!data.results || data.results.length === 0) {
                throw new Error(
                  data.error_message || "No address found for current location",
                );
              }

              const components = data.results[0].address_components || [];

              const getComponent = (types) =>
                components.find((c) => types.every((t) => c.types.includes(t)))
                  ?.long_name;

              // Build address from components to match: "214, Rajshri Palace Colony, Pipliyahana, Indore, Madhya Pradesh 452018, India"
              const premise = getComponent(["premise"]);
              const neighborhood = getComponent(["neighborhood"]);
              const sublocality = getComponent([
                "sublocality_level_1",
                "sublocality",
              ]);
              const locality = getComponent(["locality"]);
              const state = getComponent(["administrative_area_level_1"]);
              const pincode = getComponent(["postal_code"]);
              const country = getComponent(["country"]);

              const displayParts = [];
              if (premise) displayParts.push(premise);
              if (neighborhood) displayParts.push(neighborhood);
              if (sublocality && sublocality !== neighborhood)
                displayParts.push(sublocality);
              if (locality) displayParts.push(locality);

              let statePincode = "";
              if (state) statePincode += state;
              if (pincode) statePincode += (statePincode ? " " : "") + pincode;
              if (statePincode) displayParts.push(statePincode);

              if (country) displayParts.push(country);

              const friendlyName =
                displayParts.join(", ") || data.results[0].formatted_address;

              liveLocation = {
                name: friendlyName,
                time: "12-15 mins",
                city: locality || liveLocation.city,
                state: state || liveLocation.state,
                pincode: pincode || liveLocation.pincode,
                latitude: latitude,
                longitude: longitude,
              };
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

  const refreshAddresses = useCallback(async () => {
    if (!isAuthenticated) {
      setSavedAddresses([]);
      return [];
    }

    try {
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
    } catch (error) {
      if (error?.response?.status === 401) {
        setSavedAddresses([]);
        return [];
      }
      try {
        const raw = Array.isArray(user?.addresses) ? user.addresses : [];
        if (raw.length > 0) {
          const normalizedProfile = raw.map((addr, idx) =>
            mapSharedAddress(addr, idx, user || {}),
          );
          setSavedAddresses(normalizedProfile);
          return normalizedProfile;
        }
        const rawStored = typeof window !== "undefined" ? localStorage.getItem("userAddresses") : null;
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
  }, [isAuthenticated, user]);

  // On mount: hydrate saved addresses from profile (only when customer is logged in)
  useEffect(() => {
    refreshAddresses();
  }, [refreshAddresses]);

  // On mount: only restore from cache. Do NOT auto-fetch – browsers block the
  // location prompt unless it's triggered by a user gesture (e.g. tap).
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const addressName = parsed.address || parsed.name;
        if (parsed && addressName) {
          updateLocation(
            {
              name: addressName,
              time: parsed.time || "12-15 mins",
              city: parsed.city,
              state: parsed.state,
              pincode: parsed.pincode,
              latitude: parsed.latitude,
              longitude: parsed.longitude,
            },
            { persist: false, updateSavedHome: false },
          );
        }
      } else {
        // If no location is stored, persist the default one immediately
        updateLocation(currentLocation, {
          persist: true,
          updateSavedHome: false,
        });
      }
    } catch {
      // ignore parse errors
    }
    // Live fetch happens only when user taps location pill or "Use current location"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LocationContext.Provider
      value={{
        currentLocation,
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
