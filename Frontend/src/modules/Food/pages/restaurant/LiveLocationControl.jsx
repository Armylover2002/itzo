import { useNavigate } from "react"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { ArrowLeft, MapPin, Navigation, Map as MapIcon, WifiOff } from "lucide-react"
import { Switch } from "@food/components/ui/switch"
import { Card, CardContent } from "@food/components/ui/card"
import { useLiveLocation } from "@food/contexts/LiveLocationContext"

export default function LiveLocationControl() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  
  const {
    restaurantData,
    loading,
    liveTrackingEnabled,
    isUpdatingLocation,
    currentLocation,
    isOffline,
    handleToggleTracking,
    handleUpdateLocationManually
  } = useLiveLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#0d315b] border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (restaurantData?.businessType !== "Street Food Vendor") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 flex-1">Live Location</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <MapIcon className="w-16 h-16 text-gray-300 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Not Available</h2>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            Live location features are only available for Street Food Vendors. Your current business type is {restaurantData?.businessType || "Fixed Restaurant"}.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden pb-24 md:pb-6">
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3 shadow-sm">
        <button onClick={goBack} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Live Location</h1>
      </div>

      {isOffline && (
        <div className="bg-red-50 p-2 flex items-center justify-center gap-2 text-red-600 text-xs font-bold border-b border-red-100">
          <WifiOff className="w-3.5 h-3.5" />
          <span>You are offline. Location updates are paused.</span>
        </div>
      )}

      <div className="p-4 space-y-4 max-w-2xl mx-auto mt-4">
        <Card className="bg-white border-none shadow-sm overflow-hidden rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${liveTrackingEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                  <h3 className="text-base font-bold text-gray-900">Live GPS Tracking</h3>
                </div>
                <p className="text-sm text-gray-500 leading-snug pr-4">
                  Automatically update your location as you move within your zone. 
                  Keep this on while moving to serve customers.
                </p>
              </div>
              <Switch
                checked={liveTrackingEnabled}
                onCheckedChange={handleToggleTracking}
                className="data-[state=checked]:bg-emerald-500 shrink-0 mt-1"
              />
            </div>
            
            {liveTrackingEnabled && (
              <div className="mt-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-medium flex items-start gap-2 border border-emerald-100">
                <Navigation className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Location tracking is active. Customers can see your real-time movement on the map.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2.5 bg-[#f3f5f7] text-[#0b2a4d] rounded-xl shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Current Position</h3>
                <p className="text-sm text-gray-500">
                  {currentLocation 
                    ? `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`
                    : "No location data available"}
                </p>
              </div>
            </div>

            <button
              onClick={handleUpdateLocationManually}
              disabled={isUpdatingLocation || isOffline}
              className={`w-full py-3.5 text-sm font-bold rounded-xl transition-colors shadow-sm shadow-[#c3ccd6] 
                ${(isUpdatingLocation || isOffline)
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed shadow-none" 
                  : "bg-[#0d315b] hover:bg-[#0b2a4d] text-white"}`}
            >
              Update Location Now
            </button>
            <p className="text-[11px] text-gray-400 text-center mt-3">
              {liveTrackingEnabled 
                ? "Manual updates override live tracking temporarily."
                : "Tap to pin your exact location manually when parked."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
