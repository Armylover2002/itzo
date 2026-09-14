import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import Lenis from "lenis"
import { 
  ArrowLeft,
  Home,
  ShoppingBag,
  Store,
  Wallet,
  Menu,
  Star,
  Clock
} from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import BottomNavbar from "@food/components/restaurant/BottomNavbar"
import MenuOverlay from "@food/components/restaurant/MenuOverlay"
import { formatCurrency } from "@food/utils/currency"
import { restaurantAPI } from "@food/api"
import { flattenMenuItems, getMenuFromResponse } from "@food/utils/menuItems"

const toFoodData = (food, fallbackId = "") => {
  if (!food) return null
  return {
    ...food,
    id: String(food.id || food._id || fallbackId || ""),
    availabilityTime: food.availabilityTimeStart && food.availabilityTimeEnd
      ? `${food.availabilityTimeStart} - ${food.availabilityTimeEnd}`
      : "12:01 AM - 11:57 PM",
    nameArabic: food.nameArabic || "",
    description: food.description || "",
    discountType: food.discountType || "Percent",
    discountAmount: food.discountAmount || 0.0,
    variations: Array.isArray(food.variations) ? food.variations : [],
    tags: Array.isArray(food.tags) ? food.tags : [],
    nutrition: Array.isArray(food.nutrition) ? food.nutrition : [],
    allergies: Array.isArray(food.allergies) ? food.allergies : [],
    isAvailable: food.isAvailable !== false,
    isRecommended: !!food.isRecommended,
  }
}

export default function FoodDetailsPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [activeTab, setActiveTab] = useState("overview")
  const [showMenu, setShowMenu] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [menuSections, setMenuSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [stockData, setStockData] = useState({
    mainStock: 0,
    variations: []
  })
  const [foodData, setFoodData] = useState(null)
  const [isAvailable, setIsAvailable] = useState(true)
  const [isRecommended, setIsRecommended] = useState(false)

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

  // Load food data and listen for updates
  useEffect(() => {
    let isMounted = true

    const refreshFoodData = async () => {
      try {
        setLoading(true)
        setError("")
        const response = await restaurantAPI.getMenu()
        const menu = getMenuFromResponse(response)
        const sections = Array.isArray(menu?.sections) ? menu.sections : []
        const items = flattenMenuItems(menu)
        const item = items.find((entry) => String(entry.id) === String(id))
        const mapped = toFoodData(item, id)

        if (isMounted) {
          setMenuSections(sections)
          setFoodData(mapped)
          setIsAvailable(mapped?.isAvailable ?? false)
          setIsRecommended(mapped?.isRecommended ?? false)
          if (!mapped) {
            setError("Food item not found.")
          }
        }
      } catch (err) {
        if (isMounted) {
          setMenuSections([])
          setFoodData(null)
          setIsAvailable(false)
          setIsRecommended(false)
          setError(err?.response?.data?.message || err?.message || "Unable to load food details.")
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    // Initial load
    refreshFoodData()

    // Listen for food changes
    window.addEventListener('foodsChanged', refreshFoodData)
    window.addEventListener('foodUpdated', refreshFoodData)
    window.addEventListener('storage', refreshFoodData)

    return () => {
      isMounted = false
      window.removeEventListener('foodsChanged', refreshFoodData)
      window.removeEventListener('foodUpdated', refreshFoodData)
      window.removeEventListener('storage', refreshFoodData)
    }
  }, [id])

  // Initialize stock data when modal opens
  const handleOpenStockModal = () => {
    setStockData({
      mainStock:
        typeof foodData.stock === "number"
          ? foodData.stock
          : foodData.stock === "Unlimited" || foodData.stock === "unlimited"
            ? "Unlimited"
            : 0,
      variations: Array.isArray(foodData.variations)
        ? foodData.variations.map((v) => ({
            id: v.id,
            name: v.name,
            stock: v.stock || 0,
          }))
        : [],
    })
    setShowStockModal(true)
  }

  // Handle stock update
  const handleUpdateStock = async () => {
    try {
      const res = await restaurantAPI.updateFood(String(id), {
        stock: stockData.mainStock,
        variations: Array.isArray(foodData.variations)
          ? foodData.variations.map((variation) => {
              const updatedVariation = stockData.variations.find(
                (entry) => String(entry.id) === String(variation.id),
              )
              return updatedVariation
                ? { ...variation, stock: updatedVariation.stock }
                : variation
            })
          : [],
      })
      const updated = res?.data?.data?.food || res?.data?.food
      const mapped = toFoodData(updated || {}, id)
      setFoodData(mapped)
      setShowStockModal(false)
      window.dispatchEvent(new CustomEvent("foodsChanged"))
      window.dispatchEvent(new CustomEvent("foodUpdated", { detail: { food: mapped } }))
    } catch {
      alert("Error updating stock. Please try again.")
    }
  }

  // Handle stock input change
  const handleStockChange = (type, value, variationId = null) => {
    if (type === 'main') {
      // Allow "Unlimited" or numeric values
      if (value.toLowerCase() === 'unlimited') {
        setStockData(prev => ({ ...prev, mainStock: 'Unlimited' }))
      } else {
        const numValue = value === '' ? '' : parseInt(value) || 0
        setStockData(prev => ({ ...prev, mainStock: numValue }))
      }
    } else if (type === 'variation' && variationId) {
      setStockData(prev => ({
        ...prev,
        variations: prev.variations.map(v =>
          v.id === variationId ? { ...v, stock: value === '' ? '' : parseInt(value) || 0 } : v
        )
      }))
    }
  }


  const reviews = []

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-4">
          <button 
            onClick={() => navigate("/restaurant/details")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg md:text-xl font-bold text-gray-900">Food Details</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex-1 py-3 px-4 text-sm md:text-base font-medium transition-colors relative ${
              activeTab === "overview"
                ? "text-[#ff8100]"
                : "text-gray-600"
            }`}
          >
            Product Overview
            {activeTab === "overview" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff8100]"
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("reviews")}
            className={`flex-1 py-3 px-4 text-sm md:text-base font-medium transition-colors relative ${
              activeTab === "reviews"
                ? "text-[#ff8100]"
                : "text-gray-600"
            }`}
          >
            Reviews
            {activeTab === "reviews" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff8100]"
              />
            )}
          </button>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto pb-32 md:pb-6">
        <div className="px-4 py-6 space-y-4">
          {activeTab === "overview" && (
            <>
              {!foodData ? (
                <Card className="bg-white shadow-sm border-0">
                  <CardContent className="p-6 text-center">
                    <p className="text-gray-900 font-semibold">
                      {loading ? "Loading food details..." : "Food details unavailable"}
                    </p>
                    {!loading && (
                      <p className="text-sm text-gray-600 mt-2">
                        {error || "This item could not be loaded."}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <>
              {/* Food Item Summary Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                whileHover={{ y: -4, scale: 1.01 }}
              >
              <Card className="bg-white shadow-sm border-0">
                <CardContent className="p-4 md:p-6">
                  <div className="flex gap-4">
                    {/* Food Image */}
                    <div className="relative flex-shrink-0">
                      <img 
                        src={foodData.image}
                        alt={foodData.name}
                        className="w-24 h-24 md:w-32 md:h-32 rounded-lg object-cover"
                      />
                      {foodData.discount > 0 && (
                        <div className="absolute top-0 left-0 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-tl-lg rounded-br-lg">
                          {foodData.discount}% OFF
                        </div>
                      )}
                    </div>

                    {/* Food Info */}
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-2">
                        {foodData.nameArabic}
                      </h2>
                      <p className="text-[#ff8100] font-bold text-lg md:text-xl mb-2">
                        {formatCurrency(foodData.price)}
                      </p>
                      <div className="flex items-center gap-2 mb-2">
                        <Star className={`w-4 h-4 ${foodData.rating > 0 ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} />
                        <span className="text-gray-600 text-sm">
                          {foodData.rating.toFixed(1)} ({foodData.reviews} Review{foodData.reviews !== 1 ? 's' : ''})
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-600 text-sm">
                        <Clock className="w-4 h-4" />
                        <span>{foodData.availabilityTime}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </motion.div>

              {/* Availability Toggles */}
              <Card className="bg-white shadow-sm border-0">
                <CardContent className="p-4 md:p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm md:text-base font-medium text-gray-900">Available</span>
                      <button
                        type="button"
                        onClick={() => setIsAvailable(!isAvailable)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          isAvailable ? 'bg-[#ff8100]' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isAvailable ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm md:text-base font-medium text-gray-900">Recommended</span>
                      <button
                        type="button"
                        onClick={() => setIsRecommended(!isRecommended)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          isRecommended ? 'bg-[#ff8100]' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isRecommended ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Description */}
              <Card className="bg-white shadow-sm border-0">
                <CardContent className="p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3">Description</h3>
                  <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                    {foodData.description}
                  </p>
                </CardContent>
              </Card>

              {/* General Info */}
              <Card className="bg-white shadow-sm border-0">
                <CardContent className="p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">General Info</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm md:text-base text-gray-600">Category</span>
                      <span className="text-sm md:text-base font-medium text-gray-900">{foodData.category}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm md:text-base text-gray-600">Food Type</span>
                      <span className="text-sm md:text-base font-medium text-gray-900">{foodData.foodType}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Price Information */}
              <Card className="bg-white shadow-sm border-0">
                <CardContent className="p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Price Information</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm md:text-base text-gray-600">Price</span>
                      <span className="text-sm md:text-base font-medium text-gray-900">{formatCurrency(foodData.price)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm md:text-base text-gray-600">Discount Type</span>
                      <span className="text-sm md:text-base font-medium text-gray-900">{foodData.discountType}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm md:text-base text-gray-600">Discount Amount</span>
                      <span className="text-sm md:text-base font-medium text-gray-900">{foodData.discountAmount.toFixed(1)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Variations */}
              <Card className="bg-white shadow-sm border-0">
                <CardContent className="p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Variations</h3>
                  <div className="space-y-3">
                    {foodData.variations.map((variation, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                        <div className="flex-1">
                          <p className="text-sm md:text-base font-medium text-gray-900 mb-1">{variation.name}</p>
                          <div className="flex gap-4 text-xs md:text-sm text-gray-600">
                            <span>Price {formatCurrency(variation.price)}</span>
                            <span>Stock {variation.stock}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Tags */}
              <Card className="bg-white shadow-sm border-0">
                <CardContent className="p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {foodData.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Nutrition */}
              <Card className="bg-white shadow-sm border-0">
                <CardContent className="p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Nutrition</h3>
                  <div className="flex flex-wrap gap-2">
                    {foodData.nutrition.map((item, index) => (
                      <span
                        key={index}
                        className="text-sm md:text-base text-gray-700"
                      >
                        {item}{index < foodData.nutrition.length - 1 && ", "}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Allergies */}
              <Card className="bg-white shadow-sm border-0">
                <CardContent className="p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Allergies</h3>
                  <div className="flex flex-wrap gap-2">
                    {foodData.allergies.map((allergy, index) => (
                      <span
                        key={index}
                        className="text-sm md:text-base text-gray-700"
                      >
                        {allergy}{index < foodData.allergies.length - 1 && ", "}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
                </>
              )}
            </>
          )}

          {activeTab === "reviews" && (
            <div className="space-y-4">
              {reviews.length > 0 ? (
                reviews.map((review) => (
                  <Card key={review.id} className="bg-white shadow-sm border-0">
                    <CardContent className="p-4 md:p-6">
                      <div className="flex gap-4">
                        {/* User Avatar */}
                        <div className="flex-shrink-0">
                          <img
                            src={review.userAvatar}
                            alt={review.userName}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        </div>

                        {/* Review Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm md:text-base font-semibold text-gray-900">
                                {review.userName}
                              </h4>
                              {review.verified && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                  Verified
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              {review.date}
                            </span>
                          </div>

                          {/* Rating */}
                          <div className="flex items-center gap-1 mb-2">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${
                                  i < review.rating
                                    ? "text-yellow-500 fill-yellow-500"
                                    : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>

                          {/* Comment */}
                          <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                            {review.comment}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="bg-white shadow-sm border-0">
                  <CardContent className="p-4 md:p-6">
                    <p className="text-gray-600 text-center py-8">No reviews yet</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Buttons */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 md:relative md:border-0 md:shadow-none">
        <div className="px-4 py-3 flex gap-3 md:max-w-4xl md:mx-auto">
          <Button
            type="button"
            variant="outline"
            onClick={handleOpenStockModal}
            disabled={!foodData}
            className="flex-1 border-[#ff8100] text-[#ff8100] hover:bg-[#ff8100] hover:text-white font-semibold py-3"
          >
            Update Stock
          </Button>
          <Button
            type="button"
            disabled={!foodData}
            onClick={() => navigate(`/restaurant/food/${id}/edit`)}
            className="flex-1 bg-[#ff8100] hover:bg-[#e67300] text-white font-semibold py-3"
          >
            Edit
          </Button>
        </div>
      </div>

      {/* Bottom Navigation Bar - Mobile Only */}
      <BottomNavbar onMenuClick={() => setShowMenu(true)} />
      
      {/* Menu Overlay */}
      <MenuOverlay showMenu={showMenu} setShowMenu={setShowMenu} />

      {/* Update Stock Modal */}
      <AnimatePresence>
        {showStockModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setShowStockModal(false)}
              className="fixed inset-0 bg-black/40 z-[60]"
            />

            {/* Bottom Sheet Modal */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-[70] max-h-[90vh] overflow-hidden"
            >
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-4 pb-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 text-center">Update Stock</h2>
              </div>

              {/* Content */}
              <div className="px-4 py-4 overflow-y-auto max-h-[calc(90vh-180px)]">
                {/* Main Stock Section */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Main Stock
                  </label>
                  <input
                    type="text"
                    value={stockData.mainStock}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === 'Unlimited' || value === '') {
                        handleStockChange('main', value)
                      } else {
                        handleStockChange('main', value)
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                    placeholder="Enter stock or 'Unlimited'"
                  />
                </div>

                {/* Variations Stock Section */}
                {stockData.variations.length > 0 && (
                  <div>
                    <div className="grid grid-cols-2 gap-4 mb-3 pb-2 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-700">Variation</h3>
                      <h3 className="text-sm font-semibold text-gray-700">Stock</h3>
                    </div>
                    
                    <div className="mb-2">
                      <p className="text-xs text-gray-600 mb-2">Capacity</p>
                    </div>

                    <div className="space-y-4">
                      {stockData.variations.map((variation) => (
                        <div key={variation.id} className="grid grid-cols-2 gap-4 items-center">
                          <div>
                            <p className="text-sm text-gray-900">{variation.name}</p>
                          </div>
                          <div>
                            <input
                              type="number"
                              value={variation.stock}
                              onChange={(e) => handleStockChange('variation', e.target.value, variation.id)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                              placeholder="0"
                              min="0"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {stockData.variations.length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No variations available
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="px-4 pb-6 pt-4 border-t border-gray-200 flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowStockModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 rounded-lg transition-colors"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleUpdateStock}
                  className="flex-1 bg-[#ff8100] hover:bg-[#e67300] text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  Update
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

