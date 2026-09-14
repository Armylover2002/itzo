/**
 * @deprecated Unused in the food user app. Location selection is handled by
 * `AddressSelectorPage` via `UserLayout.openLocationSelector()`.
 * Kept for reference only — do not mount without coordinating with LocationPrompt.
 */
import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import { ChevronLeft, ChevronRight, Plus, MapPin, MoreHorizontal, Navigation, Home, Building2, Briefcase, Phone, X, Crosshair } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
import { Textarea } from "@food/components/ui/textarea"
import { useLocation as useGeoLocation } from "@food/hooks/useLocation"
import { useProfile } from "@food/context/ProfileContext"
import { toast } from "sonner"
import { locationAPI, userAPI } from "@food/api"
import { Loader } from '@googlemaps/js-api-loader'
import {
  fetchPlaceDetails,
  fetchPlacePredictions,
  initPlacesServices,
  parsePlaceDetails,
  PLACES_SEARCH_DEBOUNCE_MS,
} from "@food/utils/googlePlacesAutocomplete"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

// Enable Maps if API Key is available, otherwise fallback to coordinates-only mode
const MAPS_ENABLED = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY


// Google Maps implementation - Leaflet components removed

// Google Maps implementation - removed Leaflet components

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3 // Earth's radius in meters
  const lat1Rad = lat1 * Math.PI / 180
  const lat2Rad = lat2 * Math.PI / 180
  const deltaLat = (lat2 - lat1) * Math.PI / 180
  const deltaLon = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

// Get icon based on address type/label
const getAddressIcon = (address) => {
  const label = (address.label || address.additionalDetails || "").toLowerCase()
  if (label.includes("home")) return Home
  if (label.includes("work") || label.includes("office")) return Briefcase
  if (label.includes("building") || label.includes("apt")) return Building2
  return Home
}

const syncSelectedLocation = (locationData) => {
  if (!locationData) return
  try {
    localStorage.setItem("userLocation", JSON.stringify(locationData))
    window.dispatchEvent(
      new CustomEvent("userLocationUpdated", {
        detail: { location: locationData },
      })
    )
  } catch {
    // Ignore sync issues and keep selector flow working.
  }
}

export default function LocationSelectorOverlay({ isOpen, onClose }) {
  const { location, loading, requestLocation } = useGeoLocation()
  const { addresses = [], addAddress, updateAddress, setDefaultAddress, userProfile, setActiveAddressId } = useProfile()
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [mapPosition, setMapPosition] = useState([22.7196, 75.8577]) // Default Indore coordinates [lat, lng]
  const [addressFormData, setAddressFormData] = useState({
    street: "",
    city: "",
    state: "",
    zipCode: "",
    additionalDetails: "",
    label: "Home",
    phone: "",
  })
  const [loadingAddress, setLoadingAddress] = useState(false)
  const [mapLoading, setMapLoading] = useState(false)
  const mapContainerRef = useRef(null)
  const googleMapRef = useRef(null) // Google Maps instance
  const greenMarkerRef = useRef(null) // Green marker for address selection
  const blueDotCircleRef = useRef(null) // Blue dot circle for Google Maps
  const userLocationMarkerRef = useRef(null) // Blue dot marker for user location
  const userLocationAccuracyCircleRef = useRef(null) // Accuracy circle for MapLibre/Mapbox
  const watchPositionIdRef = useRef(null) // Geolocation watchPosition ID
  const lastUserLocationRef = useRef(null) // Last user location for tracking
  const locationUpdateTimeoutRef = useRef(null) // Timeout for location updates
  const [currentAddress, setCurrentAddress] = useState("")
  const [addressAutocompleteValue, setAddressAutocompleteValue] = useState("")
  const [placePredictions, setPlacePredictions] = useState([])
  const [isKeywordSearching, setIsKeywordSearching] = useState(false)
  const [showPlacePredictions, setShowPlacePredictions] = useState(false)
  const [lockMapToAutocomplete, setLockMapToAutocomplete] = useState(true)
  const [GOOGLE_MAPS_API_KEY, setGOOGLE_MAPS_API_KEY] = useState(null)
  const autocompleteServiceRef = useRef(null)
  const placesServiceRef = useRef(null)
  const sessionTokenRef = useRef(null)
  const placesSearchTimerRef = useRef(null)
  // Backend reverse geocode (on by default unless explicitly disabled)
  const ENABLE_LOCATION_REVERSE_GEOCODE =
    import.meta.env.VITE_ENABLE_LOCATION_REVERSE_GEOCODE !== "false"
  const getAddressId = (address) => address?.id || address?._id || null

  const addressAutocompleteSuggestions = useMemo(() => {
    const q = String(addressAutocompleteValue || "").trim().toLowerCase()
    if (!q) return []
    const list = Array.isArray(addresses) ? addresses : []
    return list
      .map((addr) => {
        const text = [
          addr?.label,
          addr?.additionalDetails,
          addr?.street,
          addr?.city,
          addr?.state,
          addr?.zipCode,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        return { addr, text }
      })
      .filter((x) => x.text.includes(q))
      .slice(0, 6)
      .map((x) => x.addr)
  }, [addresses, addressAutocompleteValue])

  useEffect(() => {
    if (!showAddressForm) return undefined

    const q = String(addressAutocompleteValue || "").trim()
    if (!q) {
      setPlacePredictions([])
      setShowPlacePredictions(false)
      setIsKeywordSearching(false)
      return undefined
    }

    if (placesSearchTimerRef.current) {
      clearTimeout(placesSearchTimerRef.current)
    }

    setIsKeywordSearching(true)
    placesSearchTimerRef.current = setTimeout(async () => {
      try {
        if (!autocompleteServiceRef.current) {
          const services = initPlacesServices(googleMapRef.current)
          if (services) {
            autocompleteServiceRef.current = services.autocompleteService
            placesServiceRef.current = services.placesService
            sessionTokenRef.current = services.sessionToken
          }
        }

        if (!autocompleteServiceRef.current) {
          setPlacePredictions([])
          setShowPlacePredictions(false)
          return
        }

        const results = await fetchPlacePredictions(
          autocompleteServiceRef.current,
          sessionTokenRef.current,
          q,
        )
        setPlacePredictions(results)
        setShowPlacePredictions(results.length > 0)
      } catch {
        setPlacePredictions([])
        setShowPlacePredictions(false)
      } finally {
        setIsKeywordSearching(false)
      }
    }, PLACES_SEARCH_DEBOUNCE_MS)

    return () => {
      if (placesSearchTimerRef.current) {
        clearTimeout(placesSearchTimerRef.current)
      }
    }
  }, [addressAutocompleteValue, showAddressForm])

  // Load Google Maps API key from backend
  useEffect(() => {
    if (!MAPS_ENABLED) return
    import('@food/utils/googleMapsApiKey.js').then(({ getGoogleMapsApiKey }) => {
      getGoogleMapsApiKey().then(key => {
        setGOOGLE_MAPS_API_KEY(key)
      })
    })
  }, [])
  const reverseGeocodeTimeoutRef = useRef(null) // Debounce timeout for reverse geocoding
  const lastReverseGeocodeCoordsRef = useRef(null) // Track last coordinates to avoid duplicate calls

  // Debug: Log API key status (only first few characters for security)
  useEffect(() => {
    if (!MAPS_ENABLED) return
    if (GOOGLE_MAPS_API_KEY) {
      debugLog("? Google Maps API Key loaded:", GOOGLE_MAPS_API_KEY.substring(0, 10) + "...")
    } else {
      debugWarn("?? Google Maps API Key NOT found! Please set it in ENV Setup.")
    }
  }, [GOOGLE_MAPS_API_KEY])

  // Current location display - Show complete formatted address (SAVED ADDRESSES FORMAT)
  // Format should match saved addresses: "B2/4, Gandhi Park Colony, Anand Nagar, Indore, Madhya Pradesh, 452001"
  // Show ALL parts of formattedAddress (like saved addresses show all parts)
  const currentLocationText = (() => {
    // Priority 0: Use currentAddress from map (most up-to-date when user selects location on map)
    // This is updated when map moves or "Use current location" is clicked
    if (currentAddress &&
      currentAddress !== "Select location" &&
      !currentAddress.match(/^-?\d+\.\d+,\s*-?\d+\.\d+$/)) {
      // Remove "India" from the end if present
      let fullAddress = currentAddress
      if (fullAddress.endsWith(', India')) {
        fullAddress = fullAddress.replace(', India', '').trim()
      }
      return fullAddress
    }

    // Priority 1: Use addressFormData.additionalDetails (updated when map moves)
    // This contains the full formatted address from Google Maps Places API
    if (addressFormData.additionalDetails &&
      addressFormData.additionalDetails !== "Select location" &&
      addressFormData.additionalDetails.trim() !== "") {
      let fullAddress = addressFormData.additionalDetails
      if (fullAddress.endsWith(', India')) {
        fullAddress = fullAddress.replace(', India', '').trim()
      }
      // Build complete address with all components
      const addressParts = [fullAddress]
      if (addressFormData.city) addressParts.push(addressFormData.city)
      if (addressFormData.state) {
        if (addressFormData.zipCode) {
          addressParts.push(`${addressFormData.state} ${addressFormData.zipCode}`)
        } else {
          addressParts.push(addressFormData.state)
        }
      } else if (addressFormData.zipCode) {
        addressParts.push(addressFormData.zipCode)
      }
      return addressParts.join(', ')
    }

    // Priority 2: Use formattedAddress from location hook (complete detailed address) - SAVED ADDRESSES FORMAT
    // Show full address with all parts (street, area, city, state, pincode) - just like saved addresses
    if (location?.formattedAddress &&
      location.formattedAddress !== "Select location" &&
      !location.formattedAddress.match(/^-?\d+\.\d+,\s*-?\d+\.\d+$/)) {
      // Remove "India" from the end if present (saved addresses don't show country)
      let fullAddress = location.formattedAddress
      if (fullAddress.endsWith(', India')) {
        fullAddress = fullAddress.replace(', India', '').trim()
      }

      // Show complete address - ALL parts (like saved addresses format)
      // Saved addresses format: "additionalDetails, street, city, state, zipCode"
      // Current location format: "POI, Building, Floor, Area, City, State, Pincode"
      return fullAddress
    }

    // Priority 3: Build address from components (SAVED ADDRESSES FORMAT)
    // Format: "street/area, city, state, pincode" (matching saved addresses)
    if (location?.address || location?.area || location?.street) {
      const addressParts = []

      // Add street/address/area (like saved addresses' additionalDetails + street)
      if (location.address && location.address !== "Select location") {
        addressParts.push(location.address)
      } else if (location.area) {
        addressParts.push(location.area)
      } else if (location.street) {
        addressParts.push(location.street)
      }

      // Add city
      if (location.city) {
        addressParts.push(location.city)
      }

      // Add state
      if (location.state) {
        addressParts.push(location.state)
      }

      // Add pincode (like saved addresses show zipCode)
      if (location.postalCode) {
        addressParts.push(location.postalCode)
      }

      if (addressParts.length > 0) {
        return addressParts.join(', ')
      }
    }

    // Priority 3: Use area + city + state + pincode
    if (location?.area && location?.city && location?.state) {
      const parts = [location.area, location.city, location.state]
      if (location.postalCode) {
        parts.push(location.postalCode)
      }
      return parts.join(', ')
    }

    // Priority 4: Fallback to city + state + pincode
    if (location?.city && location?.state) {
      const parts = [location.city, location.state]
      if (location.postalCode) {
        parts.push(location.postalCode)
      }
      return parts.join(', ')
    }

    // Final fallback
    return location?.city || location?.area || "Detecting location..."
  })()

  // No global console overrides; Ola Maps SDK errors will appear in dev tools if they occur.

  // Initialize map position from current location and update blue dot
  useEffect(() => {
    if (location?.latitude && location?.longitude && googleMapRef.current && window.google && window.google.maps) {
      const userPos = {
        lat: location.latitude,
        lng: location.longitude
      }

      const accuracyRadius = Math.max(location.accuracy || 50, 20)

      debugLog("?? Updating blue dot from location hook:", {
        position: userPos,
        accuracy: location.accuracy,
        radius: accuracyRadius
      })

      // Update or create blue dot marker
      if (userLocationMarkerRef.current) {
        try {
          if (userLocationMarkerRef.current.setPosition) {
            userLocationMarkerRef.current.setPosition(userPos)
          }
          // Ensure marker is visible and on map
          const currentMap = userLocationMarkerRef.current.getMap()
          if (currentMap !== googleMapRef.current) {
            userLocationMarkerRef.current.setMap(googleMapRef.current)
          }
          userLocationMarkerRef.current.setVisible(true)
          debugLog("? Updated existing blue dot marker")
        } catch (e) {
          debugError("Error updating blue dot marker:", e)
          // Recreate if update fails
          userLocationMarkerRef.current = null
        }
      }

      if (!userLocationMarkerRef.current) {
        // Create blue dot marker if it doesn't exist
        try {
          const blueDotMarker = new window.google.maps.Marker({
            position: userPos,
            map: googleMapRef.current,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: "#4285F4",
              fillOpacity: 1,
              strokeColor: "#FFFFFF",
              strokeWeight: 3,
            },
            zIndex: window.google.maps.Marker.MAX_ZINDEX + 1,
            optimized: false,
            visible: true,
            title: "Your location"
          })
          userLocationMarkerRef.current = blueDotMarker
          debugLog("? Created blue dot marker from location hook")
        } catch (e) {
          debugError("Error creating blue dot marker:", e)
        }
      }

      // Update or create accuracy circle
      if (blueDotCircleRef.current) {
        try {
          blueDotCircleRef.current.setCenter(userPos)
          blueDotCircleRef.current.setRadius(accuracyRadius)
          // Ensure circle is visible and on map
          const currentMap = blueDotCircleRef.current.getMap()
          if (currentMap !== googleMapRef.current) {
            blueDotCircleRef.current.setMap(googleMapRef.current)
          }
          blueDotCircleRef.current.setVisible(true)
          debugLog("? Updated existing accuracy circle")
        } catch (e) {
          debugError("Error updating accuracy circle:", e)
          // Recreate if update fails
          blueDotCircleRef.current = null
        }
      }

      if (!blueDotCircleRef.current) {
        // Create accuracy circle if it doesn't exist
        try {
          const blueDot = new window.google.maps.Circle({
            strokeColor: "#4285F4",
            strokeOpacity: 0.4,
            strokeWeight: 1,
            fillColor: "#4285F4",
            fillOpacity: 0.15,
            map: googleMapRef.current,
            center: userPos,
            radius: accuracyRadius,
            zIndex: window.google.maps.Marker.MAX_ZINDEX,
            visible: true
          })
          blueDotCircleRef.current = blueDot
          debugLog("? Created accuracy circle from location hook")
        } catch (e) {
          debugError("Error creating accuracy circle:", e)
        }
      }

      // Final verification
      setTimeout(() => {
        const markerVisible = userLocationMarkerRef.current?.getVisible()
        const circleVisible = blueDotCircleRef.current?.getVisible()
        const markerOnMap = userLocationMarkerRef.current?.getMap() === googleMapRef.current
        const circleOnMap = blueDotCircleRef.current?.getMap() === googleMapRef.current

        debugLog("?? Final Blue Dot Status:", {
          markerExists: !!userLocationMarkerRef.current,
          circleExists: !!blueDotCircleRef.current,
          markerVisible,
          circleVisible,
          markerOnMap,
          circleOnMap
        })
      }, 500)
    }
  }, [
    location?.latitude || null,
    location?.longitude || null,
    location?.accuracy || null,
  ])

  // Initialize Google Maps with Loader (ZOMATO-STYLE)
  useEffect(() => {
    if (!MAPS_ENABLED) {
      // Maps disabled: ensure loading spinner is off and rely on coordinates-only UX
      if (mapLoading) setMapLoading(false)
      return
    }

    if (!showAddressForm || !mapContainerRef.current || !GOOGLE_MAPS_API_KEY) {
      return
    }

    let isMounted = true
    setMapLoading(true)

    const initializeGoogleMap = async () => {
      try {
        const loader = new Loader({
          apiKey: GOOGLE_MAPS_API_KEY,
          version: "weekly",
          libraries: ["places"],
        })

        const google = await loader.load()

        if (!isMounted || !mapContainerRef.current) return

        // Initial location (Indore center or current location)
        const initialLocation = location?.latitude && location?.longitude
          ? { lat: location.latitude, lng: location.longitude }
          : { lat: 22.7196, lng: 75.8577 }

        // Create map
        const map = new google.maps.Map(mapContainerRef.current, {
          center: initialLocation,
          zoom: 15,
          disableDefaultUI: true, // Zomato-style clean look
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          draggable: !lockMapToAutocomplete,
          clickableIcons: false,
          gestureHandling: lockMapToAutocomplete ? "none" : "auto",
          // Hide basemap "tiles" (roads/labels/POIs) for pin-only UI.
          // This keeps the map container usable for centering/pin placement without showing the full map details.
          styles: [
            { featureType: "all", elementType: "labels", stylers: [{ visibility: "off" }] },
            { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
            { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
            { featureType: "road", elementType: "all", stylers: [{ visibility: "off" }] },
            { featureType: "transit", elementType: "all", stylers: [{ visibility: "off" }] },
            { featureType: "water", elementType: "all", stylers: [{ visibility: "off" }] },
            { featureType: "landscape", elementType: "all", stylers: [{ color: "#f3f4f6" }] },
          ],
        })

        googleMapRef.current = map

        const placesServices = initPlacesServices(map)
        if (placesServices) {
          autocompleteServiceRef.current = placesServices.autocompleteService
          placesServiceRef.current = placesServices.placesService
          sessionTokenRef.current = placesServices.sessionToken
        }

        // Create Green Marker (locked to autocomplete selection)
        const greenMarker = new google.maps.Marker({
          position: initialLocation,
          map: map,
          icon: {
            url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
            scaledSize: new google.maps.Size(40, 40),
            anchor: new google.maps.Point(20, 40)
          },
          draggable: false,
          title: "Selected location"
        })

        greenMarkerRef.current = greenMarker

        // Note: marker drag disabled; location updates only via autocomplete selection.

        // Function to create/update blue dot and accuracy circle
        const createBlueDotWithCircle = (position, accuracyValue) => {
          if (!isMounted || !map) return

          const userPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }

          const accuracyRadius = Math.max(accuracyValue || 50, 20) // Minimum 20m

          debugLog("?? Creating/updating blue dot:", {
            position: userPos,
            accuracy: accuracyValue,
            radius: accuracyRadius
          })

          // Remove existing blue dot and circle if any
          if (userLocationMarkerRef.current) {
            try {
              userLocationMarkerRef.current.setMap(null)
            } catch (e) {
              debugWarn("Error removing old marker:", e)
            }
          }
          if (blueDotCircleRef.current) {
            try {
              blueDotCircleRef.current.setMap(null)
            } catch (e) {
              debugWarn("Error removing old circle:", e)
            }
          }

          // Create Blue Dot Marker (Google Maps native style)
          const blueDotMarker = new google.maps.Marker({
            position: userPos,
            map: map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10, // Blue dot size
              fillColor: "#4285F4", // Google blue
              fillOpacity: 1,
              strokeColor: "#FFFFFF", // White border
              strokeWeight: 3,
            },
            zIndex: google.maps.Marker.MAX_ZINDEX + 1,
            optimized: false,
            visible: true,
            title: "Your location"
          })

          // Create Accuracy Circle (Light blue zone around blue dot)
          const accuracyCircle = new google.maps.Circle({
            strokeColor: "#4285F4",
            strokeOpacity: 0.4,
            strokeWeight: 1,
            fillColor: "#4285F4",
            fillOpacity: 0.15, // Light transparent blue
            map: map,
            center: userPos,
            radius: accuracyRadius, // Meters
            zIndex: google.maps.Marker.MAX_ZINDEX,
            visible: true
          })

          blueDotCircleRef.current = accuracyCircle
          userLocationMarkerRef.current = blueDotMarker

          debugLog("??? Blue dot and accuracy circle created successfully:", {
            marker: blueDotMarker,
            circle: accuracyCircle,
            radius: accuracyRadius,
            markerOnMap: blueDotMarker.getMap() === map,
            circleOnMap: accuracyCircle.getMap() === map
          })

          // Force visibility check (silent fix - no error logging)
          setTimeout(() => {
            if (!isMounted || !map) return

            const markerVisible = userLocationMarkerRef.current?.getVisible()
            const circleVisible = blueDotCircleRef.current?.getVisible()
            const markerOnMap = userLocationMarkerRef.current?.getMap() === map
            const circleOnMap = blueDotCircleRef.current?.getMap() === map

            // Silently fix marker visibility if needed
            if (userLocationMarkerRef.current && (!markerOnMap || !markerVisible)) {
              try {
                userLocationMarkerRef.current.setMap(map)
                userLocationMarkerRef.current.setVisible(true)
                debugLog("? Blue dot marker visibility fixed")
              } catch (e) {
                // Silently handle - marker might not be ready yet
              }
            }

            // Silently fix circle visibility if needed
            if (blueDotCircleRef.current && (!circleOnMap || !circleVisible)) {
              try {
                blueDotCircleRef.current.setMap(map)
                blueDotCircleRef.current.setVisible(true)
                debugLog("? Accuracy circle visibility fixed")
              } catch (e) {
                // Silently handle - circle might not be ready yet
              }
            }
          }, 1000)
        }

        // Wait for map to be fully ready before getting location
        google.maps.event.addListenerOnce(map, 'idle', () => {
          debugLog("??? Map is ready, requesting user location...")

          // Get user's current location and show Blue Dot
          if (navigator.geolocation) {
            // First, get current position immediately
            navigator.geolocation.getCurrentPosition(
              (position) => {
                if (!isMounted) return
                createBlueDotWithCircle(position, position.coords.accuracy)
                // Do not auto-update address from map on load when locked
              },
              (error) => {
                debugWarn("Geolocation getCurrentPosition error:", error)
                // Do not auto-update address from map on load when locked
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
              }
            )

            // Then, watch for position updates (live tracking)
            const watchId = navigator.geolocation.watchPosition(
              (position) => {
                if (!isMounted) return
                debugLog("?? Live location update:", {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                  accuracy: position.coords.accuracy
                })
                createBlueDotWithCircle(position, position.coords.accuracy)
              },
              (error) => {
                // Suppress timeout errors - they're non-critical
                if (error.code !== 3) {
                  debugWarn("Geolocation watchPosition error:", error)
                }
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000 // Allow 5 second old cached location
              }
            )

            // Store watch ID for cleanup
            watchPositionIdRef.current = watchId
          } else {
            debugWarn("Geolocation not supported")
            // Do not auto-update address from map on load when locked
          }
        })

        setMapLoading(false)
      } catch (error) {
        debugError("Error initializing Google Maps:", error)
        setMapLoading(false)
        toast.error("Failed to load map. Please refresh the page.")
      }
    }

    initializeGoogleMap()

    return () => {
      isMounted = false
      // Cleanup geolocation watch
      if (watchPositionIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current)
        watchPositionIdRef.current = null
      }
      // Cleanup markers
      if (greenMarkerRef.current) {
        greenMarkerRef.current.setMap(null)
      }
      if (userLocationMarkerRef.current) {
        try {
          userLocationMarkerRef.current.setMap(null)
        } catch (e) {
          debugWarn("Error cleaning up blue dot marker:", e)
        }
      }
      if (blueDotCircleRef.current) {
        try {
          blueDotCircleRef.current.setMap(null)
        } catch (e) {
          debugWarn("Error cleaning up accuracy circle:", e)
        }
      }
    }
  }, [showAddressForm, GOOGLE_MAPS_API_KEY, location?.latitude, location?.longitude])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose])

  const handleUseCurrentLocation = async () => {
    try {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        toast.error("Location services are not supported in your browser", {
          duration: 3000,
        })
        return
      }

      // Show loading toast
      toast.loading("Fetching your current location...", {
        id: "location-request",
      })

      // Request location - this will automatically prompt for permission if needed
      // Clear any cached location first to ensure fresh coordinates
      debugLog("?? Requesting fresh location (clearing cache and forcing fresh GPS)...")

      // Increase timeout to 15 seconds to allow GPS to get accurate fix
      // The getLocation function already has a 15-second timeout, so we match it
      const locationPromise = requestLocation()
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Location request is taking longer than expected. Please check your GPS settings.")), 15000)
      )

      let locationData
      try {
        locationData = await Promise.race([locationPromise, timeoutPromise])

        // Check if we got valid location data
        if (!locationData || (!locationData.latitude || !locationData.longitude)) {
          throw new Error("Invalid location data received")
        }
      } catch (raceError) {
        debugWarn("?? Location request failed or timed out:", raceError.message)

        // If timeout or error, try to use cached location as fallback
        const stored = localStorage.getItem("userLocation")
        if (stored) {
          try {
            const cachedLocation = JSON.parse(stored)
            if (cachedLocation?.latitude && cachedLocation?.longitude) {
              debugLog("?? Using cached location as fallback:", cachedLocation)
              locationData = cachedLocation

              // Show info toast that we're using cached location
              toast.info("Using your last known location", {
                id: "location-request",
                duration: 2000,
              })
            } else {
              throw new Error("Invalid cached location")
            }
          } catch (cacheErr) {
            debugError("? Failed to parse cached location:", cacheErr)
            // Determine specific error message
            let errorMessage = "Could not get location. Please try again."
            if (raceError.message.includes("permission") || raceError.message.includes("denied")) {
              errorMessage = "Location permission denied. Please enable location access in your browser settings."
            } else if (raceError.message.includes("timeout") || raceError.message.includes("longer")) {
              errorMessage = "Location request timed out. Please check your GPS settings and try again."
            } else if (raceError.message.includes("unavailable")) {
              errorMessage = "Location information is unavailable. Please check your device settings."
            }

            toast.error(errorMessage, {
              id: "location-request",
              duration: 5000,
            })
            return
          }
        } else {
          // No cached location available
          let errorMessage = "Could not get location. Please try again."
          if (raceError.message.includes("permission") || raceError.message.includes("denied")) {
            errorMessage = "Location permission denied. Please enable location access in your browser settings."
          } else if (raceError.message.includes("timeout") || raceError.message.includes("longer")) {
            errorMessage = "Location request timed out. Please check your GPS settings and try again."
          } else if (raceError.message.includes("unavailable")) {
            errorMessage = "Location information is unavailable. Please check your device settings."
          }

          toast.error(errorMessage, {
            id: "location-request",
            duration: 5000,
          })
          return
        }
      }

      // Validate location data
      if (!locationData) {
        toast.error("Could not get location. Please try again.", { id: "location-request" })
        return
      }

      if (!locationData.latitude || !locationData.longitude) {
        toast.error("Invalid location data received. Please try again.", { id: "location-request" })
        return
      }

      debugLog("? Fresh location received:", {
        formattedAddress: locationData?.formattedAddress,
        address: locationData?.address,
        city: locationData?.city,
        state: locationData?.state,
        area: locationData?.area,
        coordinates: locationData?.latitude && locationData?.longitude ?
          `${locationData.latitude.toFixed(8)}, ${locationData.longitude.toFixed(8)}` : "N/A",
        hasCompleteAddress: locationData?.formattedAddress &&
          locationData.formattedAddress.split(',').length >= 4
      })

      // Verify we got complete address (but don't fail if incomplete - still use the location)
      if (!locationData?.formattedAddress ||
        locationData.formattedAddress === "Select location" ||
        locationData.formattedAddress.split(',').length < 4) {
        debugWarn("?? Location received but address is incomplete. Will try to get better address from map...")
        // Don't retry immediately - let the map handle address fetching
        // The address will be fetched when map moves to the location
      }

      // CRITICAL: Ensure location state is updated in the hook
      // The requestLocation function already updates the state, but we verify here
      debugLog("??? Final location data to be saved:", {
        formattedAddress: locationData?.formattedAddress,
        address: locationData?.address,
        mainTitle: locationData?.mainTitle,
        hasCompleteAddress: locationData?.formattedAddress &&
          locationData.formattedAddress.split(',').length >= 4
      })

      // Save location to backend with ALL fields
      if (locationData?.latitude && locationData?.longitude) {
        try {
          await userAPI.updateLocation({
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            address: locationData.formattedAddress || locationData.address || "",
            city: locationData.city || "",
            state: locationData.state || "",
            area: locationData.area || "",
            formattedAddress: locationData.formattedAddress || locationData.address || "",
            accuracy: locationData.accuracy,
            postalCode: locationData.postalCode,
            street: locationData.street,
            streetNumber: locationData.streetNumber
          })
          debugLog("? Location saved to backend successfully")
        } catch (backendError) {
          // Only log non-network errors (network errors are handled by axios interceptor)
          if (backendError.code !== 'ERR_NETWORK' && backendError.message !== 'Network Error') {
            debugError("Error saving location to backend:", backendError)
          }
          // Don't fail the whole operation if backend save fails
        }
      }

      // Update map position - don't automatically show address form
      // User can manually open address form if needed
      if (locationData?.latitude && locationData?.longitude) {
        setMapPosition([locationData.latitude, locationData.longitude])
        // Don't automatically show address form - keep user on same page
        // setShowAddressForm(true)

        // Update address form data with complete address (for when user opens form)
        if (locationData.formattedAddress) {
          setCurrentAddress(locationData.formattedAddress)
          setAddressFormData(prev => ({
            ...prev,
            street: locationData.street || locationData.area || prev.street,
            city: locationData.city || prev.city,
            state: locationData.state || prev.state,
            zipCode: locationData.postalCode || prev.zipCode,
            additionalDetails: locationData.formattedAddress || prev.additionalDetails,
          }))
        }

        // Update map if it's initialized
        if (googleMapRef.current && window.google && window.google.maps) {
          try {
            googleMapRef.current.panTo({ lat: locationData.latitude, lng: locationData.longitude })
            googleMapRef.current.setZoom(17)

            if (greenMarkerRef.current) {
              greenMarkerRef.current.setPosition({ lat: locationData.latitude, lng: locationData.longitude })
            }

            // Fetch detailed address using Places API
            setTimeout(async () => {
              await handleMapMoveEnd(locationData.latitude, locationData.longitude)
            }, 500)
          } catch (mapError) {
            debugError("Error updating map:", mapError)
          }
        } else {
          // Map not initialized, fetch address directly
          setTimeout(async () => {
            await handleMapMoveEnd(locationData.latitude, locationData.longitude)
          }, 300)
        }
      }

      // Requirement: when user taps "Use current location" from delivery-location selector,
      // don't open the "Add address" form. Just close and return to homepage.
      // Store selection mode so Cart can prefer this current location for delivery address.
      try {
        localStorage.setItem("deliveryAddressMode", "current");
        const payload = {
          street: locationData.street || locationData.area || locationData.address || "Current Location",
          additionalDetails: locationData.area || "",
          city: locationData.city || locationData.area || "Current City",
          state: locationData.state || locationData.city || "Current State",
          zipCode: locationData.postalCode || locationData.zipCode || "",
          type: "current",
          label: "Current Location",
          location: {
            type: "Point",
            coordinates: [locationData.longitude, locationData.latitude]
          }
        }
        const existingCurrent = addresses.find(a => a.type === "current")
        let saved
        if (existingCurrent) {
          const existingId = existingCurrent._id || existingCurrent.id
          if (existingId) saved = await updateAddress(existingId, payload)
        } else {
          saved = await addAddress(payload)
        }
        if (saved) {
           const savedId = saved._id || saved.id
           if (savedId) setActiveAddressId(savedId)
        }
      } catch (e) {
         debugError("Error saving current location to Mongo", e)
      }
      syncSelectedLocation({
        ...locationData,
        address:
          locationData?.formattedAddress ||
          locationData?.address ||
          [locationData?.area, locationData?.city].filter(Boolean).join(", "),
        formattedAddress:
          locationData?.formattedAddress ||
          [
            locationData?.street || locationData?.area,
            locationData?.city,
            locationData?.state,
            locationData?.postalCode,
          ]
            .filter(Boolean)
            .join(", "),
      })
      setShowAddressForm(false)
      setAddressFormData((prev) => ({
        ...prev,
        street: locationData.street || locationData.area || prev.street,
        city: locationData.city || prev.city,
        state: locationData.state || prev.state,
        zipCode: locationData.postalCode || prev.zipCode,
        additionalDetails: locationData.formattedAddress || prev.additionalDetails,
        phone: prev.phone || userProfile?.phone || "",
      }))
      onClose()

      const addressPreview = locationData?.formattedAddress || locationData?.address || "Location updated"
      toast.success(`Location ready: ${addressPreview.split(',').slice(0, 2).join(', ')}`, {
        id: "location-request",
        duration: 2400,
      })
    } catch (error) {
      // Handle permission denied or other errors
      if (error.code === 1 || error.message?.includes("denied") || error.message?.includes("permission")) {
        toast.error("Location permission denied. Please enable location access in your browser settings.", {
          id: "location-request",
          duration: 4000,
        })
      } else if (error.code === 2 || error.message?.includes("unavailable")) {
        toast.error("Location unavailable. Please check your GPS settings.", {
          id: "location-request",
          duration: 3000,
        })
      } else if (error.code === 3 || error.message?.includes("timeout")) {
        toast.error("Location request timed out. Please try again.", {
          id: "location-request",
          duration: 3000,
        })
      } else {
        toast.error("Failed to get location. Please try again.", {
          id: "location-request",
          duration: 3000,
        })
      }
      // Don't close the selector if there's an error, so user can try other options
    }
  }

  const handleAddAddress = () => {
    setShowAddressForm(true)
    // Initialize form with current location data
    if (location?.latitude && location?.longitude) {
      setMapPosition([location.latitude, location.longitude])
      setAddressFormData(prev => ({
        ...prev,
        city: location.city || "",
        state: location.state || "",
        street: location.address || location.area || "",
        phone: userProfile?.phone || "",
      }))
    }
  }

  const handleAddressFormChange = (e) => {
    setAddressFormData({
      ...addressFormData,
      [e.target.name]: e.target.value,
    })
  }

  // Google Maps loading is handled by the Loader in the initialization useEffect above

  // OLD OLA MAPS INITIALIZATION - REMOVED (Replaced with Google Maps Loader above)
  // All old Ola Maps/Leaflet code has been removed and replaced with Google Maps Loader implementation

  // Removed old useEffect that initialized Ola Maps - now using Google Maps Loader above
  // All old Ola Maps initialization code has been removed

  // Resize Google Map when container dimensions change
  useEffect(() => {
    if (googleMapRef.current && showAddressForm) {
      const resizeMap = () => {
        try {
          if (googleMapRef.current && typeof window.google !== 'undefined' && window.google.maps) {
            window.google.maps.event.trigger(googleMapRef.current, 'resize');
            debugLog("? Google Map resized (container change)");
          }
        } catch (error) {
          debugWarn("?? Error resizing map:", error);
        }
      };

      const timer = setTimeout(() => {
        resizeMap();
      }, 300);

      window.addEventListener('resize', resizeMap);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', resizeMap);
      }
    }
  }, [showAddressForm])

  // Track user's live location with blue dot indicator
  const trackUserLocation = (mapInstance, sdkInstance) => {
    if (!navigator.geolocation) {
      debugWarn("?? Geolocation is not supported by this browser")
      return
    }

    debugLog("?????? STARTING USER LOCATION TRACKING...")
    debugLog("?? Map instance:", mapInstance)
    debugLog("?? SDK instance:", sdkInstance)
    debugLog("?? SDK instance type:", typeof sdkInstance)
    debugLog("?? SDK instance keys:", sdkInstance ? Object.keys(sdkInstance).slice(0, 20) : 'null')
    debugLog("?? Has addMarker:", !!(sdkInstance && sdkInstance.addMarker))
    debugLog("?? Has Marker:", !!(sdkInstance && sdkInstance.Marker))

    // Clear any existing watchPosition
    if (watchPositionIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchPositionIdRef.current)
      watchPositionIdRef.current = null
    }

    // Helper function to calculate distance between two coordinates (in meters)
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371e3 // Earth's radius in meters
      const lat1Rad = lat1 * Math.PI / 180
      const lat2Rad = lat2 * Math.PI / 180
      const deltaLat = (lat2 - lat1) * Math.PI / 180
      const deltaLon = (lon2 - lon1) * Math.PI / 180

      const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(lat1Rad) * Math.cos(lat2Rad) *
        Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

      return R * c // Distance in meters
    }

    // Helper function to create/update marker (with throttling)
    const createOrUpdateMarker = (latitude, longitude, heading, accuracy = null) => {
      // Check if location changed significantly (at least 10 meters)
      if (lastUserLocationRef.current) {
        const distance = calculateDistance(
          lastUserLocationRef.current.latitude,
          lastUserLocationRef.current.longitude,
          latitude,
          longitude
        )

        // If distance is less than 10 meters, skip update (unless it's the first time)
        if (distance < 10) {
          // Only log occasionally to avoid console spam
          if (Math.random() < 0.1) { // Log 10% of skipped updates
            debugLog(`?? Skipping location update - only moved ${distance.toFixed(2)}m (threshold: 10m)`)
          }
          return
        }

        debugLog(`?? Location changed by ${distance.toFixed(2)}m - updating marker`)
      }

      // Update last location
      lastUserLocationRef.current = { latitude, longitude, heading }

      // 1. Custom Blue Dot Element Banana
      let el = null
      if (userLocationMarkerRef.current) {
        // If marker exists, get its element
        el = userLocationMarkerRef.current.getElement?.() ||
          userLocationMarkerRef.current._element ||
          document.querySelector('.user-location-marker')
      }

      if (!el) {
        el = document.createElement('div')
        el.className = 'user-location-marker'
        // Ensure element is visible with inline styles (same pattern as green pin)
        el.style.cssText = `
          width: 20px;
          height: 20px;
          background-color: #4285F4;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(0,0,0,0.3);
          position: relative;
          z-index: 1001;
          display: block;
          visibility: visible;
          opacity: 1;
          cursor: default;
        `
        debugLog("? Created blue dot element with styles")
      } else {
        // Ensure existing element styles are correct
        el.style.display = 'block'
        el.style.visibility = 'visible'
        el.style.opacity = '1'
        el.style.zIndex = '1001'
      }

      // 2. Update accuracy circle if it exists
      if (userLocationAccuracyCircleRef.current) {
        try {
          if (userLocationAccuracyCircleRef.current.update) {
            userLocationAccuracyCircleRef.current.update(latitude, longitude, accuracy)
            debugLog("? Updated accuracy circle position and radius")
          }
        } catch (circleError) {
          debugWarn("?? Error updating accuracy circle:", circleError.message)
        }
      }

      // 3. Agar marker pehle se hai to update karein, nahi to naya banayein
      if (userLocationMarkerRef.current) {
        try {
          if (userLocationMarkerRef.current.setLngLat) {
            userLocationMarkerRef.current.setLngLat([longitude, latitude])
            debugLog("? Updated existing marker position")
          } else if (userLocationMarkerRef.current.setPosition) {
            userLocationMarkerRef.current.setPosition([longitude, latitude])
            debugLog("? Updated existing marker position (setPosition)")
          } else {
            debugWarn("?? Marker exists but no update method found")
          }
        } catch (error) {
          debugError("? Error updating user location marker:", error)
        }
      } else {
        try {
          // Try different marker creation methods - EXACT SAME PATTERN AS GREEN PIN
          let newMarker = null

          debugLog("?? Creating blue dot marker with:", {
            hasSdkInstance: !!sdkInstance,
            hasMapInstance: !!mapInstance,
            sdkAddMarker: !!(sdkInstance && sdkInstance.addMarker),
            sdkMarker: !!(sdkInstance && sdkInstance.Marker),
            element: !!el
          })

          // Method 1: Try SDK's addMarker method (EXACT SAME AS GREEN PIN)
          if (sdkInstance && sdkInstance.addMarker) {
            debugLog("?? Method 1: Using sdkInstance.addMarker (same as green pin)")
            try {
              newMarker = sdkInstance.addMarker({
                element: el,
                anchor: 'center',
                draggable: false
              }).setLngLat([longitude, latitude]).addTo(mapInstance)
              debugLog("??? Blue dot created using addMarker method:", newMarker)
            } catch (err) {
              debugError("? Error in addMarker:", err)
            }
          }
          // Method 2: Try SDK's Marker class (EXACT SAME AS GREEN PIN)
          else if (sdkInstance && sdkInstance.Marker) {
            debugLog("?? Method 2: Using sdkInstance.Marker (same as green pin)")
            try {
              newMarker = new sdkInstance.Marker({
                element: el,
                anchor: 'center',
                draggable: false
              }).setLngLat([longitude, latitude]).addTo(mapInstance)
              debugLog("??? Blue dot created using Marker class:", newMarker)
            } catch (err) {
              debugError("? Error in Marker constructor:", err)
            }
          }
          // Method 3: Try using MapLibre Marker (fallback - same as green pin)
          else if (window.maplibregl && window.maplibregl.Marker) {
            debugLog("?? Method 3: Using maplibregl.Marker (fallback)")
            try {
              newMarker = new window.maplibregl.Marker({
                element: el,
                anchor: 'center'
              }).setLngLat([longitude, latitude]).addTo(mapInstance)
              debugLog("? Blue dot created using maplibregl.Marker")
            } catch (err) {
              debugError("? Error in maplibregl.Marker:", err)
            }
          }
          else {
            debugError("??? NO MARKER API FOUND for blue dot. Available:", {
              sdkInstance: !!sdkInstance,
              sdkAddMarker: !!(sdkInstance && sdkInstance.addMarker),
              sdkMarker: !!(sdkInstance && sdkInstance.Marker),
              maplibregl: !!window.maplibregl,
              mapInstance: !!mapInstance,
              elementCreated: !!el
            })
          }

          if (newMarker) {
            userLocationMarkerRef.current = newMarker
            debugLog("? User location marker (blue dot) added successfully:", newMarker)

            // Verify blue dot is visible (same pattern as green pin)
            setTimeout(() => {
              const markerEl = newMarker.getElement?.() || newMarker._element
              if (markerEl) {
                debugLog("? Blue dot element found on map:", markerEl)
                // Ensure element is visible (same as green pin)
                markerEl.style.display = 'block'
                markerEl.style.visibility = 'visible'
                markerEl.style.opacity = '1'
                markerEl.style.zIndex = '1001'
                debugLog("? Blue dot visibility ensured")

                // Also check the inner element (the actual blue dot div)
                const innerEl = markerEl.querySelector('.user-location-marker') || markerEl
                if (innerEl) {
                  innerEl.style.display = 'block'
                  innerEl.style.visibility = 'visible'
                  innerEl.style.opacity = '1'
                  debugLog("? Blue dot inner element styles ensured")
                }
              } else {
                debugWarn("?? Blue dot element not found in DOM")
              }
            }, 500)

            // Additional check after 1 second
            setTimeout(() => {
              const markerEl = newMarker.getElement?.() || newMarker._element
              if (markerEl) {
                const computedStyle = window.getComputedStyle(markerEl)
                debugLog("?? Blue dot computed styles:", {
                  display: computedStyle.display,
                  visibility: computedStyle.visibility,
                  opacity: computedStyle.opacity,
                  zIndex: computedStyle.zIndex
                })
              }
            }, 1000)

            // Create accuracy circle around blue dot (like Google Maps)
            const accuracyRadius = accuracy || 50 // Default to 50m if accuracy not available
            try {
              // Remove existing circle if any
              if (userLocationAccuracyCircleRef.current) {
                if (userLocationAccuracyCircleRef.current.remove) {
                  userLocationAccuracyCircleRef.current.remove()
                } else if (mapInstance.removeLayer) {
                  mapInstance.removeLayer(userLocationAccuracyCircleRef.current)
                }
              }

              // Try to create circle using MapLibre/Mapbox API
              if (mapInstance.addSource && mapInstance.addLayer) {
                const circleId = 'user-location-accuracy-circle'
                const sourceId = 'user-location-accuracy-circle-source'

                // Remove existing source/layer if present
                if (mapInstance.getLayer(circleId)) {
                  mapInstance.removeLayer(circleId)
                }
                if (mapInstance.getSource(sourceId)) {
                  mapInstance.removeSource(sourceId)
                }

                // Add circle source
                mapInstance.addSource(sourceId, {
                  type: 'geojson',
                  data: {
                    type: 'Feature',
                    geometry: {
                      type: 'Point',
                      coordinates: [longitude, latitude]
                    },
                    properties: {
                      radius: accuracyRadius
                    }
                  }
                })

                // Add circle layer
                // Convert meters to pixels: use zoom-based scaling
                // At zoom 15: ~1.2 meters per pixel, at zoom 18: ~0.15 meters per pixel
                mapInstance.addLayer({
                  id: circleId,
                  type: 'circle',
                  source: sourceId,
                  paint: {
                    'circle-radius': [
                      'interpolate',
                      ['exponential', 2],
                      ['zoom'],
                      10, ['/', accuracyRadius, 2],
                      15, ['/', accuracyRadius, 1.2],
                      18, ['/', accuracyRadius, 0.15],
                      20, ['/', accuracyRadius, 0.04]
                    ],
                    'circle-color': '#4285F4',
                    'circle-opacity': 0.15,
                    'circle-stroke-color': '#4285F4',
                    'circle-stroke-opacity': 0.4,
                    'circle-stroke-width': 1
                  }
                })

                userLocationAccuracyCircleRef.current = {
                  sourceId,
                  layerId: circleId,
                  update: (newLat, newLng, newAccuracy) => {
                    if (mapInstance.getSource(sourceId)) {
                      mapInstance.getSource(sourceId).setData({
                        type: 'Feature',
                        geometry: {
                          type: 'Point',
                          coordinates: [newLng, newLat]
                        },
                        properties: {
                          radius: newAccuracy || accuracyRadius
                        }
                      })
                    }
                  },
                  remove: () => {
                    if (mapInstance.getLayer(circleId)) {
                      mapInstance.removeLayer(circleId)
                    }
                    if (mapInstance.getSource(sourceId)) {
                      mapInstance.removeSource(sourceId)
                    }
                  }
                }

                debugLog("? Accuracy circle created around blue dot:", { radius: accuracyRadius })
              }
            } catch (circleError) {
              debugWarn("?? Could not create accuracy circle (non-critical):", circleError.message)
            }

            // Don't auto-fly to user location - let green pin stay at center
            // User can use "Use current location" button if needed
          } else {
            debugError("? Failed to create blue dot marker - all methods failed")
            debugError("?? Debug info:", {
              sdkInstance: !!sdkInstance,
              mapInstance: !!mapInstance,
              element: !!el,
              sdkAddMarker: !!(sdkInstance && sdkInstance.addMarker),
              sdkMarker: !!(sdkInstance && sdkInstance.Marker)
            })
          }
        } catch (markerError) {
          debugError("? Could not create user location marker:", markerError)
          debugError("Error details:", {
            message: markerError.message,
            stack: markerError.stack,
            name: markerError.name
          })
        }
      }

      // 3. Arrow Direction (Heading) agar available ho
      // Heading is in degrees (0-360), where 0 is North
      if (heading !== null && heading !== undefined && !isNaN(heading)) {
        el.style.transform = `rotate(${heading}deg)`
      } else {
        // Reset transform if no heading
        el.style.transform = 'rotate(0deg)'
      }
    }

    // First, try to get current position immediately
    // Use a small delay to ensure map is fully ready
    debugLog("?? About to request geolocation...")
    setTimeout(() => {
      debugLog("?? Requesting geolocation with getCurrentPosition...")
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, heading } = position.coords
          debugLog("?????? Initial location received:", { latitude, longitude, heading })
          debugLog("?? Calling createOrUpdateMarker with:", { latitude, longitude, heading })
          createOrUpdateMarker(latitude, longitude, heading, position.coords.accuracy)

          // Then start watching for updates (with throttling)
          watchPositionIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
              const { latitude, longitude, heading, accuracy } = position.coords

              // Clear any pending update
              if (locationUpdateTimeoutRef.current) {
                clearTimeout(locationUpdateTimeoutRef.current)
              }

              // Throttle updates - only process after 2 seconds of no new updates
              locationUpdateTimeoutRef.current = setTimeout(() => {
                // Only log significant updates to avoid console spam
                if (!lastUserLocationRef.current ||
                  calculateDistance(
                    lastUserLocationRef.current.latitude,
                    lastUserLocationRef.current.longitude,
                    latitude,
                    longitude
                  ) >= 10) {
                  debugLog("?? Location update (throttled):", { latitude, longitude, heading })
                }
                createOrUpdateMarker(latitude, longitude, heading, accuracy)
              }, 2000) // Wait 2 seconds before processing update
            },
            (error) => {
              // Suppress timeout errors - they're non-critical and will retry
              if (error.code === 3) {
                // Timeout - silently ignore, will retry automatically
                return
              } else if (error.code === 1) {
                debugWarn("?? Location permission denied by user")
              } else if (error.code === 2) {
                debugWarn("?? Location unavailable")
              }
              // Don't log timeout errors repeatedly
            },
            {
              enableHighAccuracy: false, // Less strict for better compatibility
              timeout: 30000, // Longer timeout (30 seconds)
              maximumAge: 60000 // Allow cached location up to 1 minute old
            }
          )
          debugLog("? watchPosition started, ID:", watchPositionIdRef.current)
        },
        (error) => {
          // Suppress timeout errors - they're non-critical
          if (error.code === 3) {
            // Timeout - try to use cached location or continue without location
            debugWarn("?? Location request timeout - will retry or use cached location")

            // Try to get cached location from localStorage
            try {
              const cachedLocation = localStorage.getItem("userLocation")
              if (cachedLocation) {
                const location = JSON.parse(cachedLocation)
                if (location.latitude && location.longitude) {
                  debugLog("?? Using cached location due to timeout:", location)
                  createOrUpdateMarker(location.latitude, location.longitude, null, location.accuracy)
                }
              }
            } catch (cacheError) {
              // Ignore cache errors
            }
          } else if (error.code === 1) {
            debugWarn("?? Location permission denied")
          } else if (error.code === 2) {
            debugWarn("?? Location unavailable")
          } else {
            // Only log non-timeout errors
            debugWarn("?? Location error (code:", error.code + "):", error.message)
          }

          // Even if initial location fails, try watchPosition with less strict options
          watchPositionIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
              const { latitude, longitude, heading, accuracy } = position.coords

              // Clear any pending update
              if (locationUpdateTimeoutRef.current) {
                clearTimeout(locationUpdateTimeoutRef.current)
              }

              // Throttle updates - only process after 2 seconds of no new updates
              locationUpdateTimeoutRef.current = setTimeout(() => {
                // Only log significant updates to avoid console spam
                if (!lastUserLocationRef.current ||
                  calculateDistance(
                    lastUserLocationRef.current.latitude,
                    lastUserLocationRef.current.longitude,
                    latitude,
                    longitude
                  ) >= 10) {
                  debugLog("?? Location update (after initial error, throttled):", { latitude, longitude, heading })
                }
                createOrUpdateMarker(latitude, longitude, heading, accuracy)
              }, 2000) // Wait 2 seconds before processing update
            },
            (error) => {
              // Suppress timeout errors in watchPosition too
              if (error.code === 3) {
                // Timeout - silently ignore, will retry
                return
              } else if (error.code === 1) {
                debugWarn("?? Please enable location permission in browser settings")
              }
              // Don't log other errors repeatedly
            },
            {
              enableHighAccuracy: false, // Less strict for better compatibility
              timeout: 30000, // Longer timeout
              maximumAge: 60000 // Allow cached location up to 1 minute old
            }
          )
          debugLog("? watchPosition started (fallback), ID:", watchPositionIdRef.current)
        },
        {
          enableHighAccuracy: false, // Less strict for better compatibility
          timeout: 30000, // Longer timeout (30 seconds)
          maximumAge: 60000 // Allow cached location up to 1 minute old
        }
      )
    }, 500) // Small delay to ensure map is ready

    debugLog("? watchPosition started, ID:", watchPositionIdRef.current)
  }

  const MAP_MOVE_DEBOUNCE_MS = 1000
  const MAP_MOVE_MIN_PAN_METERS = 50

  const handleMapMoveEnd = async (lat, lng) => {
    const roundedLat = parseFloat(lat.toFixed(6))
    const roundedLng = parseFloat(lng.toFixed(6))
    const coordLabel = `${roundedLat.toFixed(6)}, ${roundedLng.toFixed(6)}`

    const last = lastReverseGeocodeCoordsRef.current
    if (last) {
      const lastLat = parseFloat(last.lat.toFixed(6))
      const lastLng = parseFloat(last.lng.toFixed(6))
      if (lastLat === roundedLat && lastLng === roundedLng) {
        debugLog("?? Skipping map move handler — same coordinates as last call")
        return
      }
      const movedM = calculateDistance(last.lat, last.lng, roundedLat, roundedLng)
      if (movedM < MAP_MOVE_MIN_PAN_METERS) {
        debugLog("?? Skipping map move handler — pan below threshold (m):", movedM)
        return
      }
    }

    if (reverseGeocodeTimeoutRef.current) {
      clearTimeout(reverseGeocodeTimeoutRef.current)
    }

    reverseGeocodeTimeoutRef.current = setTimeout(async () => {
      lastReverseGeocodeCoordsRef.current = { lat: roundedLat, lng: roundedLng }

      // Default: no reverse geocode — coordinates only (no network on every pan)
      if (!ENABLE_LOCATION_REVERSE_GEOCODE) {
        setCurrentAddress(coordLabel)
        setAddressFormData((prev) => ({
          ...prev,
          additionalDetails: coordLabel || prev.additionalDetails,
        }))
        return
      }

      setLoadingAddress(true)
      try {
        let formattedAddress = ""
        let city = ""
        let state = ""
        let area = ""
        let street = ""
        let streetNumber = ""
        let postalCode = ""
        let pointOfInterest = ""
        let premise = ""

        try {
          const response = await locationAPI.reverseGeocode(roundedLat, roundedLng)
          const backendData = response?.data?.data
          const result = backendData?.results?.[0] || backendData?.result?.[0] || null
          if (result) {
            formattedAddress = result.formatted_address || result.formattedAddress || ""
            const addressComponents = result.address_components || {}
            city = addressComponents.city || ""
            state = addressComponents.state || ""
            area = addressComponents.area || ""
          } else {
            // Fallback to direct Nominatim if backend returns nothing
            debugLog("?? Backend reverse geocode returned no results, trying Nominatim fallback...")
            const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${roundedLat}&lon=${roundedLng}&addressdetails=1`
            const nomRes = await fetch(nominatimUrl, { headers: { Accept: "application/json" } })
            const nomJson = await nomRes.json()
            if (nomJson && nomJson.display_name) {
              formattedAddress = nomJson.display_name
              const a = nomJson.address || {}
              city = a.city || a.town || a.village || ""
              state = a.state || ""
              area = a.suburb || a.neighbourhood || ""
            }
          }
        } catch (backendError) {
          debugError("? Backend reverse geocode failed, trying Nominatim fallback:", backendError)
          try {
            const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${roundedLat}&lon=${roundedLng}&addressdetails=1`
            const nomRes = await fetch(nominatimUrl, { headers: { Accept: "application/json" } })
            const nomJson = await nomRes.json()
            if (nomJson && nomJson.display_name) {
              formattedAddress = nomJson.display_name
              const a = nomJson.address || {}
              city = a.city || a.town || a.village || ""
              state = a.state || ""
              area = a.suburb || a.neighbourhood || ""
            } else {
              formattedAddress = coordLabel
            }
          } catch (nomError) {
             formattedAddress = coordLabel
          }
        }

        if (formattedAddress || city || state) {
          if (!formattedAddress || formattedAddress.split(",").length < 3) {
            const addressParts = []
            if (pointOfInterest) addressParts.push(pointOfInterest)
            if (premise && premise !== pointOfInterest) addressParts.push(premise)
            if (streetNumber && street) addressParts.push(`${streetNumber} ${street}`)
            else if (street) addressParts.push(street)
            else if (area) addressParts.push(area)
            if (city) addressParts.push(city)
            if (state) {
              if (postalCode) addressParts.push(`${state} ${postalCode}`)
              else addressParts.push(state)
            }
            formattedAddress = addressParts.join(", ")
          }

          if (!street && formattedAddress) {
            const parts = formattedAddress.split(",").map((p) => p.trim()).filter((p) => p.length > 0)
            if (parts.length > 0) {
              street = parts[0]
            }
          }

          if (!area) {
            area = pointOfInterest || premise || street || ""
          }

          if (formattedAddress && formattedAddress.endsWith(", India")) {
            formattedAddress = formattedAddress.replace(", India", "").trim()
          }

          setCurrentAddress(formattedAddress || coordLabel)

          const fullAddressForField =
            formattedAddress ||
            (pointOfInterest && city && state ? `${pointOfInterest}, ${city}, ${state}` : "") ||
            (premise && city && state ? `${premise}, ${city}, ${state}` : "") ||
            (street && city && state ? `${street}, ${city}, ${state}` : "") ||
            (area && city && state ? `${area}, ${city}, ${state}` : "") ||
            (city && state ? `${city}, ${state}` : "") ||
            ""

          setAddressFormData((prev) => ({
            ...prev,
            street: street || prev.street,
            city: city || prev.city,
            state: state || prev.state,
            zipCode: postalCode || prev.zipCode,
            additionalDetails: fullAddressForField || prev.additionalDetails,
          }))
        } else {
          setCurrentAddress(coordLabel)
        }
      } catch (error) {
        debugError("? Error reverse geocoding:", error)
        setCurrentAddress(coordLabel)
      } finally {
        setLoadingAddress(false)
      }
    }, MAP_MOVE_DEBOUNCE_MS)
  }

  const handleUseCurrentLocationForAddress = async () => {
    try {
      if (!navigator.geolocation) {
        toast.error("Location services are not supported")
        return
      }

      toast.loading("Getting your fresh location...", { id: "current-location" })

      // Use Promise.race to keep UI responsive, but don't fail too aggressively:
      // geolocation + reverse geocode can legitimately take a few seconds on slow networks/devices.
      const locationPromise = requestLocation(true, true) // forceFresh = true, updateDB = true
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Location timeout")), 10000)
      )

      let locationData
      try {
        locationData = await Promise.race([locationPromise, timeoutPromise])
      } catch (raceError) {
        // If timeout, try to use cached location immediately (and don't show an error if we can proceed).
        const stored = localStorage.getItem("userLocation")
        if (stored) {
          try {
            const cachedLocation = JSON.parse(stored)
            if (cachedLocation?.latitude && cachedLocation?.longitude) {
              debugLog("?? Using cached location (timeout):", cachedLocation)
              locationData = cachedLocation
            } else {
              throw new Error("Invalid cached location")
            }
          } catch (cacheErr) {
            toast.error("Could not get location. Please try again.", { id: "current-location" })
            return
          }
        } else {
          toast.error("Could not get location. Please try again.", { id: "current-location" })
          return
        }
      }

      debugLog("?? Current location data received:", locationData)

      if (!locationData?.latitude || !locationData?.longitude) {
        toast.error("Could not get your location. Please try again.", { id: "current-location" })
        return
      }

      const lat = parseFloat(locationData.latitude)
      const lng = parseFloat(locationData.longitude)

      if (isNaN(lat) || isNaN(lng)) {
        toast.error("Invalid location coordinates", { id: "current-location" })
        return
      }

      debugLog("?? Setting map position to:", [lat, lng])
      debugLog("?? Location accuracy:", locationData.accuracy ? `${locationData.accuracy}m` : "unknown")
      debugLog("?? Location timestamp:", locationData.timestamp || new Date().toISOString())
      setMapPosition([lat, lng])
      toast.success("Location updated", { id: "current-location" })

      // Update Google Maps to new location
      if (googleMapRef.current && window.google && window.google.maps) {
        try {
          debugLog("??? Updating Google Map to:", { lat, lng })

          // Pan to current location
          googleMapRef.current.panTo({ lat, lng })
          googleMapRef.current.setZoom(17)

          // Update green marker position
          if (greenMarkerRef.current) {
            greenMarkerRef.current.setPosition({ lat, lng })
            debugLog("? Updated green marker position")
          }

          // Update blue dot marker position
          if (userLocationMarkerRef.current) {
            if (userLocationMarkerRef.current.setPosition) {
              userLocationMarkerRef.current.setPosition({ lat, lng })
              debugLog("? Updated blue dot marker position")
            } else if (userLocationMarkerRef.current.setMap) {
              // Marker exists but might not be on map, ensure it's visible
              userLocationMarkerRef.current.setMap(googleMapRef.current)
              if (userLocationMarkerRef.current.setPosition) {
                userLocationMarkerRef.current.setPosition({ lat, lng })
              }
            }
          } else if (googleMapRef.current && window.google) {
            // Create blue dot if it doesn't exist
            const blueDotMarker = new window.google.maps.Marker({
              position: { lat, lng },
              map: googleMapRef.current,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: "#4285F4",
                fillOpacity: 1,
                strokeColor: "#FFFFFF",
                strokeWeight: 4,
              },
              zIndex: window.google.maps.Marker.MAX_ZINDEX + 1,
              optimized: false,
              visible: true
            })
            userLocationMarkerRef.current = blueDotMarker
            debugLog("? Created blue dot marker")
          }

          // Update blue dot accuracy circle position
          if (blueDotCircleRef.current) {
            blueDotCircleRef.current.setCenter({ lat, lng })
            // Update radius if accuracy is available
            const accuracyRadius = Math.max(locationData?.accuracy || 50, 20)
            blueDotCircleRef.current.setRadius(accuracyRadius)
            debugLog("? Updated blue dot accuracy circle position and radius:", accuracyRadius)
          } else if (googleMapRef.current && window.google) {
            // Create accuracy circle if it doesn't exist
            const accuracyRadius = Math.max(locationData?.accuracy || 50, 20)
            const blueDot = new window.google.maps.Circle({
              strokeColor: "#4285F4",
              strokeOpacity: 0.5,
              strokeWeight: 2,
              fillColor: "#4285F4",
              fillOpacity: 0.2,
              map: googleMapRef.current,
              center: { lat, lng },
              radius: accuracyRadius,
              zIndex: window.google.maps.Marker.MAX_ZINDEX,
              visible: true
            })
            blueDotCircleRef.current = blueDot
            debugLog("? Created blue dot accuracy circle")
          }

          // Wait for map to finish moving, then fetch address (reduced delay for faster response)
          setTimeout(async () => {
            await handleMapMoveEnd(lat, lng)
            toast.success("Location updated!", { id: "current-location" })
          }, 200)

        } catch (mapError) {
          debugError("? Error updating map location:", mapError)
          toast.error("Failed to update map location", { id: "current-location" })
        }
      } else {
        // Map not initialized yet, just update position and fetch address (reduced delay)
        setTimeout(async () => {
          await handleMapMoveEnd(lat, lng)
          toast.success("Location updated!", { id: "current-location" })
        }, 200)
      }
    } catch (error) {
      debugError("? Error getting current location:", error)

      // Check if it's a timeout error
      if (error.message && (error.message.includes("timeout") || error.message.includes("Timeout"))) {
        // Try to use cached location from localStorage
        try {
          const stored = localStorage.getItem("userLocation")
          if (stored) {
            const cachedLocation = JSON.parse(stored)
            if (cachedLocation?.latitude && cachedLocation?.longitude) {
              debugLog("?? Using cached location due to timeout:", cachedLocation)
              setMapPosition([cachedLocation.latitude, cachedLocation.longitude])

              // Update Google Maps with cached location
              if (googleMapRef.current && window.google && window.google.maps) {
                try {
                  googleMapRef.current.panTo({ lat: cachedLocation.latitude, lng: cachedLocation.longitude });
                  googleMapRef.current.setZoom(17);

                  // Update markers
                  if (greenMarkerRef.current) {
                    greenMarkerRef.current.setPosition({ lat: cachedLocation.latitude, lng: cachedLocation.longitude });
                  }
                  if (blueDotCircleRef.current) {
                    blueDotCircleRef.current.setCenter({ lat: cachedLocation.latitude, lng: cachedLocation.longitude });
                  }

                  setTimeout(async () => {
                    await handleMapMoveEnd(cachedLocation.latitude, cachedLocation.longitude);
                    toast.success("Using cached location", { id: "current-location" });
                  }, 500);
                } catch (mapErr) {
                  debugError("Error updating map with cached location:", mapErr);
                  toast.warning("Location request timed out. Please try again.", { id: "current-location" });
                }
              } else {
                setTimeout(async () => {
                  await handleMapMoveEnd(cachedLocation.latitude, cachedLocation.longitude)
                  toast.success("Using cached location", { id: "current-location" })
                }, 300)
              }
              return
            }
          }
        } catch (cacheErr) {
          debugWarn("Failed to use cached location:", cacheErr)
        }

        toast.warning("Location request timed out. Please try again or check your GPS settings.", { id: "current-location" })
      } else {
        toast.error("Failed to get current location: " + (error.message || "Unknown error"), { id: "current-location" })
      }
    }
  }

  const handleAddressFormSubmit = async (e) => {
    e.preventDefault()
    let addressToSave = null

    // Validate required fields (zipCode is optional)
    if (!addressFormData.street || !addressFormData.city || !addressFormData.state) {
      toast.error("Please fill in all required fields (Street, City, State)")
      return
    }

    // Validate that we have coordinates
    if (!mapPosition || mapPosition.length !== 2 || !mapPosition[0] || !mapPosition[1]) {
      toast.error("Please select a location on the map")
      return
    }

    setLoadingAddress(true)
    try {
      // Prepare address data matching backend format
      // Backend expects: label, street, additionalDetails, city, state, zipCode, latitude, longitude
      // Backend label enum: ['Home', 'Office', 'Other'] - not 'Work'
      // mapPosition is [latitude, longitude]

      // Validate and normalize label to match backend enum
      let normalizedLabel = addressFormData.label || "Home"
      if (normalizedLabel === "Work") {
        normalizedLabel = "Office" // Convert Work to Office to match backend enum
      }
      if (!["Home", "Office", "Other"].includes(normalizedLabel)) {
        normalizedLabel = "Other" // Fallback to Other if invalid
      }

      // Validate that trimmed fields are not empty
      const trimmedStreet = addressFormData.street.trim()
      const trimmedCity = addressFormData.city.trim()
      const trimmedState = addressFormData.state.trim()

      if (!trimmedStreet || !trimmedCity || !trimmedState) {
        toast.error("Street, City, and State cannot be empty")
        setLoadingAddress(false)
        return
      }

      const completeFormattedAddress = String(
        currentAddress ||
          addressFormData.additionalDetails ||
          [
            trimmedStreet,
            trimmedCity,
            trimmedState,
            (addressFormData.zipCode || "").trim(),
          ]
            .filter(Boolean)
            .join(", "),
      ).trim()

      addressToSave = {
        label: normalizedLabel,
        address: completeFormattedAddress,
        street: trimmedStreet,
        additionalDetails: (addressFormData.additionalDetails || "").trim(),
        city: trimmedCity,
        state: trimmedState,
        zipCode: (addressFormData.zipCode || "").trim(),
        latitude: mapPosition[0], // latitude from mapPosition[0]
        longitude: mapPosition[1], // longitude from mapPosition[1]
      }

      // Check if an address with the same label already exists
      const existingAddressWithSameLabel = addresses.find(addr => addr.label === normalizedLabel)
      const existingAddressId = existingAddressWithSameLabel?.id || existingAddressWithSameLabel?._id

      let savedAddress = null
      if (existingAddressWithSameLabel && existingAddressId) {
        // Update existing address instead of creating a new one
        debugLog("?? Updating existing address with label:", normalizedLabel)
        savedAddress = await updateAddress(existingAddressId, addressToSave)
        toast.success(`Address updated for ${normalizedLabel}!`)
      } else {
        // Create new address
        debugLog("?? Saving new address:", addressToSave)
        savedAddress = await addAddress(addressToSave)
        toast.success(`Address saved as ${normalizedLabel}!`)
      }

      const savedAddressId = getAddressId(savedAddress) || existingAddressId
      if (savedAddressId) {
        setDefaultAddress(savedAddressId)
        syncSelectedLocation({
          label: savedAddress?.label || addressToSave?.label || normalizedLabel,
          city: savedAddress?.city || addressToSave?.city || "",
          state: savedAddress?.state || addressToSave?.state || "",
          address:
            [
              savedAddress?.street || addressToSave?.street,
              savedAddress?.city || addressToSave?.city,
            ]
              .filter(Boolean)
              .join(", "),
          area: savedAddress?.additionalDetails || addressToSave?.additionalDetails || "",
          zipCode: savedAddress?.zipCode || addressToSave?.zipCode || "",
          latitude: savedAddress?.latitude || addressToSave?.latitude || mapPosition[0],
          longitude: savedAddress?.longitude || addressToSave?.longitude || mapPosition[1],
          formattedAddress:
            savedAddress?.formattedAddress ||
            [
              savedAddress?.additionalDetails || addressToSave?.additionalDetails,
              savedAddress?.street || addressToSave?.street,
              savedAddress?.city || addressToSave?.city,
              savedAddress?.state || addressToSave?.state,
              savedAddress?.zipCode || addressToSave?.zipCode,
            ]
              .filter(Boolean)
              .join(", "),
        })
        // User saved an address; prefer saved delivery address in Cart.
        try {
          localStorage.setItem("deliveryAddressMode", "saved")
        } catch {}
      }

      // Reset form
      setAddressFormData({
        street: "",
        city: "",
        state: "",
        zipCode: "",
        additionalDetails: "",
        label: "Home",
        phone: "",
      })
      setShowAddressForm(false)
      setLoadingAddress(false)

      // Close overlay and keep user in current flow
      onClose()
    } catch (error) {
      debugError("? Error saving address:", error)
      debugError("? Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        addressData: addressToSave
      })

      // Show more detailed error message
      let errorMessage = "Failed to add address. Please try again."
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error.response?.status === 400) {
        errorMessage = "Invalid address data. Please check all fields."
      } else if (error.response?.status === 500) {
        errorMessage = "Server error. Please try again later."
      }

      toast.error(errorMessage)
      setLoadingAddress(false)
    }
  }

  const handlePlacePredictionSelect = useCallback(async (prediction) => {
    if (!prediction?.place_id) return

    try {
      if (!placesServiceRef.current) {
        const services = initPlacesServices(googleMapRef.current)
        if (!services) {
          toast.error("Location search is not ready yet. Please try again.")
          return
        }
        autocompleteServiceRef.current = services.autocompleteService
        placesServiceRef.current = services.placesService
        sessionTokenRef.current = services.sessionToken
      }

      const { place, nextSessionToken } = await fetchPlaceDetails(
        placesServiceRef.current,
        sessionTokenRef.current,
        prediction.place_id,
      )
      sessionTokenRef.current = nextSessionToken

      const parsed = parsePlaceDetails(place)
      if (!parsed.latitude || !parsed.longitude) {
        toast.error("Invalid location. Please pick another address.")
        return
      }

      const latitude = parsed.latitude
      const longitude = parsed.longitude
      const display = parsed.formattedAddress || prediction.description || ""

      setAddressAutocompleteValue(display)
      setPlacePredictions([])
      setShowPlacePredictions(false)
      setCurrentAddress(display)
      setAddressFormData((prev) => ({
        ...prev,
        street: parsed.area || display.split(",")[0]?.trim() || prev.street,
        city: parsed.city || prev.city,
        state: parsed.state || prev.state,
        zipCode: parsed.pincode || prev.zipCode,
        additionalDetails: display || prev.additionalDetails,
      }))

      setMapPosition([latitude, longitude])
      if (googleMapRef.current && window.google?.maps) {
        try {
          googleMapRef.current.panTo({ lat: latitude, lng: longitude })
          googleMapRef.current.setZoom(17)
          if (greenMarkerRef.current) {
            greenMarkerRef.current.setPosition({ lat: latitude, lng: longitude })
          }
        } catch {}
      }

      try {
        await handleMapMoveEnd(latitude, longitude)
      } catch {}
    } catch {
      toast.error("Could not load location details. Please try again.")
    }
  }, [handleMapMoveEnd])

  const handleCancelAddressForm = () => {
    setShowAddressForm(false)
    setAddressAutocompleteValue("")
    setPlacePredictions([])
    setShowPlacePredictions(false)
    setIsKeywordSearching(false)
    setLockMapToAutocomplete(true)
    setAddressFormData({
      street: "",
      city: "",
      state: "",
      zipCode: "",
      additionalDetails: "",
      label: "Home",
      phone: "",
    })
  }

  const handleSelectSavedAddress = async (address) => {
    try {
      // Get coordinates from address location
      const coordinates = address.location?.coordinates || []
      const longitude = coordinates[0]
      const latitude = coordinates[1]

      if (latitude && longitude) {
        // Update location in backend
        await userAPI.updateLocation({
          latitude,
          longitude,
          address: `${address.street}, ${address.city}`,
          city: address.city,
          state: address.state,
          area: address.additionalDetails || "",
          formattedAddress: `${address.street}, ${address.city}, ${address.state}`
        })
      }

      // Update the location in localStorage with this address
      const locationData = {
        label: address.label || "Home",
        city: address.city,
        state: address.state,
        address: `${address.street}, ${address.city}`,
        area: address.additionalDetails || "",
        zipCode: address.zipCode,
        latitude,
        longitude,
        formattedAddress: `${address.street}, ${address.city}, ${address.state}`
      }
      syncSelectedLocation(locationData)

      // Update map position to show selected address
      setMapPosition([latitude, longitude])

      // Update address form data with selected address
      setAddressFormData({
        street: address.street || "",
        city: address.city || "",
        state: address.state || "",
        zipCode: address.zipCode || "",
        additionalDetails: address.additionalDetails || "",
        label: address.label || "Home",
        phone: address.phone || "",
      })

      // Update Google Maps to show selected address
      if (googleMapRef.current && window.google && window.google.maps) {
        try {
          googleMapRef.current.panTo({ lat: latitude, lng: longitude })
          googleMapRef.current.setZoom(17)

          // Update green marker position
          if (greenMarkerRef.current) {
            greenMarkerRef.current.setPosition({ lat: latitude, lng: longitude })
          }

          // Fetch and update address details
          setTimeout(async () => {
            await handleMapMoveEnd(latitude, longitude)
            toast.success("Location updated!", { id: "saved-address" })
          }, 500)
        } catch (mapError) {
          debugError("Error updating map:", mapError)
          toast.success("Location updated!", { id: "saved-address" })
        }
      } else {
        // Map not initialized yet, just fetch address
        setTimeout(async () => {
          await handleMapMoveEnd(latitude, longitude)
          toast.success("Location updated!", { id: "saved-address" })
        }, 300)
      }

      const selectedAddressId = getAddressId(address)
      if (selectedAddressId) {
        setActiveAddressId(selectedAddressId)
        await setDefaultAddress(selectedAddressId)
      }
      // User picked a saved address; Cart should prefer saved address over current location.
      try {
        localStorage.setItem("deliveryAddressMode", "saved");
      } catch {}
      onClose()
    } catch (error) {
      debugError("Error selecting saved address:", error)
      toast.error("Failed to update location. Please try again.")
    }
  }

  // Calculate distance for saved addresses
  const getAddressDistance = (address) => {
    if (!location?.latitude || !location?.longitude) return "0 m"

    const coordinates = address.location?.coordinates || []
    const addressLng = coordinates[0]
    const addressLat = coordinates[1]

    if (!addressLat || !addressLng) return "0 m"

    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      addressLat,
      addressLng
    )

    return distance < 1000 ? `${Math.round(distance)} m` : `${(distance / 1000).toFixed(2)} km`
  }

  const handleEditAddress = (addressId) => {
    // Edit address functionality removed - user can delete and add new address instead
    toast.info("To edit address, please delete and add a new one")
  }

  if (!isOpen) return null

  // If showing address form, render full-screen address form
  if (showAddressForm) {
    return (
      <div className="fixed inset-0 z-[10000] bg-white dark:bg-[#0a0a0a] flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleCancelAddressForm}
              className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ChevronLeft className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            </Button>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Select delivery location</h1>
          </div>
        </div>

        {/* Map Section - Google Maps */}
        <div className="flex-shrink-0 relative" style={{ height: '35vh', minHeight: '250px' }}>
          {/* Google Maps Container */}
          <div
            ref={mapContainerRef}
            className="w-full h-full bg-gray-200 dark:bg-gray-800"
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 1
            }}
          />

          {/* Loading State */}
          {mapLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 bg-opacity-75 z-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Loading map...</p>
              </div>
            </div>
          )}

          {/* API Key Missing Error */}
          {!GOOGLE_MAPS_API_KEY && !mapLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 z-20">
              <div className="text-center p-4">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Google Maps API key not found</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Please set VITE_GOOGLE_MAPS_API_KEY in .env file</p>
              </div>
            </div>
          )}

          {/* Use Current Location Button */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
            <Button
              onClick={handleUseCurrentLocationForAddress}
              disabled={mapLoading}
              className="bg-white dark:bg-[#1a1a1a] border-2 border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 shadow-lg disabled:opacity-50 flex items-center gap-2 px-4 py-2"
            >
              <Crosshair className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" strokeWidth={2.5} />
              <span className="text-green-600 dark:text-green-400 font-medium">Use current location</span>
            </Button>
          </div>
        </div>

        {/* Form Section - Scrollable */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-[#0a0a0a] min-h-0 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="px-4 py-4 space-y-4 pb-48">
            {/* Autocomplete address selection */}
            <div>
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                Search location
              </Label>
              <div className="relative">
                <Input
                  value={addressAutocompleteValue}
                  onChange={(e) => setAddressAutocompleteValue(e.target.value)}
                  onFocus={() => placePredictions.length > 0 && setShowPlacePredictions(true)}
                  onBlur={() => window.setTimeout(() => setShowPlacePredictions(false), 200)}
                  placeholder="Start typing your address..."
                  className="bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-700"
                />

                {addressAutocompleteValue.trim().length > 0 &&
                  ((showPlacePredictions && placePredictions.length > 0) ||
                    addressAutocompleteSuggestions.length > 0) && (
                  <div className="absolute z-50 left-0 right-0 mt-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] shadow-xl overflow-hidden">
                    {isKeywordSearching && (
                      <div className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                        Searching…
                      </div>
                    )}

                    {showPlacePredictions &&
                      placePredictions.map((p) => (
                      <button
                        key={p.place_id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handlePlacePredictionSelect(p)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                      >
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {p.description}
                        </p>
                      </button>
                    ))}

                    {/* Fallback: saved addresses matching the keyword */}
                    {(!showPlacePredictions || placePredictions.length === 0) &&
                      addressAutocompleteSuggestions.map((addr) => {
                        const id = getAddressId(addr) || `${addr?.label}-${addr?.street}-${addr?.city}`
                        const title = addr?.label || "Saved address"
                        const subtitle = [
                          addr?.additionalDetails,
                          addr?.street,
                          addr?.city,
                          addr?.state,
                          addr?.zipCode,
                        ]
                          .filter(Boolean)
                          .join(", ")
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setAddressAutocompleteValue("")
                              handleSelectSavedAddress(addr)
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                          >
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {title}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                              {subtitle}
                            </p>
                          </button>
                        )
                      })}
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Search an address to get exact suggestions; selecting one will pin it on the map.
              </p>
            </div>

            {/* Address Details */}
            <div>
              <Label htmlFor="additionalDetails" className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                Address details*
              </Label>
              <Input
                id="additionalDetails"
                name="additionalDetails"
                placeholder="E.g. Floor, House no."
                value={addressFormData.additionalDetails}
                onChange={handleAddressFormChange}
                className="bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-700"
              />
            </div>

            {/* Receiver Details */}
            <div className="mb-6">
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                Receiver details for this address
              </Label>
              <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center gap-3">
                <Phone className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {userProfile?.name || "User"}, {addressFormData.phone || userProfile?.phone || "Add phone"}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
              </div>
            </div>

            {/* Save Address As */}
            <div>
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                Save address as
              </Label>
              <div className="flex gap-2">
                {["Home", "Work", "Other"].map((label) => (
                  <Button
                    key={label}
                    type="button"
                    onClick={() => setAddressFormData(prev => ({ ...prev, label }))}
                    variant={addressFormData.label === label ? "default" : "outline"}
                    className={`flex-1 ${addressFormData.label === label
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-white dark:bg-[#1a1a1a]"
                      }`}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Manual address fields (auto-filled from Google Maps, editable by user) */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block">
                Address (Manual or Auto-fill)
              </Label>
              <Input
                name="street"
                placeholder="Street / Area *"
                value={addressFormData.street}
                onChange={handleAddressFormChange}
                className="bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-700"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  name="city"
                  placeholder="City *"
                  value={addressFormData.city}
                  onChange={handleAddressFormChange}
                  className="bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-700"
                  required
                />
                <Input
                  name="state"
                  placeholder="State *"
                  value={addressFormData.state}
                  onChange={handleAddressFormChange}
                  className="bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-700"
                  required
                />
              </div>
              <Input
                name="zipCode"
                placeholder="Pincode (optional)"
                value={addressFormData.zipCode || ""}
                onChange={handleAddressFormChange}
                className="bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-700"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tip: Use map/current location for auto-detection, or type details manually.
              </p>
            </div>
          </div>
        </div>

        {/* Save Address Button */}
        <div className="flex-shrink-0 bg-white dark:bg-[#1a1a1a] border-t border-gray-200 dark:border-gray-800 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <form onSubmit={handleAddressFormSubmit}>
            <Button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white h-12 text-base font-semibold"
              disabled={loadingAddress}
            >
              {loadingAddress ? "Loading..." : "Save address"}
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-[#0a0a0a]"
      style={{
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                onClose()
              }}
              className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 -ml-2"
            >
              <ChevronLeft className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            </Button>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Select a location</h1>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
        <div className="max-w-7xl mx-auto w-full pb-6">
          {/* Use Current Location */}
          <div
            className="px-4 sm:px-6 lg:px-8 py-2 bg-white dark:bg-[#1a1a1a]"
            style={{ animation: 'slideDown 0.3s ease-out 0.1s both' }}
          >
            <button
              onClick={handleUseCurrentLocation}
              disabled={loading}
              className="w-full flex items-center justify-between py-4 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center group-hover:bg-green-100 dark:group-hover:bg-green-900/30 transition-colors">
                  <Crosshair className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" strokeWidth={2.5} />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-green-700 dark:text-green-400">Use current location</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {loading ? "Getting location..." : currentLocationText}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </button>

            {/* Add Address */}
            <button
              onClick={handleAddAddress}
              className="w-full flex items-center justify-between py-4 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors group border-t border-gray-100 dark:border-gray-800"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center group-hover:bg-green-100 dark:group-hover:bg-green-900/30 transition-colors">
                  <Plus className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <p className="font-semibold text-green-700 dark:text-green-400">Add Address</p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </button>
          </div>

          {/* Saved Addresses Section */}
          {addresses.filter(a => a.type !== "current" && a.label !== "Current Location").length > 0 && (
            <div
              className="mt-2"
              style={{ animation: 'slideDown 0.3s ease-out 0.2s both' }}
            >
              <div className="px-4 sm:px-6 lg:px-8 py-3">
                <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wider uppercase">
                  Saved Addresses
                </h2>
              </div>
              <div className="bg-white dark:bg-[#1a1a1a]">
                {addresses
                  .filter(a => a.type !== "current" && a.label !== "Current Location")
                  .filter((address, index, self) => {
                    // Filter out duplicate addresses with same label - keep only first occurrence
                    const firstIndex = self.findIndex(addr => addr.label === address.label)
                    return index === firstIndex
                  })
                  .map((address, index) => {
                    const IconComponent = getAddressIcon(address)
                    return (
                      <div
                        key={address.id}
                        className="px-4 sm:px-6 lg:px-8"
                        style={{ animation: `slideUp 0.3s ease-out ${0.25 + index * 0.05}s both` }}
                      >
                        <div
                          className={`py-4 ${index !== 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''}`}
                        >
                          <button
                            onClick={() => handleSelectSavedAddress(address)}
                            className="w-full flex items-start gap-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors p-2 -m-2"
                          >
                            <div className="flex flex-col items-center">
                              <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                <IconComponent className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {address.label || address.additionalDetails || "Home"}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {[
                                  address.additionalDetails,
                                  address.street,
                                  address.city,
                                  address.state,
                                  address.zipCode
                                ].filter(Boolean).join(", ")}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Phone number: {address.phone || userProfile?.phone || "Not provided"}
                              </p>
                            </div>
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        /* Blue Dot Indicator for Live Location */
        .user-location-marker {
          width: 20px !important;
          height: 20px !important;
          background-color: #4285F4 !important; /* Google Blue */
          border: 3px solid white !important;
          border-radius: 50% !important;
          box-shadow: 0 0 10px rgba(0,0,0,0.3) !important;
          position: relative !important;
          transition: transform 0.3s ease;
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          z-index: 1001 !important;
          pointer-events: none;
        }
        
        /* Ensure marker container is also visible */
        .mapboxgl-marker.user-location-marker,
        .maplibregl-marker.user-location-marker {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          z-index: 1001 !important;
        }
        
        /* Arrow indicator pointing in direction of movement */
        .user-location-marker::before {
          content: "";
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-bottom: 8px solid #4285F4;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
        }
        
        /* Pulsing Aura Effect */
        .user-location-marker::after {
          content: "";
          position: absolute;
          width: 40px;
          height: 40px;
          top: -13px;
          left: -13px;
          background-color: rgba(66, 133, 244, 0.2);
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  )
}



