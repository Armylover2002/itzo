import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import { useNavigate, useLocation as useRouterLocation } from "react-router-dom"
import { ChevronLeft, ChevronRight, Plus, MapPin, MoreHorizontal, Navigation, Home, Building2, Briefcase, Phone, X, Crosshair, Search } from "lucide-react"
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

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

// Enable Maps if API Key is available, otherwise fallback to coordinates-only mode
const MAPS_ENABLED = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY

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
    String(address.formattedAddress || "").trim() ||
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
    address: [street, city].filter(Boolean).join(", ") || formattedAddress,
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
  const goBack = useAppBackNavigation()
  const { location, loading, requestLocation, reverseGeocode } = useGeoLocation()
  const { addresses = [], addAddress, updateAddress, setDefaultAddress, userProfile } = useProfile()
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
  const userLocationMarkerRef = useRef(null) // Blue dot marker for user location
  const blueDotCircleRef = useRef(null) // Accuracy circle for Google Maps
  const [currentAddress, setCurrentAddress] = useState("")
  const [addressAutocompleteValue, setAddressAutocompleteValue] = useState("")
  const [keywordAddressSuggestions, setKeywordAddressSuggestions] = useState([])
  const [isKeywordSearching, setIsKeywordSearching] = useState(false)
  const [lockMapToAutocomplete, setLockMapToAutocomplete] = useState(true)
  const [GOOGLE_MAPS_API_KEY, setGOOGLE_MAPS_API_KEY] = useState(null)
  const [mapUnavailable, setMapUnavailable] = useState(false)
  const [formScrollTop, setFormScrollTop] = useState(0)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const [baseMapHeight, setBaseMapHeight] = useState(320)
  const formBodyRef = useRef(null)
  const hasInitializedRef = useRef(false)
  const manualFieldRefs = useRef({})
  
  // Sync currentAddress and mapPosition with the useLocation hook's location address on load/update
  useEffect(() => {
    if (location && (location.formattedAddress || location.address)) {
      const addrText = location.formattedAddress || location.address || ""
      setCurrentAddress(addrText)
      
      if (!hasInitializedRef.current && location.latitude && location.longitude) {
        hasInitializedRef.current = true
        setMapPosition([location.latitude, location.longitude])
        
        // Sync addressFormData on initial load/first set if form values are empty
        setAddressFormData(prev => {
          if (prev.street || prev.city) return prev
          return {
            ...prev,
            street: location.street || location.area || "",
            city: location.city || "",
            state: location.state || "",
            zipCode: location.postalCode || location.zipCode || "",
          }
        })
      }
    }
  }, [location])

  const ENABLE_LOCATION_REVERSE_GEOCODE = import.meta.env.VITE_ENABLE_LOCATION_REVERSE_GEOCODE !== "false"
  const ENABLE_NOMINATIM_SEARCH = import.meta.env.VITE_ENABLE_NOMINATIM_SEARCH !== "false"
  const getAddressId = (address) => address?.id || address?._id || null

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

  // Nominatim search
  useEffect(() => {
    if (!showAddressForm) return
    const q = String(addressAutocompleteValue || "").trim()
    if (!ENABLE_NOMINATIM_SEARCH || q.length < 3) {
      setKeywordAddressSuggestions([])
      setIsKeywordSearching(false)
      return
    }

    const t = setTimeout(async () => {
      try {
        setIsKeywordSearching(true)
        const refLat = location?.latitude ?? 22.7196
        const refLng = location?.longitude ?? 75.8577
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=10&q=${encodeURIComponent(q)}`
        const res = await fetch(url, { headers: { Accept: "application/json" } })
        const json = await res.json()
        const mapped = (Array.isArray(json) ? json : []).map(r => ({
          id: r.place_id || r.osm_id,
          display: r.display_name || "",
          lat: Number(r.lat),
          lng: Number(r.lon),
          address: r.address || {},
        }))
        const withDistance = mapped
          .filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lng))
          .map(x => ({ ...x, distanceMeters: calculateDistance(refLat, refLng, x.lat, x.lng) }))
          .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity))
          .slice(0, 4)
        setKeywordAddressSuggestions(withDistance)
      } catch (e) {
        setKeywordAddressSuggestions([])
      } finally {
        setIsKeywordSearching(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [addressAutocompleteValue, showAddressForm, location, ENABLE_NOMINATIM_SEARCH])

  // Map Initialization logic
  useEffect(() => {
    if (!MAPS_ENABLED || mapUnavailable || !showAddressForm || !mapContainerRef.current || !GOOGLE_MAPS_API_KEY) return

    let isMounted = true
    setMapLoading(true)

    const initializeGoogleMap = async () => {
      try {
        const maps = await loadGoogleMaps(GOOGLE_MAPS_API_KEY)
        const google = typeof window !== "undefined" ? window.google : null
        if (!maps || !google?.maps?.Map) {
          throw new Error("Google Maps is unavailable")
        }
        if (!isMounted || !mapContainerRef.current) return

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

        // Debounce handleMapMoveEnd to avoid excessive API calls
        let idleTimeout = null
        let lastLat = initialPos.lat
        let lastLng = initialPos.lng

        map.addListener("idle", () => {
          clearTimeout(idleTimeout)
          idleTimeout = setTimeout(() => {
            const center = map.getCenter()
            const lat = center.lat()
            const lng = center.lng()
            
            // Only update if moved more than ~5 meters (roughly 0.00005 degrees)
            const dist = Math.sqrt(Math.pow(lat - lastLat, 2) + Math.pow(lng - lastLng, 2))
            if (dist > 0.00005) {
              lastLat = lat
              lastLng = lng
              setMapPosition([lat, lng])
              handleMapMoveEnd(lat, lng)
            }
          }, 500) // 500ms debounce for better stability
        })

        setMapLoading(false)
      } catch (err) {
        debugError("Map init error:", err)
        setMapUnavailable(true)
        setMapLoading(false)
      }
    }
    initializeGoogleMap()
    return () => { isMounted = false }
  }, [showAddressForm, GOOGLE_MAPS_API_KEY, mapUnavailable])

  const handleUseCurrentLocation = async () => {
    try {
      toast.loading("Getting location...", { id: "geo" })
      const loc = await requestLocation(true, true)
      
      if (loc?.latitude) {
        // Update state
        const newPos = [loc.latitude, loc.longitude]
        setMapPosition(newPos)
        setCurrentAddress(loc.formattedAddress || loc.address || "")
        
        // Persist
        persistSelectedLocation(loc)
        try { localStorage.setItem("deliveryAddressMode", "current") } catch {}
        
        // Update map
        if (googleMapRef.current) {
          googleMapRef.current.panTo({ lat: loc.latitude, lng: loc.longitude })
          googleMapRef.current.setZoom(17)
        }
        
        // Update form data if form is open
        if (showAddressForm) {
          setAddressFormData(prev => ({
            ...prev,
            street: loc.street || loc.area || prev.street,
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
            const from = routerLocation?.state?.from || "/food/user"
            navigate(from, { replace: true })
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
      await setDefaultAddress(id)
      persistSelectedLocation(buildLocationPayloadFromAddress(address))
      try { localStorage.setItem("deliveryAddressMode", "saved") } catch {}
      toast.success("Address selected")
      
      // Use "from" state if available, otherwise default to home page
      const from = routerLocation?.state?.from || "/food/user"
      setTimeout(() => {
        navigate(from, { replace: true })
      }, 500)
    }
  }

  const handleAddAddressClick = () => {
    setShowAddressForm(true)
  }

  const handleCancelAddressForm = () => {
    setShowAddressForm(false)
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

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

  const handleMapMoveEnd = async (lat, lng) => {
    if (!ENABLE_LOCATION_REVERSE_GEOCODE) return
    
    // Prevent redundant calls for the same coordinates
    const coordKey = `${lat.toFixed(5)},${lng.toFixed(5)}`
    if (manualFieldRefs.current._lastCoords === coordKey) return
    manualFieldRefs.current._lastCoords = coordKey

    try {
      const parsed = await reverseGeocode(lat, lng, { forceFresh: true })
      if (parsed) {
        const formatted = parsed.formattedAddress || parsed.address || ""
        setCurrentAddress(prev => prev === formatted ? prev : formatted)
        setAddressFormData(prev => {
          if (prev.street === parsed.street && prev.city === parsed.city && prev.state === parsed.state && prev.zipCode === parsed.postalCode) {
            return prev
          }
          return {
            ...prev,
            street: parsed.street || parsed.area || prev.street,
            city: parsed.city || prev.city,
            state: parsed.state || prev.state,
            zipCode: parsed.postalCode || prev.zipCode,
          }
        })
      }
    } catch (e) {
      debugError("Reverse geocode error:", e)
    }
  }

  const handleAddressFormSubmit = async (e) => {
    e.preventDefault()
    if (!addressFormData.street || !addressFormData.city) {
      toast.error("Please fill required fields")
      return
    }
    setLoadingAddress(true)
    try {
      const payload = {
        ...addressFormData,
        label: addressFormData.label === "Work" ? "Office" : addressFormData.label,
        location: { type: "Point", coordinates: [mapPosition[1], mapPosition[0]] },
        latitude: mapPosition[0],
        longitude: mapPosition[1]
      }
      
      let created = payload;
      if (userProfile) {
        created = await addAddress(payload)
        if (created) {
          const id = getAddressId(created)
          if (id) await setDefaultAddress(id)
        }
      }
      
      persistSelectedLocation(buildLocationPayloadFromAddress(created || payload))
      try { localStorage.setItem("deliveryAddressMode", userProfile ? "saved" : "current") } catch {}
      toast.success(userProfile ? "Address saved" : "Location set")
      setShowAddressForm(false)
      setAddressAutocompleteValue("")
      setKeywordAddressSuggestions([])
      
      // Use "from" state if available, otherwise default to home page
      const from = routerLocation?.state?.from || "/food/user"
      setTimeout(() => {
        navigate(from, { replace: true })
      }, 500)
      
    } catch (error) {
      toast.error("Failed to save address")
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
    if (!showAddressForm) return
    setFormScrollTop(0)
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
          onScroll={(e) => {
            setFormScrollTop(e.currentTarget.scrollTop)
          }}
          className="flex-1 overflow-y-auto"
          style={{ paddingBottom: `${96 + keyboardInset}px` }}
        >
          {/* Map Section - Parallax enabled */}
          <div
            className="flex-shrink-0 relative z-0"
            style={{ 
              height: `${mapHeight}px`,
              transform: `translateY(${formScrollTop * 0.4}px)`,
              opacity: clamp(1 - (formScrollTop / 500), 0.4, 1)
            }}
          >
            <div className="absolute top-4 left-4 right-4 z-20">
              <div className="relative group shadow-2xl">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                  value={addressAutocompleteValue}
                  onChange={(e) => setAddressAutocompleteValue(e.target.value)}
                  placeholder="Search area, street, landmark..."
                  className="pl-10 h-12 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-md border-none rounded-xl shadow-lg focus:ring-2 focus:ring-[#FE5502] transition-all"
                />
                {isKeywordSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                     <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#FE5502] border-t-transparent" />
                  </div>
                )}

                {keywordAddressSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden z-30 animate-in fade-in slide-in-from-top-2 duration-200">
                    <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 dark:bg-gray-800/50">Suggestions</p>
                    {keywordAddressSuggestions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          const { lat, lng, display, address: a } = s
                          setMapPosition([lat, lng])
                          if (googleMapRef.current) {
                            googleMapRef.current.panTo({ lat, lng })
                            googleMapRef.current.setZoom(17)
                          }
                          setAddressAutocompleteValue(display)
                          const city = a.city || a.town || a.village || a.county || ""
                          const state = a.state || ""
                          const zipCode = a.postcode || ""
                          setAddressFormData((prev) => ({
                            ...prev,
                            street: display || prev.street,
                            city: city || prev.city,
                            state: state || prev.state,
                            zipCode: zipCode || prev.zipCode,
                          }))
                          setKeywordAddressSuggestions([])
                        }}
                        className="w-full px-4 py-3 flex items-start gap-3 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors text-left border-b border-gray-50 dark:border-gray-800 last:border-none"
                      >
                        <MapPin className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{s.display}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.address?.city || s.address?.state}</p>
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FE5502]" />
              </div>
            )}
            
            <div className="absolute bottom-10 right-4 z-10">
              <Button 
                  onClick={handleUseCurrentLocation} 
                  className="bg-white text-black hover:bg-gray-100 shadow-xl border border-gray-200 rounded-full h-12 px-6"
              >
                <Navigation className="h-4 w-4 mr-2 text-[#FE5502]" /> Use My Location
              </Button>
            </div>
          </div>

          <div className="relative bg-white dark:bg-[#0a0a0a] rounded-t-[32px] -mt-8 z-10 p-4 space-y-6 shadow-[0_-12px_24px_-10px_rgba(0,0,0,0.1)]">
            <div className="bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 rounded-xl p-4 flex gap-3">
               <MapPin className="h-5 w-5 text-[#FE5502] mt-0.5" />
               <div className="min-w-0">
                  <p className="text-xs font-bold text-orange-800 dark:text-orange-200 uppercase mb-1">Pinnned Location</p>
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

              <Label className="text-sm font-bold mb-2 block text-orange-600 dark:text-orange-400">Secondary Address (House No. / Flat / Floor)</Label>
              <Input 
                placeholder="E.g. Flat 402, 4th Floor, AppZeto Building" 
                value={addressFormData.additionalDetails} 
                onChange={e => setAddressFormData({...addressFormData, additionalDetails: e.target.value})}
                onFocus={() => scrollFieldIntoView("additionalDetails")}
                ref={(el) => { manualFieldRefs.current.additionalDetails = el }}
                className="h-12 rounded-xl border-orange-200 dark:border-orange-900/40 focus:ring-orange-500"
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
                     style={addressFormData.label === l ? {backgroundColor: '#FE5502', color: 'white'} : {}}
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
            style={{backgroundColor: '#FE5502'}}
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
          <button 
            onClick={handleUseCurrentLocation}
            className="w-full flex items-center gap-4 p-4 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm hover:shadow-md transition-all group"
          >
            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Navigation className="h-5 w-5 text-[#FE5502]" />
            </div>
            <div className="text-left flex-1">
              <p className="font-bold text-[#FE5502]">Use Current Location</p>
              <p className="text-xs text-gray-500 line-clamp-1">{currentAddress || "Enable GPS for accuracy"}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Saved Addresses</h2>
            <Button variant="ghost" className="text-[#FE5502] p-0 h-auto font-bold" onClick={handleAddAddressClick}>
              <Plus className="h-4 w-4 mr-1" /> Add New
            </Button>
          </div>

          <div className="space-y-4">
            {addresses.length === 0 ? (
              <div className="text-center py-10 opacity-50">
                <MapPin className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p>No addresses saved yet</p>
              </div>
            ) : (
              addresses.map((addr, idx) => {
                const Icon = getAddressIcon(addr)
                return (
                  <button
                    key={getAddressId(addr) || idx}
                    onClick={() => handleSelectSavedAddress(addr)}
                    className="w-full flex items-start gap-4 p-4 bg-slate-50 dark:bg-[#1a1a1a] rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors text-left group"
                  >
                    <div className="h-10 w-10 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm">
                      <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white capitalize">{addr.label || "Address"}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                        {[addr.additionalDetails, addr.street, addr.city, addr.state].filter(Boolean).join(", ")}
                      </p>
                    </div>
                    <div className="h-6 w-6 rounded-full border border-gray-200 dark:border-gray-700 mt-2 flex items-center justify-center group-hover:border-[#FE5502]">
                       <ChevronRight className="h-3 w-3 text-gray-400 group-hover:text-[#FE5502]" />
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>
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
