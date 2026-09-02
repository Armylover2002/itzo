import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { MapPin, Search, Save, Loader2, ArrowLeft, AlertTriangle, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "react-hot-toast"
import RestaurantNavbar from "@food/components/restaurant/RestaurantNavbar"
import { restaurantAPI, zoneAPI } from "@food/api"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { loadGoogleMaps as loadGoogleMapsSdk } from "@core/services/googleMapsLoader"
import { clearModuleAuth } from "@food/utils/auth"
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
          const components = results[0].address_components
          const parts = {
            addressLine1: "",
            area: "",
            city: "",
            state: "",
            pincode: "",
            landmark: ""
          }
          
          components.forEach(comp => {
            const types = comp.types
            if (types.includes("premise") || types.includes("street_number") || types.includes("route") || types.includes("sublocality_level_3")) {
              parts.addressLine1 += (parts.addressLine1 ? ", " : "") + comp.long_name
            }
            if (types.includes("sublocality_level_1") || types.includes("sublocality_level_2") || types.includes("neighborhood")) {
              parts.area = comp.long_name
            }
            if (types.includes("locality")) {
              parts.city = comp.long_name
            }
            if (types.includes("administrative_area_level_1")) {
              parts.state = comp.long_name
            }
            if (types.includes("postal_code")) {
              parts.pincode = comp.long_name
            }
          })
          
          resolve({ 
            formattedAddress: results[0].formatted_address, 
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
        addressLine1: addressParts.addressLine1 || address.split(',')[0] || "",
        area: addressParts.area || "",
        city: addressParts.city || "",
        state: addressParts.state || "",
        pincode: addressParts.pincode || "",
        formattedAddress: address,
        zoneId: currentZone?._id || currentZone?.id || null, // Critical: Update the zone ID in DB
        
        location: {
          ...(restaurantData?.location || {}),
          type: "Point",
          latitude: lat,
          longitude: lng,
          coordinates: [lng, lat], // GeoJSON format: [longitude, latitude]
          formattedAddress: address,
          address: address // Some schemas use 'address' inside location
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
        status: "pending", // Force pending status for re-approval
        isActive: false,     // Deactivate until approval

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
              addressLine1: addressParts.addressLine1 || address.split(',')[0] || "",
              area: addressParts.area || "",
              city: addressParts.city || "",
              state: addressParts.state || "",
              pincode: addressParts.pincode || ""
            }
          }
        }
      }

      setReVerificationData(payload.reVerification)
      const response = await restaurantAPI.updateProfile(payload)

      if (response?.data?.success) {
        toast.success("Location updated! Logging out for re-verification...")
        
        // Delay logout slightly to let user see the toast
        const phone = restaurantData?.ownerPhone || ""
        setTimeout(() => {
          clearModuleAuth("restaurant")
          navigate("/food/restaurant/pending-verification", { 
            replace: true,
            state: { phone } 
          });
        }, 1500)
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
    <div className="min-h-screen bg-gray-50">
      <RestaurantNavbar />
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
            {/* Back Button */}
            <button
              onClick={() => navigate("/food/restaurant")}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Zone Setup</h1>
              <p className="text-sm text-gray-600">Set your restaurant location on the map</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={autocompleteInputRef}
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                placeholder="Search for your restaurant location..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSaveLocation}
              disabled={!selectedLocation || saving}
              className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Save Location</span>
                </>
              )}
            </button>
          </div>
          {selectedLocation && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Selected Location:</strong> {selectedAddress}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Coordinates: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-[#f3f5f7] border border-[#c3ccd6] rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-[#051424] mb-2">How to set your location:</h3>
          <ul className="text-sm text-[#071b32] space-y-1 list-disc list-inside">
            <li>Search for your location using the search bar above, or</li>
            <li>Click anywhere on the map to place a pin at that location</li>
            <li>You can drag the pin to adjust the exact position</li>
            <li>Click "Save Location" to save your restaurant location</li>
          </ul>
        </div>

        {/* Map Container */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
          {/* Always render the map div, show loading overlay on top */}
          <div ref={mapRef} className="w-full h-[600px]" style={{ minHeight: '600px' }} />
          {mapLoading && (
            <div className="absolute inset-0 bg-white flex items-center justify-center z-10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-red-600 mx-auto mb-2" />
                <p className="text-gray-600">Loading map...</p>
                <p className="text-xs text-gray-400 mt-2">If this takes too long, please refresh the page</p>
              </div>
            </div>
          )}
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
