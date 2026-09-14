import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import Lenis from "lenis"
import { 
  ArrowLeft,
  Calendar,
  ChevronDown,
  Wand2,
  ChevronUp,
  ChevronDown as ChevronDownIcon
} from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import BottomNavbar from "@food/components/restaurant/BottomNavbar"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function AddCouponPage(props) {
  const { mode = "create", couponId } = props || {}
  const isEditMode = mode === "edit"

  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [showDiscountDropdown, setShowDiscountDropdown] = useState(false)
  const [showDiscountDropdown2, setShowDiscountDropdown2] = useState(false)
  const [showStartDatePicker, setShowStartDatePicker] = useState(false)
  const [showEndDatePicker, setShowEndDatePicker] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    couponCode: "",
    limitForSameUser: "",
    minPurchase: "",
    discount: "",
    discountType: "%",
    maxDiscount: "",
    limitForSameUser2: "1",
    minPurchase2: "",
    discount2: "",
    discountType2: "%",
    maxDiscount2: "",
    startDate: "",
    endDate: ""
  })
  const discountRef = useRef(null)
  const discountRef2 = useRef(null)
  const startDateRef = useRef(null)
  const endDateRef = useRef(null)

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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (discountRef.current && !discountRef.current.contains(event.target)) {
        setShowDiscountDropdown(false)
      }
      if (discountRef2.current && !discountRef2.current.contains(event.target)) {
        setShowDiscountDropdown2(false)
      }
      if (startDateRef.current && !startDateRef.current.contains(event.target)) {
        setShowStartDatePicker(false)
      }
      if (endDateRef.current && !endDateRef.current.contains(event.target)) {
        setShowEndDatePicker(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const discountTypes = ["%", "$"]

  const generateCouponCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let code = ""
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData(prev => ({ ...prev, couponCode: code }))
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const incrementLimit = () => {
    const current = parseInt(formData.limitForSameUser2) || 1
    setFormData(prev => ({ ...prev, limitForSameUser2: (current + 1).toString() }))
  }

  const decrementLimit = () => {
    const current = parseInt(formData.limitForSameUser2) || 1
    if (current > 1) {
      setFormData(prev => ({ ...prev, limitForSameUser2: (current - 1).toString() }))
    }
  }

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
        <h1 className="text-lg font-bold text-gray-900 flex-1">
          {isEditMode ? "Edit Coupon" : "Add Coupon"}
        </h1>
      </div>

      {/* Main Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Coupon Details Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="Title *"
                  className="w-full"
                />
              </div>

              {/* Coupon Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Coupon Code <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={formData.couponCode}
                    onChange={(e) => handleInputChange("couponCode", e.target.value)}
                    placeholder="Coupon Code *"
                    className="flex-1"
                  />
                  <button
                    onClick={generateCouponCode}
                    className="p-2.5 bg-[#ff8100] hover:bg-[#e67300] rounded-lg transition-colors flex items-center justify-center"
                  >
                    <Wand2 className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              {/* Limit for same user */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Limit for same user
                </label>
                <Input
                  type="number"
                  value={formData.limitForSameUser}
                  onChange={(e) => handleInputChange("limitForSameUser", e.target.value)}
                  placeholder="Limit for same user"
                  className="w-full"
                />
              </div>

              {/* Min purchase */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min purchase
                </label>
                <Input
                  type="number"
                  value={formData.minPurchase}
                  onChange={(e) => handleInputChange("minPurchase", e.target.value)}
                  placeholder="Min purchase"
                  className="w-full"
                />
              </div>

              {/* Discount */}
              <div className="relative" ref={discountRef}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={formData.discount}
                    onChange={(e) => handleInputChange("discount", e.target.value)}
                    placeholder="Discount *"
                    className="flex-1"
                  />
                  <button
                    onClick={() => setShowDiscountDropdown(!showDiscountDropdown)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <span className="text-sm font-medium text-gray-700">{formData.discountType}</span>
                    <ChevronDown className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                {showDiscountDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[100px]"
                  >
                    {discountTypes.map((type) => (
                      <button
                        key={type}
                        onClick={() => {
                          handleInputChange("discountType", type)
                          setShowDiscountDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg"
                      >
                        {type}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* Max Discount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Discount
                </label>
                <Input
                  type="number"
                  value={formData.maxDiscount}
                  onChange={(e) => handleInputChange("maxDiscount", e.target.value)}
                  placeholder="Max Discount"
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Additional Discount Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-4 space-y-4">
              {/* Limit for same user 2 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Limit for same user
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={formData.limitForSameUser2}
                    onChange={(e) => handleInputChange("limitForSameUser2", e.target.value)}
                    placeholder="Limit for same user"
                    className="flex-1"
                  />
                  <div className="flex flex-col">
                    <button
                      onClick={incrementLimit}
                      className="p-1 bg-[#ff8100] hover:bg-[#e67300] rounded-t transition-colors"
                    >
                      <ChevronUp className="w-3 h-3 text-white" />
                    </button>
                    <button
                      onClick={decrementLimit}
                      className="p-1 bg-[#ff8100] hover:bg-[#e67300] rounded-b transition-colors"
                    >
                      <ChevronDownIcon className="w-3 h-3 text-white" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Min purchase 2 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min purchase
                </label>
                <Input
                  type="number"
                  value={formData.minPurchase2}
                  onChange={(e) => handleInputChange("minPurchase2", e.target.value)}
                  placeholder="Min purchase"
                  className="w-full"
                />
              </div>

              {/* Discount 2 */}
              <div className="relative" ref={discountRef2}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={formData.discount2}
                    onChange={(e) => handleInputChange("discount2", e.target.value)}
                    placeholder="Discount *"
                    className="flex-1"
                  />
                  <button
                    onClick={() => setShowDiscountDropdown2(!showDiscountDropdown2)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <span className="text-sm font-medium text-gray-700">{formData.discountType2}</span>
                    <ChevronDown className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                {showDiscountDropdown2 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[100px]"
                  >
                    {discountTypes.map((type) => (
                      <button
                        key={type}
                        onClick={() => {
                          handleInputChange("discountType2", type)
                          setShowDiscountDropdown2(false)
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg"
                      >
                        {type}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* Max Discount 2 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Discount
                </label>
                <Input
                  type="number"
                  value={formData.maxDiscount2}
                  onChange={(e) => handleInputChange("maxDiscount2", e.target.value)}
                  placeholder="Max Discount"
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Date Range Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-4 space-y-4">
              {/* Start Date */}
              <div className="relative" ref={startDateRef}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    value={formData.startDate}
                    onChange={(e) => handleInputChange("startDate", e.target.value)}
                    placeholder="Start Date *"
                    className="w-full pr-10"
                    readOnly
                    onClick={() => setShowStartDatePicker(!showStartDatePicker)}
                  />
                  <button
                    onClick={() => setShowStartDatePicker(!showStartDatePicker)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5"
                  >
                    <Calendar className="w-5 h-5 text-[#ff8100]" />
                  </button>
                </div>
                {showStartDatePicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4"
                  >
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => {
                        handleInputChange("startDate", e.target.value)
                        setShowStartDatePicker(false)
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff8100]"
                    />
                  </motion.div>
                )}
              </div>

              {/* End Date */}
              <div className="relative" ref={endDateRef}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    value={formData.endDate}
                    onChange={(e) => handleInputChange("endDate", e.target.value)}
                    placeholder="End Date *"
                    className="w-full pr-10"
                    readOnly
                    onClick={() => setShowEndDatePicker(!showEndDatePicker)}
                  />
                  <button
                    onClick={() => setShowEndDatePicker(!showEndDatePicker)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5"
                  >
                    <Calendar className="w-5 h-5 text-[#ff8100]" />
                  </button>
                </div>
                {showEndDatePicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4"
                  >
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => {
                        handleInputChange("endDate", e.target.value)
                        setShowEndDatePicker(false)
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff8100]"
                    />
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Add Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 z-50 md:relative md:border-t-0 md:px-4 md:py-4 md:mt-6">
        <Button
          onClick={() => {
            if (isEditMode) {
              debugLog("Update coupon:", { id: couponId, ...formData })
            } else {
              debugLog("Add coupon:", formData)
            }
            // Navigate to coupon list after save
            navigate("/restaurant/coupon")
          }}
          className="w-full bg-[#ff8100] hover:bg-[#e67300] text-white font-semibold py-3 rounded-lg"
        >
          {isEditMode ? "Update" : "Add"}
        </Button>
      </div>

      {/* Bottom Navigation Bar */}
      <BottomNavbar />
    </div>
  )
}


