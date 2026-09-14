const DEBOUNCE_MS = 450

export const parsePlaceDetails = (place) => {
  const formattedAddress = place?.formatted_address || ""
  const comps = Array.isArray(place?.address_components) ? place.address_components : []
  const get = (types) =>
    comps.find((c) => types.some((t) => c.types?.includes(t)))?.long_name || ""
  const area =
    get(["sublocality_level_1", "sublocality", "neighborhood"]) || get(["locality"])
  const city = get(["locality"]) || get(["administrative_area_level_2"])
  const state = get(["administrative_area_level_1"])
  const pincode = get(["postal_code"])
  const lat = place?.geometry?.location?.lat?.()
  const lng = place?.geometry?.location?.lng?.()
  return {
    formattedAddress,
    placeId: place?.place_id || "",
    area,
    city,
    state,
    pincode,
    latitude: Number.isFinite(lat) ? Number(lat.toFixed(6)) : null,
    longitude: Number.isFinite(lng) ? Number(lng.toFixed(6)) : null,
  }
}

export const initPlacesServices = (mapInstance) => {
  const google = typeof window !== "undefined" ? window.google : null
  if (!google?.maps?.places) return null

  return {
    autocompleteService: new google.maps.places.AutocompleteService(),
    placesService: new google.maps.places.PlacesService(mapInstance),
    sessionToken: new google.maps.places.AutocompleteSessionToken(),
  }
}

export const fetchPlacePredictions = (autocompleteService, sessionToken, input) =>
  new Promise((resolve) => {
    const trimmed = String(input || "").trim()
    if (!trimmed || !autocompleteService || !window.google?.maps?.places) {
      resolve([])
      return
    }

    autocompleteService.getPlacePredictions(
      {
        input: trimmed,
        componentRestrictions: { country: "in" },
        sessionToken,
      },
      (results, status) => {
        if (
          status !== window.google.maps.places.PlacesServiceStatus.OK ||
          !results?.length
        ) {
          resolve([])
          return
        }
        resolve(results.slice(0, 5))
      },
    )
  })

export const fetchPlaceDetails = (placesService, sessionToken, placeId) =>
  new Promise((resolve, reject) => {
    if (!placesService || !placeId || !window.google?.maps?.places) {
      reject(new Error("Places service unavailable"))
      return
    }

    placesService.getDetails(
      {
        placeId,
        fields: ["formatted_address", "address_components", "geometry"],
        sessionToken,
      },
      (place, status) => {
        const nextToken = new window.google.maps.places.AutocompleteSessionToken()
        if (
          status !== window.google.maps.places.PlacesServiceStatus.OK ||
          !place?.geometry
        ) {
          reject(new Error("Could not load location details"))
          return
        }
        resolve({ place, nextSessionToken: nextToken })
      },
    )
  })

export const PLACES_SEARCH_DEBOUNCE_MS = DEBOUNCE_MS
