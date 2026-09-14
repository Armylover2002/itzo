import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Lenis from "lenis"
import BottomNavbar from "@food/components/restaurant/BottomNavbar"
import MenuOverlay from "@food/components/restaurant/MenuOverlay"
import { 
  Home,
  ShoppingBag,
  Store,
  Wallet,
  Menu,
  Utensils,
  Edit,
  Star,
  Filter,
  User,
  Megaphone,
  Settings,
  Monitor,
  Plus,
  Grid3x3,
  Tag,
  FileText,
  MessageSquare,
  Shield,
  Globe,
  MessageCircle,
  LogOut,
  ArrowLeft
} from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import { useNavigate } from "react-router-dom"
import { restaurantAPI } from "@food/api"
import { flattenMenuItems, getMenuFromResponse } from "@food/utils/menuItems"
import { getRestaurantData } from "@food/utils/restaurantManagement"

export default function RestaurantDetailsPage() {
  const navigate = useNavigate()
  const [activeCategory, setActiveCategory] = useState("all")
  const [showMenu, setShowMenu] = useState(false)
  const [restaurantData, setRestaurantData] = useState(() => getRestaurantData())
  const [foodItems, setFoodItems] = useState([])
  const [logoLoadFailed, setLogoLoadFailed] = useState(false)

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

  // Load restaurant data and listen for updates
  useEffect(() => {
    const refreshRestaurantData = () => {
      setRestaurantData(getRestaurantData())
      setLogoLoadFailed(false)
    }

    // Initial load
    refreshRestaurantData()

    // Listen for restaurant data changes
    window.addEventListener('restaurantDataUpdated', refreshRestaurantData)
    window.addEventListener('storage', refreshRestaurantData)

    return () => {
      window.removeEventListener('restaurantDataUpdated', refreshRestaurantData)
      window.removeEventListener('storage', refreshRestaurantData)
    }
  }, [])

  // Load foods and listen for updates
  useEffect(() => {
    let isMounted = true

    const refreshFoods = async () => {
      try {
        const response = await restaurantAPI.getMenu()
        const menu = getMenuFromResponse(response)
        const foods = flattenMenuItems(menu)
        if (isMounted) {
          setFoodItems(foods)
        }
      } catch {
        if (isMounted) {
          setFoodItems([])
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

  const categories = [
    { id: "all", label: "All" },
    { id: "american", label: "American" },
    { id: "bengali", label: "Bengali" },
    { id: "caribbean", label: "Caribbean" },
    { id: "chinese", label: "Chinese" }
  ]

  // Filter foods by category
  const filteredFoodItems = foodItems.filter(item => {
    if (activeCategory === "all") return true
    // Map category labels to food categories
    const categoryMap = {
      "american": "American",
      "bengali": "Bengali",
      "caribbean": "Caribbean",
      "chinese": "Chinese"
    }
    return item.category?.toLowerCase() === categoryMap[activeCategory]?.toLowerCase() ||
           item.category === categoryMap[activeCategory]
  })

  return (
    <div className="min-h-screen bg-page-bg overflow-x-hidden">
      {/* Hero Image Section */}
      <div className="relative w-full h-[250px] md:h-[300px] overflow-hidden">
        <img 
          src={restaurantData.cover || "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&h=400&fit=crop"}
          alt="Restaurant Hero"
          className="w-full h-full object-cover"
        />
        
        {/* Restaurant Info Card Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-4 md:p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="bg-primary-orange rounded-lg p-3">
                {restaurantData.logo && !logoLoadFailed ? (
                  <img 
                    src={restaurantData.logo} 
                    alt="Restaurant Logo" 
                    className="w-6 h-6 md:w-8 md:h-8 object-cover rounded"
                    onError={() => setLogoLoadFailed(true)}
                  />
                ) : (
                  <Utensils className="w-6 h-6 md:w-8 md:h-8 text-white" />
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-2">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                  {restaurantData.restaurantName?.english || "Hungry Puppets"}
                </h2>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => navigate("/restaurant/edit")}
                  className="flex-shrink-0 ml-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Edit className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
                </motion.button>
              </div>
              <p className="text-gray-600 text-sm md:text-base mb-2">
                {restaurantData.address || "House: 00, Road: 00, Test City"}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="text-gray-900 font-semibold text-sm md:text-base">
                    {restaurantData.rating || 4.7}
                  </span>
                </div>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600 text-sm md:text-base underline">
                  {restaurantData.totalRatings || 3} Ratings
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-3 pb-24 md:pb-6">
        {/* All Foods Section */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg md:text-xl font-bold text-gray-900">All Foods</h3>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Filter className="w-5 h-5 text-gray-600" />
          </motion.button>
        </div>

        {/* Category Tabs */}
        <div className="mb-3 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
          <div className="flex gap-2 min-w-max md:flex-wrap md:min-w-0 relative">
            {categories.map((category, index) => (
              <motion.button
                key={category.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveCategory(category.id)}
                className={`relative z-10 flex-shrink-0 px-4 py-2 rounded-full text-sm md:text-base font-medium transition-colors ${
                  activeCategory === category.id
                    ? "text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {activeCategory === category.id && (
                  <motion.div
                    layoutId="activeCategory"
                    className="absolute inset-0 bg-primary-orange rounded-full z-0"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{category.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Food Items List */}
        <div className="space-y-2">
          {filteredFoodItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">No foods found in this category</p>
            </div>
          ) : (
            filteredFoodItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1, ease: [0.4, 0, 0.2, 1] }}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card 
                className="bg-white shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/restaurant/food/${item.id}`)}
              >
                <CardContent className="p-0 py-0 gap-0">
                  <div className="flex gap-2 p-2 md:p-2.5">
                    {/* Food Image */}
                    <div className="relative flex-shrink-0">
                      <img 
                        src={item.image}
                        alt={item.name}
                        className="w-20 h-20 md:w-24 md:h-24 rounded-lg object-cover"
                      />
                      {item.discount && (
                        <div className="absolute top-0 left-0 bg-green-500 text-white text-[10px] md:text-xs font-bold px-1.5 py-0.5 rounded-tl-lg rounded-br-lg">
                          {item.discount}$ OFF
                        </div>
                      )}
                    </div>

                    {/* Food Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-0.5">
                        <h4 className="text-sm md:text-base font-bold text-gray-900 leading-tight">
                          {item.name}
                        </h4>
                        <button className="flex-shrink-0 ml-2 p-1 hover:bg-gray-100 rounded transition-colors">
                          <div className="w-1 h-1 bg-red-500 rounded-full"></div>
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-gray-500 text-xs">
                          Category: {item.category}
                        </p>
                        <div className="flex items-center gap-1">
                          <Star className={`w-3 h-3 ${item.rating > 0 ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} />
                          <span className="text-gray-600 text-xs">
                            {item.rating.toFixed(1)} ({item.reviews})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-[#ff8100] font-bold text-sm">
                            ? {item.price.toFixed(2)}
                          </p>
                          <p className="text-gray-500 text-xs">
                            Stock : {item.stock}
                          </p>
                        </div>
                        <div className="w-4"></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )))}
        </div>
      </div>

      {/* Bottom Navigation Bar - Mobile Only */}
      <BottomNavbar onMenuClick={(e) => {
        if (e) {
          e.preventDefault()
          e.stopPropagation()
        }
        setShowMenu(true)
      }} />

      {/* Menu Overlay */}
      <MenuOverlay showMenu={showMenu} setShowMenu={setShowMenu} />
    </div>
  )
}

