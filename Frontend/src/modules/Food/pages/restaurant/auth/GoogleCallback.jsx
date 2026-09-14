import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { setAuthData } from "@food/utils/auth"
import { useCompanyName } from "@food/hooks/useCompanyName"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function RestaurantGoogleCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState("loading") // "loading", "success", "error"
  const [error, setError] = useState("")
  const [provider, setProvider] = useState("google")

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const providerParam = searchParams.get("provider") || "google"
        setProvider(providerParam)

        // Get token and user from URL params (set by backend redirect)
        const token = searchParams.get("token")
        const userParam = searchParams.get("user")
        const errorParam = searchParams.get("error")

        // Check for OAuth errors
        if (errorParam) {
          setStatus("error")
          const errorMessages = {
            oauth_failed: "Google authentication failed. Please try again.",
            no_code: "No authorization code received from Google.",
            invalid_state: "Security verification failed. Please try again.",
            no_email: "Google account email not found. Please use a different account.",
            wrong_role: "This account is not registered as a restaurant partner.",
            auth_failed: "Authentication failed. Please try again."
          }
          setError(errorMessages[errorParam] || "Authentication failed. Please try again.")
          return
        }

        // Check if we have token and user data
        if (!token || !userParam) {
          setStatus("error")
          setError("Authentication data missing. Please try logging in again.")
          return
        }

        // Parse user data
        let user
        try {
          user = JSON.parse(decodeURIComponent(userParam))
        } catch (parseError) {
          setStatus("error")
          setError("Invalid user data received. Please try again.")
          return
        }

        // Store authentication data using utility function
        setAuthData("restaurant", token, user)

        // Notify any listeners that auth state has changed
        window.dispatchEvent(new Event("restaurantAuthChanged"))

        setStatus("success")

        // Redirect to restaurant home after short delay
        setTimeout(() => {
          navigate("/restaurant")
        }, 1200)
      } catch (err) {
        debugError("Restaurant Google auth error:", err)
        setStatus("error")
        setError(
          err.message || "An error occurred during Google authentication. Please try again."
        )
      }
    }

    handleCallback()
  }, [navigate, searchParams])

  const handleRetry = () => {
    navigate("/restaurant/login")
  }

  const handleGoHome = () => {
    navigate("/restaurant")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-yellow-50/30 via-white to-red-50/20 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">
            {status === "loading" && "Signing you in with Google..."}
            {status === "success" && "Google Sign-in Successful!"}
            {status === "error" && "Google Sign-in Failed"}
          </h1>
          <p className="text-sm text-gray-600">
            {status === "loading" &&
              `Connecting your ${provider || "Google"} account to ${companyName} Restaurant Panel...`}
            {status === "success" && "You will be redirected to your restaurant panel shortly."}
            {status === "error" && "We could not complete the Google sign-in process."}
          </p>
        </div>

        {status === "loading" && (
          <div className="flex flex-col items-center justify-center py-6 space-y-3">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-500">Please wait, this may take a few seconds...</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center justify-center py-6 space-y-3">
            <CheckCircle2 className="h-14 w-14 text-green-500" />
            <p className="text-sm text-gray-700">
              Your Google account has been linked to your restaurant profile.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <XCircle className="h-14 w-14 text-red-500" />
            {error && (
              <div className="flex items-start gap-2 bg-red-50 p-3 rounded-lg text-sm text-red-700 w-full">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p className="text-left">{error}</p>
              </div>
            )}
            <div className="flex gap-3 w-full pt-2">
              <Button
                variant="outline"
                onClick={handleGoHome}
                className="flex-1"
              >
                Go Home
              </Button>
              <Button
                onClick={handleRetry}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Try Again
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}



