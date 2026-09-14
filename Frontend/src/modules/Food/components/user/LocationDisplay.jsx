import { MapPin, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { useLocationSimple } from "@food/hooks/useLocationSimple"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


/**
 * LocationDisplay Component
 * 
 * Zomato-style location display showing "Delivering to [Area Name]"
 * 
 * Features:
 * - Shows area/subLocality name (e.g., "New Palasia")
 * - Falls back to city if area is not available
 * - Handles loading and error states
 * - Clickable to request location permission
 * 
 * Usage:
 * ```jsx
 * <LocationDisplay />
 * ```
 */
export default function LocationDisplay({ 
  className = "",
  showIcon = true,
  onLocationClick 
}) {
  const { location, loading, error, permissionGranted, requestLocation } = useLocationSimple()

  // Determine what to display
  const displayText = location?.area 
    ? location.area  // Primary: Show area name (e.g., "New Palasia")
    : location?.city 
    ? location.city  // Fallback: Show city if area not available
    : "Select location"  // Default: Show placeholder

  // Handle click
  const handleClick = async () => {
    if (onLocationClick) {
      onLocationClick()
    } else {
      // Default: Request location permission
      try {
        await requestLocation()
      } catch (err) {
        debugError("Failed to get location:", err)
      }
    }
  }

  // Loading state
  if (loading && !location) {
    return (
      <Button
        variant="ghost"
        className={`flex items-center gap-2 ${className}`}
        disabled
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm font-medium">Getting location...</span>
      </Button>
    )
  }

  // Error state
  if (error && !location) {
    return (
      <Button
        variant="ghost"
        className={`flex items-center gap-2 text-red-500 hover:text-red-600 ${className}`}
        onClick={handleClick}
      >
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm font-medium">Location unavailable</span>
      </Button>
    )
  }

  // Normal state: Show location
  return (
    <Button
      variant="ghost"
      className={`flex items-center gap-2 hover:bg-gray-100 ${className}`}
      onClick={handleClick}
    >
      {showIcon && <MapPin className="h-4 w-4 text-red-500" fill="currentColor" />}
      <div className="flex flex-col items-start">
        <span className="text-xs text-gray-500">Delivering to</span>
        <span className="text-sm font-semibold text-gray-900">{displayText}</span>
      </div>
    </Button>
  )
}

/**
 * CompactLocationDisplay Component
 * 
 * Compact version showing just the area name (for navbar/header)
 * 
 * Usage:
 * ```jsx
 * <CompactLocationDisplay />
 * ```
 */
export function CompactLocationDisplay({ className = "" }) {
  const { location, loading, error, requestLocation } = useLocationSimple()

  const displayText = location?.area || location?.city || "Select"

  if (loading && !location) {
    return (
      <span className={`text-sm font-medium ${className}`}>
        Loading...
      </span>
    )
  }

  return (
    <button
      onClick={requestLocation}
      className={`flex items-center gap-1 text-sm font-semibold hover:underline ${className}`}
    >
      <MapPin className="h-4 w-4" />
      {displayText}
    </button>
  )
}

/**
 * FullLocationDisplay Component
 * 
 * Full version showing area, city, and state (for detailed views)
 * 
 * Usage:
 * ```jsx
 * <FullLocationDisplay />
 * ```
 */
export function FullLocationDisplay({ className = "" }) {
  const { location, loading, error, requestLocation } = useLocationSimple()

  if (loading && !location) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        <span className="text-gray-500">Getting location...</span>
      </div>
    )
  }

  if (error && !location) {
    return (
      <div className={`flex items-center gap-2 text-red-500 ${className}`}>
        <AlertCircle className="h-5 w-5" />
        <span>Location unavailable: {error}</span>
      </div>
    )
  }

  if (!location) {
    return (
      <Button variant="outline" onClick={requestLocation} className={className}>
        <MapPin className="h-4 w-4 mr-2" />
        Select Location
      </Button>
    )
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-red-500" fill="currentColor" />
        <div className="flex flex-col">
          <span className="text-xs text-gray-500">Delivering to</span>
          <span className="text-lg font-bold text-gray-900">
            {location.area || location.city || "Current Location"}
          </span>
        </div>
      </div>
      {(location.city || location.state) && (
        <span className="text-sm text-gray-600 ml-7">
          {[location.city, location.state].filter(Boolean).join(", ")}
        </span>
      )}
    </div>
  )
}


