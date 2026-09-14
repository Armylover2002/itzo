import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import Lenis from "lenis"
import { ArrowLeft, Zap } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@food/components/ui/radio-group"
import { Label } from "@food/components/ui/label"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function RushHour() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [selectedTime, setSelectedTime] = useState("30")

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

  const handleConfirm = () => {
    // Handle rush hour confirmation logic here
    debugLog("Rush hour confirmed for:", selectedTime, "minutes")
    // You can add API call or state management here
    goBack() // Go back after confirmation
  }

  const timeOptions = [
    { value: "30", label: "30 minutes" },
    { value: "60", label: "1 hour" },
    { value: "90", label: "1 hour 30 minutes" },
    { value: "120", label: "2 hours" },
  ]

  return (
    <div className="min-h-screen bg-white flex flex-col">
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
          <h1 className="text-lg font-bold text-gray-900">Rush in kitchen</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {/* Informational Banner */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6 flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-black flex items-center justify-center shrink-0">
            <Zap className="w-7 h-7 text-white" strokeWidth={2.5} fill="white" />
          </div>
          <p className="text-sm text-gray-900 leading-relaxed flex-1 pt-1">
            Inform us when your kitchen is in rush and you need more time to manage orders
          </p>
        </div>

        {/* How this helps you Section */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-gray-900 mb-4">How this helps you</h2>
          <div className="space-y-3">
            {[
              "Get more time to prepare food",
              "Show correct delivery time to customers",
              "Avoid crowding of riders at your restaurant"
            ].map((benefit, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-gray-700">{index + 1}</span>
                </div>
                <p className="text-sm text-gray-900">{benefit}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Time Selection Section */}
        <div className="mb-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            Increase food preparation time for the next
          </h2>
          <RadioGroup value={selectedTime} onValueChange={setSelectedTime} className="space-y-4">
            {timeOptions.map((option) => (
              <div key={option.value} className="flex items-center gap-3">
                <RadioGroupItem value={option.value} id={option.value} className="h-5 w-5" />
                <Label 
                  htmlFor={option.value} 
                  className="text-sm text-gray-900 font-normal cursor-pointer flex-1"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </div>

      {/* Confirm Button */}
      <div className="px-4 pb-6 pt-4 bg-white border-t border-gray-200">
        <button
          onClick={handleConfirm}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          Confirm
        </button>
      </div>
    </div>
  )
}

