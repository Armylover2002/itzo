import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import Lenis from "lenis"
import { ArrowLeft, Loader2 } from "lucide-react"
import { restaurantAPI, zoneAPI } from "@food/api"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { loadGoogleMaps as loadGoogleMapsSdk } from "@core/services/googleMapsLoader"
import { toast } from "react-hot-toast"
import { useRef, useCallback } from "react"
import { Search, MapPin, Save } from "lucide-react"
import { resolveOutletAddressParts } from "@food/utils/addressParts"

const debugLog = (...args) => console.log(...args)
const debugWarn = (...args) => console.warn(...args)
const debugError = (...args) => console.error(...args)


const ADDRESS_STORAGE_KEY = "restaurant_address"

// Default coordinates for Indore (can be updated based on actual location)
const DEFAULT_LAT = 22.7196
const DEFAULT_LNG = 75.8577

export default function EditRestaurantAddress() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [address, setAddress] = useState("")
  const [restaurantName, setRestaurantName] = useState("")
  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lat, setLat] = useState(DEFAULT_LAT)
  const [lng, setLng] = useState(DEFAULT_LNG)
  const [addressParts, setAddressParts] = useState({})
  const [locationSearch, setLocationSearch] = useState("")
  const [currentZone, setCurrentZone] = useState(null)
  const [mapLoading, setMapLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restaurantData, setRestaurantData] = useState(null)

  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const polygonRef = useRef(null)
  const autocompleteInputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const isMapInitializedRef = useRef(false)

  // Format address from location object
  const formatAddress = (loc) => {
    if (!loc) return ""
    
    if (loc.formattedAddress && loc.formattedAddress.trim() !== "") {
      return loc.formattedAddress.trim()
    }
    
    const parts = []
    if (loc.addressLine1) parts.push(loc.addressLine1.trim())
    if (loc.addressLine2) parts.push(loc.addressLine2.trim())
    if (loc.area) parts.push(loc.area.trim())
    if (loc.city) {
      const city = loc.city.trim()
      if (!loc.area || !loc.area.includes(city)) {
        parts.push(city)
      }
    }
    if (loc.landmark) parts.push(loc.landmark.trim())
    return parts.join(", ") || ""
  }

  // Fetch restaurant and zone data
  useEffect(() => {
    const initPage = async () => {
      try {
        setLoading(true)
        setMapLoading(true)
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        let zoneObj = null
        
        if (data) {
          setRestaurantName(data.restaurantName || data.name || "")
          setRestaurantData(data)
          if (data.location) {
            setLocation(data.location)
            const formatted = formatAddress(data.location)
            setAddress(formatted)
            if (data.location.latitude && data.location.longitude) {
              setLat(data.location.latitude)
              setLng(data.location.longitude)
            }
          }

          // Fetch zone data
          if (data.zoneId) {
            const zonesRes = await zoneAPI.getPublicZones()
            const allZones = zonesRes?.data?.data?.zones || zonesRes?.data?.zones || []
            zoneObj = allZones.find(z => String(z._id || z.id) === String(data.zoneId))
            if (zoneObj) {
              setCurrentZone(zoneObj)
            }
          }
        }

        // Load Map - Same logic as ZoneSetup
        const apiKey = await getGoogleMapsApiKey()
        if (!apiKey) {
          debugError("? Google Maps API key not found")
          setMapLoading(false)
          return
        }

        // Wait for mapRef to be available
        let refRetries = 0
        const maxRefRetries = 50 
        while (!mapRef.current && refRetries < maxRefRetries) {
          await new Promise(resolve => setTimeout(resolve, 100))
          refRetries++
        }

        if (!mapRef.current) {
          debugError("? mapRef.current is still null after waiting")
          setMapLoading(false)
          return
        }

        debugLog("?? Loading Google Maps SDK...")
        const maps = await loadGoogleMapsSdk(apiKey)
        if (!maps || !window.google?.maps) {
          throw new Error("Google Maps SDK did not finish loading")
        }

        debugLog("? Google Maps loaded, initializing map...")
        if (!isMapInitializedRef.current) {
          const startLat = data?.location?.latitude || lat || DEFAULT_LAT
          const startLng = data?.location?.longitude || lng || DEFAULT_LNG
          initializeMap(window.google, zoneObj, startLat, startLng)
        }
      } catch (error) {
        debugError("Error initializing page:", error)
        toast.error("Failed to load map data")
      } finally {
        setLoading(false)
        setMapLoading(false)
      }
    }

    initPage()
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
          const newLat = location.lat()
          const newLng = location.lng()
          
          // Check if inside zone
          if (polygonRef.current && !window.google.maps.geometry.poly.containsLocation(location, polygonRef.current)) {
            toast.error("Address must be inside your assigned zone")
            return
          }

          // Center map on selected location
          mapInstanceRef.current.setCenter(location)
          mapInstanceRef.current.setZoom(17)
          
          const formattedAddr = place.formatted_address || place.name || ""
          setLocationSearch(formattedAddr)
          setAddress(formattedAddr)
          
          // Extract address parts
          const parts = extractAddressParts(place.address_components, place.formatted_address || "")
          setAddressParts(parts)
          
          setLat(newLat)
          setLng(newLng)
          updateMarker(newLat, newLng, formattedAddr)
        }
      })
      
      autocompleteRef.current = autocomplete
    }
  }, [mapLoading])

  const extractAddressParts = (components, formattedAddress = "") =>
    resolveOutletAddressParts(components, formattedAddress)

  const initializeMap = (google, zone, startLat, startLng) => {
    if (isMapInitializedRef.current || !mapRef.current) return
    isMapInitializedRef.current = true

    const centerLat = Number(startLat) || Number(lat) || DEFAULT_LAT
    const centerLng = Number(startLng) || Number(lng) || DEFAULT_LNG
    
    debugLog("?? Creating map instance at:", centerLat, centerLng)

    try {
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: centerLat, lng: centerLng },
        zoom: 17,
        mapTypeControl: true,
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: 'greedy',
      })
      mapInstanceRef.current = map

      // Draw Zone Polygon if available
      const activeZone = zone || currentZone
      if (activeZone?.coordinates) {
        const path = activeZone.coordinates.map(c => ({
          lat: Number(c.latitude || c.lat),
          lng: Number(c.longitude || c.lng)
        }))

        const polygon = new google.maps.Polygon({
          paths: path,
          strokeColor: "#3b82f6",
          strokeOpacity: 0.6,
          strokeWeight: 2,
          fillColor: "#3b82f6",
          fillOpacity: 0.15,
          map: map
        })
        polygonRef.current = polygon

        // Only allow clicks inside polygon to set marker
        polygon.addListener('click', (event) => {
          handleLocationSelect(event.latLng.lat(), event.latLng.lng())
        })

        // Adjust map bounds to show polygon
        const bounds = new google.maps.LatLngBounds()
        path.forEach(p => bounds.extend(p))
        map.fitBounds(bounds)
      }

      // Initial Marker
      updateMarker(centerLat, centerLng)
      setMapLoading(false)
    } catch (e) {
      debugError("? Error creating map:", e)
      isMapInitializedRef.current = false
    }
  }

  const updateMarker = (newLat, newLng, addr) => {
    const google = window.google
    if (!google || !mapInstanceRef.current) return

    if (markerRef.current) {
      markerRef.current.setPosition({ lat: newLat, lng: newLng })
    } else {
      markerRef.current = new google.maps.Marker({
        position: { lat: newLat, lng: newLng },
        map: mapInstanceRef.current,
        draggable: true,
        animation: google.maps.Animation.DROP
      })

      markerRef.current.addListener('dragend', (event) => {
        handleLocationSelect(event.latLng.lat(), event.latLng.lng())
      })
    }

    setLat(newLat)
    setLng(newLng)
  }

  const handleLocationSelect = async (newLat, newLng) => {
    const google = window.google
    if (!google) return

    // Validation: Check if point is inside currentZone polygon
    if (polygonRef.current && !google.maps.geometry.poly.containsLocation(new google.maps.LatLng(newLat, newLng), polygonRef.current)) {
      toast.error("Address must be inside your assigned zone")
      // Snap back marker if it exists
      if (markerRef.current) {
        markerRef.current.setPosition({ lat, lng })
      }
      return
    }

    setLat(newLat)
    setLng(newLng)
    if (markerRef.current) {
      markerRef.current.setPosition({ lat: newLat, lng: newLng })
    }
    
    await getAddressFromCoords(newLat, newLng)
  }

  const getAddressFromCoords = (lat, lng) => {
    return new Promise((resolve) => {
      if (!window.google?.maps?.Geocoder) {
        resolve()
        return
      }
      const geocoder = new window.google.maps.Geocoder()
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results[0]) {
          const formatted = results[0].formatted_address
          setAddress(formatted)
          setLocationSearch(formatted)
          
          const parts = extractAddressParts(
            results[0].address_components,
            results[0].formatted_address || ""
          )
          setAddressParts(parts)
          resolve(formatted)
        } else {
          resolve()
        }
      })
    })
  }



  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  // Handle opening Google Maps app
  const handleViewOnMap = () => {
    // Create Google Maps URL for the restaurant location
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    
    // Try to open in Google Maps app (mobile) or web
    window.open(googleMapsUrl, "_blank")
  }

  // Handle Update button click
  const handleUpdateClick = async () => {
    try {
      setSaving(true)

      const resolvedParts = resolveOutletAddressParts([], address)
      const mergedParts = {
        addressLine1: addressParts.addressLine1 || resolvedParts.addressLine1 || address.split(',')[0] || "",
        area: addressParts.area || resolvedParts.area || "",
        city: addressParts.city || resolvedParts.city || "",
        state: addressParts.state || resolvedParts.state || "",
        pincode: addressParts.pincode || resolvedParts.pincode || "",
      }
      
      const updatedLocation = {
        ...(restaurantData?.location || {}),
        type: "Point",
        latitude: lat,
        longitude: lng,
        coordinates: [lng, lat],
        formattedAddress: address,
        address: address,
        addressLine1: mergedParts.addressLine1,
        area: mergedParts.area,
        city: mergedParts.city,
        state: mergedParts.state,
        pincode: mergedParts.pincode,
      }

      const payload = {
        addressLine1: mergedParts.addressLine1,
        area: mergedParts.area,
        city: mergedParts.city,
        state: mergedParts.state,
        pincode: mergedParts.pincode,
        formattedAddress: address,
        zoneId: currentZone?._id || currentZone?.id || null,
        location: updatedLocation,
      }

      const response = await restaurantAPI.updateProfile(payload)
      debugLog("Update response:", response)
      
      const isSuccess = response?.data?.status === "success" || 
                       response?.data?.success === true || 
                       response?.data?.data?.restaurant
      
      if (isSuccess) {
        const pending =
          response?.data?.data?.restaurant?.pendingReviewSubmitted ||
          response?.data?.data?.pendingReviewSubmitted
        toast.success(
          pending
            ? "Address submitted for admin review. Customers still see your previous location until approved."
            : "Location updated successfully!"
        )
        
        // Dispatch event to notify other components
        window.dispatchEvent(new Event("addressUpdated"))
        
        // Short delay to show toast before navigation
        setTimeout(() => {
          navigate("/food/restaurant/outlet-info", { replace: true })
        }, 800)
      } else {
        throw new Error(response?.data?.message || "Invalid response from server")
      }
    } catch (error) {
      debugError("Error updating address:", error)
      toast.error(error.response?.data?.message || error.message || "Failed to update address.")
    } finally {
      setSaving(false)
      setLoading(false)
    }
  }

  // Get simplified address for navbar (last two parts: area, city)
  const getSimplifiedAddress = (fullAddress) => {
    const parts = fullAddress.split(",").map(p => p.trim())
    if (parts.length >= 2) {
      // Return last two parts (e.g., "By Pass Road (South), Indore")
      return parts.slice(-2).join(", ")
    }
    return fullAddress
  }
  
  const simplifiedAddress = getSimplifiedAddress(address)

  return (
    <div className="h-screen bg-white overflow-hidden flex flex-col">
      {/* Sticky Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3 shrink-0">
        <button
          onClick={goBack}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
          aria-label="Go back"
        >
          <ArrowLeft className="w-6 h-6 text-gray-900" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h1 className="text-base font-bold text-gray-900 truncate">{restaurantName}</h1>
          </div>
          <p className="text-xs text-gray-600 truncate">{simplifiedAddress}</p>
        </div>
      </div>

      {/* Map Section - Takes remaining space */}
      <div className="flex-1 relative overflow-hidden bg-gray-50 min-h-[400px]">
        {/* Search Bar - Absolute positioned on map */}
        <div className="absolute top-4 left-4 right-4 z-10 flex gap-2">
          <div className="flex-1 relative shadow-lg">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={autocompleteInputRef}
              type="text"
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              placeholder="Search for your outlet location..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border-none rounded-lg text-sm shadow-md focus:ring-2 focus:ring-black outline-none"
            />
          </div>
        </div>

        {/* Google Maps Div */}
        <div 
          ref={mapRef}
          className="w-full h-full"
          style={{ minHeight: '400px', height: '100%' }}
        />
        
        {mapLoading && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-[100]">
            <div className="flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-black animate-spin mb-2" />
              <p className="text-sm text-gray-500 font-medium">Initializing Map...</p>
            </div>
          </div>
        )}
        
        {/* Address Details Section - Overlays map at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl z-20 px-4 pt-6 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          <h2 className="text-lg font-bold text-gray-900 text-center mb-3 flex items-center justify-center gap-2">
            <MapPin className="w-5 h-5 text-red-500" />
            Outlet address
          </h2>
          
          {/* Informational Banner */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-4">
            <p className="text-xs text-blue-800 leading-tight">
              Customers and delivery partners will use this pin to locate your outlet. Please ensure it's accurate.
            </p>
          </div>

          {/* Current Address Display */}
          <div className="mb-4">
            <p className="text-base text-gray-900">{address}</p>
          </div>

          {/* Update Button */}
          <div className="pb-4">
            <button
              onClick={handleUpdateClick}
              disabled={loading || saving}
              className={`w-full bg-black text-white font-semibold py-4 text-base rounded-lg flex items-center justify-center gap-2 ${loading || saving ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              {(loading || saving) ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Update Location</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {saving && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-black animate-spin mb-4" />
            <p className="text-gray-900 font-bold text-lg">Updating Location...</p>
            <p className="text-gray-500 text-sm">Please wait while we update your details</p>
          </div>
        </div>
      )}
    </div>
  )
}

