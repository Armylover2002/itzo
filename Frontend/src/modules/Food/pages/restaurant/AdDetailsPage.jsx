import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useNavigate, useParams } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import {
  ArrowLeft,
  Calendar,
  Megaphone,
  Edit
} from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import BottomNavOrders from "@food/components/restaurant/BottomNavOrders"
import { restaurantAPI } from "@food/api"
import { toast } from "sonner"

export default function AdDetailsPage() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const { id } = useParams()
  const [adData, setAdData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!id) return
      try {
        setLoading(true)
        const response = await restaurantAPI.getAdvertisement(id)
        if (!cancelled) setAdData(response?.data?.data || null)
      } catch (err) {
        if (!cancelled) {
          setAdData(null)
          toast.error(err?.response?.data?.message || "Failed to load advertisement")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden pb-24 md:pb-6">
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3">
        <button
          onClick={goBack}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Ads Details</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {loading && (
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-gray-600">Loading advertisement...</p>
            </CardContent>
          </Card>
        )}

        {!loading && !adData && (
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-6 text-center">
              <p className="text-gray-900 font-semibold">Advertisement unavailable</p>
              <p className="text-sm text-gray-600 mt-2">
                No advertisement data was found for ID {id || "unknown"}.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && adData && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-white shadow-sm border border-gray-100">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-gray-900">
                      Ads ID #{adData.adsId || adData.id}
                    </h2>
                    <span className="bg-red-50 text-red-700 text-xs font-medium px-3 py-1 rounded-full">
                      {adData.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Card className="bg-white shadow-sm border border-gray-100">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <Calendar className="w-5 h-5 text-[#FF0000]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-0.5">Ads Created</p>
                      <p className="text-sm font-medium text-gray-900">{adData.adsCreated}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <Calendar className="w-5 h-5 text-[#FF0000]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-0.5">Duration</p>
                      <p className="text-sm font-medium text-gray-900">
                        {adData.duration?.start || "N/A"} - {adData.duration?.end || "N/A"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <Megaphone className="w-5 h-5 text-[#FF0000]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-0.5">Ads Details</p>
                      <p className="text-sm font-bold text-gray-900">{adData.adsDetails || adData.adsType}</p>
                    </div>
                  </div>

                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card className="bg-white shadow-sm border border-gray-100">
                <CardContent className="p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-1.5">Title</h3>
                    <p className="text-sm text-gray-600">{adData.title}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-1.5">Description</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{adData.description || "—"}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-1.5">Pause Note</h3>
                    <p className="text-sm text-gray-600">{adData.pauseNote || "—"}</p>
                  </div>

                  {(adData.imageUrl || adData.videoUrl) && (
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 mb-1.5">Media</h3>
                      {adData.imageUrl && (
                        <img src={adData.imageUrl} alt={adData.title} className="w-full rounded-lg object-cover max-h-56" />
                      )}
                      {adData.videoUrl && (
                        <video src={adData.videoUrl} controls className="w-full rounded-lg mt-2 max-h-56" />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <Button
              onClick={() => navigate(`/food/restaurant/advertisements/${adData.id}/edit`)}
              className="w-full bg-[#FF0000] hover:bg-[#E60000] text-white font-semibold py-3 rounded-lg"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Advertisement
            </Button>
          </>
        )}
      </div>

      <div className="lg:hidden">
        <BottomNavOrders />
      </div>
    </div>
  )
}
