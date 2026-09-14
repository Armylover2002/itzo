import { useState, useEffect } from "react"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


/**
 * useLocation - Clean, Production-Ready Location Hook
 * 
 * Features:
 * - HTML5 Geolocation API for user location
 * - No reverse geocoding by default (avoids extra API calls); coords only unless you add a backend later
 * - Zomato-style location display
 * - Comprehensive error handling
 * 
 * @returns {Object} { location, loading, error, permissionGranted, requestLocation }
 */
export function useLocationSimple() {
  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [permissionGranted, setPermissionGranted] = useState(false)

  /**
   * Extract area/subLocality from Ola Maps API response
   * Priority: sublocality > neighborhood > first part of formatted_address
   * 
   * @param {Object} apiResponse - Response from backend reverse geocode endpoint
   * @returns {string} Area name (e.g., "New Palasia") or empty string
   */
  const extractAreaFromResponse = (apiResponse) => {
    try {
      // Backend response structure: { success: true, data: { results: [...] } }
      const backendData = apiResponse?.data?.data || {}
      const results = backendData.results || []
      
      if (results.length === 0) {
        return ""
      }

      const result = results[0]
      
      // Method 1: Extract from address_components object
      if (result.address_components) {
        const components = result.address_components
        
        // Check if it's an array (Google Maps style)
        if (Array.isArray(components)) {
          // Find sublocality or neighborhood
          const sublocality = components.find(comp => {
            const types = comp.types || []
            return types.includes('sublocality') || 
                   types.includes('sublocality_level_1') ||
                   types.includes('neighborhood')
          })
          
          if (sublocality?.long_name) {
            return sublocality.long_name.trim()
          }
        } 
        // Object format: { city, state, country, area }
        else if (components.area) {
          const area = components.area.trim()
          // Validate: Don't use state or city as area
          if (area && 
              area.toLowerCase() !== (components.state || "").toLowerCase() &&
              area.toLowerCase() !== (components.city || "").toLowerCase() &&
              !area.toLowerCase().includes("district")) {
            return area
          }
        }
      }

      // Method 2: Extract from formatted_address (Zomato-style parsing)
      // Indian address format: "Area, City, State" (e.g., "New Palasia, Indore, Madhya Pradesh")
      if (result.formatted_address) {
        const addressParts = result.formatted_address
          .split(',')
          .map(part => part.trim())
          .filter(part => part.length > 0)

        // If we have 3+ parts, first part is usually the area
        if (addressParts.length >= 3) {
          const firstPart = addressParts[0]
          const city = addressParts[1]
          const state = addressParts[2]

          // Validate first part is not city or state
          if (firstPart && 
              firstPart.length > 2 && 
              firstPart.length < 50 &&
              firstPart.toLowerCase() !== city.toLowerCase() &&
              firstPart.toLowerCase() !== state.toLowerCase() &&
              !firstPart.match(/^\d+/) && // Not a number
              !firstPart.toLowerCase().includes("district")) {
            return firstPart
          }
        }
      }

      // Method 3: Try direct fields from result
      const directArea = result.area || 
                        result.sublocality || 
                        result.neighborhood ||
                        result.sublocality_level_1

      if (directArea && directArea.trim()) {
        return directArea.trim()
      }

      return ""
    } catch (err) {
      debugError("Error extracting area from response:", err)
      return ""
    }
  }

  /**
   * Reverse geocode coordinates using Ola Maps API (via backend)
   * 
   * @param {number} latitude 
   * @param {number} longitude 
   * @returns {Promise<Object>} Location object with area, city, state, etc.
   */
  const reverseGeocode = async (latitude, longitude) => {
    try {
      const response = await locationAPI.reverseGeocode(latitude, longitude)

      // Check if API call was successful
      if (!response?.data?.success) {
        throw new Error(response?.data?.message || "Reverse geocoding failed")
      }

      const backendData = response.data.data || {}
      const results = backendData.results || []

      if (results.length === 0) {
        throw new Error("No location data found")
      }

      const result = results[0]
      const addressComponents = result.address_components || {}

      // Extract area (subLocality/neighborhood) - THIS IS THE KEY REQUIREMENT
      const area = extractAreaFromResponse(response)

      // Extract other location details
      const city = Array.isArray(addressComponents) 
        ? addressComponents.find(c => c.types?.includes('locality'))?.long_name 
        : addressComponents.city || ""
      
      const state = Array.isArray(addressComponents)
        ? addressComponents.find(c => c.types?.includes('administrative_area_level_1'))?.long_name
        : addressComponents.state || ""

      return {
        latitude,
        longitude,
        area: area || "", // Primary: Area/subLocality name
        city: city || "",
        state: state || "",
        formattedAddress: result.formatted_address || "",
      }
    } catch (err) {
      debugError("Reverse geocoding error:", err)
      throw err
    }
  }

  /**
   * Get user's current location using HTML5 Geolocation API
   * 
   * @param {boolean} forceFresh - Force fresh location (ignore cache)
   * @returns {Promise<Object>} Location object
   */
  const getCurrentLocation = async (forceFresh = false) => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"))
        return
      }

      const options = {
        enableHighAccuracy: true, // Use GPS for accurate location
        timeout: 10000, // 10 seconds timeout
        maximumAge: forceFresh ? 0 : 300000, // Allow 5-minute cache if not forcing fresh
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          const locationData = {
            latitude,
            longitude,
            area: "",
            city: "",
            state: "",
            formattedAddress: "",
          }
          localStorage.setItem("userLocation", JSON.stringify(locationData))
          resolve(locationData)
        },
        (err) => {
          // Handle geolocation errors
          let errorMessage = "Unable to retrieve your location"
          
          switch (err.code) {
            case err.PERMISSION_DENIED:
              errorMessage = "Location permission denied. Please enable location access in your browser settings."
              break
            case err.POSITION_UNAVAILABLE:
              errorMessage = "Location information is unavailable."
              break
            case err.TIMEOUT:
              errorMessage = "Location request timed out. Please try again."
              break
            default:
              errorMessage = "An unknown error occurred while retrieving location."
              break
          }
          
          reject(new Error(errorMessage))
        },
        options
      )
    })
  }

  /**
   * Request location permission and get current location
   * Called explicitly by user (e.g., button click)
   */
  const requestLocation = async () => {
    setLoading(true)
    setError(null)

    try {
      const locationData = await getCurrentLocation(true) // Force fresh location
      
      setLocation(locationData)
      setPermissionGranted(true)
      setError(null)
      
      return locationData
    } catch (err) {
      const errorMessage = err.message || "Failed to get location"
      setError(errorMessage)
      setPermissionGranted(false)
      
      // Try to load cached location as fallback
      const cached = localStorage.getItem("userLocation")
      if (cached) {
        try {
          const cachedLocation = JSON.parse(cached)
          setLocation(cachedLocation)
        } catch (parseErr) {
          debugError("Failed to parse cached location:", parseErr)
        }
      }
      
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Initialize: Load cached location; only fetch if missing.
  useEffect(() => {
    // Load cached location immediately (no loading state)
    const cached = localStorage.getItem("userLocation")
    if (cached) {
      try {
        const cachedLocation = JSON.parse(cached)
        setLocation(cachedLocation)
        setLoading(false)
      } catch (err) {
        debugError("Failed to parse cached location:", err)
      }
    } else {
      setLoading(false)
    }

    // IMPORTANT: Do NOT fetch on every reload.
    // Only fetch once when userLocation is missing; after that, rely on localStorage
    // unless the user explicitly requests a refresh via requestLocation().
    if (!cached) {
      getCurrentLocation()
        .then((locationData) => {
          setLocation(locationData)
          setPermissionGranted(true)
          setError(null)
        })
        .catch((err) => {
          setError(err.message)
          setPermissionGranted(false)
        })
    }

    // Geolocation permission observer
    let permStatusObj = null
    let permListener = null

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        permStatusObj = result
        permListener = () => {
          if (result.state === 'granted') {
            getCurrentLocation(true)
              .then((locationData) => {
                setLocation(locationData)
                setPermissionGranted(true)
                setError(null)
                // Notify other panels/hooks
                window.dispatchEvent(new CustomEvent("userLocationUpdated", { detail: { location: locationData } }))
              })
              .catch(() => {})
          } else {
            setPermissionGranted(false)
          }
        }
        result.addEventListener('change', permListener)
        result.onchange = permListener
      }).catch(() => {})
    }

    // Sync with external updates
    const applyExternalLocationUpdate = (event) => {
      try {
        const nextLocation = event?.detail?.location || JSON.parse(localStorage.getItem("userLocation") || "null")
        if (nextLocation && typeof nextLocation === "object") {
          setLocation(nextLocation)
          setPermissionGranted(
            Number.isFinite(Number(nextLocation.latitude)) &&
            Number.isFinite(Number(nextLocation.longitude))
          )
          setError(null)
        }
      } catch (err) {
        debugWarn("Failed to apply external location update:", err)
      }
    }

    window.addEventListener("userLocationUpdated", applyExternalLocationUpdate)

    return () => {
      window.removeEventListener("userLocationUpdated", applyExternalLocationUpdate)
      if (permStatusObj && permListener) {
        permStatusObj.removeEventListener('change', permListener)
        permStatusObj.onchange = null
      }
    }
  }, [])

  return {
    location,
    loading,
    error,
    permissionGranted,
    requestLocation,
  }
}


