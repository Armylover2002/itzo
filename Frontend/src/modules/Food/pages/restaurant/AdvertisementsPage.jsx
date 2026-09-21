import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import Lenis from "lenis"
import { 
  ArrowLeft,
  MoreVertical,
  ChevronRight,
  Plus,
  Eye,
  Edit,
  Pause,
  Trash2
} from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import { restaurantAPI } from "@food/api"
import { toast } from "sonner"

export default function AdvertisementsPage() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [activeFilter, setActiveFilter] = useState("all")
  const [openMenuId, setOpenMenuId] = useState(null)
  const [advertisements, setAdvertisements] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAds = useCallback(async () => {
    try {
      setLoading(true)
      const response = await restaurantAPI.getAdvertisements()
      const data = response?.data?.data
      setAdvertisements(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load advertisements")
      setAdvertisements([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAds()
  }, [fetchAds])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openMenuId && !event.target.closest(`[data-menu-id="${openMenuId}"]`)) {
        setOpenMenuId(null)
      }
    }

    if (openMenuId) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("touchstart", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
    }
  }, [openMenuId])

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  const matchesFilterStatus = (ad, filterId) => {
    const status = String(ad?.status || "")
    const lifecycleStatus = String(ad?.lifecycleStatus || "")

    if (filterId === "pending") return status === "Pending"
    if (filterId === "approved") {
      return status === "Approved" || status === "Running" || lifecycleStatus === "Approved"
    }
    if (filterId === "rejected") return status === "Rejected"
    if (filterId === "paused") return status === "Paused" || lifecycleStatus === "Paused"
    if (filterId === "expired") return status === "Expired"
    return true
  }

  const filterCounts = {
    all: advertisements.length,
    pending: advertisements.filter((ad) => matchesFilterStatus(ad, "pending")).length,
    approved: advertisements.filter((ad) => matchesFilterStatus(ad, "approved")).length,
    rejected: advertisements.filter((ad) => matchesFilterStatus(ad, "rejected")).length,
    paused: advertisements.filter((ad) => matchesFilterStatus(ad, "paused")).length,
    expired: advertisements.filter((ad) => matchesFilterStatus(ad, "expired")).length,
  }

  const filteredAds =
    activeFilter === "all"
      ? advertisements
      : advertisements.filter((ad) => matchesFilterStatus(ad, activeFilter))

  const filters = [
    { id: "all", label: "All", count: filterCounts.all },
    { id: "pending", label: "Pending", count: filterCounts.pending },
    { id: "approved", label: "Approved", count: filterCounts.approved },
    { id: "rejected", label: "Rejected", count: filterCounts.rejected },
    { id: "paused", label: "Paused", count: filterCounts.paused },
    { id: "expired", label: "Expired", count: filterCounts.expired },
  ]

  const getStatusBadgeClass = (status) => {
    if (status === "Approved" || status === "Running") return "bg-green-100 text-green-700"
    if (status === "Pending") return "bg-red-50 text-red-700"
    if (status === "Rejected") return "bg-red-100 text-red-700"
    if (status === "Paused") return "bg-slate-100 text-slate-700"
    if (status === "Expired") return "bg-orange-100 text-orange-700"
    return "bg-blue-100 text-blue-700"
  }

  const handlePause = async (id) => {
    try {
      await restaurantAPI.pauseAdvertisement(id)
      toast.success("Advertisement status updated")
      await fetchAds()
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to pause advertisement")
    }
  }

  const handleDelete = async (id) => {
    try {
      await restaurantAPI.deleteAdvertisement(id)
      toast.success("Advertisement deleted")
      await fetchAds()
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete advertisement")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden pb-24 md:pb-6">
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3">
        <button 
          onClick={goBack}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Advertisement List</h1>
      </div>

      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-[57px] z-40">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
          {filters.map((filter, index) => (
            <motion.button
              key={filter.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveFilter(filter.id)}
              className={`relative z-10 flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeFilter === filter.id
                  ? "text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {activeFilter === filter.id && (
                <motion.div
                  layoutId="adFilterPill"
                  className="absolute inset-0 bg-[#0D315B] rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{filter.label} ({filter.count})</span>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {loading && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">Loading advertisements...</p>
          </div>
        )}

        <AnimatePresence>
          {!loading && filteredAds.map((ad, index) => (
            <motion.div
              key={ad.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card className="bg-white shadow-sm border border-gray-100">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-base font-bold text-gray-900">
                          Ads ID # {ad.adsId || ad.id}
                        </h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusBadgeClass(ad.status)}`}>
                          {ad.status}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-700 mb-2">{ad.type || ad.adsType}</p>
                      
                      <div className="space-y-1 text-xs text-gray-600">
                        <p>Ads Placed: {ad.adsPlaced || "N/A"}</p>
                        <p>Duration: {ad.duration?.start || "N/A"} - {ad.duration?.end || "N/A"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 relative">
                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === ad.id ? null : ad.id)
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative"
                        data-menu-id={ad.id}
                      >
                        <MoreVertical className="w-5 h-5 text-gray-600" />
                      </motion.button>
                      
                      <AnimatePresence>
                        {openMenuId === ad.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-50 min-w-[180px]"
                            data-menu-id={ad.id}
                          >
                            {[
                              { icon: Eye, label: "View Ads", action: () => navigate(`/food/restaurant/advertisements/${ad.id}`) },
                              { icon: Edit, label: "Edit Ads", action: () => navigate(`/food/restaurant/advertisements/${ad.id}/edit`) },
                              { icon: Pause, label: "Pause Ads", action: () => handlePause(ad.id) },
                              { icon: Trash2, label: "Delete Ads", action: () => handleDelete(ad.id), isDanger: true }
                            ].map((option, idx) => {
                              const IconComponent = option.icon
                              return (
                                <motion.button
                                  key={option.label}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: idx * 0.03, duration: 0.2 }}
                                  whileHover={{ x: 4 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    option.action()
                                    setOpenMenuId(null)
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                                    option.isDanger
                                      ? "text-red-600 hover:bg-red-50"
                                      : "text-gray-700 hover:bg-gray-50"
                                  }`}
                                >
                                  <IconComponent className="w-4 h-4" />
                                  <span>{option.label}</span>
                                </motion.button>
                              )
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          navigate(`/food/restaurant/advertisements/${ad.id}`)
                        }}
                        className="p-2 bg-[#0D315B] hover:bg-[#E60000] rounded-lg transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-white" />
                      </motion.button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {!loading && filteredAds.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No advertisements found</p>
          </div>
        )}
      </div>

      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          navigate("/food/restaurant/advertisements/new")
        }}
        className="fixed bottom-6 right-4 md:right-6 w-14 h-14 bg-[#0D315B] hover:bg-[#E60000] text-white rounded-full shadow-lg flex items-center justify-center z-40 transition-colors"
      >
        <Plus className="w-6 h-6" />
      </motion.button>
    </div>
  )
}
