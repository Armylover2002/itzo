import { useState, useEffect, useRef, useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { MapPin, ArrowLeft, Save, X, Shapes, Search, LocateFixed } from "lucide-react"
import { adminApi } from "../services/adminApi"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { generateCityZoneFromCurrentLocation } from "@food/utils/cityZoneBoundary"
import { findZoneOverlapMessage } from "../../../../shared/utils/zoneOverlap"
import {
  computePolygonAreaKm2,
  formatAreaValue,
  formatUnitWithCoverage,
  getUnitLabel,
} from "../../../../shared/utils/zoneCoverage"
import { Loader } from "@googlemaps/js-api-loader"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const MIN_POINTS = 3;

// Order points by angle around their centroid so polygon edges never self-intersect,
// while KEEPING every clicked point (unlike a convex hull).
const orderPointsRadially = (pts) => {
  const points = pts
    .map(p => ({
      lat: typeof p.lat === 'function' ? p.lat() : p.lat,
      lng: typeof p.lng === 'function' ? p.lng() : p.lng,
    }))
    .filter(p => typeof p.lat === 'number' && typeof p.lng === 'number');

  if (points.length < 3) return points;

  const cx = points.reduce((s, p) => s + p.lng, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.lat, 0) / points.length;

  return [...points].sort((a, b) =>
    Math.atan2(a.lat - cy, a.lng - cx) - Math.atan2(b.lat - cy, b.lng - cx)
  );
};


export default function AddZone() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = !!id && !window.location.pathname.includes('/view/')
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const polygonRef = useRef(null)
  const polylineRef = useRef(null)
  const pathMarkersRef = useRef([])
  
  const mapClickListenerRef = useRef(null)
  const drawPointsRef = useRef([])
  const isDrawingRef = useRef(false)
  // Draw the loaded zone polygon once per edit session — not on every coordinates.length change
  const initialPolygonDrawnRef = useRef(false)
  
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("")
  const [mapLoading, setMapLoading] = useState(true)
  const [mapError, setMapError] = useState("")
  const [loading, setLoading] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    country: "India",
    zoneName: "",
    unit: "kilometer"
  })
  const [coordinates, setCoordinates] = useState([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [autoGenerating, setAutoGenerating] = useState(false)
  const [autoGenerateMessage, setAutoGenerateMessage] = useState({ type: "", text: "" })
  const [locationSearch, setLocationSearch] = useState("")
  const [existingZones, setExistingZones] = useState([])
  const autocompleteInputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const existingZonesPolygonsRef = useRef([])

  const coverageAreaKm2 = useMemo(
    () => computePolygonAreaKm2(coordinates),
    [coordinates],
  )
  const coverageLabel = formatAreaValue(coverageAreaKm2, formData.unit)

  useEffect(() => {
    fetchExistingZones()
    loadGoogleMaps()
    if (isEditMode && id) {
      fetchZone()
    }
  }, [id, isEditMode])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const google = window.google;
      if (google && mapClickListenerRef.current) {
        google.maps.event.removeListener(mapClickListenerRef.current);
      }
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
      }
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
      pathMarkersRef.current?.forEach(m => m.setMap(null));
      existingZonesPolygonsRef.current?.forEach(p => p?.setMap(null));
    };
  }, []);

  // Center map on India when country is selected
  useEffect(() => {
    if (formData.country === "India" && mapInstanceRef.current) {
      const indiaCenter = { lat: 20.5937, lng: 78.9629 }
      mapInstanceRef.current.setCenter(indiaCenter)
      mapInstanceRef.current.setZoom(5)
    }
  }, [formData.country])

  // Initialize Places Autocomplete when map is loaded
  useEffect(() => {
    if (!mapLoading && mapInstanceRef.current && autocompleteInputRef.current && window.google?.maps?.places && !autocompleteRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(autocompleteInputRef.current, {
        // No `geocode` type — it routes predictions through Geocoding-style endpoints.
        componentRestrictions: { country: 'in' } // Restrict to India
      })
      
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (place.geometry && place.geometry.location && mapInstanceRef.current) {
          const location = place.geometry.location
          mapInstanceRef.current.setCenter(location)
          mapInstanceRef.current.setZoom(15) // Zoom in when location is selected
          
          // Set the search input value
          setLocationSearch(place.formatted_address || place.name || "")
        }
      })
      
      autocompleteRef.current = autocomplete
    }
  }, [mapLoading])

  // Reset one-time draw flag when navigating to a different zone
  useEffect(() => {
    initialPolygonDrawnRef.current = false
  }, [id])

  // Draw existing polygon once when edit data + map are ready.
  // Must NOT re-run when the user is drawing or when vertex count changes during edits —
  // that previously forced-close the polygon at 3 points (coordinates.length >= 3).
  useEffect(() => {
    if (
      !isEditMode ||
      initialPolygonDrawnRef.current ||
      isDrawingRef.current ||
      coordinates.length < MIN_POINTS ||
      !mapInstanceRef.current ||
      !window.google ||
      mapLoading
    ) {
      return
    }

    debugLog("Drawing existing polygon in edit mode, coordinates:", coordinates.length)
    const coordsSnapshot = coordinates
    const timer = setTimeout(() => {
      if (
        !mapInstanceRef.current ||
        !window.google ||
        isDrawingRef.current ||
        initialPolygonDrawnRef.current
      ) {
        return
      }
      initialPolygonDrawnRef.current = true
      drawExistingPolygon(window.google, mapInstanceRef.current, coordsSnapshot)
    }, 500)
    return () => clearTimeout(timer)
  }, [isEditMode, coordinates, mapLoading])


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
          unit: zoneData.unit || "kilometer"
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
          libraries: ["places", "geometry"]
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
      clickableIcons: false, // POI labels must NOT capture clicks while drawing
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: google.maps.ControlPosition.TOP_RIGHT,
        mapTypeIds: [google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.SATELLITE]
      },
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      scrollwheel: true, // Enable mouse wheel zoom
      gestureHandling: 'greedy', // Allow zoom with mouse wheel and touch gestures
      disableDoubleClickZoom: false, // Allow double-click zoom
    })

    mapInstanceRef.current = map

    // Setup map click listener for drawing points
    mapClickListenerRef.current = google.maps.event.addListener(map, 'click', (event) => {
      if (!isDrawingRef.current) return;
      drawPointsRef.current.push(event.latLng);
      renderDrawingPolygon(google, map);
    });

    setMapLoading(false)

    // Existing zones will be drawn by useEffect when data is ready
    if (existingZones.length > 0) {
      drawExistingZonesOnMap(google, map)
    }

    // If in edit mode and coordinates are already loaded, draw once (effect may also handle this)
    if (isEditMode && coordinates.length >= MIN_POINTS && !initialPolygonDrawnRef.current) {
      const coordsSnapshot = coordinates
      setTimeout(() => {
        if (
          !mapInstanceRef.current ||
          !window.google ||
          isDrawingRef.current ||
          initialPolygonDrawnRef.current
        ) {
          return
        }
        initialPolygonDrawnRef.current = true
        drawExistingPolygon(window.google, mapInstanceRef.current, coordsSnapshot)
      }, 500) // Small delay to ensure map is fully loaded
    }
  }

  // Draw existing zones on the map
  const drawExistingZonesOnMap = (google, map) => {
    if (!existingZones || existingZones.length === 0) return

    // Clear previous existing zone polygons
    existingZonesPolygonsRef.current.forEach(polygon => {
      if (polygon) polygon.setMap(null)
    })
    existingZonesPolygonsRef.current = []

    existingZones.forEach((zone, index) => {
      if (!zone.coordinates || zone.coordinates.length < 3) return

      // Convert coordinates to LatLng array
      const path = zone.coordinates.map(coord => {
        const lat = typeof coord === 'object' ? (coord.latitude || coord.lat) : null
        const lng = typeof coord === 'object' ? (coord.longitude || coord.lng) : null
        if (lat === null || lng === null) return null
        return new google.maps.LatLng(lat, lng)
      }).filter(Boolean)

      if (path.length < 3) return

      // Create polygon for existing zone with different color (gray/blue)
      const polygon = new google.maps.Polygon({
        paths: path,
        strokeColor: "#3b82f6", // Blue color for existing zones
        strokeOpacity: 0.6,
        strokeWeight: 2,
        fillColor: "#3b82f6",
        fillOpacity: 0.15, // Lighter opacity so new zone stands out
        editable: false, // Not editable
        draggable: false,
        clickable: true,
        zIndex: 0 // Lower z-index so new zone appears on top
      })

      polygon.setMap(map)
      existingZonesPolygonsRef.current.push(polygon)

      // Add info window on click
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

  // Redraw existing zones when zones data changes or map is ready
  useEffect(() => {
    if (!mapLoading && mapInstanceRef.current && existingZones.length > 0 && window.google) {
      drawExistingZonesOnMap(window.google, mapInstanceRef.current)
    }
  }, [existingZones, mapLoading])

  const renderVertexMarkers = (google, map, latLngs) => {
    pathMarkersRef.current?.forEach(m => m.setMap(null));
    pathMarkersRef.current = latLngs.map((latLng, i) => new google.maps.Marker({
      position: latLng,
      map,
      clickable: false, // must not block map clicks
      icon: { 
        path: google.maps.SymbolPath.CIRCLE, 
        scale: 8, 
        fillColor: "#9333ea",
        fillOpacity: 1, 
        strokeColor: "#ffffff", 
        strokeWeight: 2 
      },
      zIndex: 1000,
      title: `Point ${i + 1}`,
    }));
  };

  const renderDrawingPolygon = (google, map) => {
    const points = drawPointsRef.current;
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    const path = points.map(p => ({ lat: p.lat(), lng: p.lng() }));

    // Polyline preview (no fill) so clicks inside the shape still reach the map
    if (path.length >= 2) {
      polylineRef.current = new google.maps.Polyline({
        path,
        strokeColor: "#9333ea",
        strokeWeight: 2,
        clickable: false,
        zIndex: 1,
      });
      polylineRef.current.setMap(map);
    }

    renderVertexMarkers(google, map, points);
    setCoordinates(path.map(p => ({
      latitude: parseFloat(p.lat.toFixed(6)),
      longitude: parseFloat(p.lng.toFixed(6)),
    })));
  };

  const finishDrawing = () => {
    const google = window.google, map = mapInstanceRef.current;
    if (!google || !map) return false;

    const points = drawPointsRef.current;
    if (points.length < MIN_POINTS) {
      alert(`Please click at least ${MIN_POINTS} points on the map.`);
      return false;
    }

    if (polygonRef.current) { polygonRef.current.setMap(null); polygonRef.current = null; }
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
    pathMarkersRef.current?.forEach(m => m.setMap(null));
    pathMarkersRef.current = [];

    const ordered = orderPointsRadially(points);
    const coords = ordered.map(p => ({
      latitude: parseFloat(p.lat.toFixed(6)),
      longitude: parseFloat(p.lng.toFixed(6)),
    }));
    setCoordinates(coords);
    drawEditablePolygon(google, map, coords); // creates editable polygon + path listeners, NO markers
    initialPolygonDrawnRef.current = true;
    return true;
  };

  const drawEditablePolygon = (google, map, coords) => {
    const path = coords.map(c => new google.maps.LatLng(c.latitude, c.longitude));
    const polygon = new google.maps.Polygon({
      paths: path, 
      strokeColor: "#9333ea", 
      strokeOpacity: 0.8, 
      strokeWeight: 3,
      fillColor: "#9333ea", 
      fillOpacity: 0.35,
      editable: true, 
      draggable: false, 
      clickable: false,
    });
    polygon.setMap(map);
    polygonRef.current = polygon;
    pathMarkersRef.current = []; // IMPORTANT: no circle markers — they block the drag handles

    const sync = () => {
      const p = polygon.getPath();
      const out = [];
      p.forEach(ll => out.push({ latitude: parseFloat(ll.lat().toFixed(6)), longitude: parseFloat(ll.lng().toFixed(6)) }));
      setCoordinates(out);
      drawPointsRef.current = p.getArray();
    };
    const pp = polygon.getPath();
    google.maps.event.addListener(pp, 'set_at', sync);
    google.maps.event.addListener(pp, 'insert_at', sync);
    google.maps.event.addListener(pp, 'remove_at', sync);
  };

  const drawExistingPolygon = (google, map, coords) => {
    if (!coords || coords.length < 3) {
      debugLog("drawExistingPolygon: Not enough coordinates", coords?.length)
      return
    }

    debugLog("drawExistingPolygon: Drawing polygon with", coords.length, "coordinates")

    // Clear existing polygon
    if (polygonRef.current) {
      polygonRef.current.setMap(null)
    }

    // Clear existing markers
    if (pathMarkersRef.current && pathMarkersRef.current.length > 0) {
      pathMarkersRef.current.forEach(marker => marker.setMap(null))
      pathMarkersRef.current = []
    }

    // Convert coords array to LatLng array and populate drawPointsRef
    const googlePoints = coords.map(coord => {
      const lat = typeof coord === 'object' ? (coord.latitude || coord.lat) : null
      const lng = typeof coord === 'object' ? (coord.longitude || coord.lng) : null
      if (lat !== null && lng !== null) {
        return new google.maps.LatLng(lat, lng)
      }
      return null
    }).filter(Boolean)

    drawPointsRef.current = googlePoints

    // Fit map to polygon bounds
    const bounds = new google.maps.LatLngBounds()
    googlePoints.forEach(latLng => bounds.extend(latLng))
    map.fitBounds(bounds)
    debugLog("Map fitted to polygon bounds")

    // Draw editable polygon and sync coordinates
    drawEditablePolygon(google, map, coords)
  }

  const toggleDrawingMode = () => {
    const google = window.google, map = mapInstanceRef.current;
    if (!google || !map) { alert("Map is still loading."); return; }

    if (isDrawing) {                       // FINISH
      if (finishDrawing() === false) return; // not enough points → stay in drawing mode
      isDrawingRef.current = false;
      setIsDrawing(false);
      map.setOptions({ draggableCursor: null });
      existingZonesPolygonsRef.current.forEach(p => p?.setOptions?.({ clickable: true }));
    } else {                               // START
      clearDrawing();
      drawPointsRef.current = [];
      isDrawingRef.current = true;
      setIsDrawing(true);
      map.setOptions({ draggableCursor: 'crosshair' });
      // make other zones non-clickable so taps over them add points, not open info windows
      existingZonesPolygonsRef.current.forEach(p => p?.setOptions?.({ clickable: false }));
    }
  };

  const clearActivePolygon = () => {
    drawPointsRef.current = [];
    if (polygonRef.current) { polygonRef.current.setMap(null); polygonRef.current = null; }
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
    pathMarkersRef.current?.forEach(m => m.setMap(null));
    pathMarkersRef.current = [];
  };

  const clearDrawing = () => {
    clearActivePolygon();
    setCoordinates([]);
  };

  const exitDrawingMode = () => {
    isDrawingRef.current = false;
    setIsDrawing(false);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setOptions({ draggableCursor: null });
    }
    existingZonesPolygonsRef.current.forEach(p => p?.setOptions?.({ clickable: true }));
  };

  const applyGeneratedPolygon = (coords, locationMeta) => {
    const google = window.google;
    const map = mapInstanceRef.current;
    if (!google || !map) {
      alert("Map is still loading. Please wait and try again.");
      return;
    }

    if (!coords || coords.length < MIN_POINTS) {
      alert("Generated zone boundary is invalid. Please draw the zone manually.");
      return;
    }

    exitDrawingMode();
    clearActivePolygon();

    setCoordinates(coords);
    drawEditablePolygon(google, map, coords);

    const bounds = new google.maps.LatLngBounds();
    coords.forEach(coord => {
      bounds.extend(new google.maps.LatLng(coord.latitude, coord.longitude));
    });
    map.fitBounds(bounds);
    initialPolygonDrawnRef.current = true;

    if (locationMeta?.formattedAddress) {
      setLocationSearch(locationMeta.formattedAddress);
    }

    setFormData(prev => {
      const next = { ...prev };
      if (locationMeta?.country && prev.country === "India") {
        next.country = locationMeta.country === "India" ? "India" : prev.country;
      }
      if (locationMeta?.zoneName && !prev.zoneName.trim()) {
        next.zoneName = locationMeta.zoneName;
      }
      return next;
    });
  };

  const handleAutoGenerateFromLocation = async () => {
    if (mapLoading || autoGenerating) return;

    setAutoGenerateMessage({ type: "", text: "" });

    if (!window.google?.maps) {
      setAutoGenerateMessage({
        type: "error",
        text: "Google Maps is not ready yet. Please wait for the map to load.",
      });
      return;
    }

    try {
      setAutoGenerating(true);
      setAutoGenerateMessage({
        type: "info",
        text: "Detecting your location and fetching the city boundary...",
      });

      const result = await generateCityZoneFromCurrentLocation();
      applyGeneratedPolygon(result.coordinates, result.location);

      const cityLabel = result.location.city || result.location.zoneName || "your city";
      setAutoGenerateMessage({
        type: "success",
        text: `City zone generated for ${cityLabel}. You can edit the boundary on the map before saving.`,
      });
    } catch (error) {
      const message =
        error?.message ||
        "Failed to auto-generate the city zone. Please draw the zone manually.";
      setAutoGenerateMessage({ type: "error", text: message });
    } finally {
      setAutoGenerating(false);
    }
  };

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
      const overlapMessage = findZoneOverlapMessage(
        validCoordinates,
        existingZones,
        isEditMode ? id : null
      )
      if (overlapMessage) {
        alert(overlapMessage)
        setLoading(false)
        return
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
            <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
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
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="kilometer">
                        {formatUnitWithCoverage("kilometer", coverageAreaKm2)}
                      </option>
                      <option value="miles">
                        {formatUnitWithCoverage("miles", coverageAreaKm2)}
                      </option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1.5">
                      {coverageLabel
                        ? `${getUnitLabel(formData.unit)} · covers ${coverageLabel} based on drawn zone`
                        : "Draw the zone on the map to see coverage area with the unit"}
                    </p>
                  </div>

                </div>
              </div>
            </div>

            {/* Right Panel - Map */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Draw Zone on Map</h2>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleAutoGenerateFromLocation}
                    disabled={mapLoading || autoGenerating || loading}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {autoGenerating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <LocateFixed className="w-4 h-4" />
                        <span>Auto Generate City Zone</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={toggleDrawingMode}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      isDrawing
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "bg-blue-600 text-white hover:bg-blue-700"
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
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {autoGenerateMessage.text && (
                  <p
                    className={`text-xs mt-2 ${
                      autoGenerateMessage.type === "error"
                        ? "text-red-600"
                        : autoGenerateMessage.type === "success"
                          ? "text-emerald-700"
                          : "text-slate-600"
                    }`}
                  >
                    {autoGenerateMessage.text}
                  </p>
                )}
                {isDrawing && (
                  <p className="text-xs text-slate-600 mt-2">
                    Click on the map to add points (minimum {MIN_POINTS}), then click <strong>Stop Drawing</strong>.
                  </p>
                )}
                {coordinates.length > 0 && (
                  <p className="text-xs text-slate-600 mt-2">
                    Points drawn: <strong>{coordinates.length}</strong>
                    {coverageLabel && (
                      <span className="ml-2">
                        · Coverage: <strong>{coverageLabel}</strong>
                      </span>
                    )}
                    {coordinates.length < MIN_POINTS && (
                      <span className="text-red-600 ml-2">(Minimum {MIN_POINTS} points required)</span>
                    )}
                  </p>
                )}
              </div>

              <div className="relative" style={{ height: "600px" }}>
                <div ref={mapRef} className="w-full h-full rounded-lg" />
                
                {mapLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
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

                {mapError && !mapLoading && googleMapsApiKey && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg">
                    <div className="text-center p-6">
                      <MapPin className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-sm text-slate-600">{mapError}</p>
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
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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


