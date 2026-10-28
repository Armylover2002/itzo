import { useEffect, useRef, useState } from "react"
import { Loader2, MapPin, Search } from "lucide-react"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { loadGoogleMaps } from "@core/services/googleMapsLoader"

const DEFAULT_LAT = 22.7196
const DEFAULT_LNG = 75.8577

/**
 * Compact search-box + draggable-pin map picker, same Google Maps flow as the
 * restaurant's own "Edit outlet address" page — used wherever a hub owner
 * needs to pin a franchise outlet's location.
 */
export default function OutletLocationPicker({ value, onChange }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const autocompleteInputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const isMapInitializedRef = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const [mapLoading, setMapLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState(value?.formattedAddress || "")

  const updateMarker = (lat, lng) => {
    const google = window.google
    if (!google || !mapInstanceRef.current) return

    if (markerRef.current) {
      markerRef.current.setPosition({ lat, lng })
    } else {
      markerRef.current = new google.maps.Marker({
        position: { lat, lng },
        map: mapInstanceRef.current,
        draggable: true,
        animation: google.maps.Animation.DROP,
      })
      markerRef.current.addListener("dragend", (event) => {
        handleCoordsSelected(event.latLng.lat(), event.latLng.lng())
      })
    }
    mapInstanceRef.current.panTo({ lat, lng })
  }

  const handleCoordsSelected = (lat, lng) => {
    onChangeRef.current?.({ latitude: lat, longitude: lng, formattedAddress: searchQuery })
    if (!window.google?.maps?.Geocoder) return
    const geocoder = new window.google.maps.Geocoder()
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        const formatted = results[0].formatted_address
        setSearchQuery(formatted)
        onChangeRef.current?.({ latitude: lat, longitude: lng, formattedAddress: formatted })
      }
    })
  }

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const apiKey = await getGoogleMapsApiKey()
      if (!apiKey || cancelled) {
        setMapLoading(false)
        return
      }
      const maps = await loadGoogleMaps(apiKey)
      if (!maps || !window.google?.maps || cancelled || !mapRef.current) {
        setMapLoading(false)
        return
      }
      if (isMapInitializedRef.current) return
      isMapInitializedRef.current = true

      const startLat = Number(value?.latitude) || DEFAULT_LAT
      const startLng = Number(value?.longitude) || DEFAULT_LNG

      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: startLat, lng: startLng },
        zoom: value?.latitude ? 16 : 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        gestureHandling: "greedy",
      })
      mapInstanceRef.current = map

      map.addListener("click", (event) => {
        handleCoordsSelected(event.latLng.lat(), event.latLng.lng())
      })

      if (value?.latitude && value?.longitude) {
        updateMarker(Number(value.latitude), Number(value.longitude))
      }

      if (autocompleteInputRef.current && window.google.maps.places) {
        const autocomplete = new window.google.maps.places.Autocomplete(autocompleteInputRef.current, {
          componentRestrictions: { country: "in" },
        })
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace()
          if (!place?.geometry?.location) return
          const lat = place.geometry.location.lat()
          const lng = place.geometry.location.lng()
          const formatted = place.formatted_address || place.name || ""
          setSearchQuery(formatted)
          map.setCenter({ lat, lng })
          map.setZoom(16)
          updateMarker(lat, lng)
          onChangeRef.current?.({ latitude: lat, longitude: lng, formattedAddress: formatted })
        })
        autocompleteRef.current = autocomplete
      }

      setMapLoading(false)
    }

    init()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <label className="text-xs font-semibold text-gray-500">Outlet location</label>
      <div className="relative mt-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={autocompleteInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search outlet address..."
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#10335D]"
        />
      </div>
      <div className="relative mt-2 h-[200px] w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
        <div ref={mapRef} className="absolute inset-0 w-full h-full" />
        {mapLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        )}
      </div>
      {value?.latitude ? (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-gray-400">
          <MapPin size={11} /> {Number(value.latitude).toFixed(5)}, {Number(value.longitude).toFixed(5)}
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] text-gray-400">Search or tap on the map to pin the outlet.</p>
      )}
    </div>
  )
}
