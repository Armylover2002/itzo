import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { ArrowLeft, Loader2, MapPin, Navigation, Search, Clock, Shield, CheckCircle } from "lucide-react"
import { restaurantAPI, zoneAPI } from "@food/api"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { loadGoogleMaps as loadGoogleMapsSdk } from "@core/services/googleMapsLoader"
import { toast } from "react-hot-toast"

const DEFAULT_LAT = 22.7196
const DEFAULT_LNG = 75.8577

/**
 * VendorMoveLocation — Map-based location picker for Street Food Vendors.
 * Updates `currentLocation` (movable/operating position) via the existing
 * updateLiveLocation API, NOT the permanent `location` field.
 *
 * Backend is the single source of truth for zone-boundary validation.
 * Frontend polygon check is UX-only (instant feedback before API call).
 */
export default function VendorMoveLocation() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()

  // --- State ---
  const [restaurantData, setRestaurantData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mapLoading, setMapLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetchingGPS, setFetchingGPS] = useState(false)

  const [lat, setLat] = useState(DEFAULT_LAT)
  const [lng, setLng] = useState(DEFAULT_LNG)
  const [address, setAddress] = useState("")
  const [locationSearch, setLocationSearch] = useState("")
  const [currentZone, setCurrentZone] = useState(null)

  // Permanent address for display reference
  const [permanentAddress, setPermanentAddress] = useState("")

  // Track if user has moved the marker (to enable/disable confirm button)
  const [hasMovedMarker, setHasMovedMarker] = useState(false)

  // --- Refs ---
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const polygonRef = useRef(null)
  const autocompleteInputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const isMapInitializedRef = useRef(null)

  // Debounce ref for reverse geocoding
  const geocodeTimerRef = useRef(null)

  // Store original position to snap back on zone violation
  const lastValidPosRef = useRef({ lat: DEFAULT_LAT, lng: DEFAULT_LNG })

  // --- Format address ---
  const formatAddress = (loc) => {
    if (!loc) return ""
    if (loc.formattedAddress && loc.formattedAddress.trim() !== "") return loc.formattedAddress.trim()
    if (loc.address && loc.address.trim() !== "") return loc.address.trim()
    const parts = []
    if (loc.addressLine1) parts.push(loc.addressLine1.trim())
    if (loc.area) parts.push(loc.area.trim())
    if (loc.city) parts.push(loc.city.trim())
    if (loc.state) parts.push(loc.state.trim())
    if (loc.pincode) parts.push(loc.pincode.trim())
    return parts.join(", ") || ""
  }

  // --- Format time ago ---
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return null
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  }

  // --- Init: Fetch restaurant + zone + map ---
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        setLoading(true)
        setMapLoading(true)

        // 1. Fetch restaurant data
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (!data) {
          toast.error("Failed to load restaurant data")
          goBack()
          return
        }

        if (cancelled) return
        setRestaurantData(data)

        // Guard: must be Street Food Vendor
        if (data.businessType !== "Street Food Vendor") {
          toast.error("This feature is only available for Street Food Vendors")
          goBack()
          return
        }

        // Set permanent address
        setPermanentAddress(formatAddress(data.location))

        // Determine starting position: prefer currentLocation, fallback to location
        let startLat = DEFAULT_LAT, startLng = DEFAULT_LNG
        if (data.currentLocation?.latitude && data.currentLocation?.longitude) {
          startLat = Number(data.currentLocation.latitude)
          startLng = Number(data.currentLocation.longitude)
        } else if (data.currentLocation?.coordinates?.length === 2) {
          startLng = Number(data.currentLocation.coordinates[0])
          startLat = Number(data.currentLocation.coordinates[1])
        } else if (data.location?.latitude && data.location?.longitude) {
          startLat = Number(data.location.latitude)
          startLng = Number(data.location.longitude)
        }

        if (cancelled) return
        setLat(startLat)
        setLng(startLng)
        lastValidPosRef.current = { lat: startLat, lng: startLng }

        // 2. Fetch zone data
        let zoneObj = null
        if (data.zoneId) {
          try {
            const zonesRes = await zoneAPI.getPublicZones()
            const allZones = zonesRes?.data?.data?.zones || zonesRes?.data?.zones || []
            const zId = typeof data.zoneId === "object" ? String(data.zoneId._id || data.zoneId.id || data.zoneId) : String(data.zoneId)
            zoneObj = allZones.find(z => String(z._id || z.id) === zId)
            if (zoneObj && !cancelled) setCurrentZone(zoneObj)
          } catch (e) {
            // Zone fetch failed — map will work without polygon
          }
        }

        // 3. Load Google Maps
        const apiKey = await getGoogleMapsApiKey()
        if (!apiKey) {
          if (!cancelled) setMapLoading(false)
          return
        }

        // Wait for mapRef
        let refRetries = 0
        while (!mapRef.current && refRetries < 50 && !cancelled) {
          await new Promise(r => setTimeout(r, 100))
          refRetries++
        }
        if (!mapRef.current || cancelled) {
          if (!cancelled) setMapLoading(false)
          return
        }

        const maps = await loadGoogleMapsSdk(apiKey)
        if (!maps || !window.google?.maps) {
          throw new Error("Google Maps SDK failed to load")
        }

        if (!cancelled && !isMapInitializedRef.current) {
          initializeMap(window.google, zoneObj, startLat, startLng)
        }
      } catch (error) {
        if (!cancelled) toast.error("Failed to initialize map")
      } finally {
        if (!cancelled) {
          setLoading(false)
          setMapLoading(false)
        }
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  // --- Init Autocomplete ---
  useEffect(() => {
    if (
      !mapLoading &&
      mapInstanceRef.current &&
      autocompleteInputRef.current &&
      window.google?.maps?.places &&
      !autocompleteRef.current
    ) {
      const autocomplete = new window.google.maps.places.Autocomplete(
        autocompleteInputRef.current,
        { componentRestrictions: { country: "in" } }
      )

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace()
        if (place.geometry?.location && mapInstanceRef.current) {
          const loc = place.geometry.location
          const newLat = loc.lat()
          const newLng = loc.lng()

          // UX-only zone check
          if (
            polygonRef.current &&
            window.google?.maps?.geometry?.poly &&
            !window.google.maps.geometry.poly.containsLocation(loc, polygonRef.current)
          ) {
            toast.error(
              `This location is outside your zone${currentZone?.name ? ` (${currentZone.name})` : ""}`,
              { duration: 3000 }
            )
            return
          }

          mapInstanceRef.current.setCenter(loc)
          mapInstanceRef.current.setZoom(17)

          const formattedAddr = place.formatted_address || place.name || ""
          setLocationSearch(formattedAddr)
          setAddress(formattedAddr)
          setLat(newLat)
          setLng(newLng)
          lastValidPosRef.current = { lat: newLat, lng: newLng }
          setHasMovedMarker(true)
          updateMarkerPosition(newLat, newLng)
        }
      })

      autocompleteRef.current = autocomplete
    }
  }, [mapLoading, currentZone])

  // --- Initialize Map ---
  const initializeMap = (google, zone, startLat, startLng) => {
    if (isMapInitializedRef.current || !mapRef.current) return
    isMapInitializedRef.current = true

    const centerLat = Number(startLat) || DEFAULT_LAT
    const centerLng = Number(startLng) || DEFAULT_LNG

    try {
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: centerLat, lng: centerLng },
        zoom: 16,
        mapTypeControl: false,
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: "greedy",
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] }
        ]
      })
      mapInstanceRef.current = map

      // Draw zone polygon
      const activeZone = zone || currentZone
      if (activeZone?.coordinates && activeZone.coordinates.length >= 3) {
        const path = activeZone.coordinates.map(c => ({
          lat: Number(c.latitude || c.lat),
          lng: Number(c.longitude || c.lng)
        }))

        const polygon = new google.maps.Polygon({
          paths: path,
          strokeColor: "#3b82f6",
          strokeOpacity: 0.7,
          strokeWeight: 2,
          fillColor: "#3b82f6",
          fillOpacity: 0.08,
          map: map,
          clickable: true
        })
        polygonRef.current = polygon

        // Click inside polygon to move marker
        polygon.addListener("click", (event) => {
          handleMarkerMoved(event.latLng.lat(), event.latLng.lng())
        })

        // Fit map to polygon bounds
        const bounds = new google.maps.LatLngBounds()
        path.forEach(p => bounds.extend(p))
        map.fitBounds(bounds, { top: 80, bottom: 260, left: 20, right: 20 })
      }

      // Click on map to move marker (outside polygon clicks are caught by zone check)
      map.addListener("click", (event) => {
        handleMarkerMoved(event.latLng.lat(), event.latLng.lng())
      })

      // Create draggable marker
      createMarker(google, map, centerLat, centerLng)

      // Reverse geocode initial position
      debouncedReverseGeocode(centerLat, centerLng)

      setMapLoading(false)
    } catch (e) {
      isMapInitializedRef.current = false
    }
  }

  const createMarker = (google, map, lat, lng) => {
    if (markerRef.current) {
      markerRef.current.setMap(null)
    }

    const marker = new google.maps.Marker({
      position: { lat, lng },
      map,
      draggable: true,
      animation: google.maps.Animation.DROP,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#ef4444",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
        strokeOpacity: 1
      }
    })

    marker.addListener("dragend", (event) => {
      handleMarkerMoved(event.latLng.lat(), event.latLng.lng())
    })

    markerRef.current = marker
  }

  const updateMarkerPosition = (newLat, newLng) => {
    if (markerRef.current) {
      markerRef.current.setPosition({ lat: newLat, lng: newLng })
    }
  }

  // --- Handle marker move with zone validation ---
  const handleMarkerMoved = useCallback((newLat, newLng) => {
    const google = window.google
    if (!google) return

    // UX-only polygon check
    if (
      polygonRef.current &&
      google.maps.geometry?.poly &&
      !google.maps.geometry.poly.containsLocation(
        new google.maps.LatLng(newLat, newLng),
        polygonRef.current
      )
    ) {
      toast.error(
        `You must stay within your zone${currentZone?.name ? ` (${currentZone.name})` : ""}`,
        { duration: 3000, id: "zone-error" }
      )
      // Snap back
      const prev = lastValidPosRef.current
      if (markerRef.current) {
        markerRef.current.setPosition({ lat: prev.lat, lng: prev.lng })
      }
      return
    }

    setLat(newLat)
    setLng(newLng)
    lastValidPosRef.current = { lat: newLat, lng: newLng }
    setHasMovedMarker(true)
    updateMarkerPosition(newLat, newLng)

    // Debounced reverse geocode
    debouncedReverseGeocode(newLat, newLng)
  }, [currentZone])

  // --- Debounced reverse geocoding ---
  const debouncedReverseGeocode = (lat, lng) => {
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
    geocodeTimerRef.current = setTimeout(() => {
      reverseGeocode(lat, lng)
    }, 500)
  }

  const reverseGeocode = (lat, lng) => {
    if (!window.google?.maps?.Geocoder) return
    const geocoder = new window.google.maps.Geocoder()
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        setAddress(results[0].formatted_address)
        setLocationSearch(results[0].formatted_address)
      }
    })
  }

  // --- Use My Current Location (GPS) ---
  const handleUseCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported by your browser")
      return
    }

    setFetchingGPS(true)
    toast.loading("Fetching your GPS location...", { id: "gps-fetch" })

    navigator.geolocation.getCurrentPosition(
      (position) => {
        toast.dismiss("gps-fetch")
        setFetchingGPS(false)
        const { latitude, longitude } = position.coords

        // UX-only zone check
        if (
          polygonRef.current &&
          window.google?.maps?.geometry?.poly &&
          !window.google.maps.geometry.poly.containsLocation(
            new window.google.maps.LatLng(latitude, longitude),
            polygonRef.current
          )
        ) {
          toast.error(
            `Your GPS location is outside your zone${currentZone?.name ? ` (${currentZone.name})` : ""}. Move inside your zone first.`,
            { duration: 4000 }
          )
          return
        }

        setLat(latitude)
        setLng(longitude)
        lastValidPosRef.current = { lat: latitude, lng: longitude }
        setHasMovedMarker(true)
        updateMarkerPosition(latitude, longitude)

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter({ lat: latitude, lng: longitude })
          mapInstanceRef.current.setZoom(17)
        }

        debouncedReverseGeocode(latitude, longitude)
        toast.success("GPS location applied", { duration: 2000 })
      },
      (error) => {
        toast.dismiss("gps-fetch")
        setFetchingGPS(false)
        if (error.code === error.PERMISSION_DENIED) {
          toast.error("Location permission denied. Please enable it in your browser settings.")
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          toast.error("GPS location unavailable. Please try again.")
        } else if (error.code === error.TIMEOUT) {
          toast.error("GPS request timed out. Please try again.")
        } else {
          toast.error("Failed to get GPS location")
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  // --- Confirm & Save Location ---
  const handleConfirmLocation = async () => {
    if (saving) return

    try {
      setSaving(true)
      // Uses existing updateLiveLocation API which validates zone on backend
      await restaurantAPI.updateLiveLocation(lat, lng, address)

      toast.success("Location updated successfully!", { duration: 2500 })

      // Dispatch event so OutletInfo refreshes
      window.dispatchEvent(new Event("addressUpdated"))

      setTimeout(() => {
        navigate("/food/restaurant/outlet-info", { replace: true })
      }, 800)
    } catch (error) {
      const errMsg = error.response?.data?.message || error.message || "Failed to update location"
      toast.error(errMsg, { duration: 4000 })
    } finally {
      setSaving(false)
    }
  }

  // --- Cleanup ---
  useEffect(() => {
    return () => {
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
    }
  }, [])

  // --- Loading State ---
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
          <p className="text-sm text-gray-500 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  const zoneName = currentZone?.name || currentZone?.zoneName || restaurantData?.zoneName || ""
  const lastUpdated = formatTimeAgo(restaurantData?.lastLocationUpdate)

  return (
    <div className="h-screen bg-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3 shrink-0">
        <button
          onClick={goBack}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
          aria-label="Go back"
        >
          <ArrowLeft className="w-6 h-6 text-gray-900" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-900">Move Your Location</h1>
          {zoneName && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Shield className="w-3 h-3 text-orange-500" />
              <p className="text-xs text-orange-600 font-medium">Operating in {zoneName}</p>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative overflow-hidden bg-gray-50 min-h-[300px]">
        {/* Search Bar */}
        <div className="absolute top-3 left-3 right-3 z-10 flex gap-2">
          <div className="flex-1 relative shadow-lg">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={autocompleteInputRef}
              type="text"
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              placeholder="Search location within your zone..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border-none rounded-xl text-sm shadow-md focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
        </div>

        {/* GPS Button */}
        <button
          onClick={handleUseCurrentLocation}
          disabled={fetchingGPS}
          className="absolute top-16 right-3 z-10 bg-white p-2.5 rounded-xl shadow-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          title="Use my current GPS location"
        >
          {fetchingGPS ? (
            <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
          ) : (
            <Navigation className="w-5 h-5 text-orange-500" />
          )}
        </button>

        {/* Map Container */}
        <div
          ref={mapRef}
          className="w-full h-full"
          style={{ minHeight: "300px", height: "100%" }}
        />

        {/* Map Loading Overlay */}
        {mapLoading && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-[100]">
            <div className="flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-black animate-spin mb-2" />
              <p className="text-sm text-gray-500 font-medium">Loading Map...</p>
            </div>
          </div>
        )}

        {/* Bottom Panel */}
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          <div className="px-4 pb-4">
            {/* Zone + Last Updated */}
            <div className="flex items-center justify-between mb-3">
              {zoneName && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 rounded-full">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                  <span className="text-[11px] font-semibold text-orange-700">{zoneName} Zone</span>
                </div>
              )}
              {lastUpdated && (
                <div className="flex items-center gap-1 text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span className="text-[11px]">Updated {lastUpdated}</span>
                </div>
              )}
            </div>

            {/* Current Address */}
            <div className="mb-3">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-medium mb-0.5">Current Location</p>
                  <p className="text-sm font-semibold text-gray-900 leading-snug">{address || "Drag the pin or search to set location"}</p>
                </div>
              </div>
            </div>

            {/* Permanent Address Reference */}
            {permanentAddress && (
              <div className="mb-3 p-2.5 bg-gray-50 rounded-xl">
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="w-2.5 h-2.5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">Registered Address</p>
                    <p className="text-xs text-gray-500 leading-snug">{permanentAddress}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Info Banner */}
            <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 mb-3">
              <p className="text-[11px] text-orange-700 leading-tight">
                Drag the pin or tap on the map to set your operating location. You must stay within your assigned zone (shown in blue).
              </p>
            </div>

            {/* Confirm Button */}
            <button
              onClick={handleConfirmLocation}
              disabled={saving || !hasMovedMarker}
              className={`w-full py-3.5 rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-all ${
                saving || !hasMovedMarker
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-black text-white active:scale-[0.98] shadow-sm"
              }`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Confirm New Location</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Saving Overlay */}
      {saving && (
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-black animate-spin mb-4" />
            <p className="text-gray-900 font-bold text-lg">Updating Location...</p>
            <p className="text-gray-500 text-sm mt-1">Please wait</p>
          </div>
        </div>
      )}
    </div>
  )
}
