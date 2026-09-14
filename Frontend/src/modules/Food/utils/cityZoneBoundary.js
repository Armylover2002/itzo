const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "en",
  "User-Agent": "Blaze-Food-Zone-Setup/1.0",
}

const MAX_POLYGON_POINTS = 250
const GEOLOCATION_TIMEOUT_MS = 15000
const FETCH_TIMEOUT_MS = 12000

const fetchWithTimeout = async (url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export const getBrowserGeolocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator?.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
      },
      (error) => {
        const code = error?.code
        if (code === 1) {
          reject(new Error("Location permission denied. Please allow location access or draw the zone manually."))
        } else if (code === 2) {
          reject(new Error("Your location is unavailable. Please try again or draw the zone manually."))
        } else if (code === 3) {
          reject(new Error("Location request timed out. Please try again or draw the zone manually."))
        } else {
          reject(new Error(error?.message || "Unable to get your current location."))
        }
      },
      {
        enableHighAccuracy: true,
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: 60_000,
      }
    )
  })

const getGoogleComponent = (components, types) => {
  if (!Array.isArray(components)) return ""
  const match = components.find((component) =>
    types.some((type) => component.types?.includes(type))
  )
  return match?.long_name || ""
}

export const reverseGeocodeWithGoogleMaps = (latitude, longitude) =>
  new Promise((resolve, reject) => {
    if (!window.google?.maps?.Geocoder) {
      reject(new Error("Google Maps geocoder is not available."))
      return
    }

    const geocoder = new window.google.maps.Geocoder()
    geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
      if (status !== "OK" || !results?.length) {
        reject(new Error("Could not resolve your location to a city."))
        return
      }

      const result = results[0]
      const components = result.address_components || []
      const city =
        getGoogleComponent(components, ["locality"]) ||
        getGoogleComponent(components, ["administrative_area_level_2"]) ||
        getGoogleComponent(components, ["administrative_area_level_3"])
      const state = getGoogleComponent(components, ["administrative_area_level_1"])
      const country = getGoogleComponent(components, ["country"])

      resolve({
        city: city || "",
        state: state || "",
        country: country || "",
        formattedAddress: result.formatted_address || "",
        zoneName: city || state || "",
      })
    })
  })

const ringArea = (ring) => {
  if (!Array.isArray(ring) || ring.length < 3) return 0
  let area = 0
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % ring.length]
    area += x1 * y2 - x2 * y1
  }
  return Math.abs(area / 2)
}

const geoJsonToRings = (geojson) => {
  if (!geojson?.type) return []

  if (geojson.type === "Polygon") {
    return Array.isArray(geojson.coordinates) ? geojson.coordinates : []
  }

  if (geojson.type === "MultiPolygon") {
    return Array.isArray(geojson.coordinates)
      ? geojson.coordinates.map((polygon) => polygon?.[0]).filter(Boolean)
      : []
  }

  return []
}

const ringContainsPoint = (ring, latitude, longitude) => {
  if (!Array.isArray(ring) || ring.length < 3) return false
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersects =
      (yi > latitude) !== (yj > latitude) &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi + Number.EPSILON) + xi
    if (intersects) inside = !inside
  }
  return inside
}

const pickBestRing = (rings, latitude, longitude) => {
  const validRings = rings.filter((ring) => Array.isArray(ring) && ring.length >= 3)
  if (validRings.length === 0) return null
  if (validRings.length === 1) return validRings[0]

  const containing = validRings.filter((ring) => ringContainsPoint(ring, latitude, longitude))
  const candidates = containing.length > 0 ? containing : validRings
  return candidates.reduce((best, ring) => (ringArea(ring) > ringArea(best) ? ring : best))
}

const simplifyRing = (ring, maxPoints = MAX_POLYGON_POINTS) => {
  if (!Array.isArray(ring) || ring.length <= maxPoints) return ring
  const step = Math.ceil(ring.length / maxPoints)
  const simplified = []
  for (let i = 0; i < ring.length; i += step) {
    simplified.push(ring[i])
  }
  return simplified.length >= 3 ? simplified : ring.slice(0, maxPoints)
}

const ringToZoneCoordinates = (ring) =>
  ring.map(([lng, lat]) => ({
    latitude: parseFloat(Number(lat).toFixed(6)),
    longitude: parseFloat(Number(lng).toFixed(6)),
  }))

const ADDRESS_TYPE_PRIORITY = {
  city: 1,
  town: 2,
  municipality: 3,
  city_district: 4,
  borough: 5,
  state_district: 6,
  county: 7,
  district: 8,
}

const NOMINATIM_ZOOM_LEVELS = [6, 8, 12]

const normalizeName = (value) => String(value || "").trim().toLowerCase()

const namesMatch = (a, b) => {
  const left = normalizeName(a)
  const right = normalizeName(b)
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}

const isLikelyCitySubArea = (candidate, city) => {
  const cityNorm = normalizeName(city)
  if (!cityNorm || candidate.addresstype !== "city_district") return false
  const name = normalizeName(candidate.name)
  return name.includes(cityNorm) && name !== cityNorm
}

const buildBoundaryCandidate = (payload, latitude, longitude) => {
  if (!payload?.geojson || payload.geojson.type === "Point") return null

  const rings = geoJsonToRings(payload.geojson)
  const bestRing = pickBestRing(rings, latitude, longitude)
  if (!bestRing) return null

  return {
    name: payload.name || "",
    addresstype: payload.addresstype || "",
    ring: bestRing,
    area: ringArea(bestRing),
    containsPoint: ringContainsPoint(bestRing, latitude, longitude),
  }
}

const scoreBoundaryCandidate = (candidate, city) => {
  let score = 0

  if (candidate.containsPoint) score += 1000
  if (namesMatch(candidate.name, city)) score += 500
  if (isLikelyCitySubArea(candidate, city)) score -= 400

  const typePriority = ADDRESS_TYPE_PRIORITY[candidate.addresstype] ?? 50
  score += Math.max(0, 50 - typePriority) * 10
  score += Math.log10(Math.max(candidate.area, 1))

  return score
}

const selectBestBoundaryCandidate = (candidates, city) => {
  if (!candidates.length) return null

  const unique = []
  const seen = new Set()

  candidates.forEach((candidate) => {
    const key = `${candidate.name}|${candidate.addresstype}|${candidate.ring.length}`
    if (seen.has(key)) return
    seen.add(key)
    unique.push(candidate)
  })

  return unique.sort(
    (a, b) => scoreBoundaryCandidate(b, city) - scoreBoundaryCandidate(a, city)
  )[0]
}

const candidateToCoordinates = (candidate) => {
  if (!candidate?.ring) return null
  const coordinates = ringToZoneCoordinates(simplifyRing(candidate.ring))
  return coordinates.length >= 3 ? coordinates : null
}

const collectNominatimReverseCandidates = async (latitude, longitude) => {
  const candidates = []

  for (let index = 0; index < NOMINATIM_ZOOM_LEVELS.length; index += 1) {
    const zoom = NOMINATIM_ZOOM_LEVELS[index]
    if (index > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1100))
    }

    try {
      const url =
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
        `&lat=${latitude}&lon=${longitude}&zoom=${zoom}&polygon_geojson=1&addressdetails=1`
      const response = await fetchWithTimeout(url, { headers: NOMINATIM_HEADERS })
      if (!response.ok) continue

      const data = await response.json()
      const candidate = buildBoundaryCandidate(data, latitude, longitude)
      if (candidate) candidates.push(candidate)
    } catch {
      // try next zoom level
    }
  }

  return candidates
}

const searchNominatimBoundary = async (query, latitude, longitude) => {
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2` +
    `&q=${encodeURIComponent(query)}&polygon_geojson=1&limit=5&addressdetails=1`

  const response = await fetchWithTimeout(url, { headers: NOMINATIM_HEADERS })
  if (!response.ok) return null

  const results = await response.json()
  if (!Array.isArray(results) || results.length === 0) return null

  const candidates = results
    .map((item) => buildBoundaryCandidate(item, latitude, longitude))
    .filter(Boolean)

  const best = selectBestBoundaryCandidate(candidates, query.split(",")[0])
  return candidateToCoordinates(best)
}

const parseOverpassGeometry = (elements, latitude, longitude) => {
  if (!Array.isArray(elements) || elements.length === 0) return null

  const candidates = elements
    .filter((element) => Array.isArray(element.geometry) && element.geometry.length >= 3)
    .map((element) => ({
      adminLevel: Number(element.tags?.admin_level || 99),
      ring: element.geometry.map((point) => [point.lon, point.lat]),
    }))
    .sort((a, b) => a.adminLevel - b.adminLevel)

  if (candidates.length === 0) return null

  const best =
    candidates.find((candidate) => ringContainsPoint(candidate.ring, latitude, longitude)) ||
    candidates[0]

  const coordinates = ringToZoneCoordinates(simplifyRing(best.ring))
  return coordinates.length >= 3 ? coordinates : null
}

const fetchOverpassBoundary = async (latitude, longitude) => {
  const query = `[out:json][timeout:25];rel["boundary"="administrative"]["admin_level"~"7|8|9"](around:25000,${latitude},${longitude});out geom;`

  const response = await fetchWithTimeout("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": NOMINATIM_HEADERS["User-Agent"],
    },
    body: `data=${encodeURIComponent(query)}`,
  })

  if (!response.ok) return null
  const data = await response.json()
  return parseOverpassGeometry(data?.elements, latitude, longitude)
}

export const fetchCityBoundaryPolygon = async ({ latitude, longitude, city, state, country }) => {
  const reverseCandidates = await collectNominatimReverseCandidates(latitude, longitude)
  const bestReverse = selectBestBoundaryCandidate(reverseCandidates, city)
  const reverseCoordinates = candidateToCoordinates(bestReverse)
  if (reverseCoordinates) return reverseCoordinates

  const searchQuery = [city, state, country].filter(Boolean).join(", ")
  if (searchQuery) {
    try {
      const coordinates = await searchNominatimBoundary(searchQuery, latitude, longitude)
      if (coordinates) return coordinates
    } catch {
      // fall through to Overpass
    }
  }

  try {
    const coordinates = await fetchOverpassBoundary(latitude, longitude)
    if (coordinates) return coordinates
  } catch {
    // handled below
  }

  throw new Error(
    "Could not find an administrative boundary for your city. Please draw the zone manually on the map."
  )
}

export const generateCityZoneFromCurrentLocation = async () => {
  const position = await getBrowserGeolocation()
  const { latitude, longitude } = position

  let locationMeta
  try {
    locationMeta = await reverseGeocodeWithGoogleMaps(latitude, longitude)
  } catch {
    locationMeta = {
      city: "",
      state: "",
      country: "",
      formattedAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      zoneName: "",
    }
  }

  const coordinates = await fetchCityBoundaryPolygon({
    latitude,
    longitude,
    city: locationMeta.city,
    state: locationMeta.state,
    country: locationMeta.country,
  })

  return {
    coordinates,
    location: {
      latitude,
      longitude,
      ...locationMeta,
    },
  }
}
