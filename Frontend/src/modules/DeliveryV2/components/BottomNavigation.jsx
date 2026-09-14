import { useNavigate, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import { User } from "lucide-react"
import { deliveryAPI } from "@food/api"

// Heroicons Outline
import {
  HomeIcon as HomeOutline,
  WalletIcon as WalletOutline,
  ClockIcon as ClockOutline,
} from "@heroicons/react/24/outline"

// Heroicons Solid
import {
  HomeIcon as HomeSolid,
  WalletIcon as WalletSolid,
  ClockIcon as ClockSolid,
} from "@heroicons/react/24/solid"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function BottomNavigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const [profileImage, setProfileImage] = useState(null)
  const [imageError, setImageError] = useState(false)

  const isActive = (path) => {
    if (path === "/delivery") return location.pathname === "/delivery"
    return location.pathname.startsWith(path)
  }

  const iconClass = "w-6 h-6"

  const TabIcon = (active, Outline, Solid) => {
    const Icon = active ? Solid : Outline
    return <Icon className={iconClass} />
  }

  const TabLabel = (active, label) => (
    <span className={`text-[10px] font-medium ${active ? "text-black" : "text-gray-500"}`}>
      {label}
    </span>
  )

  // Fetch profile image
  useEffect(() => {
    const fetchProfileImage = async () => {
      try {
        const response = await deliveryAPI.getProfile()
        if (response?.data?.success && response?.data?.data?.profile) {
          const profile = response.data.data.profile
          // Use profileImage.url first, fallback to documents.photo
          const imageUrl = profile.profileImage?.url || profile.documents?.photo
          if (imageUrl) {
            setProfileImage(imageUrl)
          }
        }
      } catch (error) {
        // Skip logging network and timeout errors (handled by axios interceptor)
        if (error.code !== 'ECONNABORTED' && 
            error.code !== 'ERR_NETWORK' && 
            error.message !== 'Network Error' &&
            !error.message?.includes('timeout')) {
          debugError("Error fetching profile image for navigation:", error)
        }
      }
    }

    fetchProfileImage()

    // Listen for profile refresh events
    const handleProfileRefresh = () => {
      fetchProfileImage()
    }

    window.addEventListener('deliveryProfileRefresh', handleProfileRefresh)
    
    return () => {
      window.removeEventListener('deliveryProfileRefresh', handleProfileRefresh)
    }
  }, [])

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="flex items-center justify-around py-2 px-4">

        {/* Feed */}
        <button
          onClick={() => navigate("/delivery")}
          className="flex flex-col items-center gap-1 p-2"
        >
          {TabIcon(isActive("/delivery"), HomeOutline, HomeSolid)}
          {TabLabel(isActive("/delivery"), "Feed")}
        </button>

        {/* Pocket */}
        <button
          onClick={() => navigate("/delivery/requests")}
          className="flex flex-col items-center gap-1 p-2"
        >
          {TabIcon(isActive("/delivery/requests"), WalletOutline, WalletSolid)}
          {TabLabel(isActive("/delivery/requests"), "Pocket")}
        </button>

        {/* Trip History */}
        <button
          onClick={() => navigate("/delivery/trip-history")}
          className="flex flex-col items-center gap-1 p-2"
        >
          {TabIcon(isActive("/delivery/trip-history"), ClockOutline, ClockSolid)}
          {TabLabel(isActive("/delivery/trip-history "), "Trip History")}
        </button>

        {/* Profile */}
        <button
          onClick={() => navigate("/delivery/profile")}
          className="flex flex-col items-center gap-1 p-2"
        >
          {profileImage && !imageError ? (
            <img
              src={profileImage}
              alt="Profile"
              className={`w-7 h-7 rounded-full border-2 object-cover ${
                isActive("/delivery/profile") ? "border-black" : "border-gray-300"
              }`}
              onError={() => {
                setImageError(true)
              }}
            />
          ) : (
            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center bg-gray-200 ${
              isActive("/delivery/profile") ? "border-black" : "border-gray-300"
            }`}>
              <User className="w-4 h-4 text-gray-500" />
            </div>
          )}
          {TabLabel(isActive("/delivery/profile"), "Profile")}
        </button>
      </div>
    </div>
  )
}

