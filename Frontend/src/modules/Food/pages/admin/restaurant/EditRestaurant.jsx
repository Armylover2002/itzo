import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { adminAPI } from "@food/api"
import { Input } from "@food/components/ui/input"
import { Button } from "@food/components/ui/button"
import { Label } from "@food/components/ui/label"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE,
  resolveRestaurantCommissionPercentage,
} from "@food/constants/commission"

const PHONE_REGEX = /^\d{10}$/
const OWNER_PHONE_DUPLICATE_MSG = "This phone number is already registered with another restaurant."
const PRIMARY_CONTACT_DUPLICATE_MSG = "This contact number is already registered with another restaurant."
const getRestaurantPhoneFieldError = (error) => {
  const msg = error?.response?.data?.message || error?.response?.data?.error || ""
  if (msg === PRIMARY_CONTACT_DUPLICATE_MSG) {
    return { field: "primaryContactNumber", message: msg }
  }
  if (msg === OWNER_PHONE_DUPLICATE_MSG) {
    return { field: "ownerPhone", message: msg }
  }
  if (/already registered|already exists|pending approval/i.test(msg)) {
    if (/contact/i.test(msg)) {
      return { field: "primaryContactNumber", message: msg }
    }
    return { field: "ownerPhone", message: msg }
  }
  return null
}
const debugError = (..._args) => {}

const toNumberOrEmpty = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : ""
}

const isNearZero = (n) => Math.abs(Number(n) || 0) < 0.000001

const normalizeRestaurantId = (r) => r?._id || r?.id || r?.restaurantId || ""

const normalizeZoneId = (zoneId) => {
  if (!zoneId) return ""
  if (typeof zoneId === "string") return zoneId
  return zoneId?._id || zoneId?.id || ""
}

const normalizeLocationFormFromRestaurant = (restaurant) => {
  const loc =
    restaurant?.location ||
    restaurant?.onboarding?.step1?.location ||
    {}

  const lat =
    toNumberOrEmpty(loc?.latitude ?? restaurant?.latitude)
  const lng =
    toNumberOrEmpty(loc?.longitude ?? restaurant?.longitude)

  const hasValidCoords =
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng)) &&
    !isNearZero(lat) &&
    !isNearZero(lng)

  const formattedAddress =
    loc?.formattedAddress ||
    loc?.addressLine1 ||
    restaurant?.formattedAddress ||
    restaurant?.addressLine1 ||
    restaurant?.address ||
    ""

  return {
    zoneId: normalizeZoneId(restaurant?.zoneId),
    formattedAddress,
    addressLine1: loc?.addressLine1 || restaurant?.addressLine1 || formattedAddress,
    addressLine2: loc?.addressLine2 || restaurant?.addressLine2 || "",
    area: loc?.area || restaurant?.area || "",
    city: loc?.city || restaurant?.city || "",
    state: loc?.state || restaurant?.state || "",
    pincode: loc?.pincode || restaurant?.pincode || "",
    landmark: loc?.landmark || restaurant?.landmark || "",
    latitude: hasValidCoords ? lat : "",
    longitude: hasValidCoords ? lng : "",
  }
}

const normalizeDetailsFormFromRestaurant = (restaurant) => {
  return {
    name: restaurant?.name || restaurant?.restaurantName || "",
    pureVegRestaurant:
      typeof restaurant?.pureVegRestaurant === "boolean"
        ? restaurant.pureVegRestaurant
        : false,
    ownerName: restaurant?.ownerName || "",
    ownerEmail: restaurant?.ownerEmail || "",
    ownerPhone: restaurant?.ownerPhone || "",
    primaryContactNumber: restaurant?.primaryContactNumber || "",
    email: restaurant?.email || "",
    cuisinesText: Array.isArray(restaurant?.cuisines) ? restaurant.cuisines.join(", ") : "",
    estimatedDeliveryTimeMinutes:
      restaurant?.estimatedDeliveryTimeMinutes ??
      restaurant?.estimatedDeliveryTime ??
      "",
    offer: restaurant?.offer || "",
    openingTime: restaurant?.openingTime || restaurant?.deliveryTimings?.openingTime || "",
    closingTime: restaurant?.closingTime || restaurant?.deliveryTimings?.closingTime || "",
    isActive: restaurant?.isActive !== false,
    commissionPercentage: resolveRestaurantCommissionPercentage(restaurant?.commissionPercentage),
  }
}

async function loadGooglePlaces() {
  if (window.google?.maps?.places?.Autocomplete) return true
  const apiKey = await getGoogleMapsApiKey()
  if (!apiKey) return false

  window.gm_authFailure = () => {}

  const existing = document.getElementById("admin-google-maps-script")
  if (existing) {
    await new Promise((resolve, reject) => {
      if (window.google?.maps?.places?.Autocomplete) {
        resolve()
        return
      }
      existing.addEventListener("load", resolve, { once: true })
      existing.addEventListener("error", reject, { once: true })
    })
    return !!window.google?.maps?.places?.Autocomplete
  }

  await new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.id = "admin-google-maps-script"
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`
    script.async = true
    script.defer = true
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })

  return !!window.google?.maps?.places?.Autocomplete
}

export default function EditRestaurant() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [savingDetails, setSavingDetails] = useState(false)
  const [savingLocation, setSavingLocation] = useState(false)
  const [error, setError] = useState("")

  const [restaurant, setRestaurant] = useState(null)
  const [zones, setZones] = useState([])
  const [zonesLoading, setZonesLoading] = useState(false)

  const [detailsForm, setDetailsForm] = useState(() => normalizeDetailsFormFromRestaurant(null))
  const [fieldErrors, setFieldErrors] = useState({})
  const [locationForm, setLocationForm] = useState(() => normalizeLocationFormFromRestaurant(null))
  const [locationError, setLocationError] = useState("")

  const locationSearchInputRef = useRef(null)
  const placesAutocompleteRef = useRef(null)

  const restaurantId = useMemo(() => {
    if (id) return id
    return normalizeRestaurantId(restaurant)
  }, [id, restaurant])

  useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!restaurantId) return
      try {
        setLoading(true)
        setError("")

        const res = await adminAPI.getRestaurantById(restaurantId)
        const data = res?.data?.data || null
        if (!mounted) return
        if (!res?.data?.success || !data) {
          setError(res?.data?.message || "Failed to load restaurant")
          setRestaurant(null)
          return
        }

        setRestaurant(data)
        setDetailsForm(normalizeDetailsFormFromRestaurant(data))
        setLocationForm(normalizeLocationFormFromRestaurant(data))
      } catch (e) {
        debugError(e)
        if (!mounted) return
        setError(e?.response?.data?.message || "Failed to load restaurant")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => {
      mounted = false
    }
  }, [restaurantId])

  useEffect(() => {
    let mounted = true
    setZonesLoading(true)
    adminAPI
      .getZones({ limit: 1000, view: "summary" })
      .then((res) => {
        const list =
          res?.data?.data?.zones ||
          res?.data?.data?.data?.zones ||
          res?.data?.data ||
          []
        if (!mounted) return
        setZones(Array.isArray(list) ? list : [])
      })
      .catch(() => {
        if (!mounted) return
        setZones([])
      })
      .finally(() => {
        if (!mounted) return
        setZonesLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!locationSearchInputRef.current) return
    if (placesAutocompleteRef.current) return

    let cancelled = false
    const init = async () => {
      setLocationError("")
      const loaded = await loadGooglePlaces()
      if (cancelled) return
      if (!loaded || !window.google?.maps?.places?.Autocomplete) {
        setLocationError("Unable to load Google Places Autocomplete.")
        return
      }

      placesAutocompleteRef.current = new window.google.maps.places.Autocomplete(
        locationSearchInputRef.current,
        {
          fields: ["formatted_address", "address_components", "geometry"],
          // Omit `types: ["geocode"]` — that biases Autocomplete toward Geocoding API (geocode/json) traffic.
          componentRestrictions: { country: "in" },
        },
      )

      const parsePlace = (place) => {
        const formattedAddress = place?.formatted_address || ""
        const comps = Array.isArray(place?.address_components) ? place.address_components : []
        const get = (types) =>
          comps.find((c) => types.some((t) => c.types?.includes(t)))?.long_name || ""
        const area =
          get(["sublocality_level_1", "sublocality", "neighborhood"]) ||
          get(["locality"])
        const city =
          get(["locality"]) ||
          get(["administrative_area_level_2"])
        const state = get(["administrative_area_level_1"])
        const pincode = get(["postal_code"])
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

      placesAutocompleteRef.current.addListener("place_changed", () => {
        const place = placesAutocompleteRef.current.getPlace()
        const parsed = parsePlace(place)
        setLocationForm((prev) => ({
          ...prev,
          formattedAddress: parsed.formattedAddress || prev.formattedAddress,
          addressLine1: parsed.formattedAddress || prev.addressLine1,
          area: parsed.area || prev.area,
          city: parsed.city || prev.city,
          state: parsed.state || prev.state,
          pincode: parsed.pincode || prev.pincode,
          latitude: parsed.latitude !== "" ? parsed.latitude : prev.latitude,
          longitude: parsed.longitude !== "" ? parsed.longitude : prev.longitude,
        }))
      })
    }

    requestAnimationFrame(init)
    return () => {
      cancelled = true
      placesAutocompleteRef.current = null
    }
  }, [])

  const currentZoneLabel = useMemo(() => {
    const zid = normalizeZoneId(locationForm.zoneId)
    if (!zid) return ""
    const z = zones.find((x) => normalizeZoneId(x?._id || x?.id) === zid)
    return z?.name || z?.zoneName || ""
  }, [locationForm.zoneId, zones])

  const handleSaveDetails = async () => {
    if (!restaurantId) return

    const nextFieldErrors = {}
    const ownerPhone = String(detailsForm.ownerPhone || "").trim()
    const primaryContactNumber = String(detailsForm.primaryContactNumber || "").trim()

    if (ownerPhone && !PHONE_REGEX.test(ownerPhone)) {
      nextFieldErrors.ownerPhone = "Owner phone number must be 10 digits"
    }
    if (primaryContactNumber && !PHONE_REGEX.test(primaryContactNumber)) {
      nextFieldErrors.primaryContactNumber = "Primary contact number must be 10 digits"
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      toast.error(Object.values(nextFieldErrors)[0])
      document.getElementById(`restaurant-field-${Object.keys(nextFieldErrors)[0]}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" })
      return
    }

    try {
      setSavingDetails(true)
      setFieldErrors({})

      const cuisines = String(detailsForm.cuisinesText || "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)

      const payload = {
        name: detailsForm.name,
        pureVegRestaurant: detailsForm.pureVegRestaurant === true,
        ownerName: detailsForm.ownerName,
        ownerEmail: detailsForm.ownerEmail,
        ownerPhone: detailsForm.ownerPhone,
        primaryContactNumber: detailsForm.primaryContactNumber,
        email: detailsForm.email,
        cuisines,
        estimatedDeliveryTimeMinutes:
          detailsForm.estimatedDeliveryTimeMinutes === ""
            ? undefined
            : Number(detailsForm.estimatedDeliveryTimeMinutes),
        offer: detailsForm.offer,
        openingTime: detailsForm.openingTime,
        closingTime: detailsForm.closingTime,
        isActive: detailsForm.isActive !== false,
        commissionPercentage:
          detailsForm.commissionPercentage === ""
            ? DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE
            : Number(detailsForm.commissionPercentage),
      }

      const res = await adminAPI.updateRestaurant(restaurantId, payload)
      const updated = res?.data?.data?.restaurant || res?.data?.data || null
      if (updated) {
        setRestaurant((prev) => ({ ...(prev || {}), ...updated }))
      }
      alert("Restaurant details updated successfully")
    } catch (e) {
      const phoneError = getRestaurantPhoneFieldError(e)
      if (phoneError) {
        setFieldErrors({ [phoneError.field]: phoneError.message })
        toast.error(phoneError.message)
        document.getElementById(`restaurant-field-${phoneError.field}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" })
        return
      }
      alert(e?.response?.data?.message || "Failed to update restaurant details")
    } finally {
      setSavingDetails(false)
    }
  }

  const handleSaveLocation = async () => {
    if (!restaurantId) return

    const latitude = Number(locationForm.latitude)
    const longitude = Number(locationForm.longitude)

    if (!locationForm.zoneId) {
      alert("Please select a zone")
      return
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !locationForm.formattedAddress) {
      alert("Please select a location from dropdown")
      return
    }

    try {
      setSavingLocation(true)
      const payload = {
        zoneId: locationForm.zoneId,
        latitude,
        longitude,
        coordinates: [longitude, latitude],
        formattedAddress: locationForm.formattedAddress || "",
        address: locationForm.formattedAddress || "",
        addressLine1: locationForm.addressLine1 || locationForm.formattedAddress || "",
        addressLine2: locationForm.addressLine2 || "",
        area: locationForm.area || "",
        city: locationForm.city || "",
        state: locationForm.state || "",
        landmark: locationForm.landmark || "",
        pincode: locationForm.pincode || "",
        zipCode: locationForm.pincode || "",
        postalCode: locationForm.pincode || "",
      }

      const res = await adminAPI.updateRestaurantLocation(restaurantId, payload)
      const updatedRestaurant = res?.data?.data?.restaurant || null
      if (updatedRestaurant) {
        setRestaurant((prev) => ({ ...(prev || {}), ...updatedRestaurant }))
      }
      alert("Restaurant location updated successfully")
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to update restaurant location")
    } finally {
      setSavingLocation(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/ecs/food/restaurants")}
              className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Edit Restaurant</h1>
              <p className="text-sm text-slate-500">
                {restaurant?.name || restaurant?.restaurantName || restaurantId}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 flex items-center justify-center gap-2 text-slate-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Basic Details</h2>
                <Button onClick={handleSaveDetails} disabled={savingDetails}>
                  {savingDetails ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    "Save Details"
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Restaurant Name</Label>
                  <Input value={detailsForm.name} onChange={(e) => setDetailsForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <Label>Pure Veg</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailsForm((p) => ({ ...p, pureVegRestaurant: true }))}
                      className={`px-3 py-1.5 text-xs rounded-full border ${
                        detailsForm.pureVegRestaurant === true
                          ? "bg-green-600 text-white border-green-600"
                          : "bg-white text-slate-700 border-slate-300"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailsForm((p) => ({ ...p, pureVegRestaurant: false }))}
                      className={`px-3 py-1.5 text-xs rounded-full border ${
                        detailsForm.pureVegRestaurant === false
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-300"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
                <div>
                  <Label>Primary Email</Label>
                  <Input value={detailsForm.email} onChange={(e) => setDetailsForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <Label>Owner Name</Label>
                  <Input value={detailsForm.ownerName} onChange={(e) => setDetailsForm((p) => ({ ...p, ownerName: e.target.value }))} />
                </div>
                <div>
                  <Label>Owner Email</Label>
                  <Input value={detailsForm.ownerEmail} onChange={(e) => setDetailsForm((p) => ({ ...p, ownerEmail: e.target.value }))} />
                </div>
                <div>
                  <Label>Owner Phone</Label>
                  <Input
                    id="restaurant-field-ownerPhone"
                    data-restaurant-field="ownerPhone"
                    value={detailsForm.ownerPhone}
                    onChange={(e) => {
                      setFieldErrors((prev) => ({ ...prev, ownerPhone: undefined }))
                      setDetailsForm((p) => ({ ...p, ownerPhone: e.target.value.replace(/\D/g, "").slice(0, 10) }))
                    }}
                    className={fieldErrors.ownerPhone ? "border-red-500 ring-1 ring-red-300" : ""}
                  />
                  {fieldErrors.ownerPhone && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.ownerPhone}</p>
                  )}
                </div>
                <div>
                  <Label>Primary Contact Number</Label>
                  <Input
                    id="restaurant-field-primaryContactNumber"
                    data-restaurant-field="primaryContactNumber"
                    value={detailsForm.primaryContactNumber}
                    onChange={(e) => {
                      setFieldErrors((prev) => ({ ...prev, primaryContactNumber: undefined }))
                      setDetailsForm((p) => ({ ...p, primaryContactNumber: e.target.value.replace(/\D/g, "").slice(0, 10) }))
                    }}
                    className={fieldErrors.primaryContactNumber ? "border-red-500 ring-1 ring-red-300" : ""}
                  />
                  {fieldErrors.primaryContactNumber && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.primaryContactNumber}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <Label>Cuisines (comma separated)</Label>
                  <Input value={detailsForm.cuisinesText} onChange={(e) => setDetailsForm((p) => ({ ...p, cuisinesText: e.target.value }))} />
                </div>
                <div>
                  <Label>Estimated Delivery Time (minutes)</Label>
                  <Input
                    type="number"
                    value={detailsForm.estimatedDeliveryTimeMinutes}
                    onChange={(e) => setDetailsForm((p) => ({ ...p, estimatedDeliveryTimeMinutes: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Offer</Label>
                  <Input value={detailsForm.offer} onChange={(e) => setDetailsForm((p) => ({ ...p, offer: e.target.value }))} />
                </div>
              </div>
            </section>

            <section className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Restaurant Commission</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Set a custom commission percentage to deduct automatically from each order subtotal.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Commission Percentage (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder={String(DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE)}
                    value={detailsForm.commissionPercentage}
                    onChange={(e) => setDetailsForm((p) => ({ ...p, commissionPercentage: e.target.value }))}
                  />
                </div>
              </div>
            </section>

            <section className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Location</h2>
                  {currentZoneLabel ? (
                    <p className="text-xs text-slate-500 mt-1">Current Zone: {currentZoneLabel}</p>
                  ) : null}
                </div>
                <Button onClick={handleSaveLocation} disabled={savingLocation}>
                  {savingLocation ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    "Save Location"
                  )}
                </Button>
              </div>

              {locationError ? (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {locationError}
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Service Zone</Label>
                  <select
                    value={locationForm.zoneId || ""}
                    onChange={(e) => setLocationForm((p) => ({ ...p, zoneId: e.target.value }))}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                    disabled={zonesLoading}
                  >
                    <option value="">{zonesLoading ? "Loading zones..." : "Select a zone"}</option>
                    {zones.map((z) => {
                      const zid = normalizeZoneId(z?._id || z?.id)
                      const label = z?.name || z?.zoneName || zid
                      return (
                        <option key={zid} value={zid}>
                          {label}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <Label>Search location</Label>
                  <Input
                    ref={locationSearchInputRef}
                    placeholder="Start typing your restaurant address..."
                    className="mt-1 bg-white text-sm text-black! dark:text-white! placeholder:text-gray-500 dark:placeholder:text-gray-400 caret-black dark:caret-white"
                    style={{ color: "#000", WebkitTextFillColor: "#000" }}
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Select a suggestion from the dropdown to fill address + coordinates.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <Label>Formatted Address</Label>
                  <Input value={locationForm.formattedAddress} readOnly className="mt-1 bg-slate-50" />
                </div>
                <div>
                  <Label>Area</Label>
                  <Input value={locationForm.area} readOnly className="mt-1 bg-slate-50" />
                </div>
                <div>
                  <Label>City</Label>
                  <Input value={locationForm.city} readOnly className="mt-1 bg-slate-50" />
                </div>
                <div>
                  <Label>State</Label>
                  <Input value={locationForm.state} readOnly className="mt-1 bg-slate-50" />
                </div>
                <div>
                  <Label>Pincode</Label>
                  <Input value={locationForm.pincode} readOnly className="mt-1 bg-slate-50" />
                </div>
                <div className="md:col-span-2">
                  <Label>Landmark</Label>
                  <Input
                    value={locationForm.landmark}
                    onChange={(e) => setLocationForm((p) => ({ ...p, landmark: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

