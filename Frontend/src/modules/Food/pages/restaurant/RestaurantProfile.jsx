import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate, Link } from "react-router-dom"
import {
  X,
  User,
  Edit,
  LogOut,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react"
import { restaurantAPI } from "@food/api"
import { clearModuleAuth, clearAuthData, getCurrentUser } from "@food/utils/auth"
import { firebaseAuth, ensureFirebaseInitialized } from "@food/firebase"

const debugWarn = (...args) => {}
const debugError = (...args) => {}

export default function RestaurantProfile({ isOpen, onClose }) {
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deleteAccountConfirmOpen, setDeleteAccountConfirmOpen] = useState(false)
  const [restaurantData, setRestaurantData] = useState(null)
  const [loadingRestaurant, setLoadingRestaurant] = useState(true)

  // Handle back button to close the sheet
  useEffect(() => {
    if (!isOpen) return

    // Push a new state to the history when the sheet opens
    window.history.pushState({ profileOpen: true }, "")

    const handlePopState = (e) => {
      // When back button is pressed, if the sheet was open, close it
      onClose()
    }

    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)
      // If we are still on the profile state (e.g. onClose called manually), go back
      if (window.history.state?.profileOpen) {
        window.history.back()
      }
    }
  }, [isOpen, onClose])

  // Fetch restaurant data on mount
  useEffect(() => {
    if (!isOpen) return

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
  }, [isOpen])

  // Get user data from logged in session and restaurant data
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
      try {
        await restaurantAPI.logout()
      } catch (apiError) {
        debugWarn("Logout API call failed, continuing with local cleanup:", apiError)
      }

      try {
        const { signOut } = await import("firebase/auth")
        ensureFirebaseInitialized({ enableAuth: true, enableRealtimeDb: false })
        const currentUser = firebaseAuth.currentUser
        if (currentUser) {
          await signOut(firebaseAuth)
        }
      } catch (firebaseError) {
        debugWarn("Firebase logout failed, continuing with local cleanup:", firebaseError)
      }

      clearModuleAuth("restaurant")
      localStorage.removeItem("restaurant_onboarding")
      localStorage.removeItem("restaurant_accessToken")
      localStorage.removeItem("restaurant_authenticated")
      localStorage.removeItem("restaurant_user")
      sessionStorage.removeItem("restaurantAuthData")
      window.dispatchEvent(new Event("restaurantAuthChanged"))

      setTimeout(() => {
        onClose()
        navigate("/food/restaurant/login", { replace: true })
      }, 300)
    } catch (error) {
      debugError("Error during logout:", error)
      clearModuleAuth("restaurant")
      window.dispatchEvent(new Event("restaurantAuthChanged"))
      navigate("/food/restaurant/login", { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleLogoutAllDevices = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)

    try {
      try {
        await restaurantAPI.logoutAll()
      } catch (apiError) {
        debugWarn("Logout All API call failed, continuing with local cleanup:", apiError)
      }

      try {
        const { signOut } = await import("firebase/auth")
        ensureFirebaseInitialized({ enableAuth: true, enableRealtimeDb: false })
        const currentUser = firebaseAuth.currentUser
        if (currentUser) {
          await signOut(firebaseAuth)
        }
      } catch (firebaseError) {
        debugWarn("Firebase logout failed, continuing with local cleanup:", firebaseError)
      }

      clearAuthData()
      localStorage.removeItem("restaurant_onboarding")
      sessionStorage.removeItem("restaurantAuthData")
      sessionStorage.removeItem("adminAuthData")
      sessionStorage.removeItem("deliveryAuthData")
      sessionStorage.removeItem("userAuthData")

      window.dispatchEvent(new Event("restaurantAuthChanged"))
      window.dispatchEvent(new Event("adminAuthChanged"))
      window.dispatchEvent(new Event("deliveryAuthChanged"))
      window.dispatchEvent(new Event("userAuthChanged"))

      setTimeout(() => {
        onClose()
        navigate("/food/restaurant/login", { replace: true })
      }, 300)
    } catch (error) {
      debugError("Error during logout from all devices:", error)
      clearAuthData()
      window.dispatchEvent(new Event("restaurantAuthChanged"))
      navigate("/food/restaurant/login", { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (isDeletingAccount) return
    setIsDeletingAccount(true)

    try {
      await restaurantAPI.deleteAccount()
      
      try {
        const { signOut } = await import("firebase/auth")
        ensureFirebaseInitialized({ enableAuth: true, enableRealtimeDb: false })
        const currentUser = firebaseAuth.currentUser
        if (currentUser) {
          await signOut(firebaseAuth)
        }
      } catch (firebaseError) {
        debugWarn("Firebase logout failed, continuing with local cleanup:", firebaseError)
      }

      clearModuleAuth("restaurant")
      localStorage.removeItem("restaurant_onboarding")
      localStorage.removeItem("restaurant_accessToken")
      localStorage.removeItem("restaurant_authenticated")
      localStorage.removeItem("restaurant_user")
      sessionStorage.removeItem("restaurantAuthData")
      window.dispatchEvent(new Event("restaurantAuthChanged"))

      setTimeout(() => {
        setDeleteAccountConfirmOpen(false)
        onClose()
        navigate("/food/restaurant/login", { replace: true })
      }, 300)
    } catch (error) {
      debugError("Error during account deletion:", error)
    } finally {
      setIsDeletingAccount(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-[100]"
            onClick={onClose}
          />

          {/* Popup Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 300
            }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, { offset, velocity }) => {
              if (offset.y > 100 || velocity.y > 500) {
                onClose()
              }
            }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-[101] max-h-[90vh] overflow-y-auto overflow-x-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div className="w-full flex justify-center pt-3 pb-1">
              <div className="w-12 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">My profile</h2>
            </div>

            {/* User Information Section */}
            <div className="px-6 py-8">
              <div className="flex items-start gap-5">
                {/* Avatar */}
                <div className="relative">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center shrink-0 overflow-hidden ring-4 ring-gray-50">
                    {userData.profileImage?.url ? (
                      <img
                        src={userData.profileImage.url}
                        alt={userData.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-10 h-10 text-gray-400" />
                    )}
                  </div>
                  <button 
                    onClick={() => {
                      onClose()
                      navigate("/food/restaurant/outlet-info")
                    }}
                    className="absolute -bottom-1 -right-1 p-1.5 bg-white rounded-full shadow-md border border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <Edit className="w-4 h-4 text-primary" />
                  </button>
                </div>

                {/* User Details */}
                <div className="flex-1 min-w-0 pt-1">
                  <h3 className="text-xl font-bold text-gray-900 truncate mb-1">
                    {userData.name}
                  </h3>
                  {userData.phone && (
                    <p className="text-base text-gray-600 mb-0.5 font-medium">
                      {userData.phone}
                    </p>
                  )}
                  {userData.email && (
                    <p className="text-sm text-gray-500 truncate mb-3">
                      {userData.email}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 bg-[#f3f5f7] text-[#092240] px-2.5 py-1 rounded-full w-fit">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {userData.role}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="px-6 pb-8 space-y-4">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white font-bold py-4 px-4 rounded-2xl transition-all shadow-lg shadow-red-100 active:scale-[0.98]"
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>

              <button
                onClick={handleLogoutAllDevices}
                disabled={isLoggingOut}
                className="w-full bg-white border-2 border-red-600 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed font-bold py-4 px-4 rounded-2xl transition-all active:scale-[0.98]"
              >
                Logout from all devices
              </button>

              <button
                onClick={() => setDeleteAccountConfirmOpen(true)}
                disabled={isLoggingOut || isDeletingAccount}
                className="w-full bg-white border-2 border-red-900 text-red-900 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed font-bold py-4 px-4 rounded-2xl transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-5 h-5" /> Delete Account
              </button>
            </div>

            {/* Footer Links */}
            <div className="px-6 py-6 border-t border-gray-100 bg-gray-50/50">
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px] text-gray-500 font-medium">
                <Link to="/food/restaurant/terms" onClick={onClose} className="hover:text-gray-900 transition-colors">Terms & Conditions</Link>
                <span className="text-gray-300">•</span>
                <Link to="/food/restaurant/privacy" onClick={onClose} className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
              </div>
            </div>
          </motion.div>

          {/* Delete Account Confirmation Popup */}
          {deleteAccountConfirmOpen && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-red-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-red-100 p-2 rounded-full text-red-600">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Delete Account?
                  </h3>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Are you sure you want to delete your restaurant account? You will lose access to all your orders and settings.
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={() => setDeleteAccountConfirmOpen(false)}
                    disabled={isDeletingAccount}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-medium text-white transition-colors disabled:opacity-50"
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount}
                  >
                    {isDeletingAccount ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </AnimatePresence>
  )
}
