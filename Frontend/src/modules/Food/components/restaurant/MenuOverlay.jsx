import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { 
  Home,
  ShoppingBag,
  Package,
  Compass,
  Info,
  Clock,
  Settings,
  Truck,
  IndianRupee,
  LifeBuoy,
  BadgeCheck,
  Store,
  CheckSquare,
  LogOut,
  LogIn,
} from "lucide-react"

export default function MenuOverlay({ showMenu, setShowMenu }) {
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("restaurant_authenticated") === "true"
  })

  // Listen for authentication state changes
  useEffect(() => {
    const checkAuth = () => {
      setIsAuthenticated(localStorage.getItem("restaurant_authenticated") === "true")
    }

    // Check on mount
    checkAuth()

    // Listen for storage changes
    window.addEventListener('storage', checkAuth)
    
    // Custom event for same-tab updates
    window.addEventListener('restaurantAuthChanged', checkAuth)

    return () => {
      window.removeEventListener('storage', checkAuth)
      window.removeEventListener('restaurantAuthChanged', checkAuth)
    }
  }, [])

  // Get menu options based on authentication state
  const getMenuOptions = () => {
    const baseOptions = [
      { id: 2, name: "Dashboard", icon: Home, route: "/restaurant" },
      { id: 3, name: "Order History", icon: ShoppingBag, route: "/restaurant/orders/all" },
      { id: 4, name: "Inventory", icon: Package, route: "/restaurant/inventory" },
      { id: 5, name: "Explore", icon: Compass, route: "/restaurant/explore" },
      { id: 6, name: "Outlet Info", icon: Info, route: "/restaurant/outlet-info" },
      { id: 7, name: "Outlet Timings", icon: Clock, route: "/restaurant/outlet-timings" },
      { id: 9, name: "Menu Categories", icon: Settings, route: "/restaurant/menu-categories" },
      { id: 10, name: "Delivery Settings", icon: Truck, route: "/restaurant/delivery-settings" },
      { id: 11, name: "Finance", icon: IndianRupee, route: "/restaurant/hub-finance" },
      { id: 12, name: "Support", icon: LifeBuoy, route: "/restaurant/help-centre/support" },
      { id: 13, name: "FSSAI", icon: BadgeCheck, route: "/restaurant/fssai" },
      { id: 14, name: "Hyperpure", icon: Store, route: "/restaurant/hyperpure" },
      { id: 15, name: "Terms & Condition", icon: CheckSquare, route: "/restaurant/terms" },
    ]

    if (isAuthenticated) {
      // If authenticated, show logout at the end
      return [
        ...baseOptions,
        { id: 20, name: "Logout", icon: LogOut, route: "/logout", isLogout: true },
      ]
    } else {
      // If not authenticated, show only login at the top
      return [
        { id: 1, name: "Login", icon: LogIn, route: "/restaurant/login" },
        ...baseOptions
      ]
    }
  }

  const menuOptions = getMenuOptions()

  return (
    <AnimatePresence mode="wait">
      {showMenu && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={() => setShowMenu(false)}
            className="fixed inset-0 bg-black/40 z-[100] backdrop-blur-sm"
          />
          
          {/* Menu Sheet - Full bottom slide */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ 
              type: "spring", 
              damping: 25, 
              stiffness: 300,
              mass: 0.8
            }}
            onClick={(e) => e.stopPropagation()}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-[110] max-h-[90vh] overflow-hidden"
          >
            {/* Drag Handle */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="flex justify-center pt-3 pb-3"
            >
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </motion.div>

            {/* Menu Grid - Improved Layout */}
            <div className="px-4 pb-20 md:pb-6 pt-2 overflow-y-auto max-h-[calc(90vh-60px)] scrollbar-hide scroll-smooth">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                className="grid grid-cols-3 gap-3 md:gap-4"
              >
                {menuOptions.map((option, index) => {
                  const IconComponent = option.icon
                  return (
                    <motion.button
                      key={option.id}
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ 
                        duration: 0.3, 
                        delay: 0.2 + (index * 0.02),
                        type: "spring",
                        stiffness: 200,
                        damping: 20
                      }}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setShowMenu(false)
                        if (option.isLogout) {
                          // Handle logout
                          if (window.confirm("Are you sure you want to logout?")) {
                            // Clear authentication state
                            localStorage.removeItem("restaurant_authenticated")
                            localStorage.removeItem("restaurant_user")
                            setIsAuthenticated(false)
                            // Dispatch custom event for same-tab updates
                            window.dispatchEvent(new Event('restaurantAuthChanged'))
                            // Redirect to login
                            navigate("/restaurant/login")
                          }
                        } else {
                          navigate(option.route)
                        }
                      }}
                      className={`flex flex-col items-center justify-center gap-2 p-3 md:p-4 rounded-xl transition-all shadow-md hover:shadow-lg ${
                        option.isLogout
                          ? "bg-red-500 hover:bg-red-600 text-white"
                          : "bg-gradient-to-br from-[#ff8100] to-[#ff9500] hover:from-[#e67300] hover:to-[#e68500] text-white"
                      }`}
                    >
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ 
                          delay: 0.25 + (index * 0.02),
                          type: "spring",
                          stiffness: 200,
                          damping: 15
                        }}
                        className="flex items-center justify-center"
                      >
                        <IconComponent className="w-5 h-5 md:w-6 md:h-6 text-white flex-shrink-0" />
                      </motion.div>
                      <motion.span 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.35 + (index * 0.02), duration: 0.2 }}
                        className="text-[10px] md:text-[11px] font-semibold text-white text-center leading-tight px-1"
                        style={{ 
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {option.name}
                      </motion.span>
                    </motion.button>
                  )
                })}
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

