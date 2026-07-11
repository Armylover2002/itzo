import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { MapPin, ArrowLeft, Save, X, Hand, Shapes, Search } from "lucide-react"
import { adminApi } from "../services/adminApi"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { Loader } from "@googlemaps/js-api-loader"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function AddZone() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = !!id && !window.location.pathname.includes('/view/')
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const polygonRef = useRef(null)
  const tempMarkersRef = useRef([])
  const previewPolygonRef = useRef(null)
  const mapClickListenerRef = useRef(null)
  const existingZonesPolygonsRef = useRef([])
  
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("")
  const [mapLoading, setMapLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    country: "India",
    zoneName: "",
    unit: "kilometer",
  })
  
  const [coordinates, setCoordinates] = useState([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [locationSearch, setLocationSearch] = useState("")
  const [existingZones, setExistingZones] = useState([])
  const autocompleteInputRef = useRef(null)
  const autocompleteRef = useRef(null)

  useEffect(() => {
    fetchExistingZones()
    loadGoogleMaps()
    if (isEditMode && id) {
      fetchZone()
    }
  }, [id, isEditMode])

  // Center map on India when country is selected
  useEffect(() => {
    if (formData.country === "India" && mapInstanceRef.current) {
      const indiaCenter = { lat: 20.5937, lng: 78.9629 }
      mapInstanceRef.current.setCenter(indiaCenter)
      mapInstanceRef.current.setZoom(5)
    }
  }, [formData.country])

  // Initialize Places Autocomplete when map is loaded
  const initAutocomplete = useCallback((google) => {
    if (!google?.maps?.places || !autocompleteInputRef.current || autocompleteRef.current) return

    const autocomplete = new google.maps.places.Autocomplete(autocompleteInputRef.current, {
      componentRestrictions: { country: 'in' }
    })
    
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (place.geometry && place.geometry.location && mapInstanceRef.current) {
        const location = place.geometry.location
        mapInstanceRef.current.setCenter(location)
        mapInstanceRef.current.setZoom(15)
        setLocationSearch(place.formatted_address || place.name || "")
      }
    })
    
    autocompleteRef.current = autocomplete
  }, [])

  useEffect(() => {
    if (window.google) {
      initAutocomplete(window.google)
    }
  }, [mapLoading, initAutocomplete])

  // Draw existing polygon when in edit mode and coordinates are loaded
  useEffect(() => {
    if (isEditMode && coordinates.length >= 3 && mapInstanceRef.current && window.google && !mapLoading) {
      debugLog("Drawing existing polygon in edit mode, coordinates:", coordinates.length)
      setTimeout(() => {
        if (mapInstanceRef.current && window.google) {
          setIsDrawing(false)
          drawExistingPolygon(window.google, mapInstanceRef.current, coordinates)
        }
      }, 500)
    }
  }, [isEditMode, coordinates.length, mapLoading])


  const fetchExistingZones = async () => {
    try {
      const response = await adminApi.getZones({ limit: 1000 })
      if (response.data?.success && response.data.data?.zones) {
        // Filter out the current zone if in edit mode
        const zones = isEditMode && id 
          ? response.data.data.zones.filter(zone => zone._id !== id)
          : response.data.data.zones
        setExistingZones(zones)
      }
    } catch (error) {
      debugError("Error fetching existing zones:", error)
      setExistingZones([])
    }
  }

  const fetchZone = async () => {
    try {
      setLoading(true)
      const response = await adminApi.getZoneById(id)
      if (response.data?.success && response.data.data?.zone) {
        const zoneData = response.data.data.zone
        setFormData({
          country: zoneData.country || "India",
          zoneName: zoneData.name || zoneData.zoneName || "",
          unit: zoneData.unit || "kilometer",
        })
        
        if (zoneData.coordinates && zoneData.coordinates.length > 0) {
          setCoordinates(zoneData.coordinates)
        }
      }
    } catch (error) {
      debugError("Error fetching zone:", error)
      alert("Failed to load zone")
      navigate("/ecs/quick-commerce/zone-setup")
    } finally {
      setLoading(false)
    }
  }

  const loadGoogleMaps = async () => {
    try {
      const apiKey = await getGoogleMapsApiKey()
      setGoogleMapsApiKey(apiKey || "loaded")
      
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
        setMapLoading(false)
      }
    } catch (error) {
      debugError("Error loading Google Maps:", error)
      setMapLoading(false)
    }
  }

  const radialSort = useCallback((coords) => {
    if (coords.length < 3) return [...coords]
    
    let sumLat = 0
    let sumLng = 0
    coords.forEach(c => {
      sumLat += c.latitude
      sumLng += c.longitude
    })
    const centroidLat = sumLat / coords.length
    const centroidLng = sumLng / coords.length
    
    return [...coords].sort((a, b) => {
      const angleA = Math.atan2(a.latitude - centroidLat, a.longitude - centroidLng)
      const angleB = Math.atan2(b.latitude - centroidLat, b.longitude - centroidLng)
      return angleA - angleB
    })
  }, [])

  const removeMarkerFromMap = useCallback((marker) => {
    if (!marker) return
    if (marker.setMap) {
      marker.setMap(null)
    } else {
      marker.map = null
    }
  }, [])

  const getSortedCoordinatesFromMarkers = useCallback(() => {
    const coords = tempMarkersRef.current.map(m => {
      let lat, lng
      if (m.getPosition) {
        lat = m.getPosition().lat()
        lng = m.getPosition().lng()
      } else {
        const pos = m.position
        lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat
        lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng
      }
      return { latitude: lat, longitude: lng }
    })
    return radialSort(coords)
  }, [radialSort])

  const updatePreviewPath = useCallback(() => {
    if (!window.google) return
    const sorted = getSortedCoordinatesFromMarkers()
    if (sorted.length < 2) {
      if (previewPolygonRef.current) {
        previewPolygonRef.current.setMap(null)
        previewPolygonRef.current = null
      }
      return
    }

    const path = sorted.map(c => new window.google.maps.LatLng(c.latitude, c.longitude))

    if (!previewPolygonRef.current) {
      previewPolygonRef.current = new window.google.maps.Polygon({
        paths: path,
        strokeColor: "#9333ea",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#9333ea",
        fillOpacity: 0.35,
        map: mapInstanceRef.current,
        clickable: false,
        draggable: false,
        editable: false
      })
    } else {
      previewPolygonRef.current.setPaths(path)
    }
  }, [getSortedCoordinatesFromMarkers])

  const handleMapClick = useCallback((e) => {
    if (!window.google) return
    const latLng = e.latLng
    const title = `Point ${tempMarkersRef.current.length + 1}`
    let marker

    if (window.google.maps.marker?.AdvancedMarkerElement) {
      const pinElement = document.createElement('div')
      pinElement.style.width = '16px'
      pinElement.style.height = '16px'
      pinElement.style.backgroundColor = '#0c831f'
      pinElement.style.borderRadius = '50%'
      pinElement.style.border = '2px solid white'
      pinElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)'
      pinElement.style.cursor = 'pointer'

      marker = new window.google.maps.marker.AdvancedMarkerElement({
        position: latLng,
        map: mapInstanceRef.current,
        content: pinElement,
        gmpDraggable: true,
        title: title
      })
    } else {
      marker = new window.google.maps.Marker({
        position: latLng,
        map: mapInstanceRef.current,
        draggable: true,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#0c831f",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2
        },
        zIndex: 1000,
        title: title
      })
    }

    marker.addListener('drag', () => {
      updatePreviewPath()
    })

    marker.addListener('dragend', () => {
      const sorted = getSortedCoordinatesFromMarkers()
      setCoordinates(sorted)
    })

    tempMarkersRef.current.push(marker)
    updatePreviewPath()
    
    const sorted = getSortedCoordinatesFromMarkers()
    setCoordinates(sorted)
  }, [updatePreviewPath, getSortedCoordinatesFromMarkers])

  const setupPolygonListeners = useCallback((polygon) => {
    if (!polygon) return

    const handlePathChange = () => {
      const path = polygon.getPath()
      const coords = []
      path.forEach(latLng => {
        coords.push({
          latitude: parseFloat(latLng.lat().toFixed(6)),
          longitude: parseFloat(latLng.lng().toFixed(6))
        })
      })
      setCoordinates(coords)
    }

    const path = polygon.getPath()
    window.google.maps.event.addListener(path, 'set_at', handlePathChange)
    window.google.maps.event.addListener(path, 'insert_at', handlePathChange)
    window.google.maps.event.addListener(path, 'remove_at', handlePathChange)

    // Vertex deletion on right click
    window.google.maps.event.addListener(polygon, 'rightclick', (event) => {
      if (event.vertex !== undefined) {
        const currentPath = polygon.getPath()
        if (currentPath.getLength() > 3) {
          currentPath.removeAt(event.vertex)
        } else {
          alert("A polygon must have at least 3 vertices.")
        }
      }
    })
  }, [])

  // Handle start/stop drawing state changes
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return

    if (isDrawing) {
      // Start Drawing Phase
      mapInstanceRef.current.setOptions({ draggableCursor: 'crosshair' })
      
      // Clear any existing main polygon
      if (polygonRef.current) {
        polygonRef.current.setMap(null)
        polygonRef.current = null
      }
      
      // Clean up previous drawing artifacts
      if (previewPolygonRef.current) {
        previewPolygonRef.current.setMap(null)
        previewPolygonRef.current = null
      }
      tempMarkersRef.current.forEach(removeMarkerFromMap)
      tempMarkersRef.current = []
      
      setCoordinates([])

      // Listen for map clicks
      mapClickListenerRef.current = mapInstanceRef.current.addListener('click', handleMapClick)
    } else {
      // Stop Drawing Phase
      mapInstanceRef.current.setOptions({ draggableCursor: null })

      if (mapClickListenerRef.current) {
        window.google.maps.event.removeListener(mapClickListenerRef.current)
        mapClickListenerRef.current = null
      }

      // Finish drawing transition
      if (coordinates.length >= 3) {
        const path = coordinates.map(c => new window.google.maps.LatLng(c.latitude, c.longitude))
        
        const polygon = new window.google.maps.Polygon({
          paths: path,
          strokeColor: "#9333ea",
          strokeOpacity: 0.8,
          strokeWeight: 3,
          fillColor: "#9333ea",
          fillOpacity: 0.35,
          editable: true,
          draggable: false,
          map: mapInstanceRef.current
        })

        polygonRef.current = polygon
        setupPolygonListeners(polygon)
      }

      // Clean up drawing phase markers and preview polygon
      tempMarkersRef.current.forEach(removeMarkerFromMap)
      tempMarkersRef.current = []
      if (previewPolygonRef.current) {
        previewPolygonRef.current.setMap(null)
        previewPolygonRef.current = null
      }
    }

    // Toggle clickability on existing zones
    existingZonesPolygonsRef.current.forEach(poly => {
      if (poly) poly.setOptions({ clickable: !isDrawing })
    })
  }, [isDrawing, handleMapClick, coordinates.length, setupPolygonListeners])

  const initializeMap = (google) => {
    if (!mapRef.current) return

    const initialLocation = { lat: 20.5937, lng: 78.9629 }

    const map = new google.maps.Map(mapRef.current, {
      center: initialLocation,
      zoom: 5,
      mapId: "DEMO_MAP_ID",
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
    initAutocomplete(google)

    if (isEditMode && coordinates.length >= 3) {
      setTimeout(() => {
        if (mapInstanceRef.current && window.google) {
          drawExistingPolygon(window.google, mapInstanceRef.current, coordinates)
        }
      }, 500)
    }
  }

  const drawExistingZonesOnMap = (google, map) => {
    if (!existingZones || existingZones.length === 0) return

    existingZonesPolygonsRef.current.forEach(polygon => {
      if (polygon) polygon.setMap(null)
    })
    existingZonesPolygonsRef.current = []

    existingZones.forEach((zone) => {
      if (!zone.coordinates || zone.coordinates.length < 3) return

      const path = zone.coordinates.map(coord => {
        const lat = typeof coord === 'object' ? (coord.latitude || coord.lat) : null
        const lng = typeof coord === 'object' ? (coord.longitude || coord.lng) : null
        if (lat === null || lng === null) return null
        return new google.maps.LatLng(lat, lng)
      }).filter(Boolean)

      if (path.length < 3) return

      const polygon = new google.maps.Polygon({
        paths: path,
        strokeColor: "#3b82f6",
        strokeOpacity: 0.6,
        strokeWeight: 2,
        fillColor: "#3b82f6",
        fillOpacity: 0.15,
        editable: false,
        draggable: false,
        clickable: !isDrawing,
        zIndex: 0
      })

      polygon.setMap(map)
      existingZonesPolygonsRef.current.push(polygon)

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <strong>${zone.name || zone.zoneName || 'Unnamed Zone'}</strong><br/>
            <small>Country: ${zone.country || 'N/A'}</small>
          </div>
        `
      })

      polygon.addListener('click', () => {
        infoWindow.setPosition(polygon.getPath().getAt(0))
        infoWindow.open(map)
      })
    })
  }

  useEffect(() => {
    if (!mapLoading && mapInstanceRef.current && existingZones.length > 0 && window.google) {
      drawExistingZonesOnMap(window.google, mapInstanceRef.current)
    }
  }, [existingZones, mapLoading])

  const drawExistingPolygon = (google, map, coords) => {
    if (!coords || coords.length < 3) return

    if (polygonRef.current) {
      polygonRef.current.setMap(null)
    }

    const path = coords.map(coord => {
      const lat = typeof coord === 'object' ? (coord.latitude || coord.lat) : null
      const lng = typeof coord === 'object' ? (coord.longitude || coord.lng) : null
      if (lat === null || lng === null) return null
      return new google.maps.LatLng(lat, lng)
    }).filter(Boolean)

    if (path.length < 3) return

    const polygon = new google.maps.Polygon({
      paths: path,
      strokeColor: "#9333ea",
      strokeOpacity: 0.8,
      strokeWeight: 3,
      fillColor: "#9333ea",
      fillOpacity: 0.35,
      editable: true,
      draggable: false,
      map: map
    })

    polygon.setMap(map)
    polygonRef.current = polygon

    const bounds = new google.maps.LatLngBounds()
    path.forEach(latLng => bounds.extend(latLng))
    map.fitBounds(bounds)

    setupPolygonListeners(polygon)
  }

  const toggleDrawingMode = () => {
    setIsDrawing(prev => !prev)
  }

  const clearDrawing = () => {
    if (polygonRef.current) {
      polygonRef.current.setMap(null)
      polygonRef.current = null
    }
    if (previewPolygonRef.current) {
      previewPolygonRef.current.setMap(null)
      previewPolygonRef.current = null
    }
    tempMarkersRef.current.forEach(removeMarkerFromMap)
    tempMarkersRef.current = []
    setCoordinates([])
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.zoneName) {
      alert("Please enter a zone name")
      return
    }

    if (!formData.country) {
      alert("Please select a country")
      return
    }

    if (coordinates.length < 3) {
      alert("Please draw at least 3 points on the map to create a zone")
      return
    }

    try {
      setLoading(true)
      
      // Validate coordinates format
      if (!coordinates || coordinates.length < 3) {
        alert("Please draw at least 3 points on the map")
        setLoading(false)
        return
      }

      // Ensure coordinates have correct format
      const validCoordinates = coordinates.map(coord => {
        if (typeof coord === 'object' && coord.latitude !== undefined && coord.longitude !== undefined) {
          return {
            latitude: parseFloat(coord.latitude),
            longitude: parseFloat(coord.longitude)
          }
        }
        return coord
      })

      const zoneData = {
        name: formData.zoneName,
        zoneName: formData.zoneName,
        country: formData.country,
        unit: formData.unit || "kilometer",
        coordinates: validCoordinates,
        isActive: true
      }

      debugLog("Sending zone data:", zoneData)

      if (isEditMode && id) {
        // Update existing zone
        const response = await adminApi.updateZone(id, zoneData)
        debugLog("Zone updated successfully:", response)
        alert("Zone updated successfully!")
      } else {
        // Create new zone
        const response = await adminApi.createZone(zoneData)
        debugLog("Zone created successfully:", response)
        alert("Zone created successfully!")
      }
      navigate("/ecs/quick-commerce/zone-setup")
    } catch (error) {
      debugError("Error creating zone:", error)
      
      // Handle different types of errors
      let errorMessage = "Failed to create zone. Please try again."
      
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || !error.response) {
        // Network error - backend not running or CORS issue
        errorMessage = "Cannot connect to server. Please make sure the backend server is running."
        debugError("Network error: Backend server might not be running")
      } else if (error.response) {
        // API error with response
        errorMessage = error.response.data?.message || 
                      error.response.data?.error || 
                      error.message || 
                      `Server error: ${error.response.status}`
        debugError("API error:", error.response.data)
        debugError("Error status:", error.response.status)
      } else {
        // Other errors
        errorMessage = error.message || errorMessage
      }
      
      alert(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate("/ecs/quick-commerce/zone-setup")}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0c831f] flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {isEditMode ? "Edit Zone" : "Add New Zone"}
              </h1>
              <p className="text-sm text-slate-600">
                {isEditMode ? "Update delivery zone for customer" : "Create a delivery zone for customer"}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel - Form */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Zone Details</h2>
                
                <div className="space-y-4">
                  {/* Country Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Country <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.country}
                      onChange={(e) => handleInputChange("country", e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    >
                      <option value="India">India</option>
                    </select>
                  </div>

                  {/* Zone Name */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Create Zone name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.zoneName}
                      onChange={(e) => handleInputChange("zoneName", e.target.value)}
                      placeholder="Enter zone name"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>

                  {/* Select Unit */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Select Unit <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.unit}
                      onChange={(e) => handleInputChange("unit", e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    >
                      <option value="kilometer">Kilometers (km)</option>
                      <option value="miles">Miles (mi)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel - Map */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Draw Zone on Map</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleDrawingMode}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      isDrawing
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "bg-primary text-white hover:bg-primary/90"
                    }`}
                  >
                    <Shapes className="w-4 h-4" />
                    <span>{isDrawing ? "Stop Drawing" : "Start Drawing"}</span>
                  </button>
                  {coordinates.length > 0 && (
                    <button
                      type="button"
                      onClick={clearDrawing}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    ref={autocompleteInputRef}
                    type="text"
                    placeholder="Search location on map..."
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                {coordinates.length > 0 && (
                  <p className="text-xs text-slate-600 mt-2">
                    Points drawn: <strong>{coordinates.length}</strong>
                    {coordinates.length < 3 && (
                      <span className="text-red-600 ml-2">(Minimum 3 points required)</span>
                    )}
                  </p>
                )}
              </div>

              <div className="relative" style={{ height: "600px" }}>
                <div ref={mapRef} className="w-full h-full rounded-lg" />
                
                {mapLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-slate-600">Loading map...</p>
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
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => navigate("/ecs/quick-commerce/zone-setup")}
              className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || coordinates.length < 3 || !formData.zoneName || !formData.country}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Zone</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


