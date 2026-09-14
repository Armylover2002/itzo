import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { MapPin, Search, Save, Loader2, ArrowLeft, AlertTriangle, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "react-hot-toast"
import RestaurantNavbar from "@food/components/restaurant/RestaurantNavbar"
import { restaurantAPI, zoneAPI } from "@food/api"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { loadGoogleMaps as loadGoogleMapsSdk } from "@core/services/googleMapsLoader"
import { updateStoredModuleUser } from "@food/utils/auth"
import { resolveOutletAddressParts } from "@food/utils/addressParts"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const parseCoordinate = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const getSavedLocationCoords = (location) => {
  if (!location) return null

  let lat = null
  let lng = null

  if (Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
    lng = parseCoordinate(location.coordinates[0])
    lat = parseCoordinate(location.coordinates[1])
  }

  if (lat === null || lng === null) {
    lat = parseCoordinate(location.latitude)
    lng = parseCoordinate(location.longitude)
  }

  if (lat === null || lng === null) return null

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    const swappedLat = lng
    const swappedLng = lat

    if (
      swappedLat >= -90 && swappedLat <= 90 &&
      swappedLng >= -180 && swappedLng <= 180
    ) {
      return { lat: swappedLat, lng: swappedLng }
    }

    return null
  }

  return { lat, lng }
}

export default function ZoneSetup() {
  const navigate = useNavigate()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const autocompleteInputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const zonesPolygonsRef = useRef([])
  
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("")
  const [mapLoading, setMapLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restaurantData, setRestaurantData] = useState(null)
  const [locationSearch, setLocationSearch] = useState("")
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [selectedAddress, setSelectedAddress] = useState("")
  const [addressParts, setAddressParts] = useState({})
  const [zones, setZones] = useState([])
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [reVerificationData, setReVerificationData] = useState(null)

  useEffect(() => {
    fetchRestaurantData()
    fetchZones()
    loadGoogleMaps()
  }, [])

  // Initialize Places Autocomplete when map is loaded
  useEffect(() => {
    if (!mapLoading && mapInstanceRef.current && autocompleteInputRef.current && window.google?.maps?.places && !autocompleteRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(autocompleteInputRef.current, {
        componentRestrictions: { country: 'in' } // Restrict to India
      })
      
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (place.geometry && place.geometry.location && mapInstanceRef.current) {
          const location = place.geometry.location
          const lat = location.lat()
          const lng = location.lng()
          
          // Center map on selected location
          mapInstanceRef.current.setCenter(location)
          mapInstanceRef.current.setZoom(17) // Zoom in when location is selected
          
          // Set the search input value
          const address = place.formatted_address || place.name || ""
          setLocationSearch(address)
          setSelectedAddress(address)
          
          // Update marker position
          updateMarker(lat, lng, address)
          
          // Set selected location
          setSelectedLocation({ lat, lng, address })
        }
      })
      
      autocompleteRef.current = autocomplete
    }
  }, [mapLoading])

  // Load existing restaurant location when data is fetched
  useEffect(() => {
    if (restaurantData?.location && mapInstanceRef.current && !mapLoading && window.google) {
      const location = restaurantData.location
      const savedCoords = getSavedLocationCoords(location)

      if (savedCoords) {
        const { lat, lng } = savedCoords
        const locationObj = new window.google.maps.LatLng(lat, lng)
        mapInstanceRef.current.setCenter(locationObj)
        mapInstanceRef.current.setZoom(17)
        
        const address = location.formattedAddress || location.address || formatAddress(location) || ""
        setLocationSearch(address)
        setSelectedAddress(address)
        setSelectedLocation({ lat, lng, address })
        
        updateMarker(lat, lng, address)
      }
    }
  }, [restaurantData, mapLoading])

  const fetchRestaurantData = async () => {
    try {
      const response = await restaurantAPI.getCurrentRestaurant()
      const data = response?.data?.data?.restaurant || response?.data?.restaurant
      if (data) {
        setRestaurantData(data)
        // Set initial location from restaurant data
        if (data.location?.latitude && data.location?.longitude) {
          const lat = data.location.latitude
          const lng = data.location.longitude
          const address = data.location.formattedAddress || ""
          setSelectedLocation({ lat, lng, address })
          setSelectedAddress(address)
          setLocationSearch(address)
        }
      }
    } catch (error) {
      debugError("Error fetching restaurant data:", error)
    }
  }

  const getAddressFromCoords = (lat, lng) => {
    return new Promise((resolve) => {
      if (!window.google || !window.google.maps || !window.google.maps.Geocoder) {
        resolve({ 
          formattedAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          parts: {} 
        })
        return
      }
      const geocoder = new window.google.maps.Geocoder()
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results[0]) {
          const formattedAddress = results[0].formatted_address
          const parts = resolveOutletAddressParts(
            results[0].address_components,
            formattedAddress,
          )
          
          resolve({ 
            formattedAddress, 
            parts 
          })
        } else {
          resolve({ 
            formattedAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            parts: {} 
          })
        }
      })
    })
  }

  const handleLocationSelect = async (lat, lng) => {
    // Use geocoding to get address
    const result = await getAddressFromCoords(lat, lng)
    const { formattedAddress, parts } = result
    
    setLocationSearch(formattedAddress)
    setSelectedAddress(formattedAddress)
    setAddressParts(parts)
    setSelectedLocation({ lat, lng, address: formattedAddress })
    updateMarker(lat, lng, formattedAddress)
  }

  const fetchZones = async () => {
    try {
      const response = await zoneAPI.getPublicZones()
      const list = response?.data?.data?.zones || response?.data?.zones || []
      setZones(Array.isArray(list) ? list : [])
    } catch (error) {
      debugError("Error fetching zones:", error)
    }
  }

  const loadGoogleMaps = async () => {
    try {
      debugLog("?? Starting Google Maps load...")
      
      // Fetch API key from database
      let apiKey = null
      try {
        apiKey = await getGoogleMapsApiKey()
        debugLog("?? API Key received:", apiKey ? `Yes (${apiKey.substring(0, 10)}...)` : "No")
        
        if (!apiKey || apiKey.trim() === "") {
          debugError("? API key is empty or not found in database")
          setMapLoading(false)
          alert("Google Maps API key not found in database. Please contact administrator to add the API key in admin panel.")
          return
        }
      } catch (apiKeyError) {
        debugError("? Error fetching API key from database:", apiKeyError)
        setMapLoading(false)
        alert("Failed to fetch Google Maps API key from database. Please check your connection or contact administrator.")
        return
      }
      
      setGoogleMapsApiKey(apiKey)

      // Wait for mapRef to be available (retry mechanism)
      let refRetries = 0
      const maxRefRetries = 50 // Wait up to 5 seconds for ref
      while (!mapRef.current && refRetries < maxRefRetries) {
        await new Promise(resolve => setTimeout(resolve, 100))
        refRetries++
      }

      if (!mapRef.current) {
        debugError("? mapRef.current is still null after waiting")
        setMapLoading(false)
        alert("Failed to initialize map container. Please refresh the page.")
        return
      }

      debugLog("?? Loading Google Maps SDK...")
      const maps = await loadGoogleMapsSdk(apiKey)
      if (!maps || !window.google?.maps) {
        throw new Error("Google Maps SDK did not finish loading")
      }

      debugLog("? Google Maps loaded, initializing map...")
      initializeMap(window.google)
    } catch (error) {
      debugError("? Error loading Google Maps:", error)
      setMapLoading(false)
      alert(`Failed to load Google Maps: ${error.message}. Please refresh the page or contact administrator.`)
    }
  }

  const initializeMap = (google) => {
    try {
      if (!mapRef.current) {
        debugError("? mapRef.current is null in initializeMap")
        setMapLoading(false)
        return
      }

      debugLog("?? Initializing map...")
      // Initial location (India center)
      const initialLocation = { lat: 20.5937, lng: 78.9629 }

      // Create map
      const map = new google.maps.Map(mapRef.current, {
        center: initialLocation,
        zoom: 5,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_RIGHT,
          mapTypeIds: [google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.SATELLITE]
        },
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        scrollwheel: true,
        gestureHandling: 'greedy',
        disableDoubleClickZoom: false,
      })

      mapInstanceRef.current = map
      debugLog("? Map initialized successfully")

      // Add click listener to place marker
      map.addListener('click', async (event) => {
        handleLocationSelect(event.latLng.lat(), event.latLng.lng())
      })

      setMapLoading(false)
      debugLog("? Map loading complete")

      // Draw zones if they are already loaded
      if (zones.length > 0) {
        drawZonesOnMap(google, map)
      }
    } catch (error) {
      debugError("? Error in initializeMap:", error)
      setMapLoading(false)
      alert("Failed to initialize map. Please refresh the page.")
    }
  }

  // Effect to draw zones when map is ready and zones are loaded
  useEffect(() => {
    if (!mapLoading && mapInstanceRef.current && zones.length > 0 && window.google) {
      drawZonesOnMap(window.google, mapInstanceRef.current)
    }
  }, [zones, mapLoading])

  const drawZonesOnMap = (google, map) => {
    if (!zones || zones.length === 0) return

    // Clear previous polygons
    zonesPolygonsRef.current.forEach(polygon => {
      if (polygon) polygon.setMap(null)
    })
    zonesPolygonsRef.current = []

    zones.forEach((zone) => {
      if (!zone.coordinates || zone.coordinates.length < 3) return

      // Convert coordinates to LatLng array
      const path = zone.coordinates.map(coord => {
        const lat = typeof coord === 'object' ? (coord.latitude || coord.lat) : null
        const lng = typeof coord === 'object' ? (coord.longitude || coord.lng) : null
        if (lat === null || lng === null) return null
        return new google.maps.LatLng(lat, lng)
      }).filter(Boolean)

      if (path.length < 3) return

      // Create polygon for zone
      const polygon = new google.maps.Polygon({
        paths: path,
        strokeColor: "#3b82f6", // Blue color
        strokeOpacity: 0.6,
        strokeWeight: 2,
        fillColor: "#3b82f6",
        fillOpacity: 0.15,
        editable: false,
        draggable: false,
        clickable: true,
        zIndex: 1
      })

      polygon.setMap(map)
      zonesPolygonsRef.current.push(polygon)

      // Add info window on click
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <strong style="display: block; margin-bottom: 4px; color: #1e3a8a;">${zone.name || zone.zoneName || 'Unnamed Zone'}</strong>
            <span style="font-size: 11px; color: #6b7280;">Service Area</span>
          </div>
        `
      })

      polygon.addListener('click', (event) => {
        // Drop pin first
        handleLocationSelect(event.latLng.lat(), event.latLng.lng())
        
        // Then show info window
        infoWindow.setPosition(event.latLng)
        infoWindow.open(map)
      })
    })
  }

  const updateMarker = (lat, lng, address) => {
    if (!mapInstanceRef.current || !window.google) return

    // Remove existing marker
    if (markerRef.current) {
      markerRef.current.setMap(null)
    }

    // Create new marker
    const marker = new window.google.maps.Marker({
      position: { lat, lng },
      map: mapInstanceRef.current,
      draggable: true,
      animation: window.google.maps.Animation.DROP,
      title: address || "Restaurant Location"
    })

    // Add info window
    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="padding: 8px; max-width: 250px;">
          <strong>Restaurant Location</strong><br/>
          <small>${address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`}</small>
        </div>
      `
    })

    marker.addListener('click', () => {
      infoWindow.open(mapInstanceRef.current, marker)
    })

    // Update location when marker is dragged
    marker.addListener('dragend', async (event) => {
      const newLat = event.latLng.lat()
      const newLng = event.latLng.lng()
      
      // Use geocoding to get address
      const newAddress = await getAddressFromCoords(newLat, newLng)
      
      setLocationSearch(newAddress)
      setSelectedAddress(newAddress)
      setSelectedLocation({ lat: newLat, lng: newLng, address: newAddress })
    })

    markerRef.current = marker
  }

  const formatAddress = (location) => {
    if (!location) return ""
    
    if (location.formattedAddress && location.formattedAddress.trim() !== "") {
      return location.formattedAddress.trim()
    }
    
    if (location.address && location.address.trim() !== "") {
      return location.address.trim()
    }
    
    const parts = []
    if (location.addressLine1) parts.push(location.addressLine1.trim())
    if (location.addressLine2) parts.push(location.addressLine2.trim())
    if (location.area) parts.push(location.area.trim())
    if (location.city) parts.push(location.city.trim())
    if (location.state) parts.push(location.state.trim())
    if (location.zipCode || location.pincode) parts.push((location.zipCode || location.pincode).trim())
    
    return parts.length > 0 ? parts.join(", ") : ""
  }

  const handleSaveLocation = () => {
    if (!selectedLocation) {
      alert("Please select a location on the map first")
      return
    }
    proceedSave()
  }

  const proceedSave = async () => {
    try {
      setSaving(true)
      
      const { lat, lng, address } = selectedLocation
      // Ensure area/city/state/pincode are filled even when Google omits locality types (common in India).
      const resolvedParts = resolveOutletAddressParts([], address)
      const mergedParts = {
        addressLine1: addressParts.addressLine1 || resolvedParts.addressLine1 || address.split(',')[0] || "",
        area: addressParts.area || resolvedParts.area || "",
        city: addressParts.city || resolvedParts.city || "",
        state: addressParts.state || resolvedParts.state || "",
        pincode: addressParts.pincode || resolvedParts.pincode || "",
        landmark: addressParts.landmark || resolvedParts.landmark || "",
      }

      // Calculate current zone name if possible
      const currentZone = zones.find(z => {
        if (!window.google || !z.coordinates || z.coordinates.length < 3) return false
        const path = z.coordinates.map(c => new window.google.maps.LatLng(c.latitude || c.lat, c.longitude || c.lng))
        const polygon = new window.google.maps.Polygon({ paths: path })
        return window.google.maps.geometry.poly.containsLocation(new window.google.maps.LatLng(lat, lng), polygon)
      })
      
      // Update restaurant location and trigger re-verification
      const payload = {
        // Top level address fields for DB update
        addressLine1: mergedParts.addressLine1,
        area: mergedParts.area,
        city: mergedParts.city,
        state: mergedParts.state,
        pincode: mergedParts.pincode,
        formattedAddress: address,
        zoneId: currentZone?._id || currentZone?.id || null, // Critical: Update the zone ID in DB
        
        location: {
          ...(restaurantData?.location || {}),
          type: "Point",
          latitude: lat,
          longitude: lng,
          coordinates: [lng, lat], // GeoJSON format: [longitude, latitude]
          formattedAddress: address,
          address: address,
          addressLine1: mergedParts.addressLine1,
          area: mergedParts.area,
          city: mergedParts.city,
          state: mergedParts.state,
          pincode: mergedParts.pincode,
        },
        // Meta data for admin review
        reVerification: {
          isZoneUpdate: true,
          previousAddress: restaurantData?.location?.formattedAddress || restaurantData?.address || "",
          previousLocation: {
            latitude: restaurantData?.location?.latitude,
            longitude: restaurantData?.location?.longitude
          },
          previousZoneId: restaurantData?.zoneId || null,
          previousZone: restaurantData?.zone || restaurantData?.zoneName || "",
          updatedZone: currentZone?.name || currentZone?.zoneName || "",
          reVerificationReason: (currentZone?.name || currentZone?.zoneName) !== (restaurantData?.zone || restaurantData?.zoneName) 
            ? "Zone and Address Update" 
            : "Location Address Update"
        },
        // Do not flip status to pending here — backend stages changes for approved
        // restaurants and keeps the outlet live with previous details.

        // Update onboarding data as well, as admin panel/backend might prioritize it for pending requests
        onboarding: {
          ...(restaurantData?.onboarding || {}),
          step1: {
            ...(restaurantData?.onboarding?.step1 || {}),
            location: {
              ...(restaurantData?.onboarding?.step1?.location || {}),
              latitude: lat,
              longitude: lng,
              coordinates: [lng, lat],
              formattedAddress: address,
              addressLine1: mergedParts.addressLine1,
              area: mergedParts.area,
              city: mergedParts.city,
              state: mergedParts.state,
              pincode: mergedParts.pincode,
            }
          }
        }
      }

      setReVerificationData(payload.reVerification)
      const response = await restaurantAPI.updateProfile(payload)

      if (response?.data?.success) {
        const updatedRestaurant =
          response?.data?.data?.restaurant ||
          response?.data?.data ||
          response?.data?.restaurant
        if (updatedRestaurant) {
          updateStoredModuleUser("restaurant", updatedRestaurant)
        }
        toast.success(
          response?.data?.data?.restaurant?.pendingReviewSubmitted || response?.data?.data?.pendingReviewSubmitted
            ? "Location submitted for admin review. Customers still see your previous location until approved."
            : "Location update submitted for admin review. You can keep using the restaurant panel."
        )
        navigate("/food/restaurant/explore", { replace: false })
      } else {
        throw new Error("Failed to submit location update")
      }
    } catch (error) {
      debugError("Error saving location:", error)
      toast.error(error.response?.data?.message || "Failed to save location. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-full bg-white md:bg-slate-50 md:pb-8">
      <div className="md:hidden">
        <RestaurantNavbar />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3 md:mx-auto md:max-w-7xl md:px-8 md:py-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/food/restaurant/explore")}
              className="rounded-lg p-1.5 transition-colors hover:bg-gray-100 md:hidden"
              aria-label="Go back"
            >
              <ArrowLeft className="h-6 w-6 text-gray-900" />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500 md:h-12 md:w-12">
              <MapPin className="h-5 w-5 text-white md:h-6 md:w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 md:text-2xl">Zone setup</h1>
              <p className="text-sm text-gray-500">Set your restaurant location on the map</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:mx-auto md:max-w-7xl md:px-8 md:py-6">
        <div className="md:grid md:grid-cols-[minmax(300px,380px)_1fr] md:gap-6 md:items-start">
          {/* Left panel — search & instructions */}
          <div className="space-y-4 md:sticky md:top-28">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
              <h2 className="mb-3 text-sm font-semibold text-gray-900 md:text-base">Search location</h2>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  ref={autocompleteInputRef}
                  type="text"
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  placeholder="Search for your restaurant location..."
                  className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>
              <button
                onClick={handleSaveLocation}
                disabled={!selectedLocation || saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    <span>Save location</span>
                  </>
                )}
              </button>
              {selectedLocation && (
                <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3">
                  <p className="text-sm text-gray-700">
                    <strong>Selected:</strong> {selectedAddress}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 md:block">
              <h3 className="mb-2 text-sm font-semibold text-blue-900">How to set your location</h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-blue-800">
                <li>Search using the bar above, or</li>
                <li>Click anywhere on the map to place a pin</li>
                <li>Drag the pin to adjust the position</li>
                <li>Click &quot;Save location&quot; when done</li>
              </ul>
            </div>
          </div>

          {/* Right panel — map */}
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:mt-0">
            <div ref={mapRef} className="h-[420px] w-full md:h-[calc(100vh-12rem)] md:min-h-[560px]" />
            {mapLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
                <div className="text-center">
                  <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-red-600" />
                  <p className="text-gray-600">Loading map...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {saving && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-red-500 animate-spin mb-4" />
            <p className="text-gray-900 font-bold text-lg">Saving Location...</p>
            <p className="text-gray-500 text-sm">Please wait while we update your details</p>
          </div>
        </div>
      )}
    </div>
  )
}
