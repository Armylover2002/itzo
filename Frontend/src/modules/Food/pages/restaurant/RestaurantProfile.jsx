import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate, Link } from "react-router-dom"
import {
  X,
  User,
  Edit,
  LogOut,
  ShieldCheck,
  Trash2,
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
  const [restaurantData, setRestaurantData] = useState(null)
  const [loadingRestaurant, setLoadingRestaurant] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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
    if (isDeleting) return
    setIsDeleting(true)

    try {
      await restaurantAPI.deleteAccount()
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
      debugError("Error during restaurant account deletion:", error)
      clearModuleAuth("restaurant")
      window.dispatchEvent(new Event("restaurantAuthChanged"))
      navigate("/food/restaurant/login", { replace: true })
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const profileBody = (
    <>
      <div className="px-6 py-8 lg:px-8 lg:py-6">
        <div className="flex items-start gap-5 lg:items-center lg:gap-6">
          <div className="relative shrink-0">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gray-100 ring-4 ring-gray-50 lg:h-24 lg:w-24">
              {userData.profileImage?.url ? (
                <img
                  src={userData.profileImage.url}
                  alt={userData.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-10 w-10 text-gray-400" />
              )}
            </div>
            <button
              onClick={() => {
                onClose()
                navigate("/food/restaurant/outlet-info")
              }}
              className="absolute -bottom-1 -right-1 rounded-full border border-gray-100 bg-white p-1.5 shadow-md transition-colors hover:bg-gray-50"
            >
              <Edit className="h-4 w-4 text-blue-600" />
            </button>
          </div>

          <div className="min-w-0 flex-1 pt-1 lg:pt-0">
            <h3 className="mb-1 truncate text-xl font-bold text-gray-900 lg:text-2xl">
              {userData.name}
            </h3>
            {userData.phone && (
              <p className="mb-0.5 text-base font-medium text-gray-600">
                {userData.phone}
              </p>
            )}
            {userData.email && (
              <p className="mb-3 truncate text-sm text-gray-500">
                {userData.email}
              </p>
            )}
            <div className="flex w-fit items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="text-xs font-bold uppercase tracking-wider">
                {userData.role}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-6 pb-8 lg:px-8 lg:pb-6">
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full rounded-2xl bg-red-600 px-4 py-4 font-bold text-white shadow-lg shadow-red-100 transition-all hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-red-400 lg:py-3.5"
        >
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>

        <button
          onClick={handleLogoutAllDevices}
          disabled={isLoggingOut}
          className="w-full rounded-2xl border-2 border-red-600 bg-white px-4 py-4 font-bold text-red-600 transition-all hover:bg-red-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 lg:py-3.5"
        >
          Logout from all devices
        </button>

        {userData.role !== "ADMIN" && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isLoggingOut || isDeleting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 font-bold text-red-600 transition-all hover:bg-red-100/80 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 lg:py-3.5"
          >
            <Trash2 className="h-5 w-5" />
            Delete Account
          </button>
        )}
      </div>

      <div className="border-t border-gray-100 bg-gray-50/50 px-6 py-6 lg:rounded-b-2xl">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px] font-medium text-gray-500">
          <Link to="/food/restaurant/terms" onClick={onClose} className="transition-colors hover:text-gray-900">Terms & Conditions</Link>
          <span className="text-gray-300">•</span>
          <Link to="/food/restaurant/privacy" onClick={onClose} className="transition-colors hover:text-gray-900">Privacy Policy</Link>
        </div>
      </div>
    </>
  )

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

          {/* Mobile bottom sheet */}
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
            className="fixed bottom-0 left-0 right-0 z-[101] max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-t-3xl bg-white shadow-2xl lg:hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex w-full justify-center pb-1 pt-3">
              <div className="h-1 w-12 rounded-full bg-gray-200" />
            </div>

            <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900">My profile</h2>
            </div>

            {profileBody}
          </motion.div>

          {/* Desktop centered dialog */}
          <div className="fixed inset-0 z-[101] hidden items-center justify-center p-6 pointer-events-none lg:flex">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="pointer-events-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-8 py-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">My profile</h2>
                  <p className="mt-0.5 text-sm text-gray-500">Manage your account and session</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-2 transition-colors hover:bg-gray-100"
                  aria-label="Close profile"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              {profileBody}
            </motion.div>
          </div>

          {showDeleteConfirm && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 backdrop-blur-xs">
              <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 text-center">
                <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 text-red-600">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Delete Restaurant Account?
                </h3>
                <p className="text-sm text-gray-500 font-medium leading-relaxed mb-6">
                  Are you sure you want to delete your restaurant account? All your outlet menus, active orders, and sales history will be disabled. This action is soft-delete.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-2xl transition-all"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-red-100"
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
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
