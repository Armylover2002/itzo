import { useState } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Info } from "lucide-react"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function ManageOutlets() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [showToast, setShowToast] = useState(false)

  const options = [
    "Timings",
    "Contacts",
    "FSSAI Food License",
    "Bank account details",
    "Profile picture",
    "Name, address, location",
    "Ratings, reviews",
    "Delivery area changes",
  ]

  const handleOptionClick = (option) => {
    // Navigate based on option selected
    switch (option) {
      case "Timings":
        navigate("/restaurant/outlet-timings")
        break
      case "FSSAI Food License":
        navigate("/restaurant/fssai")
        break
      case "Bank account details":
        navigate("/restaurant/update-bank-details")
        break
      case "Profile picture":
        navigate("/restaurant/outlet-info")
        break
      case "Name, address, location":
        navigate("/restaurant/outlet-info")
        break
      case "Ratings, reviews":
        navigate("/restaurant/ratings-reviews")
        break
      case "Delivery area changes":
        setShowToast(true)
        setTimeout(() => setShowToast(false), 5000)
        break
      default:
        debugLog(`${option} clicked`)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-gray-200">
        <button
          onClick={goBack}
          className="p-2 rounded-full hover:bg-gray-100"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Restaurant</h1>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 pt-4">
        {/* Select an option section */}
        <div className="bg-white rounded-lg border">
          <div className="px-4 py-3 bg-gray-50">
            <p className="text-md font-bold text-gray-900">Select an option</p>
          </div>
          
          {/* Options List */}
          <div className="divide-y divide-gray-200 ">
            {options.map((option, idx) => (
              <button
                key={option}
                onClick={() => handleOptionClick(option)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-900">{option}</span>
                <span className="text-gray-500">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-4 w-full max-w-md"
          >
            <div className="bg-white border border-gray-200 px-4 py-4 rounded-lg shadow-2xl">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-semibold text-gray-900">
                    You can not modify the delivery areas of your restaurant
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Delivery area is defined by the appropriate distance our delivery partners can travel to deliver your orders in time. This can vary basis the time of the day or external conditions like rain etc.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


