import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { MapPin, ArrowLeft, Save, X, Hand, Shapes, Search, Ruler } from "lucide-react"
import { adminApi } from "../services/adminApi"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { Loader } from "@googlemaps/js-api-loader"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

// --- Distance-based ("radius") zone helpers ---
// A radius zone is still saved as a plain polygon (coordinates array), so every
// existing zone list/map/panel that reads `coordinates` keeps working unchanged.

const EARTH_RADIUS_METERS = 6371000
const KM_PER_MILE = 1.609344

const toRadians = (deg) => (deg * Math.PI) / 180
const toDegrees = (rad) => (rad * 180) / Math.PI

const calculateCentroid = (coords) => {
  if (!coords || coords.length === 0) return { latitude: 0, longitude: 0 }
  let latSum = 0
  let lngSum = 0
  coords.forEach((c) => {
    latSum += c.latitude
    lngSum += c.longitude
  })
  return { latitude: latSum / coords.length, longitude: lngSum / coords.length }
}

const haversineDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const destinationPoint = (lat, lng, bearingDeg, distanceMeters) => {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS
  const bearingRad = toRadians(bearingDeg)
  const lat1 = toRadians(lat)
  const lng1 = toRadians(lng)

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad)
  )
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    )

  return { latitude: toDegrees(lat2), longitude: toDegrees(lng2) }
}

const generateCirclePolygon = (centerLat, centerLng, radiusMeters, sides = 20) => {
  const points = []
  for (let i = 0; i < sides; i++) {
    points.push(destinationPoint(centerLat, centerLng, (360 / sides) * i, radiusMeters))
  }
  return points
}

// Approximate area of a small geographic polygon (equirectangular projection + shoelace).
const polygonAreaMeters = (coords) => {
  if (!coords || coords.length < 3) return 0
  const refLat = toRadians(coords.reduce((sum, c) => sum + c.latitude, 0) / coords.length)
  const projected = coords.map((c) => ({
    x: EARTH_RADIUS_METERS * toRadians(c.longitude) * Math.cos(refLat),
    y: EARTH_RADIUS_METERS * toRadians(c.latitude),
  }))
  let area = 0
  for (let i = 0; i < projected.length; i++) {
    const p1 = projected[i]
    const p2 = projected[(i + 1) % projected.length]
    area += p1.x * p2.y - p2.x * p1.y
  }
  return Math.abs(area / 2)
}

const metersFromDistance = (value, unit) => {
  const num = parseFloat(value)
  if (!num || num <= 0) return 0
  return unit === "miles" ? num * KM_PER_MILE * 1000 : num * 1000
}

const distanceFromMeters = (meters, unit) => {
  const km = meters / 1000
  const value = unit === "miles" ? km / KM_PER_MILE : km
  return Math.round(value * 100) / 100
}

const formatArea = (areaMetersSq, unit) => {
  if (!areaMetersSq || areaMetersSq <= 0) return null
  if (unit === "miles") {
    return `${(areaMetersSq / (1609.344 * 1609.344)).toFixed(2)} mi²`
  }
  return `${(areaMetersSq / 1_000_000).toFixed(2)} km²`
}

// Detect whether a saved polygon looks like it was generated from a circle
// (near-uniform radius from centroid) so edit mode can restore radius-editing UX.
const detectCircle = (coords) => {
  if (!coords || coords.length < 8) return null
  const centroid = calculateCentroid(coords)
  const radii = coords.map((c) =>
    haversineDistanceMeters(centroid.latitude, centroid.longitude, c.latitude, c.longitude)
  )
  const avgRadius = radii.reduce((sum, r) => sum + r, 0) / radii.length
  if (avgRadius <= 0) return null
  const maxDeviation = Math.max(...radii.map((r) => Math.abs(r - avgRadius)))
  if (maxDeviation / avgRadius > 0.05) return null
  return { center: centroid, radiusMeters: avgRadius }
}

export default function AddZone() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = !!id && !window.location.pathname.includes('/view/')
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const polygonRef = useRef(null)
  const circleRef = useRef(null)
  const circleGeometryRef = useRef(null) // { center: {lat,lng}, radiusMeters }
  const savedCircleMetaRef = useRef(null) // exact circle data from a loaded zone, if any
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
  const [radiusMode, setRadiusMode] = useState(false)
  const [distanceValue, setDistanceValue] = useState("")
  const [isCircleZone, setIsCircleZone] = useState(false)
  const [areaCovered, setAreaCovered] = useState(null)
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

  // Draw existing polygon (or circle) when in edit mode and coordinates are loaded.
  // Polls until the map instance is actually ready rather than trusting the
  // `mapLoading` state flip to be synchronized with `mapInstanceRef.current`.
  const hasDrawnInitialPolygonRef = useRef(false)

  useEffect(() => {
    if (!isEditMode || coordinates.length < 3 || hasDrawnInitialPolygonRef.current) return

    let cancelled = false
    let attempts = 0

    const tryDraw = () => {
      if (cancelled || hasDrawnInitialPolygonRef.current) return
      if (!mapInstanceRef.current || !window.google) {
        if (++attempts > 50) return // ~10s, give up
        setTimeout(tryDraw, 200)
        return
      }

      debugLog("Drawing existing polygon in edit mode, coordinates:", coordinates.length)
      hasDrawnInitialPolygonRef.current = true
      setIsDrawing(false)
      setRadiusMode(false)

      // Prefer the exact saved circle (center/radiusMeters) over reverse-engineering
      // it from the polygon approximation; only fall back to detectCircle for
      // legacy zones saved before shapeType/center/radiusMeters existed.
      const savedCircle = savedCircleMetaRef.current
      const circleInfo = savedCircle
        ? { center: { latitude: savedCircle.center.lat, longitude: savedCircle.center.lng }, radiusMeters: savedCircle.radiusMeters }
        : detectCircle(coordinates)
      if (circleInfo) {
        const center = new window.google.maps.LatLng(circleInfo.center.latitude, circleInfo.center.longitude)
        renderEditableCircle(center, circleInfo.radiusMeters)
        const bounds = new window.google.maps.LatLngBounds()
        generateCirclePolygon(circleInfo.center.latitude, circleInfo.center.longitude, circleInfo.radiusMeters, 8)
          .forEach((p) => bounds.extend(new window.google.maps.LatLng(p.latitude, p.longitude)))
        mapInstanceRef.current.fitBounds(bounds)
      } else {
        drawExistingPolygon(window.google, mapInstanceRef.current, coordinates)
      }
    }

    tryDraw()
    return () => { cancelled = true }
  }, [isEditMode, coordinates])


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

        if (zoneData.shapeType === 'circle' && zoneData.center && Number.isFinite(zoneData.radiusMeters)) {
          savedCircleMetaRef.current = {
            center: { lat: zoneData.center.latitude, lng: zoneData.center.longitude },
            radiusMeters: zoneData.radiusMeters
          }
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

  const syncFromCircle = () => {
    const circle = circleRef.current
    if (!circle) return
    const center = circle.getCenter()
    const radiusMeters = circle.getRadius()
    if (!center || !radiusMeters) return

    circleGeometryRef.current = { center: { lat: center.lat(), lng: center.lng() }, radiusMeters }
    setCoordinates(generateCirclePolygon(center.lat(), center.lng(), radiusMeters))
    setDistanceValue(String(distanceFromMeters(radiusMeters, formData.unit)))
  }

  const renderEditableCircle = (center, radiusMeters) => {
    if (!mapInstanceRef.current || !window.google) return

    if (polygonRef.current) {
      polygonRef.current.setMap(null)
      polygonRef.current = null
    }
    if (previewPolygonRef.current) {
      previewPolygonRef.current.setMap(null)
      previewPolygonRef.current = null
    }
    if (circleRef.current) {
      circleRef.current.setMap(null)
      circleRef.current = null
    }
    tempMarkersRef.current.forEach(removeMarkerFromMap)
    tempMarkersRef.current = []

    const circle = new window.google.maps.Circle({
      center,
      radius: radiusMeters,
      strokeColor: "#9333ea",
      strokeOpacity: 0.8,
      strokeWeight: 3,
      fillColor: "#9333ea",
      fillOpacity: 0.35,
      editable: true,
      draggable: true,
      clickable: true,
      map: mapInstanceRef.current
    })

    circleRef.current = circle
    setIsCircleZone(true)

    window.google.maps.event.addListener(circle, 'radius_changed', syncFromCircle)
    window.google.maps.event.addListener(circle, 'center_changed', syncFromCircle)

    syncFromCircle()
  }

  const removeMarkerFromMap = (marker) => {
    if (!marker) return
    if (marker.setMap) {
      marker.setMap(null)
    } else {
      marker.map = null
    }
  }

  const getCoordinatesFromMarkers = () => {
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
    return coords
  }

  const updatePreviewPath = () => {
    if (!window.google) return
    const rawCoords = getCoordinatesFromMarkers()
    if (rawCoords.length < 2) {
      if (previewPolygonRef.current) {
        previewPolygonRef.current.setMap(null)
        previewPolygonRef.current = null
      }
      return
    }

    const coords = radialSort(rawCoords)
    const path = coords.map(c => new window.google.maps.LatLng(c.latitude, c.longitude))

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
  }

  const setupPolygonListeners = (polygon) => {
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
  }

  const finishDrawing = () => {
    setIsDrawing(false)
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setOptions({ draggableCursor: null })
    }
    
    existingZonesPolygonsRef.current.forEach(polygon => {
      if (polygon) polygon.setOptions({ clickable: true })
    })

    const coords = getCoordinatesFromMarkers()
    if (coords.length >= 3) {
      const sortedCoords = radialSort(coords)
      const path = sortedCoords.map(c => new window.google.maps.LatLng(c.latitude, c.longitude))
      
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
      setCoordinates(sortedCoords)
    }

    tempMarkersRef.current.forEach(removeMarkerFromMap)
    tempMarkersRef.current = []
    if (previewPolygonRef.current) {
      previewPolygonRef.current.setMap(null)
      previewPolygonRef.current = null
    }
  }

  const MAX_ZONE_POINTS = 20

  const handleMapClick = (e) => {
    if (!window.google) return
    if (tempMarkersRef.current.length >= MAX_ZONE_POINTS) {
      alert(`Maximum ${MAX_ZONE_POINTS} points allowed per zone. Click "Stop Drawing" to finish, or remove a point (right-click) first.`)
      return
    }
    const latLng = e.latLng
    const title = `Point ${tempMarkersRef.current.length + 1}`
    let marker

    if (window.google.maps.marker?.AdvancedMarkerElement) {
      const pinElement = document.createElement('div')
      pinElement.style.width = '16px'
      pinElement.style.height = '16px'
      pinElement.style.backgroundColor = '#FE5502'
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
          fillColor: "#FE5502",
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
      const coords = getCoordinatesFromMarkers()
      setCoordinates(radialSort(coords))
    })

    marker.addListener('click', () => {
      if (tempMarkersRef.current[0] === marker && tempMarkersRef.current.length >= 3) {
        finishDrawing()
      }
    })

    marker.addListener('rightclick', () => {
      removeMarkerFromMap(marker)
      tempMarkersRef.current = tempMarkersRef.current.filter(m => m !== marker)
      tempMarkersRef.current.forEach((m, idx) => {
        const markerTitle = `Point ${idx + 1}`
        if (m.setTitle) {
          m.setTitle(markerTitle)
        } else {
          m.title = markerTitle
        }
      })
      updatePreviewPath()
      const coords = getCoordinatesFromMarkers()
      setCoordinates(radialSort(coords))
    })

    tempMarkersRef.current.push(marker)
    updatePreviewPath()
    
    const coords = getCoordinatesFromMarkers()
    setCoordinates(radialSort(coords))
  }

  // Handle start/stop drawing state changes
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return
    let mapClickListener = null
    if (isDrawing) {
      mapInstanceRef.current.setOptions({ draggableCursor: 'crosshair' })
      mapClickListener = mapInstanceRef.current.addListener('click', handleMapClick)
    } else {
      mapInstanceRef.current.setOptions({ draggableCursor: null })
    }
    return () => {
      if (mapClickListener) {
        window.google.maps.event.removeListener(mapClickListener)
      }
    }
  }, [isDrawing])

  useEffect(() => {
    existingZonesPolygonsRef.current.forEach(poly => {
      if (poly) poly.setOptions({ clickable: !isDrawing && !radiusMode })
    })
  }, [isDrawing, radiusMode])

  // Add/remove map click listener for placing a distance-based (circle) zone
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return

    let clickListener = null

    if (radiusMode) {
      mapInstanceRef.current.setOptions({ draggableCursor: 'crosshair' })
      clickListener = mapInstanceRef.current.addListener('click', (event) => {
        const radiusMeters = metersFromDistance(distanceValue, formData.unit)
        if (!radiusMeters) {
          alert("Please enter a valid distance first.")
          return
        }
        renderEditableCircle(event.latLng, radiusMeters)
        setRadiusMode(false)
      })
    } else if (!isDrawing) {
      mapInstanceRef.current.setOptions({ draggableCursor: null })
    }

    return () => {
      if (clickListener) {
        window.google.maps.event.removeListener(clickListener)
      }
    }
  }, [radiusMode, distanceValue, formData.unit])

  // Keep the displayed distance in sync with the selected unit (km/miles) without
  // changing the actual circle geometry (which is always stored in meters).
  useEffect(() => {
    if (isCircleZone && circleGeometryRef.current) {
      setDistanceValue(String(distanceFromMeters(circleGeometryRef.current.radiusMeters, formData.unit)))
    }
  }, [formData.unit])

  // Compute the covered area for whatever shape is currently on the map
  // (exact for circles, approximated via shoelace formula for hand-drawn polygons).
  useEffect(() => {
    let areaMeters = 0
    if (isCircleZone && circleGeometryRef.current) {
      areaMeters = Math.PI * circleGeometryRef.current.radiusMeters ** 2
    } else if (coordinates.length >= 3) {
      areaMeters = polygonAreaMeters(coordinates)
    }
    setAreaCovered(formatArea(areaMeters, formData.unit))
  }, [coordinates, formData.unit, isCircleZone])

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

  const clearDrawing = () => {
    if (polygonRef.current) {
      polygonRef.current.setMap(null)
      polygonRef.current = null
    }
    if (previewPolygonRef.current) {
      previewPolygonRef.current.setMap(null)
      previewPolygonRef.current = null
    }
    if (circleRef.current) {
      circleRef.current.setMap(null)
      circleRef.current = null
    }
    tempMarkersRef.current.forEach(removeMarkerFromMap)
    tempMarkersRef.current = []
    setCoordinates([])
    setIsCircleZone(false)
    circleGeometryRef.current = null
    savedCircleMetaRef.current = null
    setDistanceValue("")
  }

  const toggleDrawingMode = () => {
    if (isDrawing) {
      if (tempMarkersRef.current.length >= 3) {
        finishDrawing()
      } else {
        alert("Please draw at least 3 points before stopping, or clear.")
      }
    } else {
      setRadiusMode(false)
      clearDrawing()
      setIsDrawing(true)
    }
  }

  const toggleRadiusMode = () => {
    if (radiusMode) {
      setRadiusMode(false)
      return
    }
    // Don't clear the existing circle/polygon yet — only replace it once a new
    // point is actually placed, so cancelling doesn't lose the current shape.
    setIsDrawing(false)
    setRadiusMode(true)
  }

  const handleDistanceInputChange = (e) => {
    const value = e.target.value
    setDistanceValue(value)
    if (circleRef.current && value) {
      const radiusMeters = metersFromDistance(value, formData.unit)
      if (radiusMeters > 0) {
        circleRef.current.setRadius(radiusMeters)
      }
    }
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
        isActive: true,
        ...(isCircleZone && circleGeometryRef.current
          ? {
              shapeType: "circle",
              center: {
                latitude: circleGeometryRef.current.center.lat,
                longitude: circleGeometryRef.current.center.lng
              },
              radiusMeters: circleGeometryRef.current.radiusMeters
            }
          : { shapeType: "polygon" })
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
            <div className="w-10 h-10 rounded-lg bg-[#FE5502] flex items-center justify-center">
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

                  {/* Distance-based (radius) zone creation */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Zone Radius (optional)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={distanceValue}
                        onChange={handleDistanceInputChange}
                        placeholder={`e.g. 5`}
                        className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={toggleRadiusMode}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                          radiusMode
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "bg-primary text-white hover:bg-primary/90"
                        }`}
                      >
                        <Ruler className="w-4 h-4" />
                        <span>{radiusMode ? "Cancel" : isCircleZone ? "Move" : "Set on Map"}</span>
                      </button>
                    </div>
                    {radiusMode && (
                      <p className="text-xs text-primary mt-2">
                        Click a point on the map to place a {distanceValue || "..."}{" "}
                        {formData.unit === "miles" ? "mi" : "km"} zone.
                      </p>
                    )}
                    {isCircleZone && !radiusMode && (
                      <p className="text-xs text-slate-500 mt-2">
                        Drag the circle to move it, or drag its edge to resize.
                      </p>
                    )}
                    {areaCovered && (
                      <p className="text-sm text-slate-700 mt-2">
                        Area covered: <strong>{areaCovered}</strong>
                      </p>
                    )}
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
                    {isCircleZone ? (
                      <>Circle zone — radius <strong>{distanceValue} {formData.unit === "miles" ? "mi" : "km"}</strong></>
                    ) : (
                      <>
                        Points drawn: <strong>{coordinates.length}</strong>
                        {coordinates.length < 3 && (
                          <span className="text-red-600 ml-2">(Minimum 3 points required)</span>
                        )}
                      </>
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


