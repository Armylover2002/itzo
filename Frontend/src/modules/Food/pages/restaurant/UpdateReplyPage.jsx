import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useNavigate, useParams } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import Lenis from "lenis"
import { 
  ArrowLeft,
  Star
} from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { Textarea } from "@food/components/ui/textarea"
import BottomNavbar from "@food/components/restaurant/BottomNavbar"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function UpdateReplyPage() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const { id } = useParams()
  const [replyText, setReplyText] = useState("")

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

  const reviewData = null

  // Load existing reply if editing
  useEffect(() => {
    if (reviewData?.currentReply) {
      setReplyText(reviewData.currentReply)
    }
  }, [id, reviewData])

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
        <h1 className="text-lg font-bold text-gray-900 flex-1">Update Reply</h1>
      </div>

      {/* Main Content */}
      <div className="px-4 py-4 space-y-4">
        {!reviewData && (
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-6 text-center">
              <p className="text-gray-900 font-semibold">Review unavailable</p>
              <p className="text-sm text-gray-600 mt-2">
                No real review data was found for ID {id || "unknown"}.
              </p>
            </CardContent>
          </Card>
        )}
        {/* Product Review Section */}
        {reviewData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-4 space-y-4">
              {/* Product Details */}
              <div className="flex items-start gap-3">
                {/* Product Image */}
                <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  <img
                    src={reviewData.productImage}
                    alt={reviewData.productName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop"
                    }}
                  />
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-gray-900 mb-2">
                    {reviewData.productName}
                  </h3>
                  
                  {/* Rating Stars */}
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < reviewData.rating
                            ? "fill-[#ff8100] text-[#ff8100]"
                            : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Reviewer Name */}
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {reviewData.reviewerName}
                </p>
              </div>

              {/* Review Text */}
              <div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {reviewData.reviewText}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        )}

        {/* Reply Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-4">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write your reply..."
                disabled={!reviewData}
                className="w-full min-h-[120px] bg-red-50 border-red-200 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#ff8100] focus:border-[#ff8100] resize-none"
                rows={5}
              />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Update Review Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 z-50 md:relative md:border-t-0 md:px-4 md:py-4 md:mt-6">
        <Button
          onClick={() => {
            debugLog("Update reply:", { reviewId: id, reply: replyText })
            // Navigate back to reviews list after update
            navigate("/restaurant/reviews")
          }}
          disabled={!reviewData}
          className="w-full bg-[#ff8100] hover:bg-[#e67300] text-white font-semibold py-3 rounded-lg"
        >
          Update Review
        </Button>
      </div>

      {/* Bottom Navigation Bar - Hidden on this page to avoid overlap */}
      <div className="hidden md:block">
        <BottomNavbar />
      </div>
    </div>
  )
}


