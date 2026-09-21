import { Link } from "react-router-dom"
import { useEffect, useRef, useMemo } from "react"
import { ChevronDown, ShoppingCart, Wallet, MapPin } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { useLocation } from "@food/hooks/useLocation"
import { useCart } from "@food/context/CartContext"
import { useLocationSelector } from "./UserLayout"
import { FaLocationDot } from "react-icons/fa6"
import { useAppBranding } from "@common/hooks/useBusinessSettingsCache"


export default function PageNavbar({
  textColor = "white",
  zIndex = 20,
  showProfile = false,
  showLogo = true,
  onNavClick
}) {
  const { location, loading, requestLocation } = useLocation()
  const { getCartCount } = useCart()
  const { openLocationSelector } = useLocationSelector()
  const cartCount = getCartCount()
  const { logoUrl, companyName } = useAppBranding("user")
  const autoLocationAttemptedRef = useRef(false)
  const requestLocationRef = useRef(requestLocation)
  const enableLocationDebugLogs = false
  const debugLog = (...args) => {
    if (enableLocationDebugLogs && import.meta.env.DEV) {
      debugLog(...args)
    }
  }

  useEffect(() => {
    requestLocationRef.current = requestLocation
  }, [requestLocation])

  // Auto-trigger location fetch once when location is missing/placeholder and permission is already granted.
  useEffect(() => {
    if (autoLocationAttemptedRef.current || loading || !requestLocationRef.current) return

    // If we already have stored coordinates, do not auto-geocode again.
    // We only update location when the user changes it manually.
    try {
      const storedRaw = localStorage.getItem("userLocation")
      const stored = storedRaw ? JSON.parse(storedRaw) : null
      const lat = Number(stored?.latitude)
      const lng = Number(stored?.longitude)
      const hasStoredCoords = Number.isFinite(lat) && Number.isFinite(lng)
      if (hasStoredCoords) return
    } catch {
      // ignore parsing errors and continue to auto-fetch as fallback for first open
    }

    const hasMissingOrPlaceholderLocation =
      !location ||
      location.formattedAddress === "Select location" ||
      location.city === "Current Location"

    if (!hasMissingOrPlaceholderLocation) return
    // Reserve a single background attempt to avoid repeated checks on re-renders.
    autoLocationAttemptedRef.current = true

    let cancelled = false
    const timeoutId = setTimeout(async () => {
      try {
        let isGranted = false
        if (navigator.permissions?.query) {
          const result = await navigator.permissions.query({ name: 'geolocation' })
          isGranted = result.state === 'granted'
        }

        if (!isGranted) {
          debugLog("?? Geolocation permission not granted; waiting for user action")
          return
        }
        const fetchedLocation = await requestLocationRef.current()
        if (cancelled) return

        if (fetchedLocation &&
          fetchedLocation.formattedAddress !== "Select location" &&
          fetchedLocation.city !== "Current Location") {
          debugLog("? Location fetched successfully:", fetchedLocation)
        } else {
          debugLog("Location fetch returned placeholder, user may need to select manually")
        }
      } catch (err) {
        if (!cancelled) {
          debugLog("Location fetch failed:", err)
        }
      }
    }, 1200)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [location, loading])

  // Reset one-time auto-attempt if location becomes valid, so future invalid states can retry.
  useEffect(() => {
    if (location &&
      location.formattedAddress !== "Select location" &&
      location.city !== "Current Location") {
      autoLocationAttemptedRef.current = false
    }
  }, [location])

  // Function to extract location parts for display
  // Main location: First 2 parts only (e.g., "Mama Loca, G-2")
  // Sub location: City and State (e.g., "New Palasia, Indore")
  const getLocationDisplay = (fullAddress, city, state, area) => {
    if (!fullAddress) {
      // Fallback: Use area and city/state if available
      if (area) {
        return {
          main: area,
          sub: city && state ? `${city}, ${state}` : city || state || ""
        }
      }
      if (city) {
        return {
          main: city,
          sub: state || ""
        }
      }
      return { main: "Select location", sub: "" }
    }

    // Split address by comma
    const parts = fullAddress.split(',').map(part => part.trim()).filter(part => part.length > 0)

    // Main location: First 2 parts only (e.g., "Mama Loca, G-2")
    let mainLocation = ""
    if (parts.length >= 2) {
      mainLocation = parts.slice(0, 2).join(', ')
    } else if (parts.length >= 1) {
      mainLocation = parts[0]
    }

    // Sub location: City and State (prefer from location object, fallback to address parts)
    let subLocation = ""
    if (city && state) {
      subLocation = `${city}, ${state}`
    } else if (city) {
      subLocation = city
    } else if (state) {
      subLocation = state
    }

    return {
      main: mainLocation || "Select location",
      sub: subLocation
    }
  }

  // Get display location parts
  // Priority: formattedAddress (complete) > address > area/city
  // IMPORTANT: Sub location ALWAYS uses city and state from location object, never from address parts
  const locationDisplay = useMemo(() => {
    let mainLocation = ""
    let subLocation = ""

    // Debug: Log the entire location object
    debugLog("?? PageNavbar - Full Location Object:", {
      location,
      address: location?.address,
      formattedAddress: location?.formattedAddress,
      area: location?.area,
      city: location?.city,
      state: location?.state
    })

    // Get main location - prioritize area name over coordinates
    // Check if address/formattedAddress contains coordinates pattern (e.g., "22.7282, 75.8843")
    const isCoordinates = (str) => {
      if (!str) return false
      // Pattern: number.number, number.number (latitude, longitude)
      const coordPattern = /^-?\d+\.\d+,\s*-?\d+\.\d+$/
      return coordPattern.test(str.trim())
    }

    // Priority 0: Use mainTitle (ZOMATO-STYLE) - Exact building/cafe name
    // This is the most accurate - directly from Google Maps components
    // If mainTitle is available, show it with area if area is different
    if (location?.mainTitle && location.mainTitle.trim() !== "" && location.mainTitle !== "Location Found") {
      mainLocation = location.mainTitle;
      // If area is available and different from mainTitle, append it
      if (location?.area && location.area.trim() !== "" &&
        location.area.toLowerCase() !== location.mainTitle.toLowerCase() &&
        location.area.toLowerCase() !== location?.city?.toLowerCase()) {
        mainLocation = `${location.mainTitle}, ${location.area}`;
      }
      debugLog("??? ZOMATO-STYLE: Using mainTitle for display:", mainLocation);
    }

    // Priority 1: Use formattedAddress if it contains complete detailed address (has multiple parts)
    // Format: "Mama Loca Cafe, 501 Princess Center, 5th Floor, New Palasia, Indore, Madhya Pradesh 452001"
    if (!mainLocation && location?.formattedAddress && !isCoordinates(location.formattedAddress) && location.formattedAddress !== "Select location") {
      const formattedParts = location.formattedAddress.split(',').map(p => p.trim()).filter(p => p.length > 0)

      // Check if formattedAddress has complete address (4+ parts means it has POI, building, area, city, state)
      if (formattedParts.length >= 4) {
        debugLog("?? Using formattedAddress (complete address detected):", location.formattedAddress)

        // Extract locality parts (everything before city)
        // Find city index
        let cityIndex = -1
        if (location?.city) {
          cityIndex = formattedParts.findIndex(part =>
            part.toLowerCase() === location.city.toLowerCase() ||
            part.toLowerCase().includes(location.city.toLowerCase())
          )
        }

        // If city not found, look for state (city is usually before state)
        if (cityIndex === -1 && location?.state) {
          const stateIndex = formattedParts.findIndex(part =>
            part.toLowerCase().includes("madhya") ||
            part.toLowerCase().includes("pradesh") ||
            part.toLowerCase().includes(location.state.toLowerCase())
          )
          if (stateIndex > 0) {
            cityIndex = stateIndex - 1
          }
        }

        // Extract locality parts (POI, building, floor, area) - everything before city
        if (cityIndex > 0) {
          const localityParts = formattedParts.slice(0, cityIndex)
          if (localityParts.length > 0) {
            mainLocation = localityParts.join(', ')
            debugLog("??? Extracted locality from complete formattedAddress:", mainLocation)
          }
        } else {
          // If city not found, take first 3-4 parts (usually POI, building, floor, area)
          const localityParts = formattedParts.slice(0, Math.min(4, formattedParts.length - 2))
          if (localityParts.length > 0) {
            mainLocation = localityParts.join(', ')
            debugLog("??? Using first parts from formattedAddress:", mainLocation)
          }
        }
      }
    }

    // Priority 2: Use address field (it has the extracted locality from Google Maps)
    // This is more reliable as it's already processed by useLocation hook
    // Address field contains: "Mama Loca Cafe, 501 Princess Center, 5th Floor, New Palasia"
    if (!mainLocation && location?.address && !isCoordinates(location.address) && location.address !== "Select location") {
      debugLog("?? Processing address field (Priority 2):", location.address)

      // Check if address already contains locality (not just city)
      const addressParts = location.address.split(',').map(p => p.trim()).filter(p => p.length > 0)
      const cityInAddress = addressParts.some(part =>
        part.toLowerCase() === location?.city?.toLowerCase() ||
        part.toLowerCase() === "indore" ||
        part.toLowerCase() === "bhopal"
      )

      // If address doesn't contain city name, it's likely the locality
      if (!cityInAddress && addressParts.length > 0) {
        mainLocation = location.address
        debugLog("? Using address field as locality:", mainLocation)
      } else {
        // Address contains city, extract locality parts before city
        const filteredParts = addressParts.filter(part => {
          if (/^\d{6}$/.test(part)) return false
          if (part.toLowerCase() === "india" || part.length > 25) return false
          return true
        })

        let cityIndex = filteredParts.findIndex(part =>
          part.toLowerCase() === location?.city?.toLowerCase() ||
          part.toLowerCase() === "indore" ||
          part.toLowerCase() === "bhopal"
        )

        if (cityIndex > 0) {
          mainLocation = filteredParts.slice(0, cityIndex).join(', ')
          debugLog("? Extracted locality from address field:", mainLocation)
        } else if (filteredParts.length >= 3) {
          mainLocation = filteredParts.slice(0, 3).join(', ')
          debugLog("? Using first 3 parts from address:", mainLocation)
        }
      }
    }

    // Priority 2: Use formattedAddress to extract exact locality (e.g., "Princess center, 5th Floor, New Palasia")
    if (!mainLocation && location?.formattedAddress &&
      !isCoordinates(location.formattedAddress) &&
      location.formattedAddress !== "Select location") {
      debugLog("?? Processing formattedAddress (Priority 2):", location.formattedAddress)
      const parts = location.formattedAddress.split(',').map(part => part.trim()).filter(part => part.length > 0)
      debugLog("?? Address parts:", parts)

      // Remove pincode and country from parts (they're usually at the end)
      const filteredParts = parts.filter(part => {
        // Skip 6-digit pincode (standalone or with state)
        if (/^\d{6}$/.test(part)) return false
        // Skip parts that are just pincode (e.g., "Madhya Pradesh 452001" - we'll handle this)
        if (/^\d{6}$/.test(part.split(' ').pop())) {
          // Remove pincode from part (e.g., "Madhya Pradesh 452001" -> "Madhya Pradesh")
          return part.replace(/\s+\d{6}$/, '').trim()
        }
        // Skip "India" or country names
        if (part.toLowerCase() === "india" || part.length > 25) return false
        return true
      })
      debugLog("?? Filtered parts (without pincode/country):", filteredParts)

      // Extract locality parts (building, floor, area) - usually first 3 parts before city
      // Format: "Princess center, 5th Floor, New Palasia, Indore, Madhya Pradesh 452001"
      // We want: "Princess center, 5th Floor, New Palasia"

      // Find city index - check multiple ways
      let cityIndex = -1

      // Method 1: Check exact match with location.city
      if (location?.city) {
        cityIndex = filteredParts.findIndex(part =>
          part.toLowerCase() === location.city.toLowerCase()
        )
        debugLog(`?? City index (exact match with "${location.city}"):`, cityIndex)
      }

      // Method 2: Check common city names (case-insensitive)
      if (cityIndex === -1) {
        const commonCities = ["Indore", "indore", "Bhopal", "bhopal", "Mumbai", "mumbai", "Delhi", "delhi"]
        cityIndex = filteredParts.findIndex(part =>
          commonCities.some(city => part.toLowerCase() === city.toLowerCase())
        )
        debugLog("?? City index (common cities):", cityIndex)
      }

      // Method 3: Check if part contains state name (usually comes after city)
      if (cityIndex === -1 && location?.state) {
        const stateIndex = filteredParts.findIndex(part =>
          part.toLowerCase().includes(location.state.toLowerCase()) ||
          part.toLowerCase().includes("madhya") ||
          part.toLowerCase().includes("pradesh")
        )
        if (stateIndex > 0) {
          // City is usually one position before state
          cityIndex = stateIndex - 1
          debugLog("?? City index (before state):", cityIndex)
        }
      }

      // Method 4: Check for "Madhya Pradesh" or other state names
      if (cityIndex === -1) {
        const stateIndex = filteredParts.findIndex(part =>
          part.toLowerCase().includes("madhya") ||
          part.toLowerCase().includes("pradesh") ||
          part.toLowerCase().includes("maharashtra") ||
          part.toLowerCase().includes("gujarat")
        )
        if (stateIndex > 0) {
          cityIndex = stateIndex - 1
          debugLog("?? City index (before state name):", cityIndex)
        }
      }

      if (cityIndex > 0) {
        // Take all parts before city (building, floor, area)
        const localityParts = filteredParts.slice(0, cityIndex)
        if (localityParts.length > 0) {
          mainLocation = localityParts.join(', ')
          debugLog("??? Using exact locality from formattedAddress:", mainLocation)
        } else {
          debugLog("No locality parts found before city")
        }
      } else {
        // City not found, try to find state and take parts before it
        const stateIndex = filteredParts.findIndex(part =>
          part.toLowerCase().includes("madhya") ||
          part.toLowerCase().includes("pradesh") ||
          (location?.state && part.toLowerCase().includes(location.state.toLowerCase()))
        )

        if (stateIndex > 0) {
          // Take first 3 parts before state (usually building, floor, area)
          const localityParts = filteredParts.slice(0, Math.min(3, stateIndex))
          if (localityParts.length > 0) {
            mainLocation = localityParts.join(', ')
            debugLog("??? Using parts before state from formattedAddress:", mainLocation)
          }
        }

        // If still no mainLocation, use first 3 parts as fallback
        if (!mainLocation && filteredParts.length >= 3) {
          mainLocation = filteredParts.slice(0, 3).join(', ')
          debugLog("??? Using first 3 parts from formattedAddress (fallback):", mainLocation)
        } else if (!mainLocation && filteredParts.length >= 2) {
          mainLocation = filteredParts.slice(0, 2).join(', ')
          debugLog("? Using first 2 parts from formattedAddress (fallback):", mainLocation)
        } else if (!mainLocation && filteredParts.length >= 1) {
          const firstPart = filteredParts[0]
          if (!isCoordinates(firstPart) && firstPart.length > 2) {
            mainLocation = firstPart
            debugLog("? Using first part from formattedAddress (fallback):", mainLocation)
          }
        }
      }

      if (!mainLocation) {
        debugLog("Could not extract locality from formattedAddress")
      } else {
        debugLog("?????? Final mainLocation extracted:", mainLocation)
      }
    }
    // Priority 2: Use address field if formattedAddress not available or didn't work
    if (!mainLocation &&
      location?.address &&
      !isCoordinates(location.address) &&
      location.address !== "Select location") {
      debugLog("?? Processing address field:", location.address)
      const parts = location.address.split(',').map(part => part.trim()).filter(part => part.length > 0)
      debugLog("?? Address parts:", parts)

      // Remove pincode, country, and placeholder values
      const filteredParts = parts.filter(part => {
        if (/^\d{6}$/.test(part)) return false
        if (part.toLowerCase() === "india" || part.length > 25) return false
        if (part.toLowerCase() === "select location" || part.toLowerCase() === "current location") return false
        return true
      })
      debugLog("?? Filtered parts:", filteredParts)

      // If filtered parts is empty or only has placeholder, skip this priority
      if (filteredParts.length === 0 ||
        (filteredParts.length === 1 &&
          (filteredParts[0].toLowerCase() === "select location" ||
            filteredParts[0].toLowerCase() === "current location"))) {
        debugLog("?? Address field only contains placeholder, skipping")
        // Don't set mainLocation, continue to next priority
      } else {

        // Find city index - same logic as formattedAddress
        let cityIndex = -1

        if (location?.city) {
          cityIndex = filteredParts.findIndex(part =>
            part.toLowerCase() === location.city.toLowerCase()
          )
        }

        if (cityIndex === -1) {
          const commonCities = ["Indore", "indore", "Bhopal", "bhopal"]
          cityIndex = filteredParts.findIndex(part =>
            commonCities.some(city => part.toLowerCase().includes(city.toLowerCase()))
          )
        }

        if (cityIndex === -1 && location?.state) {
          const stateIndex = filteredParts.findIndex(part =>
            part.toLowerCase().includes(location.state.toLowerCase())
          )
          if (stateIndex > 0) {
            cityIndex = stateIndex - 1
          }
        }

        if (cityIndex > 0) {
          const localityParts = filteredParts.slice(0, cityIndex)
          if (localityParts.length > 0) {
            mainLocation = localityParts.join(', ')
            debugLog("? Using exact locality from address:", mainLocation)
          }
        } else if (filteredParts.length >= 3) {
          mainLocation = filteredParts.slice(0, 3).join(', ')
          debugLog("? Using first 3 parts from address:", mainLocation)
        } else if (filteredParts.length >= 2) {
          mainLocation = filteredParts.slice(0, 2).join(', ')
          debugLog("? Using first 2 parts from address:", mainLocation)
        } else if (filteredParts.length >= 1) {
          const firstPart = filteredParts[0]
          if (!isCoordinates(firstPart) &&
            firstPart.length > 2 &&
            firstPart.toLowerCase() !== "select location" &&
            firstPart.toLowerCase() !== "current location") {
            mainLocation = firstPart
            debugLog("? Using first part from address:", mainLocation)
          }
        }
      }
    }
    // Priority 3: Try to extract from formattedAddress or address again with simpler logic
    if (!mainLocation) {
      // Try to get first 3 parts from any available address field
      const addressToUse = location?.formattedAddress || location?.address || ""
      if (addressToUse &&
        !isCoordinates(addressToUse) &&
        addressToUse !== "Select location" &&
        addressToUse.trim() !== "") {
        const parts = addressToUse.split(',').map(part => part.trim()).filter(part => part.length > 0)
        const filteredParts = parts.filter(part => {
          if (/^\d{6}$/.test(part)) return false // Skip pincode
          if (part.toLowerCase() === "india" || part.length > 25) return false // Skip country
          return true
        })

        // If we have 3+ parts, take first 3 (usually building, floor, area)
        if (filteredParts.length >= 3) {
          mainLocation = filteredParts.slice(0, 3).join(', ')
          debugLog("? Using first 3 parts as fallback:", mainLocation)
        } else if (filteredParts.length >= 2) {
          mainLocation = filteredParts.slice(0, 2).join(', ')
          debugLog("? Using first 2 parts as fallback:", mainLocation)
        } else if (filteredParts.length >= 1) {
          const firstPart = filteredParts[0]
          if (!isCoordinates(firstPart) && firstPart.length > 2) {
            mainLocation = firstPart
            debugLog("? Using first part as fallback:", mainLocation)
          }
        }
      }
    }

    // Priority 4: Force extract from formattedAddress if still no mainLocation
    // This is a last resort to get locality before falling back to city
    if (!mainLocation &&
      location?.formattedAddress &&
      !isCoordinates(location.formattedAddress) &&
      location.formattedAddress !== "Select location") {
      debugLog("?????? FORCE EXTRACTING from formattedAddress (last resort):", location.formattedAddress)
      const parts = location.formattedAddress.split(',').map(p => p.trim()).filter(p => p.length > 0)
      const filteredParts = parts.filter(part => {
        if (/^\d{6}$/.test(part)) return false
        if (part.toLowerCase() === "india" || part.length > 25) return false
        return true
      })

      // Force take first 3 parts (building, floor, area) - ignore city detection
      if (filteredParts.length >= 3) {
        // Check if 3rd part is city, if yes take first 2
        const thirdPart = filteredParts[2].toLowerCase()
        if (thirdPart === "indore" || thirdPart === location?.city?.toLowerCase()) {
          mainLocation = filteredParts.slice(0, 2).join(', ')
          debugLog("??? FORCE: Using first 2 parts (3rd is city):", mainLocation)
        } else {
          mainLocation = filteredParts.slice(0, 3).join(', ')
          debugLog("??? FORCE: Using first 3 parts:", mainLocation)
        }
      } else if (filteredParts.length >= 2) {
        mainLocation = filteredParts.slice(0, 2).join(', ')
        debugLog("??? FORCE: Using first 2 parts:", mainLocation)
      } else if (filteredParts.length >= 1) {
        const firstPart = filteredParts[0]
        if (!isCoordinates(firstPart) && firstPart.length > 2 && firstPart.toLowerCase() !== location?.city?.toLowerCase()) {
          mainLocation = firstPart
          debugLog("??? FORCE: Using first part:", mainLocation)
        }
      }
    }

    // Priority 5: Use area name if address extraction failed (fallback)
    // Show area + city format if both available, otherwise just area
    if (!mainLocation && location?.area && location.area.trim() !== "" && !isCoordinates(location.area)) {
      // If we have both area and city, show "Area, City" format
      if (location?.city && location.city.trim() !== "" && location.city !== "Unknown City" &&
        location.area.toLowerCase() !== location.city.toLowerCase()) {
        mainLocation = `${location.area}, ${location.city}`
        debugLog("? Using area + city:", mainLocation)
      } else {
        mainLocation = location.area
        debugLog("? Using area name:", mainLocation)
      }
    }
    // Priority 6: Use city ONLY if nothing else worked (last resort)
    // Skip if city is "Current Location" or "Select location" - these are placeholders
    else if (!mainLocation && location?.city &&
      location.city.trim() !== "" &&
      location.city !== "Unknown City" &&
      location.city !== "Current Location" &&
      location.city !== "Select location") {
      mainLocation = location.city
      debugLog("?????? FALLBACK: Using city (no locality found):", mainLocation)
    }
    // Final fallback: Show "Select location" instead of coordinates
    else if (!mainLocation) {
      mainLocation = "Select location"
      debugLog("?? No valid location found, showing placeholder")
    }

    // If mainLocation is still coordinates, replace with area or city
    if (isCoordinates(mainLocation)) {
      if (location?.area && location.area.trim() !== "") {
        mainLocation = location.area
      } else if (location?.city && location.city.trim() !== "" && location.city !== "Unknown City") {
        mainLocation = location.city
      } else {
        mainLocation = "Select location"
      }
      debugLog("?? Replaced coordinates with:", mainLocation)
    }

    // Final check: If mainLocation is just city name, try one more time to extract from formattedAddress
    if (mainLocation && (mainLocation.toLowerCase() === location?.city?.toLowerCase() || mainLocation === "Indore")) {
      debugLog("?????? MainLocation is city, trying to extract locality one more time...")

      // First priority: Check if area is available in location object
      if (location?.area && location.area.trim() !== "" &&
        location.area.toLowerCase() !== location?.city?.toLowerCase() &&
        !isCoordinates(location.area)) {
        mainLocation = `${location.area}, ${location.city}`
        debugLog("??? Using area from location object:", mainLocation)
      } else if (location?.formattedAddress && !isCoordinates(location.formattedAddress)) {
        // Second priority: Extract area from formattedAddress (before city)
        const parts = location.formattedAddress.split(',').map(p => p.trim()).filter(p => p.length > 0)
        debugLog("?? Extracting area from formattedAddress parts:", parts)

        // Find city index
        let cityIndex = -1
        if (location?.city) {
          cityIndex = parts.findIndex(part =>
            part.toLowerCase() === location.city.toLowerCase() ||
            part.toLowerCase().includes(location.city.toLowerCase())
          )
        }

        // If city found, take parts before city as area
        if (cityIndex > 0) {
          const areaParts = parts.slice(0, cityIndex)
          if (areaParts.length > 0) {
            // Take the last part before city as area (usually sublocality like "New Palasia")
            const extractedArea = areaParts[areaParts.length - 1]
            if (extractedArea && extractedArea.toLowerCase() !== location.city.toLowerCase() &&
              !extractedArea.match(/^\d+/) && extractedArea.length > 2 &&
              !extractedArea.toLowerCase().includes("madhya") &&
              !extractedArea.toLowerCase().includes("pradesh")) {
              mainLocation = `${extractedArea}, ${location.city}`
              debugLog("??? Extracted area from formattedAddress (before city):", mainLocation)
            } else if (areaParts.length >= 2) {
              // Take last 2 parts before city
              const lastTwoParts = areaParts.slice(-2)
              if (lastTwoParts.every(p => p.toLowerCase() !== location.city.toLowerCase())) {
                mainLocation = lastTwoParts.join(', ')
                debugLog("??? Extracted area (2 parts) from formattedAddress:", mainLocation)
              }
            }
          }
        } else {
          // City not found, filter out city/state and take first parts
          const filteredParts = parts.filter(part => {
            if (/^\d{6}$/.test(part)) return false
            if (part.toLowerCase() === "india" || part.length > 25) return false
            if (part.toLowerCase() === "indore" || part.toLowerCase() === location?.city?.toLowerCase()) return false
            if (part.toLowerCase().includes("madhya") || part.toLowerCase().includes("pradesh")) return false
            return true
          })

          if (filteredParts.length >= 1) {
            const extractedArea = filteredParts[0]
            if (extractedArea && extractedArea.toLowerCase() !== location.city.toLowerCase() &&
              extractedArea.length > 2 && !extractedArea.match(/^\d+/)) {
              mainLocation = `${extractedArea}, ${location.city}`
              debugLog("??? Extracted area (first part) from formattedAddress:", mainLocation)
            }
          }
        }
      }
    }

    // Final check: If mainLocation is still just city, try to add area if available
    if (mainLocation && mainLocation.toLowerCase() === location?.city?.toLowerCase()) {
      // First try location.area field
      if (location?.area && location.area.trim() !== "" &&
        location.area.toLowerCase() !== location.city.toLowerCase() &&
        !isCoordinates(location.area)) {
        mainLocation = `${location.area}, ${location.city}`
        debugLog("??? Added area to city display:", mainLocation)
      }
      // If area field is empty, try to extract from formattedAddress one more time
      else if (location?.formattedAddress && !isCoordinates(location.formattedAddress)) {
        const parts = location.formattedAddress.split(',').map(p => p.trim()).filter(p => p.length > 0)
        // Look for parts that might be sublocality (usually 2nd or 3rd part before city)
        if (parts.length >= 3) {
          // Try second-to-last part before city/state
          for (let i = parts.length - 3; i >= 0; i--) {
            const part = parts[i]
            if (part && part.toLowerCase() !== location.city.toLowerCase() &&
              !part.match(/^\d+/) && part.length > 2 &&
              !part.toLowerCase().includes("madhya") &&
              !part.toLowerCase().includes("pradesh") &&
              part.toLowerCase() !== "india") {
              mainLocation = `${part}, ${location.city}`
              debugLog("??? Last resort: Extracted area from formattedAddress:", mainLocation)
              break
            }
          }
        }
      }
    }

    // Sub location: ALWAYS use city and state from location object ONLY (never from address parts)
    // Check if city and state exist in location object
    const hasCity = location?.city && location.city.trim() !== "" && location.city !== "Unknown City"
    const hasState = location?.state && location.state.trim() !== ""

    if (hasCity && hasState) {
      subLocation = `${location.city}, ${location.state}`
    } else if (hasCity) {
      subLocation = location.city
    } else if (hasState) {
      subLocation = location.state
    } else {
      // If city/state not available in location object, try to extract from formattedAddress
      // This is a fallback - formattedAddress format: "Mama Loca, G-2, Princess Center 6/3, Opposite Manpasand Garden, New Palasia, Indore, 452001, India"
      if (location?.formattedAddress) {
        const parts = location.formattedAddress.split(',').map(part => part.trim()).filter(part => part.length > 0)

        debugLog("?? Extracting city/state from formattedAddress:", {
          formattedAddress: location.formattedAddress,
          parts: parts,
          partsLength: parts.length
        })

        // For Indian addresses: city and state are usually before pincode (which is a 6-digit number)
        // Format: "Mama Loca, G-2, Princess Center 6/3, Opposite Manpasand Garden, New Palasia, Indore, 452001, India"
        if (parts.length >= 4) {
          // Method 1: Find pincode index (6-digit number)
          const pincodeIndex = parts.findIndex(part => /^\d{6}$/.test(part))

          debugLog("?? Pincode index:", pincodeIndex)

          if (pincodeIndex > 1 && pincodeIndex !== -1) {
            // City is 2 positions before pincode, State is 1 position before pincode
            const cityPart = parts[pincodeIndex - 2]
            const statePart = parts[pincodeIndex - 1]

            debugLog("?? Extracted from pincode position:", { cityPart, statePart, pincodeIndex })

            // Validate: both should be non-empty and not numbers
            if (cityPart && statePart &&
              !cityPart.match(/^\d+$/) &&
              !statePart.match(/^\d+$/) &&
              cityPart.length > 2 &&
              statePart.length > 2) {
              subLocation = `${cityPart}, ${statePart}`
              debugLog("? Using extracted city/state (pincode method):", subLocation)
            }
          }

          // Method 2: If pincode not found or extraction failed, try alternative method
          if (!subLocation && parts.length >= 4) {
            // Last part is usually "India", second last might be pincode
            const lastPart = parts[parts.length - 1]
            const secondLastPart = parts[parts.length - 2]

            debugLog("?? Trying India method:", { lastPart, secondLastPart })

            // If last part is "India" and second last is pincode (6-digit)
            if (lastPart === "India" && /^\d{6}$/.test(secondLastPart)) {
              // City and state are 3 and 4 positions before "India"
              // Format: "..., New Palasia, Indore, 452001, India"
              // parts[length-1] = "India"
              // parts[length-2] = "452001" (pincode)
              // parts[length-3] = "Indore" (state)
              // parts[length-4] = "New Palasia" (city)
              const cityPart = parts[parts.length - 4]
              const statePart = parts[parts.length - 3]

              debugLog("?? Extracted from India position:", { cityPart, statePart })

              if (cityPart && statePart &&
                !cityPart.match(/^\d+$/) &&
                !statePart.match(/^\d+$/) &&
                cityPart.length > 2 &&
                statePart.length > 2) {
                subLocation = `${cityPart}, ${statePart}`
                debugLog("? Using extracted city/state (India method):", subLocation)
              }
            }
          }

          // Method 3: Direct extraction - if we have 8 parts, city and state are at index 4 and 5
          // Format: "Mama Loca, G-2, Princess Center 6/3, Opposite Manpasand Garden, New Palasia, Indore, 452001, India"
          // parts[4] = "New Palasia" (city), parts[5] = "Indore" (state)
          if (!subLocation && parts.length >= 6) {
            // If we have pincode at index 6, city and state are at 4 and 5
            const pincodeIndex = parts.findIndex(part => /^\d{6}$/.test(part))
            if (pincodeIndex === 6 && parts.length >= 7) {
              const cityPart = parts[4]
              const statePart = parts[5]

              debugLog("?? Direct extraction (index method):", { cityPart, statePart, pincodeIndex })

              if (cityPart && statePart &&
                !cityPart.match(/^\d+$/) &&
                !statePart.match(/^\d+$/) &&
                cityPart.length > 2 &&
                statePart.length > 2) {
                subLocation = `${cityPart}, ${statePart}`
                debugLog("? Using extracted city/state (direct index method):", subLocation)
              }
            }
          }

          // Method 4: Simple fallback - if we have 6+ parts, always try parts[4] and parts[5]
          // This is the most reliable method for the given address format
          // Format: "Mama Loca, G-2, Princess Center 6/3, Opposite Manpasand Garden, New Palasia, Indore, 452001, India"
          // parts[0] = "Mama Loca", parts[1] = "G-2", parts[2] = "Princess Center 6/3", parts[3] = "Opposite Manpasand Garden"
          // parts[4] = "New Palasia" (city), parts[5] = "Indore" (state)
          if (!subLocation && parts.length >= 6) {
            // Directly use parts[4] and parts[5] - these are ALWAYS city and state for this format
            const cityPart = parts[4]
            const statePart = parts[5]

            debugLog("?? Simple fallback (parts[4] and parts[5]):", {
              cityPart,
              statePart,
              partsLength: parts.length,
              allParts: parts
            })

            // Less strict validation - just check they're not numbers and not empty
            if (cityPart && statePart &&
              !cityPart.match(/^\d+$/) &&
              !statePart.match(/^\d+$/) &&
              cityPart.length > 1 &&
              statePart.length > 1) {
              subLocation = `${cityPart}, ${statePart}`
              debugLog("? Using extracted city/state (simple fallback):", subLocation)
            } else {
              debugLog("?? Validation failed for parts[4] and parts[5]:", { cityPart, statePart })
            }
          }
        }
      }

      // Also try from address field if formattedAddress didn't work
      if (!subLocation && location?.address && location.address !== location?.formattedAddress) {
        const parts = location.address.split(',').map(part => part.trim()).filter(part => part.length > 0)
        debugLog("?? Trying address field:", { address: location.address, parts })

        if (parts.length >= 4) {
          const pincodeIndex = parts.findIndex(part => /^\d{6}$/.test(part))
          if (pincodeIndex > 1 && pincodeIndex !== -1) {
            const cityPart = parts[pincodeIndex - 2]
            const statePart = parts[pincodeIndex - 1]
            if (cityPart && statePart &&
              !cityPart.match(/^\d+$/) &&
              !statePart.match(/^\d+$/) &&
              cityPart.length > 2 &&
              statePart.length > 2) {
              subLocation = `${cityPart}, ${statePart}`
              debugLog("? Using extracted city/state from address field:", subLocation)
            }
          }
        }
      }

      // If still empty, leave it empty
      if (!subLocation) {
        subLocation = ""
        debugLog("?? Could not extract city/state from address")
      }
    }

    // Debug log
    debugLog("?? PageNavbar Location Display:", {
      location: location,
      city: location?.city,
      state: location?.state,
      hasCity,
      hasState,
      mainLocation,
      subLocation,
      formattedAddress: location?.formattedAddress,
      address: location?.address,
      finalSubLocation: subLocation || "EMPTY"
    })

    // CRITICAL: Ensure subLocation is NEVER from address parts[1] and parts[2]
    // If subLocation looks like "G-2, Princess Center 6/3", it's wrong - force extraction
    if (subLocation && (subLocation.includes("G-2") || subLocation.includes("Princess Center"))) {
      debugLog("WRONG subLocation detected:", subLocation)
      debugLog("Forcing re-extraction from formattedAddress")

      // Force re-extraction
      if (location?.formattedAddress) {
        const parts = location.formattedAddress.split(',').map(part => part.trim()).filter(part => part.length > 0)
        if (parts.length >= 6) {
          const cityPart = parts[4]
          const statePart = parts[5]
          if (cityPart && statePart &&
            !cityPart.match(/^\d+$/) &&
            !statePart.match(/^\d+$/) &&
            cityPart.length > 1 &&
            statePart.length > 1) {
            subLocation = `${cityPart}, ${statePart}`
            debugLog("??? FORCED extraction - New subLocation:", subLocation)
          }
        }
      }
    }

    return {
      main: mainLocation,
      sub: subLocation
    }
  }, [location])

  const mainLocationName = locationDisplay.main
  const subLocationName = locationDisplay.sub
  const savedAddressLabel = useMemo(() => {
    if (location?.label && String(location.label).trim()) {
      return String(location.label).trim()
    }
    try {
      const stored = localStorage.getItem("userLocation")
      if (!stored) return ""
      const parsed = JSON.parse(stored)
      return parsed?.label && String(parsed.label).trim() ? String(parsed.label).trim() : ""
    } catch {
      return ""
    }
  }, [location?.label])
  const locationSubText = savedAddressLabel ? `Delivering to ${savedAddressLabel}` : subLocationName

  const handleLocationClick = () => {
    // Open location selector overlay
    openLocationSelector()
  }

  const textColorClass = textColor === "white" ? "text-white" : "text-black"
  const iconFill = textColor === "white" ? "white" : "black"
  const ringColor = textColor === "white" ? "ring-white/30" : "ring-gray-800/30"

  const zIndexClass = zIndex === 50 ? "z-50" : "z-20"

  return (
    <nav
      className={`relative ${zIndexClass} w-full px-3 sm:px-4 md:px-6 lg:px-8 pb-2 sm:pb-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] sm:pt-[calc(env(safe-area-inset-top)+0.75rem)] bg-transparent !bg-transparent shadow-none border-0`}
      onClick={onNavClick}
    >
      <div className="flex items-center justify-between max-w-7xl mx-auto">

        {/* Left: Company Logo */}
        {showLogo && (
          <Link to="/food/user" className="flex-shrink-0 mr-3 sm:mr-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={companyName || "Logo"}
                className="h-10 w-auto sm:h-12 md:h-14 object-contain scale-[1.8] sm:scale-[2] origin-left rounded-xl"
                crossOrigin="anonymous"
                onError={(e) => {
                  e.target.style.display = 'none'
                }}
              />
            ) : (
              <span className={`text-lg font-bold text-${textColor} scale-[1.8] sm:scale-[2] origin-left inline-block`}>
                {companyName || "Appzeto"}
              </span>
            )}
          </Link>
        )}

        {/* Center/Left: Location Selector */}
        <div className={`flex-1 flex items-center min-w-0 ${showLogo ? "justify-center absolute left-1/2 -translate-x-1/2" : "justify-start pr-2"}`}>
          <Button
            variant="ghost"
            onClick={handleLocationClick}
            disabled={loading}
            className={`h-auto px-0 py-0 hover:bg-transparent transition-colors flex flex-col max-w-full ${showLogo ? "items-center flex-shrink-0" : "items-start justify-center min-w-0 shrink"}`}
          >
            {loading ? (
              <span className={`text-sm font-bold ${textColorClass}`}>
                Loading...
              </span>
            ) : (
              <div className={`flex flex-col ${showLogo ? "items-center" : "items-start w-full"} min-w-0 max-w-full`}>
                <div className={`flex items-center min-w-0 max-w-full ${showLogo ? "justify-center gap-1" : "gap-1.5"}`}>
                  {!showLogo && <MapPin className={`h-[18px] w-[18px] ${textColor === "white" ? "text-white" : "text-[#FE5502]"} flex-shrink-0`} strokeWidth={2.5} />}
                  <div className={`flex items-center gap-1 min-w-0 max-w-full`}>
                    <span className={`${showLogo ? "text-sm sm:text-base md:text-lg" : "text-[16px]"} font-bold ${textColorClass} truncate block`}>
                      {mainLocationName}
                    </span>
                    <ChevronDown className={`${showLogo ? "h-3 w-3 sm:h-4 sm:w-4" : "h-[14px] w-[14px] mt-0.5"} ${textColorClass} flex-shrink-0`} strokeWidth={showLogo ? 2.5 : 3} />
                  </div>
                </div>
                {locationSubText && (
                  <span className={`${showLogo ? "text-[10px] sm:text-xs font-medium text-center max-w-[140px] sm:max-w-[200px]" : "text-[11px] font-semibold text-left pl-6"} ${textColorClass}/80 truncate block w-full`}>
                    {locationSubText}
                  </span>
                )}
              </div>
            )}
          </Button>
        </div>

        {/* Right: Actions (Wallet & Cart) */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-auto">
          <Link
            to="/user/wallet"
            className={`p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:scale-105 active:scale-95 transition-all ${textColor === "white" ? "text-black dark:text-white" : "text-gray-700 dark:text-white"}`}
            title="Wallet"
          >
            <Wallet className="h-5 w-5" strokeWidth={2} />
          </Link>

          <Link
            to="/user/cart"
            className={`relative p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:scale-105 active:scale-95 transition-all ${textColor === "white" ? "text-black dark:text-white" : "text-gray-700 dark:text-white"}`}
            title="Cart"
          >
            <ShoppingCart className="h-5 w-5" strokeWidth={2} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center ring-2 ring-white">
                <span className="text-[10px] font-bold text-white">{cartCount > 99 ? "99+" : cartCount}</span>
              </span>
            )}
          </Link>

          {/* Profile - Only shown if showProfile is true */}
          {showProfile && (
            <Link to="/user/profile">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-full p-0 hover:opacity-80 transition-opacity"
                title="Profile"
              >
                <div className={`h-full w-full rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shadow-sm`}>
                  <span className={`text-xs sm:text-sm font-bold ${textColor === "white" ? "text-black" : "text-gray-900"}`}>
                    A
                  </span>
                </div>
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}



