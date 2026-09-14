import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, Crosshair, Loader2, MapPin } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@food/components/ui/select"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { loadGoogleMaps } from "@core/services/googleMapsLoader"
import { toast } from "sonner"
import {
  ONBOARDING_HINT,
  ONBOARDING_INPUT,
  ONBOARDING_LABEL,
} from "./onboardingStyles"

const DEBOUNCE_MS = 450

const extractPincodeFromAddress = (formattedAddress = "") => {
  const match = String(formattedAddress || "").match(/\b\d{6}\b/)
  return match?.[0] || ""
}

const zonePolygonPath = (zone, google) => {
  if (!zone?.coordinates?.length) return []
  return zone.coordinates
    .map((coord) => {
      const lat = Number(coord?.latitude ?? coord?.lat)
      const lng = Number(coord?.longitude ?? coord?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return new google.maps.LatLng(lat, lng)
    })
    .filter(Boolean)
}

/** Empty string / null must not become 0 (Null Island) via Number(""). */
const parseMapCoord = (value) => {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const hasValidMapCoords = (lat, lng) =>
  lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)

const isLatLngInsideZone = (lat, lng, zone, google) => {
  if (!google?.maps?.geometry?.poly || !zone?.coordinates?.length) return false
  const path = zonePolygonPath(zone, google)
  if (path.length < 3) return false
  const polygon = new google.maps.Polygon({ paths: path })
  return google.maps.geometry.poly.containsLocation(
    new google.maps.LatLng(lat, lng),
    polygon,
  )
}

const parsePlaceDetails = (place) => {
  const formattedAddress = place?.formatted_address || ""
  const comps = Array.isArray(place?.address_components) ? place.address_components : []
  const get = (types) =>
    comps.find((c) => types.some((t) => c.types?.includes(t)))?.long_name || ""
  const area =
    get(["sublocality_level_1", "sublocality", "neighborhood"]) || get(["locality"])
  const city = get(["locality"]) || get(["administrative_area_level_2"])
  const state = get(["administrative_area_level_1"])
  const pincode = get(["postal_code"]) || extractPincodeFromAddress(formattedAddress)
  const lat = place?.geometry?.location?.lat?.()
  const lng = place?.geometry?.location?.lng?.()
  return {
    formattedAddress,
    area,
    city,
    state,
    pincode,
    latitude: Number.isFinite(lat) ? Number(lat.toFixed(6)) : "",
    longitude: Number.isFinite(lng) ? Number(lng.toFixed(6)) : "",
  }
}

const parseGeocoderResult = (result) => {
  if (!result) return null
  const comps = result.address_components || []
  const get = (types) =>
    comps.find((c) => types.some((t) => c.types?.includes(t)))?.long_name || ""
  const formattedAddress = result.formatted_address || ""
  return {
    formattedAddress,
    area:
      get(["sublocality_level_1", "sublocality", "neighborhood"]) || get(["locality"]),
    city: get(["locality"]) || get(["administrative_area_level_2"]),
    state: get(["administrative_area_level_1"]),
    pincode: get(["postal_code"]) || extractPincodeFromAddress(formattedAddress),
  }
}

function useDebouncedCallback(fn, delay) {
  const timerRef = useRef(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return useCallback(
    (...args) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => fnRef.current(...args), delay)
    },
    [delay],
  )
}

export default function OnboardingLocationSection({
  zoneId,
  zones,
  zonesLoading,
  isEditing,
  location,
  onZoneChange,
  onLocationChange,
  zoneError = "",
  locationError = "",
}) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const zonePolygonRef = useRef(null)
  const autocompleteServiceRef = useRef(null)
  const placesServiceRef = useRef(null)
  const geocoderRef = useRef(null)
  const sessionTokenRef = useRef(null)
  const handleCoordsSelectedRef = useRef(null)
  const locationRef = useRef(location)
  const isEditingRef = useRef(isEditing)
  locationRef.current = location
  isEditingRef.current = isEditing

  const [mapLoading, setMapLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState(location?.formattedAddress || "")
  const [predictions, setPredictions] = useState([])
  const [showPredictions, setShowPredictions] = useState(false)
  const [fetchingPredictions, setFetchingPredictions] = useState(false)
  const [locationOutsideZone, setLocationOutsideZone] = useState(false)
  const [locating, setLocating] = useState(false)
  const [pickedFromSuggestion, setPickedFromSuggestion] = useState(
    () => hasValidMapCoords(parseMapCoord(location?.latitude), parseMapCoord(location?.longitude)),
  )

  const selectedZone = zones.find((z) => String(z._id || z.id) === String(zoneId))
  const zoneSelected = Boolean(zoneId)
  const locationFieldsDisabled = !zoneSelected || !isEditing

  const applyLocation = useCallback(
    (parsed, { fromSuggestion = false, outsideZone = false } = {}) => {
      setLocationOutsideZone(outsideZone)
      setPickedFromSuggestion(fromSuggestion && !outsideZone)
      onLocationChange({
        ...parsed,
        outsideZone,
        fromSuggestion: fromSuggestion && !outsideZone,
      })
    },
    [onLocationChange],
  )

  const updateMarker = useCallback((lat, lng, google) => {
    if (!mapInstanceRef.current || !google) return
    const position = { lat, lng }

    if (markerRef.current) {
      markerRef.current.setPosition(position)
    } else {
      markerRef.current = new google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        draggable: true,
        animation: google.maps.Animation.DROP,
      })

      markerRef.current.addListener("dragend", (event) => {
        handleCoordsSelectedRef.current?.(event.latLng.lat(), event.latLng.lng(), {
          fromDrag: true,
        })
      })
    }

    mapInstanceRef.current.panTo(position)
  }, [])

  const handleCoordsSelected = useCallback(
    async (lat, lng, { fromDrag = false } = {}) => {
      if (!selectedZone || !window.google) return

      const outsideZone = !isLatLngInsideZone(lat, lng, selectedZone, window.google)
      if (outsideZone) {
        setLocationOutsideZone(true)
        setPickedFromSuggestion(false)
        toast.error("Selected location is outside the selected service zone")
        onLocationChange({ outsideZone: true, fromSuggestion: false })
        const prev = locationRef.current
        if (fromDrag && markerRef.current && prev?.latitude && prev?.longitude) {
          markerRef.current.setPosition({
            lat: Number(prev.latitude),
            lng: Number(prev.longitude),
          })
        }
        return
      }

      setLocationOutsideZone(false)

      if (!geocoderRef.current) {
        geocoderRef.current = new window.google.maps.Geocoder()
      }

      geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
        if (status !== "OK" || !results?.[0]) return
        const parsed = parseGeocoderResult(results[0])
        setSearchQuery(parsed.formattedAddress || "")
        setShowPredictions(false)
        setPredictions([])
        applyLocation(
          {
            formattedAddress: parsed.formattedAddress,
            addressLine1: parsed.formattedAddress || "",
            area: parsed.area || "",
            city: parsed.city || "",
            state: parsed.state || "",
            pincode: parsed.pincode || "",
            latitude: Number(lat.toFixed(6)),
            longitude: Number(lng.toFixed(6)),
          },
          { fromSuggestion: true, outsideZone: false },
        )
        updateMarker(lat, lng, window.google)
      })
    },
    [selectedZone, applyLocation, onLocationChange, updateMarker],
  )

  handleCoordsSelectedRef.current = handleCoordsSelected

  const drawZonePolygon = useCallback(
    (google, map) => {
      if (zonePolygonRef.current) {
        zonePolygonRef.current.setMap(null)
        zonePolygonRef.current = null
      }
      if (!selectedZone) return

      const path = zonePolygonPath(selectedZone, google)
      if (path.length < 3) return

      zonePolygonRef.current = new google.maps.Polygon({
        paths: path,
        strokeColor: "#FF0000",
        strokeOpacity: 0.85,
        strokeWeight: 2,
        fillColor: "#FF0000",
        fillOpacity: 0.12,
        clickable: false,
        zIndex: 1,
      })
      zonePolygonRef.current.setMap(map)

      const bounds = new google.maps.LatLngBounds()
      path.forEach((p) => bounds.extend(p))
      map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 })
    },
    [selectedZone],
  )

  const initMap = useCallback(async () => {
    if (!mapContainerRef.current || !zoneSelected) return

    try {
      setMapLoading(true)
      const apiKey = await getGoogleMapsApiKey()
      if (!apiKey) {
        setMapLoading(false)
        return
      }

      await loadGoogleMaps(apiKey)

      if (!window.google?.maps || !mapContainerRef.current) {
        setMapLoading(false)
        return
      }

      const google = window.google
      const center = { lat: 20.5937, lng: 78.9629 }

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new google.maps.Map(mapContainerRef.current, {
          center,
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          gestureHandling: "greedy",
        })

        mapInstanceRef.current.addListener("click", (event) => {
          if (!isEditingRef.current || !zoneSelected) return
          handleCoordsSelectedRef.current?.(event.latLng.lat(), event.latLng.lng())
        })
      }

      autocompleteServiceRef.current = new google.maps.places.AutocompleteService()
      placesServiceRef.current = new google.maps.places.PlacesService(mapInstanceRef.current)
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken()

      drawZonePolygon(google, mapInstanceRef.current)

      const lat = parseMapCoord(locationRef.current?.latitude)
      const lng = parseMapCoord(locationRef.current?.longitude)
      if (hasValidMapCoords(lat, lng)) {
        updateMarker(lat, lng, google)
        mapInstanceRef.current.setCenter({ lat, lng })
        mapInstanceRef.current.setZoom(16)
      } else if (markerRef.current) {
        // Zone picked but no pin yet — don't leave a leftover pin at 0,0 / prior zone.
        markerRef.current.setMap(null)
        markerRef.current = null
      }

      setMapLoading(false)
    } catch {
      setMapLoading(false)
    }
  }, [zoneSelected, drawZonePolygon, updateMarker])

  useEffect(() => {
    if (!zoneSelected) {
      setMapLoading(false)
      return
    }
    initMap()
  }, [zoneSelected, initMap])

  useEffect(() => {
    if (mapInstanceRef.current && window.google && selectedZone) {
      drawZonePolygon(window.google, mapInstanceRef.current)
    }
  }, [selectedZone, drawZonePolygon])

  useEffect(() => {
    setSearchQuery(location?.formattedAddress || "")
    const lat = parseMapCoord(location?.latitude)
    const lng = parseMapCoord(location?.longitude)
    if (hasValidMapCoords(lat, lng) && selectedZone && window.google) {
      const outside = !isLatLngInsideZone(lat, lng, selectedZone, window.google)
      setLocationOutsideZone(outside)
      if (mapInstanceRef.current) {
        updateMarker(lat, lng, window.google)
      }
    } else if (!hasValidMapCoords(lat, lng) && markerRef.current) {
      markerRef.current.setMap(null)
      markerRef.current = null
      setLocationOutsideZone(false)
      setPickedFromSuggestion(false)
    }
  }, [location?.formattedAddress, location?.latitude, location?.longitude, selectedZone, updateMarker])

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setDraggable(Boolean(isEditing && zoneSelected))
    }
  }, [isEditing, zoneSelected])

  const fetchPredictions = useDebouncedCallback((input) => {
    if (!input?.trim() || !zoneSelected || !window.google?.maps?.places) {
      setPredictions([])
      setFetchingPredictions(false)
      return
    }

    if (!autocompleteServiceRef.current) {
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService()
    }
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken()
    }

    autocompleteServiceRef.current.getPlacePredictions(
      {
        input: input.trim(),
        componentRestrictions: { country: "in" },
        sessionToken: sessionTokenRef.current,
      },
      (results, status) => {
        setFetchingPredictions(false)
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results?.length) {
          setPredictions([])
          return
        }
        setPredictions(results.slice(0, 5))
        setShowPredictions(true)
      },
    )
  }, DEBOUNCE_MS)

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchQuery(value)
    setPickedFromSuggestion(false)
    setLocationOutsideZone(false)

    if (!value.trim()) {
      setPredictions([])
      setShowPredictions(false)
      setFetchingPredictions(false)
      return
    }

    setFetchingPredictions(true)
    fetchPredictions(value)
  }

  const handlePredictionSelect = (prediction) => {
    if (!placesServiceRef.current || !prediction?.place_id) return

    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ["formatted_address", "address_components", "geometry"],
        sessionToken: sessionTokenRef.current,
      },
      (place, status) => {
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken()
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place?.geometry) {
          toast.error("Could not load location details. Please try again.")
          return
        }

        const parsed = parsePlaceDetails(place)
        if (!parsed.latitude || !parsed.longitude) {
          toast.error("Invalid location. Please pick another address.")
          return
        }

        const outsideZone = !isLatLngInsideZone(
          parsed.latitude,
          parsed.longitude,
          selectedZone,
          window.google,
        )

        if (outsideZone) {
          setSearchQuery("")
          setPredictions([])
          setShowPredictions(false)
          setLocationOutsideZone(true)
          setPickedFromSuggestion(false)
          toast.error("Selected address is outside the selected service zone")
          onLocationChange({ outsideZone: true, fromSuggestion: false })
          return
        }

        setSearchQuery(parsed.formattedAddress || prediction.description || "")
        setPredictions([])
        setShowPredictions(false)
        applyLocation(
          {
            formattedAddress: parsed.formattedAddress,
            addressLine1: parsed.formattedAddress || "",
            area: parsed.area || "",
            city: parsed.city || "",
            state: parsed.state || "",
            pincode: parsed.pincode || "",
            latitude: parsed.latitude,
            longitude: parsed.longitude,
          },
          { fromSuggestion: true, outsideZone: false },
        )
        updateMarker(parsed.latitude, parsed.longitude, window.google)
        mapInstanceRef.current?.setZoom(17)
      },
    )
  }

  const handleZoneSelect = (value) => {
    setSearchQuery("")
    setPredictions([])
    setShowPredictions(false)
    setLocationOutsideZone(false)
    setPickedFromSuggestion(false)
    if (markerRef.current) {
      markerRef.current.setMap(null)
      markerRef.current = null
    }
    onZoneChange(value)
  }

  const handleUseCurrentLocation = () => {
    if (!zoneSelected || !isEditing || locating) return

    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported on this device")
      return
    }

    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        handleCoordsSelected(position.coords.latitude, position.coords.longitude)
      },
      (error) => {
        setLocating(false)
        const message =
          error?.code === error.PERMISSION_DENIED
            ? "Location permission denied. Please allow access in your browser settings."
            : "Could not detect your current location. Please try again."
        toast.error(message)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  const zoneTriggerClass = zoneError
    ? `${ONBOARDING_INPUT} h-11 border-red-400 ring-2 ring-red-200`
    : `${ONBOARDING_INPUT} h-11`

  return (
    <div className="space-y-4">
      <div>
        <Label className={ONBOARDING_LABEL}>Service zone*</Label>
        <Select
          value={zoneId || ""}
          onValueChange={handleZoneSelect}
          disabled={zonesLoading || !isEditing}
        >
          <SelectTrigger className={zoneTriggerClass}>
            <SelectValue
              placeholder={zonesLoading ? "Loading zones..." : "Select a service zone"}
            />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {zones.map((z) => {
              const id = String(z?._id || z?.id || "")
              const label = z?.name || z?.zoneName || z?.serviceLocation || id
              return (
                <SelectItem key={id} value={id} className="cursor-pointer">
                  {label}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        {zoneError ? (
          <p className="mt-1.5 text-xs font-medium text-red-600">{zoneError}</p>
        ) : (
          <p className={`${ONBOARDING_HINT} mt-2`}>
            Choose the service zone where your restaurant will be available.
          </p>
        )}
      </div>

      <div>
        <Label className={ONBOARDING_LABEL}>Search location</Label>
        {!zoneSelected && (
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Please select a service zone first to search and pin your location.
          </p>
        )}
        <div className="relative">
          <Input
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => predictions.length > 0 && setShowPredictions(true)}
            onBlur={() => window.setTimeout(() => setShowPredictions(false), 200)}
            disabled={locationFieldsDisabled}
            className={`${ONBOARDING_INPUT} pr-10 text-slate-900 placeholder:text-slate-400 caret-[#FF0000] disabled:cursor-not-allowed disabled:opacity-60`}
            placeholder={
              zoneSelected
                ? "Start typing your restaurant address..."
                : "Select service zone first"
            }
          />
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            {fetchingPredictions ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            ) : (
              <MapPin className="h-4 w-4 text-slate-400" />
            )}
          </div>

          {showPredictions && predictions.length > 0 && (
            <ul className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              {predictions.map((p) => (
                <li key={p.place_id}>
                  <button
                    type="button"
                    className="w-full cursor-pointer px-4 py-2.5 text-left text-sm text-slate-800 transition-colors hover:bg-slate-50"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handlePredictionSelect(p)}
                  >
                    {p.description}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {locationOutsideZone && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-red-600">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Selected location is outside the selected service zone. Pin a location inside the highlighted area.</span>
          </p>
        )}
        {pickedFromSuggestion && !locationOutsideZone && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-emerald-700">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Location confirmed inside the service zone.</span>
          </p>
        )}
        {zoneSelected && !locationOutsideZone && !pickedFromSuggestion && (
          <p className={`${ONBOARDING_HINT} mt-2`}>
            Search an address or tap on the map below to pin your restaurant location inside the zone.
          </p>
        )}
      </div>

      {zoneSelected && (
        <div className={`overflow-hidden rounded-xl border bg-slate-100 ${locationError ? "border-red-300 ring-2 ring-red-100" : "border-slate-200"}`}>
          <div className="border-b border-slate-200 bg-white px-3 py-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-700">
                  Pin location on map
                  {selectedZone?.name || selectedZone?.zoneName ? (
                    <span className="ml-1 font-normal text-slate-500">
                      — {selectedZone.name || selectedZone.zoneName}
                    </span>
                  ) : null}
                </p>
                <p className="text-[11px] text-slate-500">
                  Red area shows the admin-defined service zone. Your pin must be inside it.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!isEditing || locating}
                onClick={handleUseCurrentLocation}
                className="h-8 shrink-0 rounded-full border-slate-200 px-3 text-[11px] font-semibold"
              >
                {locating ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Crosshair className="mr-1.5 h-3.5 w-3.5" />
                )}
                {locating ? "Locating..." : "Use current location"}
              </Button>
            </div>
          </div>
          <div className="relative h-[280px] w-full sm:h-[320px]">
            <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />
            {mapLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80">
                <Loader2 className="h-8 w-8 animate-spin text-[#FF0000]" />
              </div>
            )}
          </div>
          {locationError ? (
            <p className="border-t border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              {locationError}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
