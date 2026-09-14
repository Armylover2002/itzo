import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  User,
  Edit,
  LogOut,
  ShieldCheck,
  ChevronRight,
  Settings,
  HelpCircle,
  FileText,
  Lock,
  Globe
} from "lucide-react"
import { motion } from "framer-motion"
import { restaurantAPI } from "@food/api"
import { clearModuleAuth, clearAuthData, getCurrentUser } from "@food/utils/auth"
import { firebaseAuth, ensureFirebaseInitialized } from "@food/firebase"
import { Card, CardContent } from "@/components/ui/card"

const debugWarn = (...args) => {}
const debugError = (...args) => {}

export default function RestaurantProfilePage() {
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [restaurantData, setRestaurantData] = useState(null)
  const [loadingRestaurant, setLoadingRestaurant] = useState(true)

  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setLoadingRestaurant(true)
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (data) {
          setRestaurantData(data)
        }
      } catch (error) {
        if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
          debugError("Error fetching restaurant data:", error)
        }
      } finally {
        setLoadingRestaurant(false)
      }
    }

    fetchRestaurantData()
  }, [])

  const userData = useMemo(() => {
    const sessionUser = getCurrentUser("restaurant")
    
    if (sessionUser && sessionUser.name && sessionUser.role) {
      return {
        name: sessionUser.name,
        phone: sessionUser.phone || restaurantData?.ownerPhone || restaurantData?.phone || "N/A",
        email: sessionUser.email || restaurantData?.ownerEmail || restaurantData?.email || "N/A",
        role: sessionUser.role.toUpperCase(),
        profileImage: sessionUser.profileImage || restaurantData?.profileImage
      }
    }
    
    if (restaurantData) {
      return {
        name: restaurantData.ownerName || restaurantData.name || "Restaurant Owner",
        phone: restaurantData.ownerPhone || restaurantData.phone || "N/A",
        email: restaurantData.ownerEmail || restaurantData.email || "N/A",
        role: "OWNER",
        profileImage: restaurantData.profileImage
      }
    }
    
    return {
      name: loadingRestaurant ? "Loading..." : "Restaurant Owner",
      phone: "",
      email: "",
      role: "OWNER"
    }
  }, [restaurantData, loadingRestaurant])

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)

    try {
      try { await restaurantAPI.logout() } catch (e) {}
      try {
        const { signOut } = await import("firebase/auth")
        ensureFirebaseInitialized({ enableAuth: true, enableRealtimeDb: false })
        if (firebaseAuth.currentUser) await signOut(firebaseAuth)
      } catch (e) {}

      clearModuleAuth("restaurant")
      localStorage.removeItem("restaurant_onboarding")
      window.dispatchEvent(new Event("restaurantAuthChanged"))
      navigate("/food/restaurant/login", { replace: true })
    } catch (error) {
      clearModuleAuth("restaurant")
      navigate("/food/restaurant/login", { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const menuItems = [
    { icon: Settings, label: "Settings", route: "/food/restaurant/onboarding?step=1" },
    { icon: HelpCircle, label: "Help Centre", route: "/food/restaurant/help-centre/support" },
    { icon: FileText, label: "Terms & Conditions", route: "/food/restaurant/terms" },
    { icon: Lock, label: "Privacy Policy", route: "#" },
    { icon: Globe, label: "Language", value: "English" },
  ]

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gray-50 pb-20"
    >
      {/* Header */}
      <div className="bg-white px-4 py-4 border-b border-gray-100 flex items-center gap-3 sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-6 h-6 text-gray-900" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
      </div>

      <div className="px-4 py-6 max-w-md mx-auto">
        {/* Profile Card */}
        <Card className="bg-white border-none shadow-sm rounded-3xl overflow-hidden mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden ring-4 ring-blue-50">
                  {userData.profileImage?.url ? (
                    <img src={userData.profileImage.url} alt={userData.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-gray-400" />
                  )}
                </div>
                <button 
                  onClick={() => navigate("/food/restaurant/onboarding?step=1")}
                  className="absolute bottom-0 right-0 p-2 bg-blue-600 rounded-full shadow-lg text-white"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{userData.name}</h2>
              <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full mb-4">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">{userData.role}</span>
              </div>
              <div className="w-full space-y-1 text-sm text-gray-500">
                <p>{userData.phone}</p>
                <p>{userData.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Menu Items */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden mb-6">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={() => item.route && navigate(item.route)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-gray-100 rounded-xl text-gray-600">
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="font-semibold text-gray-700">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.value && <span className="text-sm text-gray-400">{item.value}</span>}
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </div>
            </button>
          ))}
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-center gap-3 bg-red-50 text-red-600 font-bold py-4 rounded-3xl hover:bg-red-100 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-400">App Version 1.0.0</p>
          <div className="flex justify-center gap-4 mt-2 text-xs text-gray-500 font-medium">
            <a href="#">Privacy Policy</a>
            <span>•</span>
            <a href="#">Terms of Service</a>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
