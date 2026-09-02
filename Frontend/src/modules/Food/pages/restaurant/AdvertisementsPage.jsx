import { useState, useEffect } from "react"
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
  Copy,
  Trash2
} from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import BottomNavbar from "@food/components/restaurant/BottomNavbar"
import MenuOverlay from "@food/components/restaurant/MenuOverlay"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function AdvertisementsPage() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [activeFilter, setActiveFilter] = useState("all")
  const [openMenuId, setOpenMenuId] = useState(null)
  const [showMenu, setShowMenu] = useState(false)

  // Close menu when clicking outside
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

  // Lenis smooth scrolling
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

  const advertisements = []

  // Filter counts
  const filterCounts = {
    all: advertisements.length,
    pending: advertisements.filter(ad => ad.status === "Pending").length,
    running: advertisements.filter(ad => ad.status === "Running").length,
    approve: 0
  }

  // Filter advertisements based on active filter
  const filteredAds = activeFilter === "all" 
    ? advertisements 
    : activeFilter === "pending"
    ? advertisements.filter(ad => ad.status === "Pending")
    : activeFilter === "running"
    ? advertisements.filter(ad => ad.status === "Running")
    : advertisements.filter(ad => ad.status === "Approve")

  const filters = [
    { id: "all", label: "All", count: filterCounts.all },
    { id: "pending", label: "Pending", count: filterCounts.pending },
    { id: "running", label: "Running", count: filterCounts.running },
    { id: "approve", label: "Approve", count: filterCounts.approve }
  ]

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden pb-20 md:pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3">
        <button 
          onClick={goBack}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Advertisement List</h1>
      </div>

      {/* Filter Tabs */}
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
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {activeFilter === filter.id && (
                <motion.div
                  layoutId="activeFilter"
                  className="absolute inset-0 bg-[#ff8100] rounded-full z-0"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <span className="relative z-10 text-black font-bold">
                {filter.label} {filter.count > 0 && filter.count}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Advertisement List */}
      <div className="px-4 py-4 space-y-3">
        <AnimatePresence mode="wait">
          {filteredAds.map((ad, index) => (
            <motion.div
              key={ad.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, delay: index * 0.1, ease: [0.4, 0, 0.2, 1] }}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card className="bg-white shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/restaurant/advertisements/${ad.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    {/* Left Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-base font-bold text-gray-900">
                          Ads ID # {ad.id}
                        </h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          ad.status === "Running"
                            ? "bg-[#e7eaef] text-[#092240]"
                            : "bg-[#e7eaef] text-[#092240]"
                        }`}>
                          {ad.status}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-700 mb-2">{ad.type}</p>
                      
                      <div className="space-y-1 text-xs text-gray-600">
                        <p>Ads Placed: {ad.adsPlaced}</p>
                        <p>Duration: {ad.duration.start} - {ad.duration.end}</p>
                      </div>
                    </div>

                    {/* Right Icons */}
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
                      
                      {/* Context Menu */}
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
                              { icon: Eye, label: "View Ads", action: () => navigate(`/restaurant/advertisements/${ad.id}`) },
                              { icon: Edit, label: "Edit Ads", action: () => navigate(`/restaurant/advertisements/${ad.id}/edit`) },
                              { icon: Pause, label: "Pause Ads", action: () => debugLog("Pause:", ad.id) },
                              { icon: Copy, label: "Copy Ads", action: () => debugLog("Copy:", ad.id) },
                              { icon: Trash2, label: "Delete Ads", action: () => debugLog("Delete:", ad.id), isDanger: true }
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
                          navigate(`/restaurant/advertisements/${ad.id}`)
                        }}
                        className="p-2 bg-[#ff8100] hover:bg-[#e67300] rounded-lg transition-colors"
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

        {/* Empty State */}
        {filteredAds.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No advertisements found</p>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          navigate("/restaurant/advertisements/new")
        }}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 w-14 h-14 bg-[#ff8100] hover:bg-[#e67300] text-white rounded-full shadow-lg flex items-center justify-center z-40 transition-colors"
      >
        <Plus className="w-6 h-6" />
      </motion.button>

      {/* Bottom Navigation Bar */}
      <BottomNavbar onMenuClick={() => setShowMenu(true)} />
      
      {/* Menu Overlay */}
      <MenuOverlay showMenu={showMenu} setShowMenu={setShowMenu} />
    </div>
  )
}


