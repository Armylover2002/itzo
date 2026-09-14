import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import { useNavigate, useLocation as useRouterLocation } from "react-router-dom"
import { ChevronLeft, ChevronRight, Plus, MapPin, MoreHorizontal, Navigation, Home, Building2, Briefcase, Phone, X, Crosshair, Search, Trash2 } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
import { Textarea } from "@food/components/ui/textarea"
import { useLocation as useGeoLocation } from "@food/hooks/useLocation"
import { useProfile } from "@food/context/ProfileContext"
import { toast } from "sonner"
import { locationAPI, userAPI } from "@food/api"
import AnimatedPage from "@food/components/user/AnimatedPage"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import { loadGoogleMaps } from "@/core/services/googleMapsLoader"
import { useDebouncedMapGeocode } from "@core/hooks/useDebouncedMapGeocode"
import {
  DEFAULT_MAP_GEOCODE_DEBOUNCE_MS,
  DEFAULT_MAP_GEOCODE_MIN_DISTANCE_M,
} from "@core/utils/mapGeocode"
import {
  fetchPlaceDetails,
  fetchPlacePredictions,
  initPlacesServices,
  parsePlaceDetails,
  PLACES_SEARCH_DEBOUNCE_MS,
} from "@food/utils/googlePlacesAutocomplete"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@food/components/ui/dialog"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const isPlusCode = (value) =>
  /^[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}$/i.test(String(value || "").trim())

const resolveStreetFromGeocode = (parsed, fallback = "") => {
  const street = String(parsed?.street || "").trim()
  const area = String(parsed?.area || "").trim()
  if (street && !isPlusCode(street)) return street
  return area || street || fallback
}

// Enable Maps if API Key is available, otherwise fallback to coordinates-only mode
const MAPS_ENABLED = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY

// Get icon based on address type/label
const getAddressIcon = (address) => {
  const label = (address.label || address.additionalDetails || "").toLowerCase()
  if (label.includes("home")) return Home
  if (label.includes("work") || label.includes("office")) return Briefcase
  if (label.includes("building") || label.includes("apt")) return Building2
  return Home
}

const buildLocationPayloadFromAddress = (address) => {
  if (!address || typeof address !== "object") return null

  const coordinates = Array.isArray(address.location?.coordinates)
    ? address.location.coordinates
    : []
  const longitude = Number(
    coordinates[0] ?? address.longitude ?? address.lng ?? null,
  )
  const latitude = Number(
    coordinates[1] ?? address.latitude ?? address.lat ?? null,
  )

  const street = String(address.street || "").trim()
  const area = String(address.additionalDetails || address.area || "").trim()
  const city = String(address.city || "").trim()
  const state = String(address.state || "").trim()
  const zipCode = String(address.zipCode || address.postalCode || "").trim()
  const formattedAddress =
    String(address.formattedAddress || address.address || "").trim() ||
    [area, street, city, state, zipCode].filter(Boolean).join(", ") ||
    [street, city, state].filter(Boolean).join(", ")

  return {
    label: address.label || "Home",
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
    street,
    area,
    city,
    state,
    zipCode,
    postalCode: zipCode,
    placeId: address.placeId || address.place_id || undefined,
    address: formattedAddress,
    formattedAddress,
  }
}

const persistSelectedLocation = (locationData) => {
  if (!locationData) return
  try {
    localStorage.setItem("userLocation", JSON.stringify(locationData))
    window.dispatchEvent(
      new CustomEvent("userLocationUpdated", {
        detail: { location: locationData },
      }),
    )
  } catch {
    // Ignore storage/event sync errors so selection still works.
  }
}

export default function AddressSelectorPage() {
  const navigate = useNavigate()
  const routerLocation = useRouterLocation()
  const returnPath =
    routerLocation?.state?.from ||
    routerLocation?.state?.backTo ||
    "/food/user"
  const goBack = useAppBackNavigation()
  const { location: geoLocation, loading, requestLocation, reverseGeocode } = useGeoLocation()
  const { addresses = [], addAddress, updateAddress, setDefaultAddress, deleteAddress, userProfile, setActiveAddressId } = useProfile()
  const savedAddresses = useMemo(() => addresses.filter(a => a.type !== "current" && a.label !== "Current Location"), [addresses]);
  const currentLocation = useMemo(() => addresses.find(a => a.type === "current" || a.label === "Current Location"), [addresses]);
  const [addressToDelete, setAddressToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [editAddressId, setEditAddressId] = useState(null)
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
  const userLocationMarkerRef = useRef(null) // Blue dot marker for user location
  const blueDotCircleRef = useRef(null) // Accuracy circle for Google Maps
  const [currentAddress, setCurrentAddress] = useState("")
  const [selectedPlaceId, setSelectedPlaceId] = useState("")
  const [selectedFormattedAddress, setSelectedFormattedAddress] = useState("")
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
  const [mapUnavailable, setMapUnavailable] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const [baseMapHeight, setBaseMapHeight] = useState(320)
  const formBodyRef = useRef(null)
  const hasInitializedRef = useRef(false)
  const manualFieldRefs = useRef({})
  const lastReverseGeocodeCoordsRef = useRef(null)
  const reverseGeocodeInFlightRef = useRef(null)
  const skipMapIdleRef = useRef(false)
  
  // Sync currentAddress and mapPosition with the useLocation hook's location address on load/update
  useEffect(() => {
    if (geoLocation && (geoLocation.formattedAddress || geoLocation.address)) {
      const addrText = geoLocation.formattedAddress || geoLocation.address || ""
      setCurrentAddress(addrText)

      if (!hasInitializedRef.current && geoLocation.latitude && geoLocation.longitude) {
        hasInitializedRef.current = true
        setMapPosition([geoLocation.latitude, geoLocation.longitude])
        
        // Sync addressFormData on initial load/first set if form values are empty
        setAddressFormData(prev => {
          if (prev.street || prev.city) return prev
          return {
            ...prev,
            street: resolveStreetFromGeocode(geoLocation, prev.street),
            city: geoLocation.city || "",
            state: geoLocation.state || "",
            zipCode: geoLocation.postalCode || geoLocation.zipCode || "",
          }
        })
      }
    }
  }, [geoLocation])

  const ENABLE_LOCATION_REVERSE_GEOCODE = import.meta.env.VITE_ENABLE_LOCATION_REVERSE_GEOCODE !== "false"
  const getAddressId = (address) => address?.id || address?._id || null

  const handleDeleteConfirm = async () => {
    if (!addressToDelete) return;
    setIsDeleting(true);
    try {
      await deleteAddress(addressToDelete);
      toast.success("Address deleted successfully");
      setAddressToDelete(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete address");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBack = () => {
    goBack()
  }

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

  // Load Google Maps API key
  useEffect(() => {
    if (!MAPS_ENABLED) return
    import('@food/utils/googleMapsApiKey.js').then(({ getGoogleMapsApiKey }) => {
      getGoogleMapsApiKey().then(key => {
        setGOOGLE_MAPS_API_KEY(key)
      })
    })
  }, [])

  // Google Places autocomplete search
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

  const handleMapMoveEnd = useCallback(async (lat, lng, { signal } = {}) => {
    if (!ENABLE_LOCATION_REVERSE_GEOCODE) return

    const roundedLat = parseFloat(Number(lat).toFixed(6))
    const roundedLng = parseFloat(Number(lng).toFixed(6))
    const coordKey = `${roundedLat.toFixed(6)},${roundedLng.toFixed(6)}`

    lastReverseGeocodeCoordsRef.current = { lat: roundedLat, lng: roundedLng, key: coordKey }
    manualFieldRefs.current._lastCoords = coordKey

    const run = (async () => {
      try {
        const parsed = await reverseGeocode(roundedLat, roundedLng)
        if (!parsed || signal?.aborted) return

        const formatted = parsed.formattedAddress || parsed.address || ""
        setCurrentAddress((prev) => (prev === formatted ? prev : formatted))
        setSelectedFormattedAddress(formatted)
        setSelectedPlaceId("")
        setAddressFormData((prev) => {
          if (
            prev.street === parsed.street &&
            prev.city === parsed.city &&
            prev.state === parsed.state &&
            prev.zipCode === parsed.postalCode
          ) {
            return prev
          }
          return {
            ...prev,
            street: resolveStreetFromGeocode(parsed, prev.street),
            city: parsed.city || prev.city,
            state: parsed.state || prev.state,
            zipCode: parsed.postalCode || prev.zipCode,
          }
        })
      } catch (e) {
        if (signal?.aborted || e?.code === "ERR_CANCELED") return
        debugError("Reverse geocode error:", e)
      }
    })()

    reverseGeocodeInFlightRef.current = run
    try {
      await run
    } finally {
      if (reverseGeocodeInFlightRef.current === run) {
        reverseGeocodeInFlightRef.current = null
      }
    }
  }, [reverseGeocode])

  const {
    bindMap,
    detachMap,
    cancelPending: cancelMapGeocode,
    setLastGeocoded,
    forceGeocode,
  } = useDebouncedMapGeocode({
    debounceMs: DEFAULT_MAP_GEOCODE_DEBOUNCE_MS,
    minDistanceM: DEFAULT_MAP_GEOCODE_MIN_DISTANCE_M,
    skipRef: skipMapIdleRef,
    onGeocode: handleMapMoveEnd,
    onCenterChange: (lat, lng) => setMapPosition([lat, lng]),
  })

  const panMapTo = useCallback((lat, lng, zoom = 17) => {
    if (!googleMapRef.current) return
    skipMapIdleRef.current = true
    cancelMapGeocode()
    googleMapRef.current.panTo({ lat, lng })
    if (zoom) googleMapRef.current.setZoom(zoom)
    window.setTimeout(() => {
      skipMapIdleRef.current = false
    }, DEFAULT_MAP_GEOCODE_DEBOUNCE_MS + 200)
  }, [cancelMapGeocode])

  // Map Initialization logic
  useEffect(() => {
    if (!MAPS_ENABLED || mapUnavailable || !showAddressForm || !mapContainerRef.current || !GOOGLE_MAPS_API_KEY) return

    if (googleMapRef.current) {
      setMapLoading(false)
      return undefined
    }

    let isMounted = true
    setMapLoading(true)

    const initializeGoogleMap = async () => {
      try {
        const maps = await loadGoogleMaps(GOOGLE_MAPS_API_KEY)
        const google = typeof window !== "undefined" ? window.google : null
        if (!maps || !google?.maps?.Map) {
          throw new Error("Google Maps is unavailable")
        }
        if (!isMounted || !mapContainerRef.current || googleMapRef.current) return

        const initialPos = { lat: mapPosition[0], lng: mapPosition[1] }

        const map = new google.maps.Map(mapContainerRef.current, {
          center: initialPos,
          zoom: 16,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] }
          ]
        })
        googleMapRef.current = map
        setLastGeocoded(initialPos)

        const placesServices = initPlacesServices(map)
        if (placesServices) {
          autocompleteServiceRef.current = placesServices.autocompleteService
          placesServiceRef.current = placesServices.placesService
          sessionTokenRef.current = placesServices.sessionToken
        }

        bindMap(map)

        setMapLoading(false)
      } catch (err) {
        debugError("Map init error:", err)
        setMapUnavailable(true)
        setMapLoading(false)
      }
    }
    initializeGoogleMap()
    return () => {
      isMounted = false
      detachMap()
    }
  }, [showAddressForm, GOOGLE_MAPS_API_KEY, mapUnavailable, bindMap, detachMap, setLastGeocoded])

  const handleUseCurrentLocation = async () => {
    try {
      toast.loading("Getting location...", { id: "geo" })
      const loc = await requestLocation(true, true)
      
      if (loc?.latitude) {
        // Update state
        const newPos = [loc.latitude, loc.longitude]
        setMapPosition(newPos)
        setCurrentAddress(loc.formattedAddress || loc.address || "")
        
        // Persist local
        persistSelectedLocation(loc)
        try { localStorage.setItem("deliveryAddressMode", "current") } catch {}
        
        // Save to Mongo
        try {
          const payload = {
            street: resolveStreetFromGeocode(loc, loc.street || loc.address || "Current Location"),
            additionalDetails: loc.area || "",
            city: loc.city || loc.area || "Current City",
            state: loc.state || loc.city || "Current State",
            zipCode: loc.postalCode || loc.zipCode || "",
            type: "current",
            label: "Current Location",
            address: loc.formattedAddress || loc.address || "Current Location",
            location: {
              type: "Point",
              coordinates: [loc.longitude, loc.latitude]
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
          debugError("Failed to save current location to DB:", e)
        }
        
        // Update map
        panMapTo(loc.latitude, loc.longitude, 17)
        
        // Update form data if form is open
        if (showAddressForm) {
          setAddressFormData(prev => ({
            ...prev,
            street: resolveStreetFromGeocode(loc, prev.street),
            city: loc.city || prev.city,
            state: loc.state || prev.state,
            zipCode: loc.postalCode || prev.zipCode,
          }))
          toast.success("Location updated", { id: "geo" })
          // Don't redirect if they are explicitly in the "Add Address" form
        } else {
          toast.success("Location updated", { id: "geo" })
          // Redirect if they are on the main selection page
          setTimeout(() => {
            navigate(returnPath, { replace: true })
          }, 800)
        }
      } else {
        toast.error("Could not determine location", { id: "geo" })
      }
    } catch (e) {
      toast.error("Failed to get location", { id: "geo" })
    }
  }

  const handleSelectSavedAddress = async (address) => {
    const id = getAddressId(address)
    if (id) {
      setActiveAddressId(id)
      await setDefaultAddress(id)
      persistSelectedLocation(buildLocationPayloadFromAddress(address))
      try { localStorage.setItem("deliveryAddressMode", "saved") } catch {}
      toast.success("Address selected")
      
      // Use "from" state if available, otherwise default to home page
      const from = returnPath
      setTimeout(() => {
        navigate(from, { replace: true })
      }, 500)
    }
  }

  const handleAddAddressClick = () => {
    setShowAddressForm(true)
  }

  const handleCancelAddressForm = () => {
    cancelMapGeocode()
    detachMap()
    googleMapRef.current = null
    lastReverseGeocodeCoordsRef.current = null
    setShowAddressForm(false)
    setAddressAutocompleteValue("")
    setPlacePredictions([])
    setShowPlacePredictions(false)
    setIsKeywordSearching(false)
    setSelectedPlaceId("")
    setSelectedFormattedAddress("")
    setEditAddressId(null)
  }

  const scrollFieldIntoView = useCallback((fieldName) => {
    const el = manualFieldRefs.current?.[fieldName]
    if (!el) return
    setTimeout(() => {
      try {
        const scrollHost = formBodyRef.current
        if (!scrollHost) {
          el.scrollIntoView({ behavior: "smooth", block: "center" })
          return
        }
        const hostRect = scrollHost.getBoundingClientRect()
        const elRect = el.getBoundingClientRect()
        const viewportHeight =
          typeof window !== "undefined" && window.visualViewport
            ? window.visualViewport.height
            : window.innerHeight
        const safeBottom = viewportHeight - keyboardInset - 90
        const overBy = elRect.bottom - safeBottom
        if (overBy > 0) {
          scrollHost.scrollTo({
            top: scrollHost.scrollTop + overBy + 24,
            behavior: "smooth",
          })
          return
        }
        if (elRect.top < hostRect.top + 70) {
          const upBy = hostRect.top + 70 - elRect.top
          scrollHost.scrollTo({
            top: Math.max(0, scrollHost.scrollTop - upBy - 12),
            behavior: "smooth",
          })
          return
        }
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      } catch {
        // Ignore scrolling errors.
      }
    }, 120)
  }, [keyboardInset])

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

      setMapPosition([latitude, longitude])
      setLastGeocoded({ lat: latitude, lng: longitude })
      panMapTo(latitude, longitude, 17)

      setAddressAutocompleteValue(display)
      setPlacePredictions([])
      setShowPlacePredictions(false)
      setCurrentAddress(display)
      setSelectedFormattedAddress(display)
      setSelectedPlaceId(parsed.placeId || prediction.place_id || "")
      setAddressFormData((prev) => ({
        ...prev,
        street: parsed.area || display.split(",")[0]?.trim() || prev.street,
        city: parsed.city || prev.city,
        state: parsed.state || prev.state,
        zipCode: parsed.pincode || prev.zipCode,
      }))

      try {
        await handleMapMoveEnd(latitude, longitude)
      } catch {}
    } catch {
      toast.error("Could not load location details. Please try again.")
    }
  }, [handleMapMoveEnd])

  // Auto-geocode from manual address fields (debounced)
  useEffect(() => {
    if (!showAddressForm || typeof window === "undefined" || !window.google) return;
    const addr = `${addressFormData.street || ""}, ${addressFormData.city || ""}`.trim();
    if (addr.length < 5) return;

    const timeout = setTimeout(() => {
      // Don't auto-geocode if the user just moved the map (which triggered reverse geocode)
      // or if it's the same address we just geocoded
      if (manualFieldRefs.current._lastGeocoded === addr) return;
      manualFieldRefs.current._lastGeocoded = addr;

      try {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: addr }, (results, status) => {
          if (status === "OK" && results && results[0]) {
            const location = results[0].geometry.location;
            const lat = location.lat();
            const lng = location.lng();
            
            // Update map but don't trigger reverse geocode again
            const coordKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
            manualFieldRefs.current._lastCoords = coordKey;
            
            setMapPosition([lat, lng]);
            setLastGeocoded({ lat, lng });
            panMapTo(lat, lng, 17);
          }
        });
      } catch (err) {
        // Ignored
      }
    }, 1200);

    return () => clearTimeout(timeout);
  }, [addressFormData.street, addressFormData.city, showAddressForm, panMapTo, setLastGeocoded]);

  const handleAddressFormSubmit = async (e) => {
    e.preventDefault()
    if (!addressFormData.street || !addressFormData.city) {
      toast.error("Please fill required fields")
      return
    }
    setLoadingAddress(true)
    try {
      const completeAddress =
        String(selectedFormattedAddress || currentAddress || "").trim() ||
        [addressFormData.street, addressFormData.city, addressFormData.state, addressFormData.zipCode]
          .filter(Boolean)
          .join(", ")
      const payload = {
        ...addressFormData,
        label: addressFormData.label === "Work" ? "Office" : addressFormData.label,
        address: completeAddress,
        formattedAddress: completeAddress,
        ...(selectedPlaceId ? { placeId: selectedPlaceId } : {}),
        location: { type: "Point", coordinates: [mapPosition[1], mapPosition[0]] },
        latitude: mapPosition[0],
        longitude: mapPosition[1]
      }
      let created;
      if (editAddressId) {
        created = await updateAddress(editAddressId, payload)
      } else {
        created = await addAddress(payload)
      }
      
      if (created) {
        const id = getAddressId(created || payload)
        if (id) {
          setActiveAddressId(id)
          await setDefaultAddress(id)
        }
        persistSelectedLocation(buildLocationPayloadFromAddress(created || payload))
        try { localStorage.setItem("deliveryAddressMode", "saved") } catch {}
        toast.success("Address saved")
        setShowAddressForm(false)
        setAddressAutocompleteValue("")
        setPlacePredictions([])
        setShowPlacePredictions(false)
        
        // Use "from" state if available, otherwise default to home page
        const from = returnPath
        setTimeout(() => {
          navigate(from, { replace: true })
        }, 500)
      }
    } catch (error) {
      console.error("Address form submit error:", error)
      toast.error(error?.response?.data?.message || error?.message || "Failed to save address")
    } finally {
      setLoadingAddress(false)
    }
  }

  useEffect(() => {
    if (!showAddressForm) return
    const updateBaseMapHeight = () => {
      const vh = typeof window !== "undefined" ? window.innerHeight : 800
      const target = Math.round(vh * 0.45)
      setBaseMapHeight(Math.max(260, Math.min(420, target)))
    }
    updateBaseMapHeight()
    window.addEventListener("resize", updateBaseMapHeight)
    return () => window.removeEventListener("resize", updateBaseMapHeight)
  }, [showAddressForm])

  useEffect(() => {
    if (!showAddressForm || typeof window === "undefined" || !window.visualViewport) return
    const viewport = window.visualViewport
    const updateKeyboardInset = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      setKeyboardInset(inset > 0 ? inset : 0)
    }
    updateKeyboardInset()
    viewport.addEventListener("resize", updateKeyboardInset)
    viewport.addEventListener("scroll", updateKeyboardInset)
    return () => {
      viewport.removeEventListener("resize", updateKeyboardInset)
      viewport.removeEventListener("scroll", updateKeyboardInset)
    }
  }, [showAddressForm])

  if (showAddressForm) {
    const mapHeight = baseMapHeight 
    return (
      <AnimatedPage
        className="fixed inset-0 z-50 bg-white dark:bg-[#0a0a0a] flex flex-col h-screen overflow-hidden"
      >
        <div className="flex-shrink-0 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleCancelAddressForm} className="rounded-full">
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-lg font-bold">Add delivery location</h1>
        </div>

        <div
          ref={formBodyRef}
          className="flex-1 overflow-y-auto"
          style={{ paddingBottom: `${96 + keyboardInset}px` }}
        >
          {/* Map Section - Parallax enabled */}
          <div
            className="flex-shrink-0 relative z-0"
            style={{ height: `${mapHeight}px` }}
          >
            <div className="absolute top-4 left-4 right-4 z-20">
              <div className="relative group shadow-2xl">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                  value={addressAutocompleteValue}
                  onChange={(e) => setAddressAutocompleteValue(e.target.value)}
                  onFocus={() => placePredictions.length > 0 && setShowPlacePredictions(true)}
                  onBlur={() => window.setTimeout(() => setShowPlacePredictions(false), 200)}
                  placeholder="Start typing your address..."
                  className="pl-10 h-12 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-md border-none rounded-xl shadow-lg focus:ring-2 focus:ring-[#FF0000] transition-all"
                />
                {isKeywordSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                     <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#FF0000] border-t-transparent" />
                  </div>
                )}

                {showPlacePredictions && placePredictions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden z-30 animate-in fade-in slide-in-from-top-2 duration-200">
                    <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 dark:bg-gray-800/50">Suggestions</p>
                    {placePredictions.map((s) => (
                      <button
                        key={s.place_id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handlePlacePredictionSelect(s)}
                        className="w-full px-4 py-3 flex items-start gap-3 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left border-b border-gray-50 dark:border-gray-800 last:border-none"
                      >
                        <MapPin className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{s.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div ref={mapContainerRef} className="w-full h-full bg-gray-100 dark:bg-gray-800" />

            {mapUnavailable && (
              <div className="absolute inset-x-4 top-20 z-20 rounded-2xl border border-amber-200 bg-white/95 px-4 py-3 text-sm text-amber-900 shadow-lg backdrop-blur">
                Map preview could not load here. You can still enter and save the address manually below.
              </div>
            )}
            
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
               <div className="relative mb-8 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center p-2 mb-[-6px] shadow-sm animate-bounce-short">
                     <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center border-2 border-white">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                     </div>
                  </div>
                  <div className="w-1.5 h-6 bg-green-600 border-x border-white shadow-xl rounded-b-full shadow-green-900/40" />
                  <div className="w-3 h-1.5 bg-black/20 rounded-full blur-[1px] transform scale-x-150 absolute bottom-[-4px]" />
               </div>
            </div>

            {mapLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF0000]" />
              </div>
            )}
            
            <div className="absolute bottom-10 right-4 z-10">
              <Button 
                  onClick={handleUseCurrentLocation} 
                  className="bg-white text-black hover:bg-gray-100 shadow-xl border border-gray-200 rounded-full h-12 px-6"
              >
                <Navigation className="h-4 w-4 mr-2 text-[#FF0000]" /> Use My Location
              </Button>
            </div>
          </div>

          <div className="relative bg-white dark:bg-[#0a0a0a] rounded-t-[32px] -mt-8 z-10 p-4 space-y-6 shadow-[0_-12px_24px_-10px_rgba(0,0,0,0.1)]">
            <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl p-4 flex gap-3">
               <MapPin className="h-5 w-5 text-[#FF0000] mt-0.5" />
               <div className="min-w-0">
                  <p className="text-xs font-bold text-red-800 dark:text-red-200 uppercase mb-1">Pinnned Location</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{currentAddress || "Select a location on map"}</p>
               </div>
            </div>

            <div>
              <Label className="text-sm font-bold mb-2 block">Primary Address (Street / Area / Landmark)</Label>
              <Input 
                placeholder="Search or drag to update street/area" 
                value={addressFormData.street} 
                onChange={e => setAddressFormData({...addressFormData, street: e.target.value})}
                onFocus={() => scrollFieldIntoView("street")}
                ref={(el) => { manualFieldRefs.current.street = el }}
                className="mb-4 h-12 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                required
              />

              <Label className="text-sm font-bold mb-2 block text-red-600 dark:text-red-400">Secondary Address (House No. / Flat / Floor)</Label>
              <Input 
                placeholder="E.g. Flat 402, 4th Floor, AppZeto Building" 
                value={addressFormData.additionalDetails} 
                onChange={e => setAddressFormData({...addressFormData, additionalDetails: e.target.value})}
                onFocus={() => scrollFieldIntoView("additionalDetails")}
                ref={(el) => { manualFieldRefs.current.additionalDetails = el }}
                className="h-12 rounded-xl border-red-200 dark:border-red-900/40 focus:ring-red-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs mb-1 block">City</Label>
                <Input 
                  value={addressFormData.city} 
                  onChange={e => setAddressFormData({...addressFormData, city: e.target.value})} 
                  onFocus={() => scrollFieldIntoView("city")}
                  ref={(el) => { manualFieldRefs.current.city = el }}
                  className="h-12 rounded-xl"
                  required 
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">State</Label>
                <Input 
                  value={addressFormData.state} 
                  onChange={e => setAddressFormData({...addressFormData, state: e.target.value})} 
                  onFocus={() => scrollFieldIntoView("state")}
                  ref={(el) => { manualFieldRefs.current.state = el }}
                  className="h-12 rounded-xl"
                  required 
                />
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Pincode / ZIP</Label>
              <Input 
                placeholder="Pincode" 
                value={addressFormData.zipCode || ""} 
                onChange={e => setAddressFormData({...addressFormData, zipCode: e.target.value})} 
                onFocus={() => scrollFieldIntoView("zipCode")}
                ref={(el) => { manualFieldRefs.current.zipCode = el }}
                className="h-12 rounded-xl"
              />
            </div>

            <div>
               <Label className="text-sm font-bold mb-2 block">Save address as</Label>
               <div className="flex gap-2">
                 {["Home", "Work", "Other"].map(l => (
                   <Button 
                     key={l}
                     variant={addressFormData.label === l ? "default" : "outline"}
                     onClick={() => setAddressFormData({...addressFormData, label: l})}
                     className="flex-1"
                     style={addressFormData.label === l ? {backgroundColor: '#FF0000', color: 'white'} : {}}
                   >
                     {l}
                   </Button>
                 ))}
               </div>
            </div>
          </div>
        </div>

        <div
          className="fixed left-0 right-0 p-4 bg-white dark:bg-[#1a1a1a] border-t dark:border-gray-800 transition-[bottom] duration-150"
          style={{ bottom: `${keyboardInset}px` }}
        >
          <Button 
            className="w-full h-12 text-white font-bold text-lg" 
            style={{backgroundColor: '#FF0000'}}
            onClick={handleAddressFormSubmit}
            disabled={loadingAddress}
          >
            {loadingAddress ? "Saving..." : "Save Address \u0026 Proceed"}
          </Button>
        </div>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage className="min-h-screen bg-white dark:bg-[#0a0a0a] flex flex-col">
      <div className="flex-shrink-0 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 px-4 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleBack} className="rounded-full">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold">Select Location</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-10">
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Current Location</h2>
          {currentLocation ? (
            <button 
              onClick={() => handleSelectSavedAddress(currentLocation)}
              className="w-full flex items-center gap-3 p-3 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm hover:shadow-md transition-all group mb-3"
            >
              <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <Navigation className="h-4 w-4 text-[#FF0000]" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-bold text-[#FF0000]">Current Location</p>
                <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">{currentLocation.address || currentAddress || "Unknown location"}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>
          ) : null}
          <button 
            onClick={handleUseCurrentLocation}
            className="w-full flex items-center justify-center gap-2 p-2.5 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-sm font-semibold rounded-xl border border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
          >
            <Crosshair className="h-4 w-4" />
            Refresh GPS Location
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Saved Addresses</h2>
            <Button variant="ghost" className="text-[#FF0000] p-0 h-auto text-sm font-bold" onClick={handleAddAddressClick}>
              <Plus className="h-3 w-3 mr-1" /> Add New
            </Button>
          </div>

          <div className="space-y-3">
            {savedAddresses.length === 0 ? (
              <div className="text-center py-10 opacity-50">
                <MapPin className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No addresses saved yet</p>
              </div>
            ) : (
              savedAddresses.map((addr, idx) => {
                const Icon = getAddressIcon(addr)
                const addrId = getAddressId(addr);
                return (
                  <div key={addrId || idx} className="relative group">
                    <button
                      onClick={() => handleSelectSavedAddress(addr)}
                      className="w-full flex items-start gap-3 p-3 bg-slate-50 dark:bg-[#1a1a1a] rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left"
                    >
                      <div className="h-8 w-8 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm flex-shrink-0 mt-0.5">
                        <Icon className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                      </div>
                      <div className="flex-1 min-w-0 pr-16">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-bold text-gray-900 dark:text-white capitalize">{addr.label || "Address"}</p>
                        </div>
                        <p className="text-[11px] text-gray-500 line-clamp-2 leading-tight">
                          {[addr.street, addr.additionalDetails, addr.city, addr.state, addr.zipCode].filter(Boolean).join(", ")}
                        </p>
                      </div>
                    </button>
                    {addrId && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddressFormData({
                              street: addr.street || "",
                              city: addr.city || "",
                              state: addr.state || "",
                              zipCode: addr.zipCode || "",
                              additionalDetails: addr.additionalDetails || "",
                              label: addr.label || "Home",
                              phone: addr.phone || "",
                            })
                            if (addr.location?.coordinates) {
                              setMapPosition([addr.location.coordinates[1], addr.location.coordinates[0]])
                            } else if (addr.latitude && addr.longitude) {
                              setMapPosition([addr.latitude, addr.longitude])
                            }
                            setEditAddressId(addrId)
                            setShowAddressForm(true)
                          }}
                          className="p-1.5 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                          title="Edit Address"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddressToDelete(addrId);
                          }}
                          className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full transition-colors"
                          title="Delete Address"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!addressToDelete} onOpenChange={(isOpen) => !isOpen && !isDeleting && setAddressToDelete(null)}>
        <DialogContent className="sm:max-w-md w-[90vw] rounded-2xl mx-auto p-6 pt-8">
          <DialogHeader className="pr-6">
            <DialogTitle className="text-center sm:text-left">Delete Address</DialogTitle>
            <DialogDescription className="text-center sm:text-left mt-2">
              Are you sure you want to delete this address? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddressToDelete(null)}
              disabled={isDeleting}
              className="flex-1 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes bounce-short {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bounce-short {
          animation: bounce-short 1s infinite ease-in-out;
        }
      `}</style>
    </AnimatedPage>
  )
}
