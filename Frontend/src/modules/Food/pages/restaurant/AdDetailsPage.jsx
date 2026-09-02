import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useNavigate, useParams } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import Lenis from "lenis"
import { 
  ArrowLeft,
  Calendar,
  Megaphone,
  DollarSign,
  Edit
} from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import BottomNavbar from "@food/components/restaurant/BottomNavbar"
import MenuOverlay from "@food/components/restaurant/MenuOverlay"

export default function AdDetailsPage() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const { id } = useParams()
  const [showMenu, setShowMenu] = useState(false)

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

  const adData = null

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden pb-24 md:pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3">
        <button 
          onClick={goBack}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Ads Details</h1>
      </div>

      {/* Main Content */}
      <div className="px-4 py-4 space-y-4">
        {!adData && (
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-6 text-center">
              <p className="text-gray-900 font-semibold">Advertisement unavailable</p>
              <p className="text-sm text-gray-600 mt-2">
                No real advertisement data was found for ID {id || "unknown"}.
              </p>
            </CardContent>
          </Card>
        )}

        {adData && (
          <>
        {/* Ad ID and Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900">
                  Ads ID #{adData.id}
                </h2>
                <span className="bg-[#e7eaef] text-[#092240] text-xs font-medium px-3 py-1 rounded-full">
                  {adData.status}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Ad Information Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-4 space-y-3">
              {/* Ads Created */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <Calendar className="w-5 h-5 text-[#ff8100]" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">Ads Created</p>
                  <p className="text-sm font-medium text-gray-900">{adData.adsCreated}</p>
                </div>
              </div>

              {/* Duration */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <Calendar className="w-5 h-5 text-[#ff8100]" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">Duration</p>
                  <p className="text-sm font-medium text-gray-900">
                    {adData.duration.start} - {adData.duration.end}
                  </p>
                </div>
              </div>

              {/* Ads Details */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <Megaphone className="w-5 h-5 text-[#ff8100]" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">Ads Details</p>
                  <p className="text-sm font-bold text-gray-900">{adData.adsDetails}</p>
                </div>
              </div>

              {/* Payment Status */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <DollarSign className="w-5 h-5 text-[#ff8100]" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">Payment Status</p>
                  <p className="text-sm font-medium text-red-600">{adData.paymentStatus}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Ad Content Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-4 space-y-4">
              {/* Title */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1.5">Title</h3>
                <p className="text-sm text-gray-600">{adData.title}</p>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1.5">Description</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{adData.description}</p>
              </div>

              {/* Pause Note */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1.5">Pause Note</h3>
                <p className="text-sm text-gray-600">{adData.pauseNote}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Image Section Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-4 space-y-4">
              {/* Profile Image */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-2">Profile Image</h3>
                <div className="w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
                  <img 
                    src={adData.profileImage}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = `https://ui-avatars.com/api/?name=Hungry+PUPPETS&background=ff8100&color=fff&size=200`
                    }}
                  />
                </div>
              </div>

              {/* Cover Image */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-2">Cover Image</h3>
                <div className="w-full h-48 rounded-lg overflow-hidden border border-gray-200">
                  <img 
                    src={adData.coverImage}
                    alt="Cover"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = `https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=400&fit=crop`
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
          </>
        )}
      </div>

      {/* Edit Ads Button - Fixed at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 z-50 md:relative md:border-t-0 md:px-4 md:py-4 md:mt-6">
        <Button
          onClick={() => {
            if (adData?.id) {
              navigate(`/restaurant/advertisements/${adData.id}/edit`)
            }
          }}
          disabled={!adData}
          className="w-full bg-[#ff8100] hover:bg-[#e67300] text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
        >
          <Edit className="w-5 h-5" />
          <span>Edit Ads</span>
        </Button>
      </div>

      {/* Bottom Navigation Bar */}
      <BottomNavbar onMenuClick={() => setShowMenu(true)} />
      
      {/* Menu Overlay */}
      <MenuOverlay showMenu={showMenu} setShowMenu={setShowMenu} />
    </div>
  )
}

