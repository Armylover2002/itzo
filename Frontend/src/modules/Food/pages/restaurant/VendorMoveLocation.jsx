import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Crosshair, Loader2 } from "lucide-react"
import { toast } from "sonner"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { restaurantAPI, zoneAPI } from "@food/api"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { loadGoogleMaps } from "@core/services/googleMapsLoader"
import { useLiveLocation } from "@food/contexts/LiveLocationContext"

/**
 * Drag-a-pin picker for Street Food Vendors to park their stall at a specific point.
 * Updates `currentLocation` via the existing updateLiveLocation API, NOT the permanent
 * `location` field directly. The backend is the single source of truth for zone-boundary
 * validation — the polygon check drawn here is UX-only (instant feedback while dragging).
 */
export default function VendorMoveLocation() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const { restaurantData, currentLocation, refreshRestaurantData } = useLiveLocation()

  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const zoneRef = useRef(null)
  const lastValidPosRef = useRef(null)

  const [mapLoading, setMapLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [outsideZone, setOutsideZone] = useState(false)
  const [pickedAddress, setPickedAddress] = useState("")
  const [pickedLatLng, setPickedLatLng] = useState(null)

  const isInsideZone = useCallback((lat, lng, google) => {
    const zone = zoneRef.current
    if (!google?.maps?.geometry?.poly || !zone?.coordinates?.length) return true
    const path = zone.coordinates
      .map((c) => {
        const zLat = Number(c?.latitude ?? c?.lat)
        const zLng = Number(c?.longitude ?? c?.lng)
        return Number.isFinite(zLat) && Number.isFinite(zLng) ? new google.maps.LatLng(zLat, zLng) : null
      })
      .filter(Boolean)
    if (path.length < 3) return true
    const polygon = new google.maps.Polygon({ paths: path })
    return google.maps.geometry.poly.containsLocation(new google.maps.LatLng(lat, lng), polygon)
  }, [])

  const reverseGeocodeAndSet = useCallback((lat, lng, google) => {
    if (!google) return
    const geocoder = new google.maps.Geocoder()
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        setPickedAddress(results[0].formatted_address || "")
      }
    })
  }, [])

  const handleMarkerMoved = useCallback(
    (lat, lng, google) => {
      const inside = isInsideZone(lat, lng, google)
      setOutsideZone(!inside)
      if (!inside) {
        toast.error("That point is outside your assigned zone")
        const prev = lastValidPosRef.current
        if (prev && markerRef.current) {
          markerRef.current.setPosition(prev)
        }
        return
      }
      lastValidPosRef.current = { lat, lng }
      setPickedLatLng({ lat, lng })
      reverseGeocodeAndSet(lat, lng, google)
    },
    [isInsideZone, reverseGeocodeAndSet],
  )

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        const [apiKey, zonesRes] = await Promise.all([
          getGoogleMapsApiKey(),
          zoneAPI.getPublicZones().catch(() => null),
        ])
        const google = await loadGoogleMaps(apiKey)
        if (cancelled) return

        const zones = zonesRes?.data?.data?.zones || zonesRes?.data?.zones || []
        const myZoneId = String(restaurantData?.zoneId || "")
        const myZone = zones.find((z) => String(z._id || z.id) === myZoneId) || null
        zoneRef.current = myZone

        const startLat = Number(currentLocation?.latitude) || Number(restaurantData?.location?.latitude) || 20.5937
        const startLng = Number(currentLocation?.longitude) || Number(restaurantData?.location?.longitude) || 78.9629
        lastValidPosRef.current = { lat: startLat, lng: startLng }
        setPickedLatLng({ lat: startLat, lng: startLng })
        setPickedAddress(currentLocation?.formattedAddress || currentLocation?.address || "")

        const map = new google.maps.Map(mapRef.current, {
          center: { lat: startLat, lng: startLng },
          zoom: 16,
          disableDefaultUI: true,
          zoomControl: true,
        })
        mapInstanceRef.current = map

        if (myZone?.coordinates?.length >= 3) {
          const path = myZone.coordinates
            .map((c) => {
              const lat = Number(c?.latitude ?? c?.lat)
              const lng = Number(c?.longitude ?? c?.lng)
              return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
            })
            .filter(Boolean)
          new google.maps.Polygon({
            paths: path,
            strokeColor: "#111827",
            strokeOpacity: 0.6,
            strokeWeight: 2,
            fillColor: "#111827",
            fillOpacity: 0.05,
            map,
          })
        }

        const marker = new google.maps.Marker({
          position: { lat: startLat, lng: startLng },
          map,
          draggable: true,
          animation: google.maps.Animation.DROP,
        })
        marker.addListener("dragend", (event) => {
          handleMarkerMoved(event.latLng.lat(), event.latLng.lng(), google)
        })
        markerRef.current = marker

        setMapLoading(false)
      } catch (err) {
        if (!cancelled) {
          toast.error("Failed to load map")
          setMapLoading(false)
        }
      }
    }

    init()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported on this device")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const google = window.google
        if (mapInstanceRef.current && markerRef.current && google) {
          mapInstanceRef.current.panTo({ lat: latitude, lng: longitude })
          markerRef.current.setPosition({ lat: latitude, lng: longitude })
          handleMarkerMoved(latitude, longitude, google)
        }
      },
      () => toast.error("Unable to fetch current location"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  const handleConfirmLocation = async () => {
    if (!pickedLatLng || outsideZone) return
    setSaving(true)
    try {
      await restaurantAPI.updateLiveLocation(pickedLatLng.lat, pickedLatLng.lng, pickedAddress)
      toast.success("Location updated successfully!")
      await refreshRestaurantData()
      window.dispatchEvent(new Event("addressUpdated"))
      navigate("/food/restaurant/live-location")
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update location")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Go back">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900">Move My Stall</h1>
        </div>
      </div>

      <div className="relative flex-1 min-h-[320px]">
        {mapLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}
        <div ref={mapRef} className="absolute inset-0" />
        <button
          onClick={handleUseCurrentLocation}
          className="absolute bottom-4 right-4 z-10 bg-white shadow-lg rounded-full p-3 border border-gray-200"
          aria-label="Use current location"
        >
          <Crosshair className="h-5 w-5 text-gray-700" />
        </button>
      </div>

      <div className="border-t border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm text-gray-600 line-clamp-2">
          {pickedAddress || "Drag the pin to your exact stall location."}
        </p>
        {outsideZone && (
          <p className="text-xs font-semibold text-rose-600">
            This point is outside your zone. Pick a location inside the highlighted area.
          </p>
        )}
        <button
          onClick={handleConfirmLocation}
          disabled={saving || outsideZone || !pickedLatLng}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Confirm Location
        </button>
      </div>
    </div>
  )
}
