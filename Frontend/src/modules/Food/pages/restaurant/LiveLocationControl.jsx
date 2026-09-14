import { useNavigate } from "react-router-dom"
import { ArrowLeft, MapPin, Navigation, RefreshCw } from "lucide-react"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { Switch } from "@food/components/ui/switch"
import { useLiveLocation } from "@food/contexts/LiveLocationContext"

export default function LiveLocationControl() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const {
    restaurantData,
    liveTrackingEnabled,
    currentLocation,
    lastLocationUpdate,
    isOffline,
    handleToggleTracking,
    handleUpdateLocationManually,
  } = useLiveLocation()

  if (restaurantData && restaurantData.businessType !== "Street Food Vendor") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center gap-3">
        <MapPin className="h-10 w-10 text-gray-300" />
        <h2 className="text-base font-bold text-gray-900">Not Available</h2>
        <p className="text-sm text-gray-500 max-w-xs">
          Live Location Control is only available for Street Food Vendor accounts.
        </p>
        <button
          onClick={() => navigate("/food/restaurant")}
          className="mt-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold"
        >
          Back to dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900">Live Location Control</h1>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {isOffline && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-4 py-3">
            You appear to be offline. Location updates will sync once you're back online.
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-900">Live GPS Tracking</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {liveTrackingEnabled
                ? "Customers can see your live position while this is on."
                : "Turn this on to start broadcasting your live position."}
            </p>
          </div>
          <Switch checked={liveTrackingEnabled} onCheckedChange={handleToggleTracking} />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">Current Position</p>
            {lastLocationUpdate && (
              <span className="text-[11px] text-gray-400">
                Updated {new Date(lastLocationUpdate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 flex items-start gap-2">
            <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
            <span>{currentLocation?.formattedAddress || currentLocation?.address || "No location captured yet."}</span>
          </p>
          <button
            onClick={handleUpdateLocationManually}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Update Location Now
          </button>
          <button
            onClick={() => navigate("/food/restaurant/move-location")}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
          >
            <Navigation className="h-4 w-4" />
            Move My Stall On Map
          </button>
        </div>
      </div>
    </div>
  )
}
