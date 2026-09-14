import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import Lenis from "lenis"
import { 
  ArrowLeft,
  Search,
  Image as ImageIcon
} from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import BottomNavbar from "@food/components/restaurant/BottomNavbar"
import MenuOverlay from "@food/components/restaurant/MenuOverlay"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function ReviewsPage() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [showMenu, setShowMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [failedImages, setFailedImages] = useState(new Set())

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

  const reviews = []

  // Filter reviews based on search
  const filteredReviews = reviews.filter(review => {
    const searchLower = searchQuery.toLowerCase()
    return (
      review.orderId.toLowerCase().includes(searchLower) ||
      review.productName.toLowerCase().includes(searchLower) ||
      review.reviewerName.toLowerCase().includes(searchLower)
    )
  })

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
        <h1 className="text-lg font-bold text-gray-900 flex-1">Customer Reviews</h1>
      </div>

      {/* Search Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="relative">
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by order id or food name..."
            className="w-full pl-4 pr-10 py-2.5 rounded-lg border-gray-200 focus:ring-2 focus:ring-[#ff8100]"
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Reviews List */}
      <div className="px-4 py-4 space-y-4">
        {filteredReviews.map((review, index) => (
          <motion.div
            key={review.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Card className="bg-white shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                {/* Order Details */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">
                    Order # {review.orderId}
                  </span>
                  <span className="text-xs text-gray-500">
                    {review.date} | {review.time}
                  </span>
                </div>

                {/* Product Details */}
                <div className="flex items-center gap-3">
                  {/* Product Image */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                    {failedImages.has(review.id) || !review.productImage ? (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      </div>
                    ) : (
                      <img
                        src={review.productImage}
                        alt={review.productName}
                        className="w-full h-full object-cover"
                        onError={() => {
                          setFailedImages(prev => new Set([...prev, review.id]))
                        }}
                      />
                    )}
                  </div>

                  {/* Product Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{review.productName}</p>
                  </div>

                  {/* Action Button */}
                  <Button
                    onClick={() => {
                      if (review.hasReply) {
                        debugLog("View reply for review:", review.id)
                        // Navigate to view reply page if needed
                      } else {
                        navigate(`/restaurant/reviews/${review.id}/reply`)
                      }
                    }}
                    className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg ${
                      review.hasReply
                        ? "bg-blue-100 hover:bg-blue-200 text-blue-700"
                        : "bg-[#ff8100] hover:bg-[#e67300] text-white"
                    }`}
                  >
                    {review.hasReply ? "View Reply" : "Give Reply"}
                  </Button>
                </div>

                {/* Reviewer Information */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Reviewer</p>
                    <p className="text-sm font-semibold text-gray-900">{review.reviewerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                    <p className="text-sm font-medium text-gray-700">{review.phoneNumber}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {/* Empty State */}
        {filteredReviews.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No reviews found</p>
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <BottomNavbar onMenuClick={() => setShowMenu(true)} />
      
      {/* Menu Overlay */}
      <MenuOverlay showMenu={showMenu} setShowMenu={setShowMenu} />
    </div>
  )
}


