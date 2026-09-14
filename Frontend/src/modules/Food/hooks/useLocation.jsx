import { useState, useEffect, useRef, createContext, useContext } from "react"
import { locationAPI, userAPI } from "@food/api"
import apiClient from "@/services/api/axios.js"
import {
  hasValidCoordinates,
  USER_LOCATION_STORAGE_KEY,
} from "@food/utils/locationStorage"

const debugLog = (...args) => {
  if (import.meta.env.DEV) console.log("[useLocation]", ...args)
}
const debugWarn = (...args) => {
  if (import.meta.env.DEV) console.warn("[useLocation]", ...args)
}
const debugError = (...args) => {
  if (import.meta.env.DEV) console.error("[useLocation]", ...args)
}

// BigDataCloud reverse-geocode is expensive/noisy if many components mount `useLocation()`.
// This module-level guard dedupes concurrent calls + rate-limits starts across the whole app.
const GLOBAL_GEOCODE_MIN_INTERVAL_MS = 60_000
const GLOBAL_GEOCODE_REUSE_DISTANCE_METERS = 75
const geoDistanceMeters = (lat1, lng1, lat2, lng2) => {
  if (
    typeof lat1 !== "number" ||
    typeof lng1 !== "number" ||
    typeof lat2 !== "number" ||
    typeof lng2 !== "number"
  ) {
    return Number.POSITIVE_INFINITY
  }
  const latDiff = lat2 - lat1
  const lngDiff = lng2 - lng1
  return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111320
}

let globalReverseGeocodeInFlight = null
let globalReverseGeocodeLastStartAt = 0
let globalReverseGeocodeLastCoords = { latitude: null, longitude: null }
let globalReverseGeocodeLastSuccess = null

// Default behavior: only resolve an address once on initial app load,
// then rely on localStorage/DB. Live watching is enabled only via explicit user action.
const AUTO_START_LIVE_WATCH = false

const isMeaningfulAddressValue = (value) => {
  const normalized = String(value || "").trim().toLowerCase()
  return Boolean(
    normalized &&
      normalized !== "select location" &&
      normalized !== "current location" &&
      !/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(normalized)
  )
}

const buildBigDataCloudAddress = (data, latitude, longitude) => {
  const administrative = Array.isArray(data?.localityInfo?.administrative)
    ? data.localityInfo.administrative
    : []

  const adminNames = administrative
    .map((item) => String(item?.name || "").trim())
    .filter(Boolean)

  const locality = String(data?.locality || data?.city || "").trim()
  const city = String(data?.city || data?.locality || "").trim()
  const state = String(data?.principalSubdivision || "").trim()
  const postcode = String(data?.postcode || "").trim()

  const areaCandidates = [
    data?.locality,
    data?.city,
    administrative.find((item) => Number(item?.adminLevel) >= 8)?.name,
    administrative.find((item) => Number(item?.adminLevel) === 6)?.name,
    administrative.find((item) => Number(item?.adminLevel) === 5)?.name,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)

  const uniqueParts = []
  const pushUnique = (value) => {
    const next = String(value || "").trim()
    if (!next) return
    if (uniqueParts.some((part) => part.toLowerCase() === next.toLowerCase())) return
    uniqueParts.push(next)
  }

  const explicitFormattedAddress =
    data?.formattedAddress || data?.lookupSourceAddress || data?.displayName
  if (isMeaningfulAddressValue(explicitFormattedAddress)) {
    return {
      area: areaCandidates[0] || city || "",
      city: city || "Unknown City",
      state,
      country: String(data?.countryName || "").trim(),
      postalCode: postcode,
      address: String(explicitFormattedAddress).trim(),
      formattedAddress: String(explicitFormattedAddress).trim(),
    }
  }

  pushUnique(areaCandidates[0])
  pushUnique(areaCandidates[1])
  pushUnique(areaCandidates[2])
  pushUnique(city)
  pushUnique(state)
  pushUnique(postcode)

  if (uniqueParts.length === 0) {
    const fallbackText = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
    return {
      area: "",
      city: city || "Unknown City",
      state,
      country: String(data?.countryName || "").trim(),
      postalCode: postcode,
      address: fallbackText,
      formattedAddress: fallbackText,
    }
  }

  return {
    area: areaCandidates[0] || locality || city || adminNames[0] || "",
    city: city || "Unknown City",
    state,
    country: String(data?.countryName || "").trim(),
    postalCode: postcode,
    address: uniqueParts.join(", "),
    formattedAddress: uniqueParts.join(", "),
  }
}

const isPlusCode = (value) => {
  const text = String(value || "").trim()
  return /^[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}$/i.test(text)
}

const isGenericAddressPart = (value, { city = "", state = "", country = "" } = {}) => {
  const trimmed = String(value || "").trim()
  if (!trimmed || trimmed.length < 2) return true
  if (isPlusCode(trimmed)) return true

  const lower = trimmed.toLowerCase()
  if (country && lower === country.toLowerCase()) return true
  if (lower === "india") return true
  if (city && lower === city.toLowerCase()) return true
  if (state && (lower === state.toLowerCase() || lower.startsWith(`${state.toLowerCase()} `))) return true
  if (/^\d{5,6}$/.test(trimmed)) return true

  return false
}

const pickMeaningfulAddressPart = (parts, context = {}) => {
  for (const part of parts) {
    const trimmed = String(part || "").trim()
    if (!trimmed || isGenericAddressPart(trimmed, context)) continue
    return trimmed.replace(/\s+\d{5,6}$/, "").trim()
  }
  return ""
}

const buildGoogleAddress = (data, latitude, longitude) => {
  if (!data || !data.results || !data.results[0]) return null
  const result = data.results[0]
  const addressComponents = result.address_components || []
  const displayName = result.formatted_address || ""

  let streetNumber = ""
  let route = ""
  let subpremise = ""
  let premise = ""
  let neighborhood = ""
  let sublocality1 = ""
  let sublocality2 = ""
  let locality = ""
  let administrativeArea1 = ""
  let country = ""
  let postalCode = ""

  addressComponents.forEach(comp => {
    const types = comp.types || []
    if (types.includes("street_number")) streetNumber = comp.long_name
    if (types.includes("route")) route = comp.long_name
    if (types.includes("subpremise")) subpremise = comp.long_name
    if (types.includes("premise")) premise = comp.long_name
    if (types.includes("neighborhood")) neighborhood = comp.long_name
    if (types.includes("sublocality_level_1")) sublocality1 = comp.long_name
    if (types.includes("sublocality_level_2")) sublocality2 = comp.long_name
    if (types.includes("locality")) locality = comp.long_name
    if (types.includes("administrative_area_level_1")) administrativeArea1 = comp.long_name
    if (types.includes("country")) country = comp.long_name
    if (types.includes("postal_code")) postalCode = comp.long_name
  })

  const city = locality || "Unknown City"
  const state = administrativeArea1 || ""
  const area = sublocality1 || sublocality2 || neighborhood || ""
  const addressParts = displayName.split(",").map((part) => part.trim()).filter(Boolean)
  const fallbackLine = pickMeaningfulAddressPart(addressParts, { city, state, country })

  const streetParts = [streetNumber, route, premise, subpremise].filter(Boolean)
  const streetFromComponents = streetParts.join(", ")
  const street = streetFromComponents || area || fallbackLine || ""

  return {
    area: area || city,
    city: city,
    state: state,
    country: country,
    postalCode: postalCode,
    street,
    address: displayName,
    formattedAddress: displayName,
  }
}

const buildNominatimAddress = (data, latitude, longitude) => {
  if (!data || !data.address) return null
  const addr = data.address
  const displayName = data.display_name || ""

  // Extract meaningful street/area info
  const streetParts = [
    addr.road,
    addr.house_number,
    addr.building,
  ].filter(Boolean)
  const street = streetParts.join(", ")

  const area = addr.suburb || addr.neighbourhood || addr.city_district || addr.residential || ""
  const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || ""
  const state = addr.state || ""
  const postcode = addr.postcode || ""
  const addressParts = displayName.split(",").map((part) => part.trim()).filter(Boolean)
  const fallbackLine = pickMeaningfulAddressPart(addressParts, {
    city,
    state,
    country: addr.country || "",
  })

  return {
    area: area || city || "",
    city: city || "Unknown City",
    state,
    country: addr.country || "",
    postalCode: postcode,
    street: street || area || fallbackLine || "",
    address: displayName,
    formattedAddress: displayName,
  }
}

const reverseGeocodeDirect = async (latitude, longitude, forceFresh = false) => {
  const now = Date.now()
  const movedMeters = geoDistanceMeters(
    globalReverseGeocodeLastCoords.latitude,
    globalReverseGeocodeLastCoords.longitude,
    latitude,
    longitude
  )
  const timeSinceLastStart = now - globalReverseGeocodeLastStartAt

  // If we recently geocoded a nearby point, reuse the last successful payload (no network).
  // Skip cache when forceFresh is true (user explicitly requested current location)
  if (
    !forceFresh &&
    globalReverseGeocodeLastSuccess &&
    movedMeters < GLOBAL_GEOCODE_REUSE_DISTANCE_METERS &&
    timeSinceLastStart < GLOBAL_GEOCODE_MIN_INTERVAL_MS
  ) {
    return globalReverseGeocodeLastSuccess
  }

  // If another caller is already fetching nearby coords, wait for it (skip when forceFresh).
  if (!forceFresh && globalReverseGeocodeInFlight) {
    const inFlightMoved = geoDistanceMeters(
      globalReverseGeocodeLastCoords.latitude,
      globalReverseGeocodeLastCoords.longitude,
      latitude,
      longitude
    )
    if (inFlightMoved < GLOBAL_GEOCODE_REUSE_DISTANCE_METERS) {
      try {
        return await globalReverseGeocodeInFlight
      } catch {
        // fall through to a fresh attempt
      }
    }
  }

  globalReverseGeocodeLastStartAt = now
  globalReverseGeocodeLastCoords = { latitude, longitude }

  const run = (async () => {
    try {
      // 1. Try backend reverse-geocode proxy (server-side Google Maps key)
      try {
        const controller = new AbortController()
        const abortTimeout = setTimeout(() => controller.abort(), 5000)

        const res = await apiClient.get("/common/maps/reverse-geocode", {
          params: { lat: latitude, lng: longitude },
          signal: controller.signal,
        })
        clearTimeout(abortTimeout)

        const backendData = res?.data?.data
        if (backendData?.formattedAddress) {
          const parsed = buildGoogleAddress(
            {
              results: [{
                formatted_address: backendData.formattedAddress,
                address_components: backendData.addressComponents || [],
              }],
            },
            latitude,
            longitude,
          )
          if (parsed && parsed.address && parsed.address.trim() !== "") {
            globalReverseGeocodeLastSuccess = parsed
            return parsed
          }
        }
      } catch (backendErr) {
        debugWarn("Backend reverse geocode failed, falling back to Nominatim:", backendErr.message)
      }

      // 2. Try Nominatim as a fallback for detailed street-level data
      try {
        const controller = new AbortController()
        const abortTimeout = setTimeout(() => controller.abort(), 4000) // 4s timeout for Nominatim

        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            "Accept-Language": "en",
            "User-Agent": "AppZeto-Food-App"
          }
        })

        clearTimeout(abortTimeout)

        if (res.ok) {
          const data = await res.json()
          const parsed = buildNominatimAddress(data, latitude, longitude)
          if (parsed && parsed.address && parsed.address.trim() !== "") {
            globalReverseGeocodeLastSuccess = parsed
            return parsed
          }
        }
      } catch (nominatimErr) {
        debugWarn("Nominatim reverse geocode failed, falling back to BigDataCloud:", nominatimErr.message)
      }

      // 3. Fallback to BigDataCloud (using new api-bdc.io endpoint)
      try {
        const controller = new AbortController()
        const abortTimeout = setTimeout(() => controller.abort(), 3000) // Faster timeout for fallback

        const res = await fetch(
          `https://api-bdc.io/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
          { signal: controller.signal }
        )

        clearTimeout(abortTimeout)

        const data = await res.json()
        const value = buildBigDataCloudAddress(data, latitude, longitude)
        globalReverseGeocodeLastSuccess = value
        return value
      } catch (bdcErr) {
        debugError("Fallback BigDataCloud geocoding failed too:", bdcErr.message)
        const fallback = {
          city: "Current Location",
          address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          formattedAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        }
        return fallback
      }
    } finally {
      globalReverseGeocodeInFlight = null
    }
  })()

  globalReverseGeocodeInFlight = run
  return run
}

export function useLocation() {
  const shared = useContext(LocationContext)
  if (shared) return shared
  return useLocationInternal()
}

export function LocationProvider({ children }) {
  const value = useLocationInternal()
  return (
    <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
  )
}

const LocationContext = createContext(null)

function useLocationInternal() {
  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hasCoordinates, setHasCoordinates] = useState(false)
  const [geolocationPermission, setGeolocationPermission] = useState("unknown")

  const syncCoordinatesFromLocation = (nextLocation) => {
    setHasCoordinates(hasValidCoordinates(nextLocation))
  }

  const markBrowserGeolocationGranted = () => {
    setGeolocationPermission("granted")
  }

  const markBrowserGeolocationDenied = () => {
    setGeolocationPermission("denied")
  }

  const watchIdRef = useRef(null)
  const updateTimerRef = useRef(null)
  const prevLocationCoordsRef = useRef({ latitude: null, longitude: null })
  const lastGeocodeAtRef = useRef(0)
  const lastGeocodedCoordsRef = useRef({ latitude: null, longitude: null })
  const lastResolvedAddressRef = useRef(null)
  const lastDbLocationFetchAtRef = useRef(0)
  const lastDbLocationRef = useRef(null)
  const lastDbUpdateAtRef = useRef(0)
  const lastDbUpdatedCoordsRef = useRef({ latitude: null, longitude: null })
  const gpsRequestSeqRef = useRef(0)

  const GEOCODE_REUSE_DISTANCE_METERS = 120
  const GEOCODE_REUSE_TIME_MS = 10 * 60 * 1000
  const DB_LOCATION_FETCH_TTL_MS = 2 * 60 * 1000
  const DB_UPDATE_MIN_DISTANCE_METERS = 30
  const DB_UPDATE_MIN_INTERVAL_MS = 90 * 1000
  const getDistanceMeters = (lat1, lng1, lat2, lng2) => {
    if (
      typeof lat1 !== "number" ||
      typeof lng1 !== "number" ||
      typeof lat2 !== "number" ||
      typeof lng2 !== "number"
    ) {
      return Number.POSITIVE_INFINITY
    }
    const latDiff = lat2 - lat1
    const lngDiff = lng2 - lng1
    return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111320
  }

  /* ===================== DB UPDATE (LIVE LOCATION TRACKING) ===================== */
  const updateLocationInDB = async (locationData) => {
    try {
      // Check if location has placeholder values - don't save placeholders
      const hasPlaceholder =
        locationData?.city === "Current Location" ||
        locationData?.address === "Select location" ||
        locationData?.formattedAddress === "Select location" ||
        (!locationData?.city && !locationData?.address && !locationData?.formattedAddress);

      if (hasPlaceholder) {
        debugLog("?? Skipping DB update - location contains placeholder values:", {
          city: locationData?.city,
          address: locationData?.address,
          formattedAddress: locationData?.formattedAddress
        });
        return;
      }

      // Check if user is authenticated before trying to update DB
      const userToken = localStorage.getItem('user_accessToken') || localStorage.getItem('accessToken')
      if (!userToken || userToken === 'null' || userToken === 'undefined') {
        // User not logged in - skip DB update, just use localStorage
        debugLog("?? User not authenticated, skipping DB update (using localStorage only)")
        return
      }

      const dbUpdateDistanceMeters = getDistanceMeters(
        lastDbUpdatedCoordsRef.current.latitude,
        lastDbUpdatedCoordsRef.current.longitude,
        locationData.latitude,
        locationData.longitude
      )
      const dbUpdateAgeMs = Date.now() - lastDbUpdateAtRef.current
      const shouldSkipDbUpdate =
        dbUpdateDistanceMeters < DB_UPDATE_MIN_DISTANCE_METERS &&
        dbUpdateAgeMs < DB_UPDATE_MIN_INTERVAL_MS
      if (shouldSkipDbUpdate) {
        debugLog("Skipping DB update (small movement + recent update):", {
          dbUpdateDistanceMeters: dbUpdateDistanceMeters.toFixed(1),
          dbUpdateAgeMs
        })
        return
      }

      // Persist the full geocoder string in `address` (display may use a shorter label locally).
      const completeAddress = String(
        locationData.formattedAddress || locationData.address || "",
      ).trim()

      // Prepare complete location data for database storage
      const locationPayload = {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        address: completeAddress,
        city: locationData.city || "",
        state: locationData.state || "",
        area: locationData.area || "",
        formattedAddress: completeAddress,
      }

      // Add optional fields if available
      if (locationData.accuracy !== undefined && locationData.accuracy !== null) {
        locationPayload.accuracy = locationData.accuracy
      }
      if (locationData.postalCode) {
        locationPayload.postalCode = locationData.postalCode
      }
      if (locationData.street) {
        locationPayload.street = locationData.street
      }
      if (locationData.streetNumber) {
        locationPayload.streetNumber = locationData.streetNumber
      }

      debugLog("?? Updating live location in database:", {
        coordinates: `${locationPayload.latitude}, ${locationPayload.longitude}`,
        formattedAddress: locationPayload.formattedAddress,
        city: locationPayload.city,
        area: locationPayload.area,
        accuracy: locationPayload.accuracy
      })

      await userAPI.updateLocation(locationPayload)
      lastDbUpdatedCoordsRef.current = {
        latitude: locationPayload.latitude,
        longitude: locationPayload.longitude
      }
      lastDbUpdateAtRef.current = Date.now()

      debugLog("? Live location successfully stored in database")
    } catch (err) {
      // Only log non-network and non-auth errors
      if (err.code !== "ERR_NETWORK" && err.response?.status !== 404 && err.response?.status !== 401) {
        debugError("? DB location update error:", err)
      } else if (err.response?.status === 404 || err.response?.status === 401) {
        // 404 or 401 means user not authenticated or route doesn't exist
        // Silently skip - this is expected for non-authenticated users
        debugLog("?? Location update skipped (user not authenticated or route not available)")
      }
    }
  }

  // Google Places API removed - using OLA Maps only

  /* Removed Google Geocoding/Places (maps.googleapis.com). Uses BigDataCloud reverse-geocode only. */
  const reverseGeocodeWithGoogleMaps = async (latitude, longitude, _options = {}) =>
    reverseGeocodeDirect(latitude, longitude, _options?.forceFresh || false)


  /* ===================== OLA MAPS REVERSE GEOCODE (DEPRECATED - KEPT FOR FALLBACK) ===================== */
  const reverseGeocodeWithOLAMaps = async (latitude, longitude) => {
    try {
      debugLog("?? Fetching address from OLA Maps for:", latitude, longitude)

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("OLA Maps API timeout")), 10000)
      )

      const apiPromise = locationAPI.reverseGeocode(latitude, longitude)
      const res = await Promise.race([apiPromise, timeoutPromise])

      // Log full response for debugging
      debugLog("?? Full OLA Maps API Response:", JSON.stringify(res?.data, null, 2))

      // Check if response is valid
      if (!res || !res.data) {
        throw new Error("Invalid response from OLA Maps API")
      }

      // Check if API call was successful
      if (res.data.success === false) {
        throw new Error(res.data.message || "OLA Maps API returned error")
      }

      // Backend returns: { success: true, data: { results: [{ formatted_address, address_components: { city, state, country, area } }] } }
      const backendData = res?.data?.data || {}

      // Debug: Check backend data structure
      debugLog("?? Backend data structure:", {
        hasResults: !!backendData.results,
        hasResult: !!backendData.result,
        keys: Object.keys(backendData),
        dataType: typeof backendData,
        backendData: JSON.stringify(backendData, null, 2).substring(0, 500) // First 500 chars
      })

      // Handle different OLA Maps response structures
      // Backend processes OLA Maps response and returns: { results: [{ formatted_address, address_components: { city, state, area } }] }
      let result = null;
      if (backendData.results && Array.isArray(backendData.results) && backendData.results.length > 0) {
        result = backendData.results[0];
        debugLog("? Using results[0] from backend")
      } else if (backendData.result && Array.isArray(backendData.result) && backendData.result.length > 0) {
        result = backendData.result[0];
        debugLog("? Using result[0] from backend")
      } else if (backendData.results && !Array.isArray(backendData.results)) {
        result = backendData.results;
        debugLog("? Using results object from backend")
      } else {
        result = backendData;
        debugLog("?? Using backendData directly (fallback)")
      }

      if (!result) {
        debugWarn("?? No result found in backend data")
        result = {};
      }

      debugLog("?? Parsed result:", {
        hasFormattedAddress: !!result.formatted_address,
        hasAddressComponents: !!result.address_components,
        formattedAddress: result.formatted_address,
        addressComponents: result.address_components
      })

      // Extract address_components - handle both object and array formats
      let addressComponents = {};
      if (result.address_components) {
        if (Array.isArray(result.address_components)) {
          // Google Maps style array
          result.address_components.forEach(comp => {
            const types = comp.types || [];
            if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
              addressComponents.area = comp.long_name || comp.short_name;
            } else if (types.includes('neighborhood') && !addressComponents.area) {
              addressComponents.area = comp.long_name || comp.short_name;
            } else if (types.includes('locality')) {
              addressComponents.city = comp.long_name || comp.short_name;
            } else if (types.includes('administrative_area_level_1')) {
              addressComponents.state = comp.long_name || comp.short_name;
            } else if (types.includes('country')) {
              addressComponents.country = comp.long_name || comp.short_name;
            }
          });
        } else {
          // Object format
          addressComponents = result.address_components;
        }
      } else if (result.components) {
        addressComponents = result.components;
      }

      debugLog("?? Parsed result structure:", {
        result,
        addressComponents,
        hasArrayComponents: Array.isArray(result.address_components),
        hasObjectComponents: !Array.isArray(result.address_components) && !!result.address_components
      })

      // Extract address details - try multiple possible response structures
      let city = addressComponents?.city ||
        result?.city ||
        result?.locality ||
        result?.address_components?.city ||
        ""

      let state = addressComponents?.state ||
        result?.state ||
        result?.administrative_area_level_1 ||
        result?.address_components?.state ||
        ""

      let country = addressComponents?.country ||
        result?.country ||
        result?.country_name ||
        result?.address_components?.country ||
        ""

      let formattedAddress = result?.formatted_address ||
        result?.formattedAddress ||
        result?.address ||
        ""

      // PRIORITY 1: Extract area from formatted_address FIRST (most reliable for Indian addresses)
      // Indian address format: "Area, City, State" e.g., "New Palasia, Indore, Madhya Pradesh"
      // ALWAYS try formatted_address FIRST - it's the most reliable source and preserves full names like "New Palasia"
      let area = ""
      if (formattedAddress) {
        const addressParts = formattedAddress.split(',').map(part => part.trim()).filter(part => part.length > 0)

        debugLog("?? Parsing formatted address for area:", { formattedAddress, addressParts, city, state, currentArea: area })

        // ZOMATO-STYLE: If we have 3+ parts, first part is ALWAYS the area/locality
        // Format: "New Palasia, Indore, Madhya Pradesh" -> area = "New Palasia"
        if (addressParts.length >= 3) {
          const firstPart = addressParts[0]
          const secondPart = addressParts[1] // Usually city
          const thirdPart = addressParts[2]  // Usually state

          // First part is the area (e.g., "New Palasia")
          // Second part is usually city (e.g., "Indore")
          // Third part is usually state (e.g., "Madhya Pradesh")
          if (firstPart && firstPart.length > 2 && firstPart.length < 50) {
            // Make sure first part is not the same as city or state
            const firstLower = firstPart.toLowerCase()
            const cityLower = (city || secondPart || "").toLowerCase()
            const stateLower = (state || thirdPart || "").toLowerCase()

            if (firstLower !== cityLower &&
              firstLower !== stateLower &&
              !firstPart.match(/^\d+/) && // Not a number
              !firstPart.match(/^\d+\s*(km|m|meters?)$/i) && // Not a distance
              !firstLower.includes("district") && // Not a district name
              !firstLower.includes("city")) { // Not a city name
              area = firstPart
              debugLog("??? EXTRACTED AREA from formatted address (3+ parts):", area)

              // Also update city if second part matches better
              if (secondPart && (!city || secondPart.toLowerCase() !== city.toLowerCase())) {
                city = secondPart
              }
              // Also update state if third part matches better
              if (thirdPart && (!state || thirdPart.toLowerCase() !== state.toLowerCase())) {
                state = thirdPart
              }
            }
          }
        } else if (addressParts.length === 2 && !area) {
          // Two parts: Could be "Area, City" or "City, State"
          const firstPart = addressParts[0]
          const secondPart = addressParts[1]

          // Check if first part is city (if we already have city name)
          const isFirstCity = city && firstPart.toLowerCase() === city.toLowerCase()

          // If first part is NOT the city, it's likely the area
          if (!isFirstCity &&
            firstPart.length > 2 &&
            firstPart.length < 50 &&
            !firstPart.toLowerCase().includes("district") &&
            !firstPart.toLowerCase().includes("city") &&
            !firstPart.match(/^\d+/)) {
            area = firstPart
            debugLog("? Extracted area from 2 part address:", area)
            // Update city if second part exists
            if (secondPart && !city) {
              city = secondPart
            }
          } else if (isFirstCity) {
            // First part is city, second part might be state
            // No area in this case, but update state if needed
            if (secondPart && !state) {
              state = secondPart
            }
          }
        } else if (addressParts.length === 1 && !area) {
          // Single part - could be just city or area
          const singlePart = addressParts[0]
          if (singlePart && singlePart.length > 2 && singlePart.length < 50) {
            // If it doesn't match city exactly, it might be an area
            if (!city || singlePart.toLowerCase() !== city.toLowerCase()) {
              // Don't use as area if it looks like a city name (contains common city indicators)
              if (!singlePart.toLowerCase().includes("city") &&
                !singlePart.toLowerCase().includes("district")) {
                // Could be area, but be cautious - only use if we're sure
                debugLog("?? Single part address - ambiguous, not using as area:", singlePart)
              }
            }
          }
        }
      }

      // PRIORITY 2: If still no area from formatted_address, try from address_components (fallback)
      // Note: address_components might have incomplete/truncated names like "Palacia" instead of "New Palasia"
      // So we ALWAYS prefer formatted_address extraction over address_components
      if (!area && addressComponents) {
        // Try all possible area fields (but exclude state and generic names!)
        const possibleAreaFields = [
          addressComponents.sublocality,
          addressComponents.sublocality_level_1,
          addressComponents.neighborhood,
          addressComponents.sublocality_level_2,
          addressComponents.locality,
          addressComponents.area, // Check area last
        ].filter(field => {
          // Filter out invalid/generic area names
          if (!field) return false
          const fieldLower = field.toLowerCase()
          return fieldLower !== state.toLowerCase() &&
            fieldLower !== city.toLowerCase() &&
            !fieldLower.includes("district") &&
            !fieldLower.includes("city") &&
            field.length > 3 // Minimum length
        })

        if (possibleAreaFields.length > 0) {
          const fallbackArea = possibleAreaFields[0]
          // CRITICAL: If formatted_address exists and has a different area, prefer formatted_address
          // This ensures "New Palasia" from formatted_address beats "Palacia" from address_components
          if (formattedAddress && formattedAddress.toLowerCase().includes(fallbackArea.toLowerCase())) {
            // formatted_address contains the fallback area, so it's likely more complete
            // Try one more time to extract from formatted_address
            debugLog("?? address_components has area but formatted_address might have full name, re-checking formatted_address")
          } else {
            area = fallbackArea
            debugLog("? Extracted area from address_components (fallback):", area)
          }
        }
      }

      // Also check address_components array structure (Google Maps style)
      if (!area && result?.address_components && Array.isArray(result.address_components)) {
        const components = result.address_components
        // Find sublocality or neighborhood in the components array
        const sublocality = components.find(comp =>
          comp.types?.includes('sublocality') ||
          comp.types?.includes('sublocality_level_1') ||
          comp.types?.includes('neighborhood')
        )
        if (sublocality?.long_name || sublocality?.short_name) {
          area = sublocality.long_name || sublocality.short_name
        }
      }

      // FINAL FALLBACK: If area is still empty, force extract from formatted_address
      // This is the last resort - be very aggressive (ZOMATO-STYLE)
      // Even if formatted_address only has 2 parts (City, State), try to extract area
      if (!area && formattedAddress) {
        const parts = formattedAddress.split(',').map(p => p.trim()).filter(p => p.length > 0)
        debugLog("?? Final fallback: Parsing formatted_address for area", { parts, city, state })

        if (parts.length >= 2) {
          const potentialArea = parts[0]
          // Very lenient check - if it's not obviously city/state, use it as area
          const potentialAreaLower = potentialArea.toLowerCase()
          const cityLower = (city || "").toLowerCase()
          const stateLower = (state || "").toLowerCase()

          if (potentialArea &&
            potentialArea.length > 2 &&
            potentialArea.length < 50 &&
            !potentialArea.match(/^\d+/) &&
            potentialAreaLower !== cityLower &&
            potentialAreaLower !== stateLower &&
            !potentialAreaLower.includes("district") &&
            !potentialAreaLower.includes("city")) {
            area = potentialArea
            debugLog("??? FORCE EXTRACTED area (final fallback):", area)
          }
        }
      }

      // Final validation and logging
      debugLog("??? FINAL PARSED OLA Maps response:", {
        city,
        state,
        country,
        area,
        formattedAddress,
        hasArea: !!area,
        areaLength: area?.length || 0
      })

      // CRITICAL: If formattedAddress has only 2 parts, OLA Maps didn't provide sublocality
      // Try to get more detailed location using coordinates-based search
      if (!area && formattedAddress) {
        const parts = formattedAddress.split(',').map(p => p.trim()).filter(p => p.length > 0)

        // If we have 3+ parts, extract area from first part
        if (parts.length >= 3) {
          // ZOMATO PATTERN: "New Palasia, Indore, Madhya Pradesh"
          // First part = Area, Second = City, Third = State
          const potentialArea = parts[0]
          // Validate it's not state, city, or generic names
          const potentialAreaLower = potentialArea.toLowerCase()
          if (potentialAreaLower !== state.toLowerCase() &&
            potentialAreaLower !== city.toLowerCase() &&
            !potentialAreaLower.includes("district") &&
            !potentialAreaLower.includes("city")) {
            area = potentialArea
            if (!city && parts[1]) city = parts[1]
            if (!state && parts[2]) state = parts[2]
            debugLog("??? ZOMATO-STYLE EXTRACTION:", { area, city, state })
          }
        } else if (parts.length === 2) {
          // Only 2 parts: "Indore, Madhya Pradesh" - area is missing
          // OLA Maps API didn't provide sublocality
          debugWarn("?? Only 2 parts in address - OLA Maps didn't provide sublocality")
          // Try to extract from other fields in the response
          // Check if result has any other location fields
          if (result.locality && result.locality !== city) {
            area = result.locality
            debugLog("? Using locality as area:", area)
          } else if (result.neighborhood) {
            area = result.neighborhood
            debugLog("? Using neighborhood as area:", area)
          } else {
            // Leave area empty - will show city instead
            area = ""
          }
        }
      }

      // FINAL VALIDATION: Never use state as area!
      if (area && state && area.toLowerCase() === state.toLowerCase()) {
        debugWarn("?????? REJECTING area (same as state):", area)
        area = ""
      }

      // FINAL VALIDATION: Reject district names
      if (area && area.toLowerCase().includes("district")) {
        debugWarn("?????? REJECTING area (contains district):", area)
        area = ""
      }

      // If we have a valid formatted address or city, return it
      if (formattedAddress || city) {
        const finalLocation = {
          city: city || "Unknown City",
          state: state || "",
          country: country || "",
          area: area || "", // Area is CRITICAL - must be extracted
          address: formattedAddress || `${city || "Current Location"}`,
          formattedAddress: formattedAddress || `${city || "Current Location"}`,
        }

        debugLog("??? RETURNING LOCATION DATA:", finalLocation)
        return finalLocation
      }

      // If no valid data, throw to trigger fallback
      throw new Error("No valid address data from OLA Maps")
    } catch (err) {
      debugWarn("?? OLA Maps geocoding failed, trying BigDataCloud:", err.message)
      // Fallback to direct reverse geocoding (BigDataCloud)
      try {
        return await reverseGeocodeWithGoogleMaps(latitude, longitude)
      } catch (fallbackErr) {
        // If all fail, return minimal location data
        debugError("? All reverse geocoding failed:", fallbackErr)
        return {
          city: "Current Location",
          address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          formattedAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        }
      }
    }
  }

  /* ===================== DB FETCH ===================== */
  const fetchLocationFromDB = async () => {
    try {
      // Check if user is authenticated before trying to fetch from DB
      const userToken = localStorage.getItem('user_accessToken') || localStorage.getItem('accessToken')
      if (!userToken || userToken === 'null' || userToken === 'undefined') {
        // User not logged in - skip DB fetch, return null to use localStorage
        return null
      }

      const dbLocationAgeMs = Date.now() - lastDbLocationFetchAtRef.current
      if (lastDbLocationRef.current && dbLocationAgeMs < DB_LOCATION_FETCH_TTL_MS) {
        return lastDbLocationRef.current
      }

      // Deduplicate DB fetch globally across components
      if (window._globalFetchDbLocationInFlight) {
        return await window._globalFetchDbLocationInFlight
      }

      window._globalFetchDbLocationInFlight = (async () => {
        const res = await userAPI.getLocation()
        const loc = res?.data?.data?.location
        if (loc?.latitude && loc?.longitude) {
          // Validate coordinates are in India range BEFORE attempting geocoding
          const isInIndiaRange = loc.latitude >= 6.5 && loc.latitude <= 37.1 && loc.longitude >= 68.7 && loc.longitude <= 97.4 && loc.longitude > 0

          if (!isInIndiaRange || loc.longitude < 0) {
            // Coordinates are outside India - return placeholder
            debugWarn("?? Coordinates from DB are outside India range:", { latitude: loc.latitude, longitude: loc.longitude })
            const outOfRangeLocation = {
              latitude: loc.latitude,
              longitude: loc.longitude,
              city: "Current Location",
              state: "",
              country: "",
              area: "",
              address: "Select location",
              formattedAddress: "Select location",
            }
            return outOfRangeLocation
          }

          const hasUsableStoredAddress =
            (loc.formattedAddress && loc.formattedAddress !== "Select location") ||
            (loc.address && loc.address !== "Select location") ||
            (loc.city && loc.city !== "Current Location")

          if (hasUsableStoredAddress) {
            const storedLocation = {
              latitude: loc.latitude,
              longitude: loc.longitude,
              city: loc.city || "Current Location",
              area: loc.area || "",
              state: loc.state || "",
              country: loc.country || "",
              address: loc.address || loc.formattedAddress || "Select location",
              formattedAddress: loc.formattedAddress || loc.address || "Select location"
            }
            return storedLocation
          }

          try {
            const addr = await reverseGeocodeWithGoogleMaps(
              loc.latitude,
              loc.longitude,
              { includePlaceDetails: false }
            )
            const resolvedLocation = { ...addr, latitude: loc.latitude, longitude: loc.longitude }
            return resolvedLocation
          } catch (geocodeErr) {
            // If reverse geocoding fails, return location without coordinates in address
            debugWarn("?? Reverse geocoding failed in fetchLocationFromDB:", geocodeErr.message)
            const fallbackLocation = {
              latitude: loc.latitude,
              longitude: loc.longitude,
              city: "Current Location",
              area: "",
              state: "",
              address: "Select location", // Don't show coordinates
              formattedAddress: "Select location", // Don't show coordinates
            }
            return fallbackLocation
          }
        }
        return null;
      })();

      const resolved = await window._globalFetchDbLocationInFlight;
      window._globalFetchDbLocationInFlight = null;
      
      if (resolved) {
        lastDbLocationRef.current = resolved
        lastDbLocationFetchAtRef.current = Date.now()
        return resolved
      }
    } catch (err) {
      window._globalFetchDbLocationInFlight = null;
      // Silently fail for 404/401 (user not authenticated) or network errors
      if (err.code !== "ERR_NETWORK" && err.response?.status !== 404 && err.response?.status !== 401) {
        debugError("DB location fetch error:", err)
      }
    }
    return null
  }

  /* ===================== MAIN LOCATION ===================== */
  const getLocation = async (updateDB = true, forceFresh = false, showLoading = false) => {
    const requestId = ++gpsRequestSeqRef.current
    const isCurrentGpsRequest = () => requestId === gpsRequestSeqRef.current

    const commitGpsUpdate = ({
      loc,
      loading: nextLoading,
      error: nextError,
      persist = false,
      permission = null,
    } = {}) => {
      if (!isCurrentGpsRequest()) return false
      if (loc !== undefined) {
        setLocation(loc)
        syncCoordinatesFromLocation(loc)
      }
      if (nextLoading !== undefined) setLoading(nextLoading)
      if (nextError !== undefined) setError(nextError)
      if (permission === "granted") markBrowserGeolocationGranted()
      if (permission === "denied") markBrowserGeolocationDenied()
      if (persist && loc) {
        localStorage.setItem("userLocation", JSON.stringify(loc))
      }
      return true
    }

    // If not forcing fresh, try DB first (faster)
    let dbLocation = !forceFresh ? await fetchLocationFromDB() : null
    if (dbLocation && !forceFresh) {
      commitGpsUpdate({ loc: dbLocation, loading: showLoading ? false : undefined })
      return isCurrentGpsRequest() ? dbLocation : null
    }

    if (!navigator.geolocation) {
      if (isCurrentGpsRequest()) {
        setError("Geolocation not supported")
        if (showLoading) setLoading(false)
      }
      return isCurrentGpsRequest() ? dbLocation : null
    }

    // Helper function to get position with retry mechanism
    const getPositionWithRetry = (options, retryCount = 0) => {
      return new Promise((resolve, reject) => {
        const isRetry = retryCount > 0
        debugLog(`?? Requesting location${isRetry ? ' (retry with lower accuracy)' : ' (high accuracy)'}...`)
        debugLog(`?? Force fresh: ${forceFresh ? 'YES' : 'NO'}, maximumAge: ${options.maximumAge || (forceFresh ? 0 : 60000)}`)

        // Use cached location if available and not too old (faster response)
        // If forceFresh is true, don't use cache (maximumAge: 0)
        const cachedOptions = {
          ...options,
          maximumAge: forceFresh ? 0 : (options.maximumAge || 60000), // If forceFresh, get fresh location
        }

        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              const { latitude, longitude, accuracy } = pos.coords
              const timestamp = pos.timestamp || Date.now()
              const age = Date.now() - timestamp

              if (forceFresh && age > 30000) {
                debugWarn(`? Stale GPS location detected (age: ${age}ms), rejecting...`)
                return reject({ code: 3, message: "Stale location" })
              }

              debugLog(`? Got location${isRetry ? ' (lower accuracy)' : ' (high accuracy)'}:`, {
                latitude,
                longitude,
                accuracy: `${accuracy}m`,
                timestamp: new Date(timestamp).toISOString(),
                coordinates: `${latitude.toFixed(8)}, ${longitude.toFixed(8)}`
              })

              // Validate coordinates are in India range BEFORE attempting geocoding
              // India: Latitude 6.5� to 37.1� N, Longitude 68.7� to 97.4� E
              const isInIndiaRange = latitude >= 6.5 && latitude <= 37.1 && longitude >= 68.7 && longitude <= 97.4 && longitude > 0

              // Reverse geocode (BigDataCloud via reverseGeocodeWithGoogleMaps wrapper)
              let addr
              if (!isInIndiaRange || longitude < 0) {
                // Coordinates are outside India - skip geocoding and use placeholder
                debugWarn("?? Coordinates outside India range, skipping geocoding:", { latitude, longitude })
                addr = {
                  city: "Current Location",
                  state: "",
                  country: "",
                  area: "",
                  address: "Select location",
                  formattedAddress: "Select location",
                }
              } else {
                debugLog("?? Calling reverse geocode with coordinates:", { latitude, longitude })
                try {
                  addr = await reverseGeocodeWithGoogleMaps(latitude, longitude, {
                    includePlaceDetails: Boolean(forceFresh && showLoading),
                    forceFresh: forceFresh
                  })
                  debugLog("? Reverse geocoding successful:", addr)
                } catch (geocodeErr) {
                  debugWarn("?? Primary geocoding failed, trying fallback:", geocodeErr.message)
                  try {
                    // Fallback to direct reverse geocode (BigDataCloud)
                    addr = await reverseGeocodeDirect(latitude, longitude, forceFresh)
                    debugLog("? Fallback geocoding successful:", addr)

                    // Validate fallback result - if it still has placeholder values, don't use it
                    if (addr.city === "Current Location" || addr.address.includes(latitude.toFixed(4))) {
                      debugWarn("?? Fallback geocoding returned placeholder, will not save")
                      addr = {
                        city: "Current Location",
                        state: "",
                        country: "",
                        area: "",
                        address: "Select location",
                        formattedAddress: "Select location",
                      }
                    }
                  } catch (fallbackErr) {
                    debugError("? All geocoding methods failed:", fallbackErr.message)
                    addr = {
                      city: "Current Location",
                      state: "",
                      country: "",
                      area: "",
                      address: "Select location",
                      formattedAddress: "Select location",
                    }
                  }
                }
              }
              debugLog("Reverse geocode result:", addr)
              if (addr?.formattedAddress && addr.formattedAddress !== "Select location") {
                lastResolvedAddressRef.current = addr
                lastGeocodedCoordsRef.current = { latitude, longitude }
                lastGeocodeAtRef.current = Date.now()
              }
              // Ensure we don't use coordinates as address if we have area/city
              // Keep the complete formattedAddress from geocoder when available
              const completeFormattedAddress = addr.formattedAddress || "";
              let displayAddress = addr.address || "";

              // If address contains coordinates pattern, use area/city instead
              const isCoordinatesPattern = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(displayAddress.trim());
              if (isCoordinatesPattern) {
                if (addr.area && addr.area.trim() !== "") {
                  displayAddress = addr.area;
                } else if (addr.city && addr.city.trim() !== "" && addr.city !== "Unknown City") {
                  displayAddress = addr.city;
                }
              }

              // Build location object with ALL fields from reverse geocoding
              const finalLoc = {
                ...addr, // This includes: city, state, area, street, streetNumber, postalCode, formattedAddress
                latitude,
                longitude,
                accuracy: accuracy || null,
                address: displayAddress, // Locality parts for navbar display
                formattedAddress: completeFormattedAddress || addr.formattedAddress || displayAddress // Complete detailed address
              }

              // Check if location has placeholder values - don't save placeholders
              const hasPlaceholder =
                finalLoc.city === "Current Location" ||
                finalLoc.address === "Select location" ||
                finalLoc.formattedAddress === "Select location" ||
                (!finalLoc.city && !finalLoc.address && !finalLoc.formattedAddress && !finalLoc.area);

              if (hasPlaceholder) {
                debugWarn("?? Skipping save - location contains placeholder values:", finalLoc)
                const coordOnlyLoc = {
                  latitude,
                  longitude,
                  accuracy: accuracy || null,
                  city: finalLoc.city,
                  address: finalLoc.address,
                  formattedAddress: finalLoc.formattedAddress
                }
                if (!commitGpsUpdate({
                  loc: coordOnlyLoc,
                  loading: showLoading ? false : undefined,
                  error: null,
                  permission: "granted",
                })) {
                  resolve(null)
                  return
                }
                resolve(coordOnlyLoc)
                return
              }

              debugLog("?? Saving location:", finalLoc)
              if (!commitGpsUpdate({
                loc: finalLoc,
                loading: showLoading ? false : undefined,
                error: null,
                permission: "granted",
                persist: true,
              })) {
                resolve(null)
                return
              }

              if (updateDB && isCurrentGpsRequest()) {
                await updateLocationInDB(finalLoc).catch(err => {
                  debugWarn("Failed to update location in DB:", err)
                })
              }
              resolve(isCurrentGpsRequest() ? finalLoc : null)
            } catch (err) {
              debugError("? Error processing location:", err)
              // Try one more time with direct reverse geocode as last resort
              const { latitude, longitude } = pos.coords

              try {
                debugLog("?? Last attempt: trying direct reverse geocode...")
                const lastResortAddr = await reverseGeocodeDirect(latitude, longitude)

                // Check if we got valid data (not just coordinates)
                if (lastResortAddr &&
                  lastResortAddr.city !== "Current Location" &&
                  !lastResortAddr.address.includes(latitude.toFixed(4)) &&
                  lastResortAddr.formattedAddress &&
                  !lastResortAddr.formattedAddress.includes(latitude.toFixed(4))) {
                  const lastResortLoc = {
                    ...lastResortAddr,
                    latitude,
                    longitude,
                    accuracy: pos.coords.accuracy || null
                  }
                  debugLog("? Last resort geocoding succeeded:", lastResortLoc)
                  if (!commitGpsUpdate({
                    loc: lastResortLoc,
                    loading: showLoading ? false : undefined,
                    error: null,
                    permission: "granted",
                    persist: true,
                  })) {
                    resolve(null)
                    return
                  }
                  if (updateDB && isCurrentGpsRequest()) {
                    await updateLocationInDB(lastResortLoc).catch(() => { })
                  }
                  resolve(isCurrentGpsRequest() ? lastResortLoc : null)
                  return
                } else {
                  debugWarn("?? Last resort geocoding returned invalid data:", lastResortAddr)
                }
              } catch (lastErr) {
                debugError("? Last resort geocoding also failed:", lastErr.message)
              }

              // If all geocoding fails, use placeholder but don't save
              const fallbackLoc = {
                latitude,
                longitude,
                city: "Current Location",
                area: "",
                state: "",
                address: "Select location", // Don't show coordinates
                formattedAddress: "Select location", // Don't show coordinates
              }
              // Don't save placeholder values to localStorage
              // Only set in state for display
              debugWarn("?? Skipping save - all geocoding failed, using placeholder")
              if (!commitGpsUpdate({
                loc: fallbackLoc,
                loading: showLoading ? false : undefined,
                permission: "granted",
              })) {
                resolve(null)
                return
              }
              resolve(isCurrentGpsRequest() ? fallbackLoc : null)
            }
          },
          async (err) => {
            // If timeout and we haven't retried yet, try with lower accuracy
            if (err.code === 3 && retryCount === 0 && options.enableHighAccuracy) {
              debugWarn("?? High accuracy timeout, retrying with lower accuracy...")
              // Retry with lower accuracy - faster response (uses network-based location)
              getPositionWithRetry({
                enableHighAccuracy: false,
                timeout: 5000,  // 5 seconds for lower accuracy (network-based is faster)
                maximumAge: forceFresh ? 0 : 300000 // If forceFresh, force fresh network location too
              }, 1).then(resolve).catch(reject)
              return
            }

            // Don't log timeout errors as errors - they're expected in some cases
            if (err.code === 3) {
              debugWarn("?? Geolocation timeout (code 3) - using fallback location")
            } else {
              debugError("? Geolocation error:", err.code, err.message)
            }
            // Try multiple fallback strategies
            try {
              if (forceFresh) {
                // User explicitly requested a fresh GPS location.
                // Do NOT fallback to old DB or cached locations!
                throw new Error("Could not get fresh GPS location. Please check your device settings.");
              }

              // Strategy 1: Use DB location if available
              let fallback = dbLocation
              if (!fallback) {
                fallback = await fetchLocationFromDB()
              }

              // Strategy 2: Use cached location from localStorage
              if (!fallback) {
                const stored = localStorage.getItem("userLocation")
                if (stored) {
                  try {
                    fallback = JSON.parse(stored)
                    debugLog("? Using cached location from localStorage")
                  } catch (parseErr) {
                    debugWarn("?? Failed to parse stored location:", parseErr)
                  }
                }
              }

              if (fallback) {
                debugLog("? Using fallback location:", fallback)
                if (!commitGpsUpdate({
                  loc: fallback,
                  loading: showLoading ? false : undefined,
                  error: err.code !== 3 ? err.message : undefined,
                  permission: err.code === 1 ? "denied" : "granted",
                })) {
                  resolve(null)
                  return
                }
                resolve(isCurrentGpsRequest() ? fallback : null)
              } else {
                debugWarn("?? No fallback location available, setting default")
                const defaultLocation = {
                  city: "Select location",
                  address: "Select location",
                  formattedAddress: "Select location"
                }
                if (!commitGpsUpdate({
                  loc: defaultLocation,
                  loading: showLoading ? false : undefined,
                  error: err.code === 3 ? "Location request timed out. Please try again." : err.message,
                  permission: err.code === 1 ? "denied" : undefined,
                })) {
                  resolve(null)
                  return
                }
                resolve(isCurrentGpsRequest() ? defaultLocation : null)
              }
            } catch (fallbackErr) {
              debugWarn("?? Fallback retrieval failed:", fallbackErr)
              if (!isCurrentGpsRequest()) {
                resolve(null)
                return
              }
              setLocation(null)
              setError(err.code === 3 ? "Location request timed out. Please try again." : err.message)
              if (err.code === 1) {
                markBrowserGeolocationDenied()
              }
              if (showLoading) setLoading(false)
              resolve(null)
            }
          },
          options
        )
      })
    }

    // Try with high accuracy first
    // If forceFresh is true, don't use cached location (maximumAge: 0)
    // Otherwise, allow cached location for faster response
    return getPositionWithRetry({
      enableHighAccuracy: true,  // Use GPS for exact location (highest accuracy)
      timeout: 15000,            // 15 seconds timeout (gives GPS more time to get accurate fix)
      maximumAge: forceFresh ? 0 : 60000  // If forceFresh, get fresh location. Otherwise allow 1 minute cache
    })
  }

  /* ===================== WATCH LOCATION ===================== */
  const startWatchingLocation = () => {
    if (!navigator.geolocation) {
      debugWarn("?? Geolocation not supported")
      return
    }

    // Clear any existing watch
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    debugLog("?? Starting to watch location for live updates...")

    let retryCount = 0
    const maxRetries = 2

    const startWatch = (options) => {
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          try {
            const { latitude, longitude, accuracy } = pos.coords
            debugLog("?? Location updated:", { latitude, longitude, accuracy: `${accuracy}m` })

            // Reset retry count on success
            retryCount = 0

            // Validate coordinates are in India range BEFORE attempting geocoding
            // India: Latitude 6.5� to 37.1� N, Longitude 68.7� to 97.4� E
            const isInIndiaRange = latitude >= 6.5 && latitude <= 37.1 && longitude >= 68.7 && longitude <= 97.4 && longitude > 0

            // "Geocode once" mode:
            // Do NOT reverse-geocode on every watch tick (it causes frequent api-bdc.io calls).
            // Instead reuse the last resolved address (from the initial page load / explicit request).
            let addr
            if (!isInIndiaRange || longitude < 0) {
              debugWarn("?? Coordinates outside India range; skipping reverse geocoding:", { latitude, longitude })
              addr = {
                city: "Current Location",
                state: "",
                country: "",
                area: "",
                address: "Select location",
                formattedAddress: "Select location",
              }
            } else if (lastResolvedAddressRef.current && lastResolvedAddressRef.current.formattedAddress) {
              addr = lastResolvedAddressRef.current
            } else {
              // If we don't have an address yet, avoid network calls and keep placeholders.
              // (The initial location fetch should set `lastResolvedAddressRef`.)
              addr = {
                city: "Current Location",
                state: "",
                country: "",
                area: "",
                address: "Select location",
                formattedAddress: "Select location",
              }
            }

            // CRITICAL: Ensure formattedAddress is NEVER coordinates
            // Check if reverse geocoding returned proper address or just coordinates
            let completeFormattedAddress = addr.formattedAddress || "";
            let displayAddress = addr.address || "";

            // Check if formattedAddress is coordinates pattern
            const isFormattedAddressCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(completeFormattedAddress.trim());
            const isDisplayAddressCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(displayAddress.trim());

            // If formattedAddress is coordinates, it means reverse geocoding failed
            // Build proper address from components or use fallback
            if (isFormattedAddressCoordinates || !completeFormattedAddress || completeFormattedAddress === "Select location") {
              debugWarn("?????? Reverse geocoding returned coordinates or empty address!")
              debugWarn("?? Attempting to build address from components:", {
                city: addr.city,
                state: addr.state,
                area: addr.area,
                street: addr.street,
                streetNumber: addr.streetNumber
              })

              // Build address from components
              const addressParts = [];
              if (addr.area && addr.area.trim() !== "") {
                addressParts.push(addr.area);
              }
              if (addr.city && addr.city.trim() !== "") {
                addressParts.push(addr.city);
              }
              if (addr.state && addr.state.trim() !== "") {
                addressParts.push(addr.state);
              }

              if (addressParts.length > 0) {
                completeFormattedAddress = addressParts.join(', ');
                displayAddress = addr.area || addr.city || "Select location";
                debugLog("? Built address from components:", completeFormattedAddress);
              } else {
                // Final fallback - don't use coordinates
                completeFormattedAddress = addr.city || "Select location";
                displayAddress = addr.city || "Select location";
                debugWarn("?? Using fallback address:", completeFormattedAddress);
              }
            }

            // Also check displayAddress
            if (isDisplayAddressCoordinates) {
              displayAddress = addr.area || addr.city || "Select location";
            }

            // Build location object with ALL fields from reverse geocoding
            // NEVER include coordinates in formattedAddress or address
            const loc = {
              ...addr, // This includes: city, state, area, street, streetNumber, postalCode
              latitude,
              longitude,
              accuracy: accuracy || null,
              address: displayAddress, // Locality parts for navbar display (NEVER coordinates)
              formattedAddress: completeFormattedAddress // Complete detailed address (NEVER coordinates)
            }

            // STABILITY: Only update if location changed significantly (>10m) OR address improved
            const currentLoc = location
            if (currentLoc && currentLoc.latitude && currentLoc.longitude) {
              // Calculate distance in meters (Haversine formula simplified for small distances)
              const latDiff = latitude - currentLoc.latitude
              const lngDiff = longitude - currentLoc.longitude
              const distanceMeters = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111320 // ~111320m per degree

              // Check if address is better (more parts = more complete)
              const currentParts = (currentLoc.formattedAddress || "").split(',').filter(p => p.trim()).length
              const newParts = completeFormattedAddress.split(',').filter(p => p.trim()).length
              const addressImproved = newParts > currentParts

              // Only update if moved >10 meters OR address significantly improved
              if (distanceMeters <= 10 && !addressImproved) {
                debugLog(`?? Location unchanged (${distanceMeters.toFixed(1)}m change), keeping stable address`)
                return // Don't update - keep current stable address
              }

              debugLog(`?? Location updated: ${distanceMeters.toFixed(1)}m change, address parts: ${currentParts} ? ${newParts}`)
            }

            // Final validation - ensure formattedAddress is never coordinates
            if (loc.formattedAddress && /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(loc.formattedAddress.trim())) {
              debugError("??? CRITICAL: formattedAddress is still coordinates! Replacing with city/area")
              loc.formattedAddress = loc.area || loc.city || "Select location";
              loc.address = loc.area || loc.city || "Select location";
            }

            // Check if location has placeholder values - don't save placeholders
            const hasPlaceholder =
              loc.city === "Current Location" ||
              loc.address === "Select location" ||
              loc.formattedAddress === "Select location" ||
              (!loc.city && !loc.address && !loc.formattedAddress && !loc.area);

            if (hasPlaceholder) {
              debugWarn("?? Skipping live location update - contains placeholder values:", loc)
              return // Don't update location or save to DB
            }

            // Check if coordinates have changed significantly (threshold: ~10 meters)
            const coordThreshold = 0.0001 // approximately 10 meters
            const coordsChanged =
              !prevLocationCoordsRef.current.latitude ||
              !prevLocationCoordsRef.current.longitude ||
              Math.abs(prevLocationCoordsRef.current.latitude - loc.latitude) > coordThreshold ||
              Math.abs(prevLocationCoordsRef.current.longitude - loc.longitude) > coordThreshold
            let persistedLocation = loc
            try {
              const storedRaw = localStorage.getItem("userLocation")
              const storedLocation = storedRaw ? JSON.parse(storedRaw) : null
              const savedLabel = loc?.label || storedLocation?.label
              if (savedLabel && String(savedLabel).trim()) {
                persistedLocation = { ...loc, label: String(savedLabel).trim() }
              }
            } catch {
              persistedLocation = loc
            }

            // Only update location state if coordinates changed significantly
            if (coordsChanged) {
              prevLocationCoordsRef.current = { latitude: loc.latitude, longitude: loc.longitude }
              debugLog("?? Updating live location:", loc)
              localStorage.setItem("userLocation", JSON.stringify(persistedLocation))
              setLocation(persistedLocation)
              markBrowserGeolocationGranted()
              syncCoordinatesFromLocation(persistedLocation)
              setError(null)
            } else {
              // Coordinates haven't changed significantly, skip state update to prevent re-renders
              // Still update localStorage silently for persistence
              localStorage.setItem("userLocation", JSON.stringify(persistedLocation))
            }

            // Debounce DB updates - only update every 5 seconds
            clearTimeout(updateTimerRef.current)
            updateTimerRef.current = setTimeout(() => {
              updateLocationInDB(loc).catch(err => {
                debugWarn("Failed to update location in DB:", err)
              })
            }, 5000)
          } catch (err) {
            debugError("? Error processing live location update:", err)
            // If reverse geocoding fails, DON'T use coordinates - use placeholder
            const { latitude, longitude } = pos.coords
            const fallbackLoc = {
              latitude,
              longitude,
              city: "Current Location",
              area: "",
              state: "",
              address: "Select location", // NEVER use coordinates
              formattedAddress: "Select location", // NEVER use coordinates
            }
            debugWarn("?? Using fallback location (reverse geocoding failed):", fallbackLoc)
            // Don't save placeholder values to localStorage
            // Only set in state for display
            debugWarn("?? Skipping localStorage save - fallback location contains placeholder values")
            setLocation(fallbackLoc)
            markBrowserGeolocationGranted()
            syncCoordinatesFromLocation(fallbackLoc)
          }
        },
        (err) => {
          // Don't log timeout errors for watchPosition (it's a background operation)
          // Only log non-timeout errors
          if (err.code !== 3) {
            debugWarn("?? Watch position error (non-timeout):", err.code, err.message)
          }

          // If timeout and we haven't exceeded max retries, retry with HIGH ACCURACY GPS
          // CRITICAL: Keep using GPS (not network-based) for accurate location
          // Network-based location won't give exact landmarks like "Mama Loca Cafe"
          if (err.code === 3 && retryCount < maxRetries) {
            retryCount++
            debugLog(`?? GPS timeout, retrying with high accuracy GPS (attempt ${retryCount}/${maxRetries})...`)

            // Clear current watch
            if (watchIdRef.current) {
              navigator.geolocation.clearWatch(watchIdRef.current)
              watchIdRef.current = null
            }

            // Retry with HIGH ACCURACY GPS (don't use network-based location)
            // Network-based location is less accurate and won't give exact landmarks
            setTimeout(() => {
              startWatch({
                enableHighAccuracy: true,   // Keep using GPS (not network-based)
                timeout: 20000,              // 20 seconds timeout (give GPS more time)
                maximumAge: 0                // Always get fresh GPS location
              })
            }, 3000) // 3 second delay before retry
            return
          }

          // If all retries failed, silently continue - don't set error state for background watch
          // The watch will keep trying in background, user won't notice
          // Only set error for non-timeout errors that are critical
          if (err.code !== 3) {
            setError(err.message)
            if (err.code === 1) {
              markBrowserGeolocationDenied()
            }
          }

          // Don't clear the watch - let it keep trying in background
          // The user might move to a location with better GPS signal
        },
        options
      )
    }

    // Start with HIGH ACCURACY GPS for live location tracking
    // CRITICAL: enableHighAccuracy: true forces GPS (not network-based) for accurate location
    // Network-based location won't give exact landmarks like "Mama Loca Cafe"
    startWatch({
      enableHighAccuracy: true,   // CRITICAL: Use GPS (not network-based) for accurate location
      timeout: 15000,             // 15 seconds timeout (gives GPS more time to get accurate fix)
      maximumAge: 0               // Always get fresh GPS location (no cache for live tracking)
    })

    debugLog("??? GPS High Accuracy enabled for live location tracking")
    debugLog("? GPS will provide accurate coordinates for reverse geocoding")
    debugLog("? Network-based location disabled (less accurate)")
  }

  const stopWatchingLocation = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    clearTimeout(updateTimerRef.current)
  }

  useEffect(() => {
    if (typeof window === "undefined") return undefined

    const applyExternalLocationUpdate = (event) => {
      try {
        const nextLocation =
          event?.detail?.location ||
          JSON.parse(window.localStorage.getItem("userLocation") || "null")

        if (!nextLocation || typeof nextLocation !== "object") return

        setLocation(nextLocation)
        syncCoordinatesFromLocation(nextLocation)
        setLoading(false)
        setError(null)
      } catch (err) {
        debugWarn("Failed to apply external location update:", err)
      }
    }

    window.addEventListener("userLocationUpdated", applyExternalLocationUpdate)
    return () => {
      window.removeEventListener("userLocationUpdated", applyExternalLocationUpdate)
    }
  }, [])

  /* ===================== INIT ===================== */
  useEffect(() => {
    // Load stored location first for IMMEDIATE display (no loading state)
    const stored = localStorage.getItem(USER_LOCATION_STORAGE_KEY)
    let shouldForceRefresh = false
    let hasInitialLocation = false

    if (stored) {
      try {
        const parsedLocation = JSON.parse(stored)

        const lat = Number(parsedLocation?.latitude)
        const lng = Number(parsedLocation?.longitude)
        const hasLatLng = Number.isFinite(lat) && Number.isFinite(lng)

        if (parsedLocation && hasLatLng) {
          setLocation(parsedLocation)
          syncCoordinatesFromLocation(parsedLocation)
          setLoading(false)
          hasInitialLocation = true
          shouldForceRefresh = false
          debugLog("?? Loaded stored location instantly (no auto-refresh):", parsedLocation)
        } else {
          localStorage.removeItem(USER_LOCATION_STORAGE_KEY)
          debugLog("?? Stored location missing coordinates; cleared stale cache")
          shouldForceRefresh = true
        }
      } catch (err) {
        debugError("Failed to parse stored location:", err)
        localStorage.removeItem(USER_LOCATION_STORAGE_KEY)
        shouldForceRefresh = true
      }
    }

    // If no cached location, try DB
    if (!hasInitialLocation) {
      fetchLocationFromDB()
        .then((dbLoc) => {
          if (dbLoc && Number.isFinite(Number(dbLoc.latitude)) && Number.isFinite(Number(dbLoc.longitude))) {
            setLocation(dbLoc)
            syncCoordinatesFromLocation(dbLoc)
            setLoading(false)
            hasInitialLocation = true
            debugLog("?? Loaded location from DB:", dbLoc)
          } else {
            // No location found - set loading to false and show fallback
            setLoading(false)
            shouldForceRefresh = true
          }
        })
        .catch(() => {
          setLoading(false)
          shouldForceRefresh = true
        })
    }

    // Always ensure loading is false after initial check
    // Safety timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      setLoading((currentLoading) => {
        if (currentLoading) {
          debugWarn("?? Loading timeout - setting loading to false")
          // Only set fallback if we still don't have a location
          setLocation((currentLocation) => {
            if (!currentLocation ||
              (currentLocation.formattedAddress === "Select location" &&
                !currentLocation.latitude && !currentLocation.city)) {
              return {
                city: "Select location",
                address: "Select location",
                formattedAddress: "Select location"
              }
            }
            return currentLocation
          })
        }
        return false
      })
    }, 5000) // 5 second safety timeout (increased to allow background fetch to complete)

    // Don't set fallback immediately - wait for background fetch to complete
    // The background fetch will set the location, or we'll use the cached/DB location
    // Only set fallback if we have no location after all attempts

    let permStatusObj = null;
    let permListener = null;

    // Request fresh location in BACKGROUND (non-blocking)
    // CRITICAL FIX: Only auto-request if permission is ALREADY granted
    // This prevents "Requests geolocation permission on page load" warning
    const checkPermissionAndStart = async () => {
      try {
        let browserGranted = false;

        if (navigator.permissions && navigator.permissions.query) {
          try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            permStatusObj = result;
            setGeolocationPermission(result.state);
            permListener = () => {
              setGeolocationPermission(result.state);
              if (result.state === 'granted') {
                debugLog("?? Geolocation permission changed to granted! Fetching fresh location...");
                getLocation(true, true).then((freshLoc) => {
                  if (freshLoc) {
                    window.dispatchEvent(new CustomEvent("userLocationUpdated", { detail: { location: freshLoc } }));
                  }
                }).catch(() => {});
              }
            };
            result.addEventListener('change', permListener);
            result.onchange = permListener;

            if (result.state === 'granted') {
              browserGranted = true;
            } else {
              debugLog(`?? Geolocation permission is '${result.state}' - Waiting for user action (avoiding prompt on load)`);
            }
          } catch (permErr) {
            debugWarn("?? Permission query failed:", permErr);
          }
        } else {
          // Fallback for browsers without permissions API - assume not granted to be safe
          setGeolocationPermission("prompt");
          debugLog("?? Permissions API not available - Skipping auto-start");
        }

        if (!browserGranted) {
          // If we have an initial location, we are fine (it's displayed).
          // If we don't, we show "Select Location".
          // In either case, we avoid the PROMPT.
          // Ensure loading is false so UI doesn't hang
          setLoading(false);
          return;
        }

        debugLog("?? Permission granted! Fetching/Watching location...", shouldForceRefresh ? "(FORCE REFRESH)" : "");

        // Only fetch once on initial app open if we have no stored coordinates yet.
        // Do not keep re-geocoding just because the address text is placeholder.
        const shouldFetch = shouldForceRefresh || !hasInitialLocation

        if (shouldFetch) {
          debugLog("?? Fetching location - shouldForceRefresh:", shouldForceRefresh, "hasInitialLocation:", hasInitialLocation)
          getLocation(true, shouldForceRefresh) // forceFresh = true if cached location is incomplete
            .then((location) => {
              if (location &&
                location.formattedAddress !== "Select location" &&
                location.city !== "Current Location") {
                debugLog("? Fresh location fetched:", location)
                debugLog("? Location details:", {
                  formattedAddress: location?.formattedAddress,
                  address: location?.address,
                  city: location?.city,
                  state: location?.state,
                  area: location?.area
                })
                if (AUTO_START_LIVE_WATCH) startWatchingLocation()
              } else {
                // Placeholder result means reverse-geocode failed or was unavailable.
                // Requirement: no more automatic retries; user can trigger manual refresh.
                debugWarn("?? Location fetch returned placeholder; not retrying automatically")
              }
            })
            .catch((err) => {
              debugWarn("?? Background location fetch failed (using cached):", err.message)
              // Don't auto-start live watching; keep cached/localStorage behavior.
              if (AUTO_START_LIVE_WATCH) startWatchingLocation()
            })
        } else {
          // We have a valid location; no need to start live watching.
          if (AUTO_START_LIVE_WATCH) startWatchingLocation()
        }
      } catch (err) {
        debugError("Error in checkPermissionAndStart:", err);
        setLoading(false);
      }
    };

    // Always check permission state on startup.
    // This does NOT trigger browser prompt by itself; it only auto-fetches when permission is already granted.
    checkPermissionAndStart();

    // Cleanup timeout and watcher
    return () => {
      clearTimeout(loadingTimeout)
      debugLog("?? Cleaning up location watcher")
      stopWatchingLocation()
      if (permStatusObj && permListener) {
        permStatusObj.removeEventListener('change', permListener);
        permStatusObj.onchange = null;
      }
    }
  }, [])

  const requestLocation = async () => {
    debugLog("?????? User requested location update - clearing cache and fetching fresh")
    // Invalidate any in-flight GPS work from init/PageNavbar before starting a user request.
    gpsRequestSeqRef.current += 1
    setLoading(true)
    setError(null)

    try {
      // Clear cached location to force fresh fetch
      localStorage.removeItem("userLocation")
      debugLog("??? Cleared cached location from localStorage")

      // Clear global reverse geocode cache so we get a truly fresh address
      globalReverseGeocodeLastSuccess = null
      globalReverseGeocodeLastStartAt = 0
      globalReverseGeocodeLastCoords = { latitude: null, longitude: null }
      globalReverseGeocodeInFlight = null
      debugLog("??? Cleared global reverse geocode cache")

      // Also clear instance-level geocode refs so fresh geocode happens
      lastGeocodedCoordsRef.current = { latitude: null, longitude: null }
      lastGeocodeAtRef.current = 0
      lastResolvedAddressRef.current = null

      // Show loading, so pass showLoading = true
      // forceFresh = true, updateDB = true, showLoading = true
      // This ensures we get fresh GPS coordinates and reverse geocode
      const location = await getLocation(true, true, true)

      debugLog("??? Fresh location requested successfully:", location)
      debugLog("??? Complete Location details:", {
        formattedAddress: location?.formattedAddress,
        address: location?.address,
        city: location?.city,
        state: location?.state,
        area: location?.area,
        pointOfInterest: location?.pointOfInterest,
        premise: location?.premise,
        coordinates: location?.latitude && location?.longitude ?
          `${location.latitude.toFixed(8)}, ${location.longitude.toFixed(8)}` : "N/A",
        hasCompleteAddress: location?.formattedAddress &&
          location.formattedAddress !== "Select location" &&
          !location.formattedAddress.match(/^-?\d+\.\d+,\s*-?\d+\.\d+$/) &&
          location.formattedAddress.split(',').length >= 4
      })

      // Verify we got complete address (POI, building, floor, area, city, state, pincode)
      if (!location?.formattedAddress ||
        location.formattedAddress === "Select location" ||
        location.formattedAddress.match(/^-?\d+\.\d+,\s*-?\d+\.\d+$/) ||
        location.formattedAddress.split(',').length < 4) {
        debugWarn("?????? Location received but address is incomplete!")
        debugWarn("?? Address parts count:", location?.formattedAddress?.split(',').length || 0)
        debugWarn("?? This might be due to:")
        debugWarn("   1. Geocoding service unavailable or rate-limited")
        debugWarn("   2. Location permission not granted")
        debugWarn("   3. GPS accuracy too low (try on mobile device)")
      } else {
        debugLog("??? SUCCESS: Complete detailed address received!")
        debugLog("? Full address:", location.formattedAddress)
      }

      return location
    } catch (err) {
      debugError("? Failed to request location:", err)
      setError(err.message || "Failed to get location")
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    location,
    loading,
    error,
    hasCoordinates,
    geolocationPermission,
    permissionGranted: geolocationPermission === "granted",
    requestLocation,
    startWatchingLocation,
    stopWatchingLocation,
    reverseGeocode: (lat, lng, _options = {}) => reverseGeocodeDirect(lat, lng, _options?.forceFresh || false),
  }
}

