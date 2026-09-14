import { useState } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, X } from "lucide-react"
import { adminAPI } from "@food/api"
import { API_ENDPOINTS } from "@food/api/config"
import api from "@food/api"
import { toast } from "sonner"
import { useCompanyName } from "@food/hooks/useCompanyName"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function ShareFeedback() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [rating, setRating] = useState(null)
  const [showThanks, setShowThanks] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const numbers = Array.from({ length: 11 }, (_, i) => i)

  const handleClose = () => {
    goBack()
  }

  const handleContinue = async () => {
    if (rating === null) return
    
    try {
      setIsSubmitting(true)
      // Save feedback experience to backend
      const response = await api.post(API_ENDPOINTS.ADMIN.FEEDBACK_EXPERIENCE_CREATE, {
        rating: Math.ceil(rating / 2) || 1, // Convert 0-10 to 1-5 for backend
        module: 'restaurant',
        comment: `User rated ${rating}/10 overall experience`
      })
      
      if (response.data?.success) {
        setShowThanks(true)
      } else {
        throw new Error(response.data?.message || 'Failed to submit')
      }
    } catch (error) {
      debugError('Error submitting feedback:', error)
      toast.error(error.message || 'Failed to save feedback')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-full bg-white lg:bg-slate-50 flex flex-col">
      <div className="lg:max-w-lg lg:mx-auto lg:w-full lg:py-10 lg:px-8 lg:flex lg:flex-col lg:flex-1">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 lg:px-0 lg:pt-0">
        <h1 className="text-xl font-semibold text-gray-900 lg:text-2xl">
          Share your feedback
        </h1>
        <button
          onClick={handleClose}
          className="p-2 rounded-full hover:bg-gray-100 lg:hidden"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-900" />
        </button>
      </div>

      <div className="flex-1 px-4 lg:px-0 lg:rounded-2xl lg:border lg:border-slate-200 lg:bg-white lg:p-8 lg:shadow-sm">
        {/* Question */}
        <div className="mt-6 mb-6">
          <p className="text-sm text-gray-700 mb-1">Tell us about your</p>
          <p className="text-lg font-semibold text-gray-900">
            Overall experience with {companyName.toLowerCase()}
          </p>
        </div>

        {/* Rating scale */}
        <div className="mb-3 lg:mb-6">
          <div className="grid grid-cols-11 gap-1 rounded-xl border border-gray-300 bg-white overflow-hidden lg:gap-1.5">
            {numbers.map((num) => {
              const isActive = rating === num
              const intensity =
                rating === null ? 0 : Math.abs(num - rating)
              const scale = isActive ? 1.05 : intensity === 1 ? 1.02 : 1

              return (
                <motion.button
                  key={num}
                  type="button"
                  onClick={() => setRating(num)}
                  whileTap={{ scale: 0.96 }}
                  animate={{ scale }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className={`py-2 text-xs font-medium border-l border-gray-200 first:border-l-0 focus:outline-none ${
                    isActive
                      ? "bg-black text-white"
                      : "bg-white text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {num}
                </motion.button>
              )
            })}
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-red-500">Very Bad</span>
            <span className="text-xs text-green-600">Very Good</span>
          </div>
          {rating !== null && (
            <motion.p
              className="mt-3 text-xs text-gray-600"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              key={rating}
            >
              You rated your experience{" "}
              <span className="font-semibold text-gray-900">
                {rating}/10
              </span>
              .
            </motion.p>
          )}
        </div>

        {/* Illustration placeholder */}
        <div className="mt-10 flex items-center justify-center lg:mt-8">
          <div className="w-full max-w-xs h-48 rounded-3xl bg-gradient-to-r from-indigo-100 via-pink-100 to-yellow-100 flex items-end justify-center px-6 pb-6">
            <div className="flex items-end gap-2 w-full justify-between">
              <div className="w-10 h-20 rounded-full bg-indigo-300" />
              <div className="w-10 h-32 rounded-full bg-pink-300" />
              <div className="w-10 h-24 rounded-full bg-purple-300" />
              <div className="w-10 h-28 rounded-full bg-green-300" />
              <div className="w-10 h-22 rounded-full bg-yellow-300" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom button */}
      <div className="px-4 pb-6 pt-2 lg:px-0 lg:pb-0 lg:pt-6">
        <motion.button
          type="button"
          onClick={handleContinue}
          disabled={rating === null || isSubmitting}
          className={`w-full py-3 rounded-full text-sm font-medium transition-colors ${
            rating === null || isSubmitting
              ? "bg-gray-200 text-gray-500"
              : "bg-black text-white hover:bg-gray-900"
          }`}
          whileTap={rating !== null && !isSubmitting ? { scale: 0.98 } : undefined}
        >
          {isSubmitting ? "Submitting..." : "Continue"}
        </motion.button>
      </div>
      </div>

      {/* Thank you popup */}
      <AnimatePresence>
        {showThanks && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowThanks(false)
              goBack()
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 10, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-sm rounded-3xl bg-white px-5 pt-5 pb-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-green-600" />
                </div>
                <h2 className="text-base font-semibold text-gray-900 mb-1">
                  Thanks for your feedback
                </h2>
                <p className="text-xs text-gray-600 mb-4">
                  It helps us improve your experience with {companyName.toLowerCase()}.
                </p>
                <button
                  type="button"
                  className="w-full py-2.5 rounded-full bg-black text-white text-sm font-medium"
                  onClick={() => {
                    setShowThanks(false)
                    goBack()
                  }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

