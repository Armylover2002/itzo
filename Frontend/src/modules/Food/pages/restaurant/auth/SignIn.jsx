import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { restaurantAPI } from "@food/api"
import { isModuleAuthenticated, setAuthData } from "@food/utils/auth"
import { Mail, Lock, EyeOff, Eye, CheckSquare, UtensilsCrossed } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
import { Checkbox } from "@food/components/ui/checkbox"
import loginBg from "@food/assets/loginbanner.png"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { getAppLogo, subscribeBusinessSettings } from "@common/utils/businessSettings"


export default function RestaurantSignIn() {
  const navigate = useNavigate()
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo('restaurant'))

  useEffect(() => {
    const apply = () => {
      const logo = getAppLogo('restaurant')
      if (logo) setLogoUrl(logo)
    }
    apply()
    return subscribeBusinessSettings(apply)
  }, [])
  const [email, setEmail] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("restaurantLoginEmail") || ""
    }
    return ""
  })
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const companyName = useCompanyName()

  // Redirect to restaurant home if already authenticated
  useEffect(() => {
    const isAuthenticated = isModuleAuthenticated("restaurant")
    if (isAuthenticated) {
      navigate("/restaurant", { replace: true })
    }
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      // Login with restaurant auth endpoint
      const response = await restaurantAPI.login(email, password)
      const data = response?.data?.data || response?.data
      
      if (data.accessToken && data.restaurant) {
        // Replace old token with new one (handles cross-module login)
        setAuthData("restaurant", data.accessToken, data.restaurant)
        
        // Dispatch custom event for same-tab updates
        window.dispatchEvent(new Event('restaurantAuthChanged'))
        
        navigate("/restaurant", { replace: true })
      } else {
        throw new Error("Login failed. Please try again.")
      }
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Login failed. Please check your credentials."
      setError(message)
    } finally {
    setIsLoading(false)
    }
  }

  return (
    <div className="h-screen w-full flex bg-white overflow-hidden">
      {/* Left image section */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img
          src={loginBg}
          alt="Restaurant background"
          className="w-full h-full object-cover"
        />
        {/* Orange half-circle text block attached to the left with animation */}
        <div className="absolute inset-0 flex items-center text-white pointer-events-none">
          <div
            className="bg-primary-orange/80 rounded-r-full py-10 xl:py-20 pl-10 xl:pl-14 pr-10 xl:pr-20 max-w-[70%] shadow-xl backdrop-blur-[1px]"
            style={{ animation: "slideInLeft 0.8s ease-out both" }}
          >
            <h1 className="text-3xl xl:text-4xl font-extrabold mb-4 tracking-wide leading-tight">
              WELCOME TO
              <br />
              {companyName.toUpperCase()}
            </h1>
            <p className="text-base xl:text-lg opacity-95 max-w-xl">
              Manage your restaurant, orders and website easily from a single dashboard.
            </p>
          </div>
        </div>
      </div>

      {/* Right form section */}
      <div className="w-full lg:w-1/2 h-full flex flex-col">
        {/* Top logo and version */}
        <div className="relative flex items-center justify-center px-6 sm:px-10 lg:px-16 pt-6 pb-4">
          <div
            className="flex items-center gap-3"
            style={{ animation: "fadeInDown 0.7s ease-out both" }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-11 w-auto object-contain shrink-0" />
            ) : (
              <div className="h-11 w-11 rounded-xl bg-primary-orange flex items-center justify-center text-white shadow-lg overflow-hidden shrink-0">
                <UtensilsCrossed className="h-6 w-6" />
              </div>
            )}
            <div className="flex flex-col items-start">
              <span className="text-2xl font-bold tracking-wide text-primary-orange">
                {companyName}
              </span>
              <span className="text-xs font-medium text-gray-500">
                Restaurant Panel
              </span>
            </div>
          </div>
          <div className="absolute right-6 sm:right-10 lg:right-16 top-6 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-medium text-emerald-700 shadow-sm">
            Software Version : 1.0.0
          </div>
        </div>

        {/* Centered content (title + form + info) */}
        <div
          className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 lg:px-16 pb-8"
          style={{ animation: "fadeInUp 0.8s ease-out 0.15s both" }}
        >
          {/* Title */}
          <div className="mb-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
              Signin To Your Restaurant Panel
            </h2>
            <p className="text-sm text-gray-500">
              Enter your credentials to access the restaurant dashboard.
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="space-y-5 w-full max-w-lg rounded-xl bg-white/80 backdrop-blur-sm p-1 sm:p-2"
          >
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Your Email
              </Label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                  <Mail className="h-4 w-4" />
                </span>
                <Input
                  id="email"
                  type="email"
                  placeholder="test.restaurant@gmail.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (typeof window !== "undefined") {
                      sessionStorage.setItem("restaurantLoginEmail", e.target.value)
                    }
                  }}
                  className="h-11 pl-9 border-gray-300 rounded-md shadow-sm focus-visible:ring-primary-orange focus-visible:ring-2 transition-colors placeholder:text-gray-400"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </Label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                  <Lock className="h-4 w-4" />
                </span>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pl-9 pr-10 border-gray-300 rounded-md shadow-sm focus-visible:ring-primary-orange focus-visible:ring-2 transition-colors placeholder:text-gray-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox
                  id="remember"
                  checked={remember}
                  onCheckedChange={(v) => setRemember(Boolean(v))}
                  className="border-gray-300 data-[state=checked]:bg-primary-orange data-[state=checked]:border-primary-orange"
                />
                <span className="text-gray-700">Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => navigate("/restaurant/forgot-password")}
                className="text-primary-orange hover:underline font-medium"
              >
                Forgot Password
              </button>
            </div>

            {/* Sign in button */}
            <Button
              type="submit"
              className="mt-2 h-11 w-full bg-primary-orange hover:bg-primary-orange/90 text-white text-base font-semibold rounded-md shadow-md transition-colors"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          {/* Sign up link */}
          <div className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?{" "}
            <button
              onClick={() => navigate("/restaurant/signup-email")}
              className="text-primary-orange hover:underline font-medium"
            >
              Sign up
            </button>
          </div>

          {/* Demo credentials / info bar */}
          <div className="mt-8 w-full max-w-lg rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-xs sm:text-sm text-gray-800 flex items-start gap-3">
            <div className="mt-0.5 text-primary-orange">
              <CheckSquare className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold mb-1">Demo Credentials</div>
              <div>
                <span className="font-semibold">Email :</span> test.restaurant@gmail.com
              </div>
              <div>
                <span className="font-semibold">Password :</span> 12345678
              </div>
            </div>
          </div>
        </div>

        {/* Simple keyframe animations */}
        <style>{`
          @keyframes slideInLeft {
            from {
              opacity: 0;
              transform: translateX(-40px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes fadeInDown {
            from {
              opacity: 0;
              transform: translateY(-16px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    </div>
  )
}

