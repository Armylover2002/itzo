import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { setAuthData } from "@food/utils/auth"
import { markLocationPromptAfterLogin } from "@food/utils/locationStorage"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState("loading") // "loading", "success", "error"
  const [error, setError] = useState("")
  const [provider, setProvider] = useState("")

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get provider from URL params
        const providerParam = searchParams.get("provider") || "google"
        setProvider(providerParam)

        // Get OAuth parameters from URL
        const code = searchParams.get("code")
        const errorParam = searchParams.get("error")
        const state = searchParams.get("state")

        // Check for OAuth errors
        if (errorParam) {
          setStatus("error")
          setError(
            errorParam === "access_denied"
              ? "You denied access to your account. Please try again."
              : "Authentication failed. Please try again."
          )
          return
        }

        // Check for direct token from backend (Backend OAuth flow)
        const token = searchParams.get("token")
        const userStr = searchParams.get("user")

        if (token) {
          try {
            const user = userStr ? JSON.parse(userStr) : null

            // Save auth data
            setAuthData("user", token, user)
            markLocationPromptAfterLogin()

            // Notify app of auth change
            window.dispatchEvent(new Event("userAuthChanged"))

            setStatus("success")

            // Redirect to home after short delay
            setTimeout(() => {
              navigate("/food/user", { replace: true })
            }, 1000)
            return
          } catch (err) {
            debugError("Error processing token from URL:", err)
            throw new Error("Invalid user data received from server")
          }
        }

        // If no code and no token, it might be a direct redirect (for demo purposes)
        if (!code) {
          // Simulate OAuth flow for demo
          await new Promise((resolve) => setTimeout(resolve, 2000))

          // In a real app, you would:
          // 1. Exchange the code for tokens
          // 2. Get user info from the provider
          // 3. Create/login user in your backend
          // 4. Set authentication tokens

          // For now, if we don't have a token, we can't really log them in properly
          // unless this is just a mockup

          // Store auth success in sessionStorage
          sessionStorage.setItem("oauthSuccess", JSON.stringify({
            provider: providerParam,
            timestamp: Date.now(),
          }))

          // Redirect to home after short delay
          setTimeout(() => {
            navigate("/food/user")
          }, 1500)
          return
        }

        // Backend disconnected - new backend in progress. OAuth callback disabled.
        setStatus("error")
        setError("OAuth is temporarily disabled. Backend is being rebuilt.")
      } catch (err) {
        setStatus("error")
        setError(
          err.message || "An error occurred during authentication. Please try again."
        )
      }
    }

    handleAuthCallback()
  }, [navigate, searchParams])

  const handleRetry = () => {
    navigate("/user/auth/login")
  }

  const handleGoHome = () => {
    navigate("/food/user")
  }

  return (
    <AnimatedPage className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50/30 via-white to-red-100/20 dark:from-gray-900 dark:via-[#0a0a0a] dark:to-gray-900 p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12">
      <Card className="w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl shadow-xl dark:shadow-2xl border-0 md:border md:border-gray-200 dark:md:border-gray-800">
        <CardHeader className="text-center space-y-2 md:space-y-3 lg:space-y-4 p-6 md:p-8 lg:p-10">
          <CardTitle className="text-2xl md:text-3xl lg:text-4xl font-bold text-black dark:text-white">
            {status === "loading" && "Authenticating..."}
            {status === "success" && "Authentication Successful!"}
            {status === "error" && "Authentication Failed"}
          </CardTitle>
          <CardDescription className="text-base md:text-lg text-gray-600 dark:text-gray-400">
            {status === "loading" && `Signing you in with ${provider || "your account"}...`}
            {status === "success" && "You've been successfully signed in."}
            {status === "error" && "We couldn't complete the authentication process."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 md:space-y-8 p-6 md:p-8 lg:p-10 pt-0 md:pt-0 lg:pt-0">
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-8 md:py-12 space-y-4 md:space-y-6">
              <Loader2 className="h-12 w-12 md:h-16 md:w-16 text-[#EB590E] animate-spin" />
              <p className="text-sm md:text-base text-muted-foreground text-center">
                Please wait while we verify your credentials...
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center justify-center py-8 md:py-12 space-y-4 md:space-y-6">
              <div className="relative">
                <CheckCircle2 className="h-16 w-16 md:h-20 md:w-20 lg:h-24 lg:w-24 text-[#EB590E] animate-in fade-in zoom-in duration-500" />
              </div>
              <div className="text-center space-y-2 md:space-y-3">
                <h3 className="text-xl md:text-2xl lg:text-3xl font-semibold text-[#EB590E] dark:text-[#F97316]">
                  Welcome!
                </h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Redirecting you to the home page...
                </p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center justify-center py-8 md:py-12 space-y-4 md:space-y-6">
              <div className="relative">
                <XCircle className="h-16 w-16 md:h-20 md:w-20 lg:h-24 lg:w-24 text-red-500 animate-in fade-in zoom-in duration-500" />
              </div>
              <div className="text-center space-y-2 md:space-y-3 w-full">
                <h3 className="text-xl md:text-2xl lg:text-3xl font-semibold text-red-600 dark:text-red-400">
                  Something went wrong
                </h3>
                {error && (
                  <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 p-4 md:p-5 rounded-lg text-sm md:text-base text-red-700 dark:text-red-400 max-w-sm mx-auto border border-red-200 dark:border-red-800">
                    <AlertCircle className="h-4 w-4 md:h-5 md:w-5 mt-0.5 flex-shrink-0" />
                    <p className="text-left">{error}</p>
                  </div>
                )}
                <p className="text-sm md:text-base text-muted-foreground">
                  Please try signing in again or use a different method.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full pt-4 md:pt-6">
                <Button
                  variant="outline"
                  onClick={handleGoHome}
                  className="flex-1 h-11 md:h-12 text-base md:text-lg border-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                >
                  Go Home
                </Button>
                <Button
                  onClick={handleRetry}
                  className="flex-1 h-11 md:h-12 text-base md:text-lg bg-[#EB590E] hover:bg-[#D94F0C] text-white transition-all hover:shadow-lg active:scale-[0.98]"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {status === "loading" && (
            <div className="text-center text-xs md:text-sm text-muted-foreground pt-4 md:pt-6 border-t border-gray-200 dark:border-gray-800">
              <p>This may take a few seconds...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </AnimatedPage>
  )
}

