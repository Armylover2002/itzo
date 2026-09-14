import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Power, AlertCircle } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Button } from "@food/components/ui/button"
import { Card, CardContent } from "@food/components/ui/card"
import { useState } from "react"
import { authAPI } from "@food/api"
import { firebaseAuth, ensureFirebaseInitialized } from "@food/firebase"
import { clearUserSession } from "@food/utils/auth"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}
const USER_SESSION_PREFERENCE_KEYS = ["userVegMode", "food-under-250-filters"]


export default function Logout() {
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [error, setError] = useState("")

  const handleLogout = async () => {
    setIsLoggingOut(true)
    setError("")

    try {
      // Call backend logout API to invalidate refresh token
      try {
        let fcmToken = null;
        let platform = "web";
        try {
          if (typeof window !== "undefined") {
            if (window.flutter_inappwebview) {
              platform = "mobile";
              const handlerNames = ["getFcmToken", "getFCMToken", "getPushToken", "getFirebaseToken"];
              for (const handlerName of handlerNames) {
                try {
                  const t = await Promise.race([
                    window.flutter_inappwebview.callHandler(handlerName, { module: "user" }),
                    new Promise((resolve) => setTimeout(() => resolve(null), 800))
                  ]);
                  if (t && typeof t === "string" && t.length > 20) {
                    fcmToken = t.trim();
                    break;
                  }
                } catch (e) {}
              }
            } else {
              fcmToken = localStorage.getItem("fcm_web_registered_token_user") || null;
            }
          }
        } catch (e) {
          console.warn("Failed to get FCM token during logout", e);
        }
        await authAPI.logout(null, fcmToken, platform)
      } catch (apiError) {
        // Continue with logout even if API call fails (network issues, etc.)
        debugWarn("Logout API call failed, continuing with local cleanup:", apiError)
      }

      // Sign out from Firebase if user logged in via Google
      try {
        const { signOut } = await import("firebase/auth")
        // Firebase Auth is lazy-initialized now; ensure it before accessing firebaseAuth.currentUser
        ensureFirebaseInitialized({ enableAuth: true, enableRealtimeDb: false })
        const currentUser = firebaseAuth.currentUser
        if (currentUser) {
          await signOut(firebaseAuth)
        }
      } catch (firebaseError) {
        // Continue even if Firebase logout fails
        debugWarn("Firebase logout failed, continuing with local cleanup:", firebaseError)
      }

      // Clear all authentication data from localStorage
      clearUserSession()
      localStorage.removeItem("accessToken")
      localStorage.removeItem("user_authenticated")
      localStorage.removeItem("user_user")
      localStorage.removeItem("user")
      USER_SESSION_PREFERENCE_KEYS.forEach((key) => localStorage.removeItem(key))

      // Clear sessionStorage
      sessionStorage.removeItem("userAuthData")

      // Dispatch auth change event to notify other components
      window.dispatchEvent(new Event("userAuthChanged"))

      // Small delay for UX, then return to the shared login screen.
      setTimeout(() => {
        navigate("/user/auth/login", { replace: true })
      }, 500)
    } catch (err) {
      // Even if there's an error, we should still clear local data and logout
      debugError("Error during logout:", err)
      
      // Clear local data anyway
      clearUserSession()
      localStorage.removeItem("accessToken")
      localStorage.removeItem("user_authenticated")
      localStorage.removeItem("user_user")
      localStorage.removeItem("user")
      USER_SESSION_PREFERENCE_KEYS.forEach((key) => localStorage.removeItem(key))
      sessionStorage.removeItem("userAuthData")
      window.dispatchEvent(new Event("userAuthChanged"))

      setError("An error occurred during logout, but you have been signed out locally.")
      
      // Still return to the shared login screen after showing error.
      setTimeout(() => {
        navigate("/user/auth/login", { replace: true })
      }, 2000)
    }
  }

  return (
    <AnimatedPage className="min-h-screen bg-[#f5f5f5]">
      <div className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6 lg:mb-8">
          <Link to="/user/profile">
            <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10 p-0">
              <ArrowLeft className="h-4 w-4 md:h-5 md:w-5 text-black dark:text-white" />
            </Button>
          </Link>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-black dark:text-white">Log out</h1>
        </div>

        {!isLoggingOut ? (
          <>
            {/* Warning Card */}
            <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border-0 mb-4 md:mb-5 lg:mb-6">
              <CardContent className="p-6 md:p-8 lg:p-10 text-center">
                <div className="w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-5 lg:mb-6">
                  <Power className="h-8 w-8 md:h-10 md:w-10 lg:h-12 lg:w-12 text-gray-700 dark:text-gray-300" />
                </div>
                <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2 md:mb-3">Log out?</h2>
                <p className="text-sm md:text-base lg:text-lg text-gray-600 dark:text-gray-400 mb-4 md:mb-6">
                  Are you sure you want to log out? You'll need to sign in again to access your account.
                </p>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 rounded-xl shadow-sm mb-4 md:mb-5 lg:mb-6">
              <CardContent className="p-4 md:p-5 lg:p-6">
                <div className="flex items-start gap-3 md:gap-4">
                  <div className="bg-yellow-100 dark:bg-yellow-900/40 rounded-full p-2 md:p-3 mt-0.5">
                    <AlertCircle className="h-5 w-5 md:h-6 md:w-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base md:text-lg lg:text-xl font-semibold text-yellow-900 dark:text-yellow-200 mb-1 md:mb-2">
                      Before you go
                    </h3>
                    <p className="text-sm md:text-base text-yellow-700 dark:text-yellow-300">
                      Make sure you've saved any important information. Your cart and preferences will be saved for next time.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3 md:space-y-4">
              <Button
                onClick={handleLogout}
                className="w-full bg-red-600 hover:bg-red-700 text-white text-sm md:text-base h-10 md:h-12"
              >
                Yes, Log out
              </Button>
              <Link to="/user/profile">
                <Button
                  variant="outline"
                  className="w-full text-sm md:text-base h-10 md:h-12"
                >
                  Cancel
                </Button>
              </Link>
            </div>
          </>
        ) : (
          /* Logging Out State */
          <Card className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border-0 overflow-hidden">
            <CardContent className="p-6 md:p-8 lg:p-10 text-center">
              <div className="w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-5 lg:mb-6">
                <Power className="h-8 w-8 md:h-10 md:w-10 lg:h-12 lg:w-12 text-gray-700 dark:text-gray-300 animate-pulse" />
              </div>
              <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2 md:mb-3">Logging out...</h2>
              <p className="text-sm md:text-base lg:text-lg text-gray-600 dark:text-gray-400 mb-3 md:mb-4">
                Please wait while we sign you out.
              </p>
              {error && (
                <div className="mt-4 p-3 md:p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-xs md:text-sm text-yellow-800 dark:text-yellow-200">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AnimatedPage>
  )
}

