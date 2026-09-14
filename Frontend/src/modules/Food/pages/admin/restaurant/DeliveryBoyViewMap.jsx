import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { MapPin, ArrowLeft, Search, Bike } from "lucide-react"
import { adminAPI } from "@food/api"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { Loader } from "@googlemaps/js-api-loader"
import { subscribeAllDeliveryLocations } from "@food/realtimeTracking"
import bikeLogo from "@food/assets/bikelogo.png"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function DeliveryBoyViewMap() {
  const navigate = useNavigate()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const zonesPolygonsRef = useRef([])
  const infoWindowsRef = useRef([])
  const deliveryBoyMarkersRef = useRef([])
  const rotatedIconCacheRef = useRef(new Map()) // Cache for rotated bike icons
  
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("")
  const [mapLoading, setMapLoading] = useState(true)
  const [zones, setZones] = useState([])
  const [deliveryBoys, setDeliveryBoys] = useState([])
  const deliveryMetaByIdRef = useRef(new Map())
  const [loading, setLoading] = useState(true)
  const [locationSearch, setLocationSearch] = useState("")
  const autocompleteInputRef = useRef(null)
  const autocompleteRef = useRef(null)

  useEffect(() => {
    fetchZones()
    fetchDeliveryPartnerDirectory()
    loadGoogleMaps()

    const unsubscribeRealtime = subscribeAllDeliveryLocations(
      (deliveryNode) => {
        const nextDeliveryBoys = Object.entries(deliveryNode || {})
          .map(([deliveryId, payload]) => {
            const location = payload?.location || {}
            const lat = Number(location?.lat)
            const lng = Number(location?.lng)
            const isOnline =
              location?.isOnline === true ||
              location?.status === "online" ||
              location?.status === "busy"

            if (!isOnline || !Number.isFinite(lat) || !Number.isFinite(lng)) {
              return null
            }

            const meta = deliveryMetaByIdRef.current.get(String(deliveryId)) || {}

            return {
              _id: String(deliveryId),
              name: meta.name || meta.fullName || "Delivery Partner",
              phone: meta.phone || "N/A",
              availability: {
                isOnline: true,
                currentLocation: {
                  type: "Point",
                  coordinates: [lng, lat],
                  heading: Number(location?.heading) || 0,
                  speed: Number(location?.speed) || 0,
                  lastUpdate: Number(location?.timestamp || location?.last_updated) || Date.now()
                },
                lastLocationUpdate: Number(location?.timestamp || location?.last_updated) || Date.now()
              }
            }
          })
          .filter(Boolean)

        setDeliveryBoys(nextDeliveryBoys)
        setLoading(false)
      },
      (error) => {
        debugError("Firebase delivery listener failed:", error)
      }
    )

    return () => {
      if (typeof unsubscribeRealtime === "function") unsubscribeRealtime()
    }
  }, [])

  // Initialize Places Autocomplete when map is loaded
  useEffect(() => {
    if (!mapLoading && mapInstanceRef.current && autocompleteInputRef.current && window.google?.maps?.places && !autocompleteRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(autocompleteInputRef.current, {
        componentRestrictions: { country: 'in' }
      })
      
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (place.geometry && place.geometry.location && mapInstanceRef.current) {
          const location = place.geometry.location
          mapInstanceRef.current.setCenter(location)
          mapInstanceRef.current.setZoom(12)
          setLocationSearch(place.formatted_address || place.name || "")
        }
      })
      
      autocompleteRef.current = autocomplete
    }
  }, [mapLoading])

  // Draw zones and delivery boy markers when map and data are ready
  useEffect(() => {
    if (!mapLoading && mapInstanceRef.current && window.google) {
      if (zones.length > 0) {
        drawAllZonesOnMap(window.google, mapInstanceRef.current)
      }
      if (deliveryBoys.length > 0) {
        // drawDeliveryBoyMarkers is async, so handle it properly
        drawDeliveryBoyMarkers(window.google, mapInstanceRef.current).catch(error => {
          debugError("Error drawing delivery boy markers:", error)
        })
      }
    }
  }, [zones, mapLoading, deliveryBoys])

  const fetchZones = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getZones({ limit: 1000 })
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

  const fetchDeliveryPartnerDirectory = async () => {
    try {
      const response = await adminAPI.getDeliveryPartners({
        limit: 1000,
        status: "approved",
        isActive: true,
        includeAvailability: false
      })

      if (response.data?.success && response.data.data?.deliveryPartners) {
        const nextMap = new Map()
        response.data.data.deliveryPartners.forEach((boy) => {
          const boyId =
            boy?._id ||
            boy?.id ||
            boy?.deliveryId ||
            boy?.fullData?._id ||
            boy?.fullData?.id

          if (!boyId) return

          nextMap.set(String(boyId), {
            name: boy?.name || boy?.fullData?.name || "Delivery Partner",
            fullName: boy?.fullName || boy?.fullData?.fullName || "",
            phone: boy?.phone || boy?.fullData?.phone || "N/A"
          })
        })
        deliveryMetaByIdRef.current = nextMap
      }
    } catch (error) {
      debugError("Error fetching delivery partner directory:", error)
    }
  }
  const loadGoogleMaps = async () => {
    try {
      const apiKey = await getGoogleMapsApiKey()
      setGoogleMapsApiKey(apiKey || "loaded")
      
      let retries = 0
      const maxRetries = 50
      
      while (!window.google && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100))
        retries++
      }

      if (window.google && window.google.maps) {
        initializeMap(window.google)
        return
      }

      if (apiKey) {
        const loader = new Loader({
          apiKey: apiKey,
          version: "weekly",
          libraries: ["places", "drawing", "geometry"]
        })

        const google = await loader.load()
        initializeMap(google)
      } else {
        setMapLoading(false)
      }
    } catch (error) {
      debugError("Error loading Google Maps:", error)
      setMapLoading(false)
    }
  }

  const initializeMap = (google) => {
    if (!mapRef.current) return

    const initialLocation = { lat: 20.5937, lng: 78.9629 }

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
      zonesPolygonsRef.current.forEach(polygon => {
        if (polygon) polygon.setMap(null)
      })
      zonesPolygonsRef.current = []
      return
    }

    zonesPolygonsRef.current.forEach(polygon => {
      if (polygon) polygon.setMap(null)
    })
    zonesPolygonsRef.current = []

    infoWindowsRef.current.forEach(infoWindow => {
      if (infoWindow) infoWindow.close()
    })
    infoWindowsRef.current = []

    const colors = [
      "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
      "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
    ]

    const bounds = new google.maps.LatLngBounds()

    zones.forEach((zone, index) => {
      if (!zone.coordinates || zone.coordinates.length < 3) return

      const path = zone.coordinates.map(coord => {
        const lat = typeof coord === 'object' ? (coord.latitude || coord.lat) : null
        const lng = typeof coord === 'object' ? (coord.longitude || coord.lng) : null
        if (lat === null || lng === null) return null
        const latLng = new google.maps.LatLng(lat, lng)
        bounds.extend(latLng)
        return latLng
      }).filter(Boolean)

      if (path.length < 3) return

      const color = colors[index % colors.length]

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

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 12px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1e293b;">
              ${zone.name || 'Unnamed Zone'}
            </h3>
            <div style="font-size: 13px; color: #64748b; line-height: 1.6;">
              <div style="margin-bottom: 4px;">
                <strong>Location:</strong> ${zone.serviceLocation || 'N/A'}
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
        infoWindowsRef.current.forEach(iw => {
          if (iw && iw !== infoWindow) iw.close()
        })
        infoWindow.setPosition(path[0])
        infoWindow.open(map)
        infoWindowsRef.current.push(infoWindow)
      })
    })

    if (zones.length > 0) {
      map.fitBounds(bounds)
      const padding = { top: 50, right: 50, bottom: 50, left: 50 }
      map.fitBounds(bounds, padding)
    }
  }

  // Function to get rotated bike icon (similar to delivery app)
  const getRotatedBikeIcon = (heading = 0) => {
    // Round heading to nearest 5 degrees for caching
    const roundedHeading = Math.round(heading / 5) * 5
    const cacheKey = `${roundedHeading}`
    
    // Check cache first
    if (rotatedIconCacheRef.current.has(cacheKey)) {
      return Promise.resolve(rotatedIconCacheRef.current.get(cacheKey))
    }

    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const size = 50 // Icon size
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')
          
          // Clear canvas
          ctx.clearRect(0, 0, size, size)
          
          // Move to center, rotate, then draw image
          ctx.save()
          ctx.translate(size / 2, size / 2)
          ctx.rotate((roundedHeading * Math.PI) / 180) // Convert degrees to radians
          ctx.drawImage(img, -size / 2, -size / 2, size, size)
          ctx.restore()
          
          // Get data URL and cache it
          const dataUrl = canvas.toDataURL()
          rotatedIconCacheRef.current.set(cacheKey, dataUrl)
          resolve(dataUrl)
        } catch (error) {
          debugWarn('?? Error rotating bike icon:', error)
          // Fallback to original image if rotation fails
          resolve(bikeLogo)
        }
      }
      img.onerror = () => {
        // Fallback to original image if loading fails
        resolve(bikeLogo)
      }
      img.src = bikeLogo
    })
  }

  // Draw delivery boy markers (bikes) on the map
  const drawDeliveryBoyMarkers = async (google, map) => {
    if (!deliveryBoys || deliveryBoys.length === 0) {
      // Clear previous markers
      deliveryBoyMarkersRef.current.forEach(marker => {
        if (marker) marker.setMap(null)
      })
      deliveryBoyMarkersRef.current = []
      return
    }

    // Clear previous markers
    deliveryBoyMarkersRef.current.forEach(marker => {
      if (marker) marker.setMap(null)
    })
    deliveryBoyMarkersRef.current = []

    // Track processed delivery boy IDs to prevent duplicates
    const processedIds = new Set()

    // Process all delivery boys and create markers
    for (const boy of deliveryBoys) {
      // Get unique ID to prevent duplicate markers
      const fullData = boy.fullData || boy
      const boyId = boy._id || boy.id || boy.deliveryId || fullData?._id || fullData?.id || fullData?.deliveryId
      
      if (!boyId) {
        debugWarn("?? Skipping delivery boy without ID:", fullData.name || "Unknown")
        continue
      }
      
      const idString = boyId.toString()
      
      // Skip if we've already processed this delivery boy
      if (processedIds.has(idString)) {
        debugWarn("?? Duplicate delivery boy detected, skipping:", fullData.name || "Unknown", idString)
        continue
      }
      
      processedIds.add(idString)
      
      // Try multiple sources for availability
      const availability = boy.availability || fullData?.availability || (fullData && fullData.availability)
      const currentLocation = availability?.currentLocation
      
      if (!currentLocation?.coordinates) {
        debugWarn("?? No coordinates for delivery boy:", fullData.name || "Unknown")
        continue
      }

      const coords = currentLocation.coordinates
      // Handle both [lng, lat] and [lat, lng] formats
      let lat, lng
      if (Array.isArray(coords) && coords.length >= 2) {
        // Try [lng, lat] format first (GeoJSON standard)
        if (coords[0] > -180 && coords[0] < 180 && coords[1] > -90 && coords[1] < 90) {
          lng = coords[0]
          lat = coords[1]
        } else {
          // Try [lat, lng] format
          lat = coords[0]
          lng = coords[1]
        }
      } else {
        debugWarn("?? Invalid coordinates format:", coords)
        continue
      }

      if (!lat || !lng || isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
        debugWarn("?? Invalid lat/lng values:", { lat, lng })
        continue
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        debugWarn("?? Coordinates out of range:", { lat, lng })
        continue
      }

      // Get heading if available
      const heading = currentLocation.heading || 0
      
      // Get name and phone from fullData
      const boyName = fullData.name || "Delivery Boy"
      const boyPhone = fullData.phone || "N/A"
      
      debugLog("?? Creating bike marker for:", {
        name: boyName,
        lat,
        lng,
        heading
      })

      // Get rotated bike icon
      const rotatedIconUrl = await getRotatedBikeIcon(heading)

      // Create bike icon using rotated bike logo image
      const bikeIcon = {
        url: rotatedIconUrl,
        scaledSize: new google.maps.Size(50, 50), // Size of bike icon
        anchor: new google.maps.Point(25, 25) // Center point
      }
      const lastUpdate = availability?.lastLocationUpdate || currentLocation?.lastUpdate

      // Create marker
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: map,
        icon: bikeIcon,
        title: boyName,
        zIndex: 1000, // Show above zones
      })

      // Create info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 12px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1e293b;">
              ${boyName}
            </h3>
            <div style="font-size: 13px; color: #64748b; line-height: 1.6;">
              <div style="margin-bottom: 4px;">
                <strong>Phone:</strong> ${boyPhone}
              </div>
              <div style="margin-bottom: 4px;">
                <strong>Status:</strong> 
                <span style="color: #10b981; font-weight: 600;">Online</span>
              </div>
              ${lastUpdate ? `
                <div style="margin-top: 8px; font-size: 12px; color: #94a3b8;">
                  Last updated: ${new Date(lastUpdate).toLocaleTimeString()}
                </div>
              ` : ''}
            </div>
          </div>
        `
      })

      // Add click listener to show info window
      marker.addListener('click', () => {
        infoWindowsRef.current.forEach(iw => {
          if (iw && iw !== infoWindow) iw.close()
        })
        infoWindow.open(map, marker)
        infoWindowsRef.current.push(infoWindow)
      })

      deliveryBoyMarkersRef.current.push(marker)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-4 lg:p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate("/ecs/food/zone-setup")}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
              <Bike className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Delivery Boy View</h1>
              <p className="text-sm text-slate-600">View zones and online delivery boys on map</p>
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
                  <p className="text-slate-600">Loading data...</p>
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

            {!loading && !mapLoading && zones.length === 0 && deliveryBoys.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg">
                <div className="text-center p-6">
                  <MapPin className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-sm text-slate-600">No zones or delivery boys found</p>
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
                {deliveryBoys.length > 0 && (
                  <p>
                    Click on any <span className="font-semibold text-green-600">green bike icon</span> to view delivery boy details. Online delivery boys: <strong>{deliveryBoys.length}</strong>
                  </p>
                )}
                {deliveryBoys.length === 0 && (
                  <p className="text-amber-600">
                    No online delivery boys found. Delivery boys will appear when they go online.
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



