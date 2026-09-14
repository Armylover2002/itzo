import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { motion, AnimatePresence } from "framer-motion"
import Lenis from "lenis"
import {
  ArrowLeft,
  Star,
  ChevronRight,
  ChevronDown,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react"
import BottomPopup from "@delivery/components/BottomPopup"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

// Using placeholder for restaurant review banner
const restaurantReviewBanner = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=400&fit=crop"

const accordionItems = [
  {
    id: 1,
    question: "How is my restaurant's rating calculated",
    answer: "Your restaurant's rating is calculated based on customer reviews and ratings from delivery and dining orders. The system takes an average of all ratings received, with more recent reviews having slightly more weight."
  },
  {
    id: 2,
    question: "Why am I not getting rating on all orders",
    answer: "Not all customers leave ratings after their orders. Some customers may skip the rating step, while others may not have the option to rate depending on the order type or platform. Typically, about 30-40% of customers provide ratings."
  },
  {
    id: 3,
    question: "Can I call customer to discuss rating",
    answer: "Yes, you can contact customers through the order details page if they have provided a phone number. However, please be respectful and professional when discussing ratings."
  },
  {
    id: 4,
    question: "How to raise a concern if I think rating was bad due to delivery partner",
    answer: "If you believe a low rating was due to delivery partner issues, you can raise a concern through the order details page. Navigate to the specific order, click on 'Raise Concern', and select 'Delivery Partner Issue'."
  },
  {
    id: 5,
    question: "What if I don't agree with the rating",
    answer: "If you disagree with a customer's rating, you can reply to the review publicly to address concerns professionally. You can also raise a concern if you believe the rating violates our guidelines."
  },
  {
    id: 6,
    question: "How can I reply on a customer review",
    answer: "To reply to a customer review, go to the Reviews section in your restaurant dashboard. Find the review you want to respond to and click the 'Reply' button. Write a professional, courteous response."
  }
]

export default function RatingsReviews() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [expandedItems, setExpandedItems] = useState(new Set())
  const [showThankYouPopup, setShowThankYouPopup] = useState(false)
  const [showNotHelpfulPopup, setShowNotHelpfulPopup] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

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

  const toggleAccordion = (itemId) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const handleThankYou = () => {
    setShowThankYouPopup(true)
    setFeedbackSubmitted(true)
  }

  const handleNotHelpful = () => {
    setShowNotHelpfulPopup(true)
    setFeedbackSubmitted(true)
  }

  const handleThankYouPopupClose = () => {
    setShowThankYouPopup(false)
  }

  const handleNotHelpfulPopupClose = () => {
    setShowNotHelpfulPopup(false)
  }

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Ratings, reviews</h1>
        </div>
      </div>

      {/* Top Banner Section */}
      <div className="relative w-full">
        <img 
          src={restaurantReviewBanner}
          alt="Ratings and reviews banner"
          className="w-full h-auto object-cover"
        />
      </div>

      {/* Your Restaurant's Rating Section */}
      <div className="px-4 py-4 bg-white">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold text-gray-900">Your restaurant's rating</h2>
          <div className="bg-green-600 px-3 py-1.5 rounded-lg flex items-center gap-1">
            <span className="text-white text-sm font-bold">4.0</span>
            <Star className="w-4 h-4 text-white fill-white" />
          </div>
        </div>
        <button
          onClick={() => navigate("/restaurant/feedback?tab=reviews")}
          className="flex items-center gap-1 text-blue-600 text-sm font-normal hover:text-blue-700 transition-colors"
        >
          <span>View order ratings</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Select Your Concern Section */}
      <div className="px-4 py-4">
        <div className="border  border-gray-100 rounded-lg p-4">
          <h3 className="text-base font-bold  text-gray-900 mb-4">Select your concern</h3>
          
          <div className="space-y-0">
            {accordionItems.map((item, index) => {
              const isExpanded = expandedItems.has(item.id)
              return (
                <div key={item.id}>
                  <button
                    onClick={() => toggleAccordion(item.id)}
                    className="w-full flex items-center justify-between py-3 text-left"
                  >
                    <span className="text-sm text-gray-900 font-normal pr-4">
                      {item.question}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-900 shrink-0 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  
                  {index < accordionItems.length - 1 && (
                    <div className="border-b border-gray-300" />
                  )}

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pb-3 pt-1">
                          <p className="text-sm text-gray-700 font-normal leading-relaxed">
                            {item.answer}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Feedback Section */}
      {!feedbackSubmitted && (
        <div className="px-4 py-6 pb-8">
          <p className="text-base font-semibold text-gray-900 text-center mb-4">
            Was this helpful in resolving your query?
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleThankYou}
              className="flex-1 flex items-center justify-center gap-2 border-2 border-blue-600 bg-white rounded-lg py-3 px-4 hover:bg-blue-50 transition-colors"
            >
              <ThumbsUp className="w-5 h-5 text-blue-600" />
              <span className="text-blue-600 text-sm font-semibold">Yes, thank you</span>
            </button>
            <button
              onClick={handleNotHelpful}
              className="flex-1 flex items-center justify-center gap-2 border-2 border-gray-400 bg-white rounded-lg py-3 px-4 hover:bg-gray-50 transition-colors"
            >
              <ThumbsDown className="w-5 h-5 text-gray-600" />
              <span className="text-gray-600 text-sm font-semibold">Not helpful</span>
            </button>
          </div>
        </div>
      )}

      {/* Thank You Popup */}
      <BottomPopup
        isOpen={showThankYouPopup}
        onClose={handleThankYouPopupClose}
        showHandle={true}
      >
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ThumbsUp className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Thank you!</h3>
          <p className="text-sm text-gray-600">
            We're glad we could help resolve your query.
          </p>
        </div>
      </BottomPopup>

      {/* Not Helpful Popup */}
      <BottomPopup
        isOpen={showNotHelpfulPopup}
        onClose={handleNotHelpfulPopupClose}
        showHandle={true}
      >
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ThumbsDown className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">We're sorry</h3>
          <p className="text-sm text-gray-600 mb-4">
            We're sorry this wasn't helpful. Please contact our support team for further assistance.
          </p>
          <button
            onClick={() => {
              setShowNotHelpfulPopup(false)
              debugLog("Contact support")
            }}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Contact Support
          </button>
        </div>
      </BottomPopup>
    </div>
  )
}

