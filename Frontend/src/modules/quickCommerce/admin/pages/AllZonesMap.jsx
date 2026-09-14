import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { MapPin, ArrowLeft, Search } from "lucide-react"
import { adminApi } from "../services/adminApi"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { Loader } from "@googlemaps/js-api-loader"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function AllZonesMap() {
  const navigate = useNavigate()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const zonesPolygonsRef = useRef([])
  const infoWindowsRef = useRef([])
  const quickCommerceMarkersRef = useRef([])
  
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("")
  const [mapLoading, setMapLoading] = useState(true)
  const [mapError, setMapError] = useState("")
  const [zones, setZones] = useState([])
  const [quickCommerces, setQuickCommerces] = useState([])
  const [loading, setLoading] = useState(true)
  const [locationSearch, setLocationSearch] = useState("")
  const autocompleteInputRef = useRef(null)
  const autocompleteRef = useRef(null)

  useEffect(() => {
    fetchZones()
    fetchQuickCommerces()
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
          mapInstanceRef.current.setCenter(location)
          mapInstanceRef.current.setZoom(12) // Zoom in when location is selected
          
          // Set the search input value
          setLocationSearch(place.formatted_address || place.name || "")
        }
      })
      
      autocompleteRef.current = autocomplete
    }
  }, [mapLoading])

  // Draw zones and quick commerce markers when map and data are ready
  useEffect(() => {
    if (!mapLoading && mapInstanceRef.current && window.google) {
      if (zones.length > 0 && quickCommerces.length > 0) {
        drawAllZonesOnMap(window.google, mapInstanceRef.current)
      }
      if (quickCommerces.length > 0) {
        drawQuickCommerceMarkers(window.google, mapInstanceRef.current)
      }
    }
  }, [zones, mapLoading, quickCommerces])

  const fetchZones = async () => {
    try {
      setLoading(true)
      const response = await adminApi.getZones({ limit: 1000 })
      if (response.data?.success && response.data.data?.zones) {
        setZones(response.data.data.zones)
      }
    } catch (error) {
      debugError("Error fetching zones:", error)
      setZones([])
    } finally {
      setLoading(false)
    }
  }

  const fetchQuickCommerces = async () => {
    try {
      const response = await adminApi.getSellers({ limit: 1000 })
      const sellers =
        response.data?.data?.sellers ||
        response.data?.data?.items ||
        response.data?.sellers ||
        response.data?.result ||
        []
      setQuickCommerces(Array.isArray(sellers) ? sellers : [])
    } catch (error) {
      debugError("Error fetching quick commerces:", error)
      setQuickCommerces([])
    }
  }

  const loadGoogleMaps = async () => {
    try {
      setMapError("")
      const apiKey = await getGoogleMapsApiKey()
      setGoogleMapsApiKey(apiKey || "")
      
      // Wait for Google Maps to be loaded from main.jsx if it's loading
      let retries = 0
      const maxRetries = 50 // Wait up to 5 seconds (50 * 100ms)
      
      while (!window.google && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100))
        retries++
      }

      // If Google Maps is already loaded (from main.jsx), use it directly
      if (window.google && window.google.maps) {
        initializeMap(window.google)
        return
      }

      // If Google Maps is not loaded yet and we have an API key, use Loader as fallback
      if (apiKey) {
        const loader = new Loader({
          apiKey: apiKey,
          version: "weekly",
          libraries: ["places", "drawing", "geometry"]
        })

        const google = await loader.load()
        initializeMap(google)
      } else {
        setMapError("Google Maps API key not found")
        setMapLoading(false)
      }
    } catch (error) {
      debugError("Error loading Google Maps:", error)
      setMapError("Unable to load Google Maps SDK. Please verify API key and network.")
      setMapLoading(false)
    }
  }

  const initializeMap = (google) => {
    if (!mapRef.current) return

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
    setMapLoading(false)
  }

  // Draw all zones on the map
  const drawAllZonesOnMap = (google, map) => {
    if (!zones || zones.length === 0) {
      // Clear zones if no zones exist
      zonesPolygonsRef.current.forEach(polygon => {
        if (polygon) polygon.setMap(null)
      })
      zonesPolygonsRef.current = []
      return
    }

    // Clear previous polygons and info windows
    zonesPolygonsRef.current.forEach(polygon => {
      if (polygon) polygon.setMap(null)
    })
    zonesPolygonsRef.current = []

    infoWindowsRef.current.forEach(infoWindow => {
      if (infoWindow) infoWindow.close()
    })
    infoWindowsRef.current = []

    // Colors for different zones
    const colors = [
      "#3b82f6", // Blue
      "#10b981", // Green
      "#f59e0b", // Orange
      "#ef4444", // Red
      "#8b5cf6", // Purple
      "#ec4899", // Pink
      "#06b6d4", // Cyan
      "#84cc16", // Lime
    ]

    const bounds = new google.maps.LatLngBounds()

    zones.forEach((zone, index) => {
      if (!zone.coordinates || zone.coordinates.length < 3) return

      // Convert coordinates to LatLng array
      const path = zone.coordinates.map(coord => {
        const lat = typeof coord === 'object' ? (coord.latitude || coord.lat) : null
        const lng = typeof coord === 'object' ? (coord.longitude || coord.lng) : null
        if (lat === null || lng === null) return null
        const latLng = new google.maps.LatLng(lat, lng)
        bounds.extend(latLng)
        return latLng
      }).filter(Boolean)

      if (path.length < 3) return

      // Select color based on index
      const color = colors[index % colors.length]

      // Create polygon for zone
      const polygon = new google.maps.Polygon({
        paths: path,
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: 0.25,
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
          <div style="padding: 12px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1e293b;">
              ${zone.name || zone.zoneName || 'Unnamed Zone'}
            </h3>
            <div style="font-size: 13px; color: #64748b; line-height: 1.6;">
              <div style="margin-bottom: 4px;">
                <strong>Country:</strong> ${zone.country || 'N/A'}
              </div>
              <div style="margin-bottom: 4px;">
                <strong>Unit:</strong> ${zone.unit || 'km'}
              </div>
              <div style="margin-bottom: 4px;">
                <strong>Points:</strong> ${zone.coordinates.length}
              </div>
              <div>
                <strong>Status:</strong> 
                <span style="color: ${zone.isActive ? '#10b981' : '#ef4444'}; font-weight: 600;">
                  ${zone.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        `
      })

      polygon.addListener('click', () => {
        // Close all other info windows
        infoWindowsRef.current.forEach(iw => {
          if (iw && iw !== infoWindow) iw.close()
        })
        
        infoWindow.setPosition(path[0])
        infoWindow.open(map)
        infoWindowsRef.current.push(infoWindow)
      })
    })

    // Fit map to show all zones
    if (zones.length > 0) {
      map.fitBounds(bounds)
      // Add some padding
      const padding = { top: 50, right: 50, bottom: 50, left: 50 }
      map.fitBounds(bounds, padding)
    }
  }

  // Draw quick commerce markers on the map
  const drawQuickCommerceMarkers = (google, map) => {
    if (!quickCommerces || quickCommerces.length === 0) return

    // Clear previous markers
    quickCommerceMarkersRef.current.forEach(marker => {
      if (marker) marker.setMap(null)
    })
    quickCommerceMarkersRef.current = []

    quickCommerces.forEach((quickCommerce) => {
      if (!quickCommerce.location) return

      // Get coordinates from quick commerce location
      let lat = null
      let lng = null

      if (quickCommerce.location.coordinates && Array.isArray(quickCommerce.location.coordinates) && quickCommerce.location.coordinates.length >= 2) {
        lng = quickCommerce.location.coordinates[0]
        lat = quickCommerce.location.coordinates[1]
      } else if (quickCommerce.location.latitude && quickCommerce.location.longitude) {
        lat = parseFloat(quickCommerce.location.latitude)
        lng = parseFloat(quickCommerce.location.longitude)
      }

      // Skip if no valid coordinates
      if (!lat || !lng || isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
        return
      }

      // Validate coordinates are in valid range
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return
      }

      // Create custom icon for quick commerce
      const quickCommerceIcon = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#ef4444", // Red color
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      }

      // Create marker
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: map,
        icon: quickCommerceIcon,
        title: quickCommerce.name || quickCommerce.shopName || "quick commerce",
        zIndex: 1000, // Show above zones
      })

      // Create info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 12px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1e293b;">
              ${quickCommerce.name || quickCommerce.shopName || 'Unnamed quick commerce'}
            </h3>
            <div style="font-size: 13px; color: #64748b; line-height: 1.6;">
              ${quickCommerce.location?.formattedAddress || quickCommerce.location?.address || quickCommerce.location?.area || 'Location not specified'}
            </div>
            ${quickCommerce.ownerName ? `
              <div style="margin-top: 8px; font-size: 12px; color: #94a3b8;">
                <strong>Owner:</strong> ${quickCommerce.ownerName}
              </div>
            ` : ''}
          </div>
        `
      })

      // Add click listener to show info window
      marker.addListener('click', () => {
        // Close all other info windows
        infoWindowsRef.current.forEach(iw => {
          if (iw && iw !== infoWindow) iw.close()
        })
        
        infoWindow.open(map, marker)
        infoWindowsRef.current.push(infoWindow)
      })

      quickCommerceMarkersRef.current.push(marker)
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-4 lg:p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate("/ecs/quick-commerce/zone-setup")}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">All Zones Map</h1>
              <p className="text-sm text-slate-600">View all quick commerce delivery zones on map</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              ref={autocompleteInputRef}
              type="text"
              placeholder="Search location on map..."
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Map Container */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="relative" style={{ height: "calc(100vh - 250px)", minHeight: "600px" }}>
            <div ref={mapRef} className="w-full h-full rounded-lg" />
            
            {mapLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-slate-600">Loading map...</p>
                </div>
              </div>
            )}

            {loading && !mapLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-slate-600">Loading zones...</p>
                </div>
              </div>
            )}

            {!googleMapsApiKey && !mapLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg">
                <div className="text-center p-6">
                  <MapPin className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-sm text-slate-600">Google Maps API key not found</p>
                </div>
              </div>
            )}

            {mapError && !mapLoading && googleMapsApiKey && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg">
                <div className="text-center p-6">
                  <MapPin className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-sm text-slate-600">{mapError}</p>
                </div>
              </div>
            )}

            {!loading && !mapLoading && zones.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg">
                <div className="text-center p-6">
                  <MapPin className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-sm text-slate-600">No zones found</p>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          {!mapLoading && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Map Information</h3>
              <div className="text-xs text-slate-600 space-y-1">
                {zones.length > 0 && (
                  <p>
                    Click on any <span className="font-semibold text-blue-600">zone</span> on the map to view details. Total zones: <strong>{zones.length}</strong>
                  </p>
                )}
                {quickCommerces.length > 0 && (
                  <p>
                    Click on any <span className="font-semibold text-red-600">red marker</span> to view quick commerce name and details. Total quick commerces: <strong>{quickCommerces.length}</strong>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


