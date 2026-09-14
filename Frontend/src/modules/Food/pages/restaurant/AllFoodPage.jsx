import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { motion, AnimatePresence } from "framer-motion"
import Lenis from "lenis"
import { 
  ArrowLeft,
  Search,
  Filter,
  Plus,
  Star
} from "lucide-react"
import BottomNavbar from "@food/components/restaurant/BottomNavbar"
import MenuOverlay from "@food/components/restaurant/MenuOverlay"
import { formatCurrency } from "@food/utils/currency"
import { restaurantAPI } from "@food/api"
import { flattenMenuItems, getMenuFromResponse } from "@food/utils/menuItems"

export default function AllFoodPage() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [searchParams] = useSearchParams()
  const [activeCategory, setActiveCategory] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [showMenu, setShowMenu] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [foodTypeFilter, setFoodTypeFilter] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [allFoods, setAllFoods] = useState([])

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

  // Set category from URL params
  useEffect(() => {
    const categoryParam = searchParams.get("category")
    if (categoryParam) {
      setActiveCategory(categoryParam)
    }
  }, [searchParams])

  // Load foods and listen for updates
  useEffect(() => {
    let isMounted = true

    const refreshFoods = async () => {
      try {
        const response = await restaurantAPI.getMenu()
        const menu = getMenuFromResponse(response)
        const foods = flattenMenuItems(menu)
        if (isMounted) {
          setAllFoods(foods)
        }
      } catch {
        if (isMounted) {
          setAllFoods([])
        }
      }
    }

    // Initial load
    refreshFoods()

    // Listen for food changes
    window.addEventListener('foodsChanged', refreshFoods)
    window.addEventListener('foodAdded', refreshFoods)
    window.addEventListener('foodUpdated', refreshFoods)
    window.addEventListener('foodDeleted', refreshFoods)
    window.addEventListener('storage', refreshFoods)

    return () => {
      isMounted = false
      window.removeEventListener('foodsChanged', refreshFoods)
      window.removeEventListener('foodAdded', refreshFoods)
      window.removeEventListener('foodUpdated', refreshFoods)
      window.removeEventListener('foodDeleted', refreshFoods)
      window.removeEventListener('storage', refreshFoods)
    }
  }, [])

  // Categories
  const categories = [
    "All",
    "American",
    "Bengali",
    "Caribbean",
    "Chinese",
    "Italian",
    "Mexican",
    "Indian",
    "Thai",
    "Japanese"
  ]

  // Transform foods for display (convert prices if needed, ensure all fields)
  const transformedFoods = allFoods.map(food => ({
    ...food,
    // Ensure price is in correct format (already stored, but ensure consistency)
    price: food.price || 0,
    originalPrice: food.originalPrice || null,
    discount: food.discount || null,
    stock: food.stock !== undefined ? food.stock : "Unlimited",
    foodType: food.foodType || "Non-Veg",
    category: food.category || "Varieties",
    rating: food.rating || 0.0,
    reviews: food.reviews || 0
  }))

  // Filter foods based on category, search, food type, and stock
  const filteredFoods = transformedFoods.filter(food => {
    const matchesCategory = activeCategory === "All" || 
      food.category?.toLowerCase() === activeCategory.toLowerCase() ||
      food.category === activeCategory
    const matchesSearch = food.name.toLowerCase().includes(searchQuery.toLowerCase())
    
    // Food type filter
    const matchesFoodType = foodTypeFilter === "all" || 
      (foodTypeFilter === "veg" && food.foodType === "Veg") ||
      (foodTypeFilter === "nonVeg" && food.foodType === "Non-Veg")
    
    // Stock filter
    const matchesStock = stockFilter === "all" ||
      (stockFilter === "outOfStock" && (food.stock === 0 || food.stock === "Out of Stock"))
    
    return matchesCategory && matchesSearch && matchesFoodType && matchesStock
  })

  const handleClearFilter = () => {
    setFoodTypeFilter("all")
    setStockFilter("all")
  }

  const handleApplyFilter = () => {
    setShowFilterModal(false)
  }

  return (
    <div className="min-h-screen bg-[#f6e9dc] pb-20">
      {/* Header */}
      <div className="bg-white sticky top-0 z-50 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={goBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-800" />
          </motion.button>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="text-lg font-bold text-gray-900 flex-1"
          >
            All Food
          </motion.h1>
          <div className="flex items-center gap-2">
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 border-2 border-[#ff8100] rounded-lg hover:bg-[#ff8100]/10 transition-colors"
            >
              <Search className="w-5 h-5 text-[#ff8100]" />
            </motion.button>
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.25 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowFilterModal(true)}
              className="p-2 border-2 border-[#ff8100] rounded-lg hover:bg-[#ff8100]/10 transition-colors"
            >
              <Filter className="w-5 h-5 text-[#ff8100]" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
          {categories.map((category, index) => (
            <motion.button
              key={category}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveCategory(category)}
              className={`relative px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                activeCategory === category
                  ? "text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {activeCategory === category && (
                <motion.div
                  layoutId="activeCategoryTab"
                  className="absolute inset-0 bg-[#ff8100] rounded-full z-0"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <span className="relative z-10">{category}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Food Items List */}
      <div className="px-4 py-4 space-y-4">
        {filteredFoods.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No foods found</p>
          </div>
        ) : (
          filteredFoods.map((food, index) => (
          <motion.div
            key={food.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.05, ease: [0.4, 0, 0.2, 1] }}
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/restaurant/food/${food.id}`)}
          >
            <div className="flex gap-3 p-3">
              {/* Food Image */}
              <div className="relative flex-shrink-0 w-24 h-24 md:w-28 md:h-28 rounded-lg overflow-hidden">
                <img
                  src={food.image}
                  alt={food.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"
                  }}
                />
                {/* Discount Badge */}
                {food.discount && (
                  <div className="absolute top-1 left-1 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    {food.discount}
                  </div>
                )}
                {/* Dietary Icon */}
                <div className="absolute bottom-1 right-1 w-4 h-4 bg-red-500 rounded border border-white">
                  <div className="w-full h-full rounded-full bg-white/80 m-0.5"></div>
                </div>
              </div>

              {/* Food Details */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-gray-900 mb-1 line-clamp-1">{food.name}</h3>
                <p className="text-xs text-gray-600 mb-2">{food.category}</p>
                
                {/* Rating */}
                <div className="flex items-center gap-1 mb-2">
                  <Star className={`w-3 h-3 ${food.rating > 0 ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                  <span className="text-xs text-gray-700">
                    {food.rating.toFixed(1)} ({food.reviews})
                  </span>
                </div>

                {/* Price */}
                <div className="flex items-center gap-2">
                  {food.originalPrice ? (
                    <>
                      <span className="text-xs text-gray-400 line-through">{formatCurrency(food.originalPrice)}</span>
                      <span className="text-sm font-bold text-[#ff8100]">{formatCurrency(food.price)}</span>
                    </>
                  ) : (
                    <span className="text-sm font-bold text-[#ff8100]">{formatCurrency(food.price)}</span>
                  )}
                </div>

                {/* Stock */}
                <p className="text-xs text-gray-600 mt-1">Stock : {food.stock}</p>
              </div>
            </div>
          </motion.div>
        )))}
      </div>

      {/* Floating Action Button - Add Food */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => navigate("/restaurant/food/new")}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-[#ff8100] hover:bg-[#e67300] text-white rounded-full shadow-lg flex items-center justify-center z-50 transition-colors"
      >
        <Plus className="w-6 h-6" />
      </motion.button>

      {/* Bottom Navigation Bar - Mobile Only */}
      <BottomNavbar onMenuClick={() => setShowMenu(true)} />
      
      {/* Menu Overlay */}
      <MenuOverlay showMenu={showMenu} setShowMenu={setShowMenu} />

      {/* Filter Modal */}
      <AnimatePresence>
        {showFilterModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setShowFilterModal(false)}
              className="fixed inset-0 bg-black/40 z-[60]"
            />

            {/* Bottom Sheet */}
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
              <div className="px-4 pb-4">
                <h2 className="text-lg font-bold text-gray-900 text-center">Filter Data</h2>
              </div>

              {/* Content */}
              <div className="px-4 pb-4 overflow-y-auto max-h-[calc(90vh-180px)]">
                {/* Foods Type Section */}
                <div className="mb-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4">Foods Type</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="foodType"
                        value="all"
                        checked={foodTypeFilter === "all"}
                        onChange={(e) => setFoodTypeFilter(e.target.value)}
                        className="w-5 h-5 text-[#ff8100] border-gray-300 focus:ring-[#ff8100] focus:ring-2"
                      />
                      <span className="text-sm text-gray-700">All Foods</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="foodType"
                        value="veg"
                        checked={foodTypeFilter === "veg"}
                        onChange={(e) => setFoodTypeFilter(e.target.value)}
                        className="w-5 h-5 text-[#ff8100] border-gray-300 focus:ring-[#ff8100] focus:ring-2"
                      />
                      <span className="text-sm text-gray-700">Veg Foods</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="foodType"
                        value="nonVeg"
                        checked={foodTypeFilter === "nonVeg"}
                        onChange={(e) => setFoodTypeFilter(e.target.value)}
                        className="w-5 h-5 text-[#ff8100] border-gray-300 focus:ring-[#ff8100] focus:ring-2"
                      />
                      <span className="text-sm text-gray-700">Non-Veg Foods</span>
                    </label>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 mb-6" />

                {/* Foods Stock Section */}
                <div className="mb-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4">Foods Stock</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="stock"
                        value="all"
                        checked={stockFilter === "all"}
                        onChange={(e) => setStockFilter(e.target.value)}
                        className="w-5 h-5 text-[#ff8100] border-gray-300 focus:ring-[#ff8100] focus:ring-2"
                      />
                      <span className="text-sm text-gray-700">All</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="stock"
                        value="outOfStock"
                        checked={stockFilter === "outOfStock"}
                        onChange={(e) => setStockFilter(e.target.value)}
                        className="w-5 h-5 text-[#ff8100] border-gray-300 focus:ring-[#ff8100] focus:ring-2"
                      />
                      <span className="text-sm text-gray-700">Out of Stock Foods</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-4 pb-6 pt-4 border-t border-gray-200 flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleClearFilter}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 rounded-lg transition-colors"
                >
                  Clear Filter
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleApplyFilter}
                  className="flex-1 bg-[#ff8100] hover:bg-[#e67300] text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  Filter
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

