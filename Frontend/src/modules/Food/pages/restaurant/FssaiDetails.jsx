import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { ArrowLeft, Eye, Loader2, AlertCircle, X } from "lucide-react"
import { restaurantAPI } from "@food/api"
import { toast } from "sonner"

export default function FssaiDetails() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [restaurantData, setRestaurantData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showViewer, setShowViewer] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (data) {
          setRestaurantData(data)
        }
      } catch (error) {
        console.error("Error fetching FSSAI data:", error)
        toast.error("Failed to load FSSAI details")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const formatDate = (dateString) => {
    if (!dateString) return "Not available"
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric"
      })
    } catch (e) {
      return dateString
    }
  }

  const hasFssai = restaurantData?.fssaiNumber && restaurantData.fssaiNumber.trim() !== ""

  if (loading) {
    return (
      <div className="min-h-full bg-white lg:bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
        <p className="text-sm text-gray-500 font-medium">Loading FSSAI details...</p>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-white lg:bg-slate-50 flex flex-col">
      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="px-4 pt-4 pb-3 flex items-center gap-3 lg:max-w-2xl lg:mx-auto lg:px-8 lg:py-5 lg:w-full">
          <button
            onClick={goBack}
            className="p-2 rounded-full hover:bg-gray-100 lg:hidden"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-gray-900 lg:text-2xl lg:font-bold">FSSAI Details</h1>
            <p className="text-xs text-gray-500 lg:text-sm">
              {hasFssai ? "Manage your restaurant license data." : "No live restaurant license data available."}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 pt-4 pb-28 lg:max-w-2xl lg:mx-auto lg:px-8 lg:py-6 lg:pb-8 lg:w-full space-y-4">
        {!hasFssai && (
          <div className="rounded-2xl bg-[#ffe9b3] px-4 py-3 flex items-start gap-3">
            <div className="mt-1 h-6 w-6 rounded-full bg-black/80 flex items-center justify-center text-white text-xs font-semibold">
              i
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">
                FSSAI details are not available
              </p>
              <p className="text-xs text-gray-700 mt-1">
                Upload or sync your license information to manage compliance here.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-4 space-y-3 lg:p-6 lg:shadow-md lg:border-slate-200">
          <div>
            <p className="text-xs text-gray-500 mb-1">FSSAI registration number</p>
            <p className={`text-sm font-semibold ${hasFssai ? "text-gray-900" : "text-gray-500"}`}>
              {restaurantData?.fssaiNumber || "Not available"}
            </p>
          </div>

          <div className="border-t border-dashed border-gray-200" />

          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 mb-1">Document</p>
              <p className={`text-sm font-semibold truncate ${restaurantData?.fssaiImage ? "text-gray-900" : "text-gray-500"}`}>
                {restaurantData?.fssaiImage ? "FSSAI License Document" : "No document uploaded"}
              </p>
            </div>
            {restaurantData?.fssaiImage && (
              <button
                type="button"
                onClick={() => setShowViewer(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                View
              </button>
            )}
          </div>

          <div className="border-t border-dashed border-gray-200" />

          <div>
            <p className="text-xs text-gray-500 mb-1">Valid up to</p>
            <p className={`text-sm font-semibold ${restaurantData?.fssaiExpiry ? "text-gray-900" : "text-gray-500"}`}>
              {formatDate(restaurantData?.fssaiExpiry)}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-6 pt-3 border-t border-gray-200 bg-white lg:max-w-2xl lg:mx-auto lg:px-8 lg:w-full lg:border-t-0 lg:bg-transparent lg:pb-8">
        <button
          type="button"
          className="w-full py-3 rounded-full bg-black text-white text-sm font-medium mb-2 lg:rounded-xl lg:py-3.5"
          onClick={() => navigate("/food/restaurant/fssai/update")}
        >
          {hasFssai ? "Update FSSAI license" : "Add FSSAI license"}
        </button>
      </div>
      {/* Image Viewer Modal */}
      {showViewer && restaurantData?.fssaiImage && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-200">
          <div className="p-4 flex items-center justify-between text-white border-b border-white/10">
            <h3 className="text-sm font-medium">FSSAI License Document</h3>
            <button 
              onClick={() => setShowViewer(false)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
            <img 
              src={typeof restaurantData.fssaiImage === 'string' ? restaurantData.fssaiImage : restaurantData.fssaiImage?.url} 
              alt="FSSAI License" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}
