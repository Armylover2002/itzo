import { useState, useEffect, useRef } from "react"
import { useNavigate, Link, useSearchParams } from "react-router-dom"
import { AlertCircle, Loader2 } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { authAPI } from "@food/api"
import loginBanner from "@food/assets/loginbanner.png"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function SignIn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [formData, setFormData] = useState({
    phone: "",
    countryCode: "+91", // required; default +91 for India
  })

  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    const stored = sessionStorage.getItem("userAuthData")
    if (!stored) return

    try {
      const data = JSON.parse(stored)
      const fullPhone = String(data.phone || "").trim()
      const phoneDigits = fullPhone.replace(/^\+91\s*/, "").replace(/\D/g, "").slice(0, 10)

      setFormData((prev) => ({
        ...prev,
        phone: phoneDigits || prev.phone,
      }))
    } catch (err) {
      debugError("Error parsing stored auth data:", err)
    }
  }, [])

  const validatePhone = (phone) => {
    if (!phone.trim()) return "Phone number is required"
    const cleanPhone = phone.replace(/\D/g, "")
    if (!/^\d{10}$/.test(cleanPhone)) return "Phone number must be exactly 10 digits"
    return ""
  }

  const handleChange = (e) => {
    const { name } = e.target
    let { value } = e.target

    if (name === "phone") {
      value = value.replace(/\D/g, "").slice(0, 10)
      setError(validatePhone(value))
    }

    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const phoneError = validatePhone(formData.phone)
    setError(phoneError)
    if (phoneError) return
    if (submittingRef.current) return
    submittingRef.current = true
    setIsLoading(true)
    setError("")

    try {
      const countryCode = formData.countryCode?.trim() || "+91"
      const phoneDigits = String(formData.phone ?? "").replace(/\D/g, "").slice(0, 10)
      if (phoneDigits.length !== 10) {
        setError("Phone number must be exactly 10 digits")
        setIsLoading(false)
        submittingRef.current = false
        return
      }
      const fullPhone = `${countryCode} ${phoneDigits}`
      await authAPI.sendOTP(fullPhone, "login", null)

      const ref = String(searchParams.get("ref") || "").trim()
      const authData = {
        method: "phone",
        phone: fullPhone,
        email: null,
        name: null,
        referralCode: ref || null,
        isSignUp: false,
        module: "user",
      }

      sessionStorage.setItem("userAuthData", JSON.stringify(authData))
      navigate("/food/user/auth/otp")
    } catch (apiError) {
      const message =
        apiError?.response?.data?.message ||
        apiError?.response?.data?.error ||
        "Failed to send OTP. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
      submittingRef.current = false
    }
  }

  return (
    <AnimatedPage className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center p-4">
      {/* Background decoration (desktop only) */}
      <div className="fixed inset-0 z-0 hidden md:block opacity-40">
        <img src={loginBanner} alt="" className="w-full h-full object-cover blur-sm" />
        <div className="absolute inset-0 bg-white/60 dark:bg-black/80" />
      </div>

      <div className="w-full max-w-[450px] bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl relative z-10 overflow-hidden border border-gray-100 dark:border-gray-800">
        {/* Banner (Mobile Only) */}
        <div className="md:hidden w-full h-[180px] relative">
          <img src={loginBanner} alt="Food Banner" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#1a1a1a] to-transparent" />
        </div>

        <div className="p-6 sm:p-8 md:p-10 space-y-6 md:space-y-8">
          <div className="text-center space-y-2 md:space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white leading-tight">
              Login or Signup
            </h2>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
              Enter your phone number to continue
            </p>
          </div>

          <form id="user-signin-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <div className="relative flex items-center">
                <div className="flex items-center px-4 h-12 md:h-14 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-white rounded-lg border-r-0 rounded-r-none font-medium">
                  <span>+91</span>
                </div>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  placeholder="Phone number"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`flex-1 h-12 md:h-14 text-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white border-gray-300 dark:border-gray-700 rounded-lg rounded-l-none focus-visible:ring-1 focus-visible:ring-[#EB590E] focus-visible:border-[#EB590E] ${error ? "border-red-500" : ""} transition-all`}
                  aria-invalid={error ? "true" : "false"}
                />
              </div>

              {error && (
                <div className="flex items-center gap-1.5 text-xs text-red-500 pl-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              form="user-signin-form"
              className="w-full h-12 md:h-14 bg-[#EB590E] hover:bg-[#D94F0C] text-white font-bold text-base md:text-lg rounded-lg transition-all hover:shadow-lg active:scale-[0.98]"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Sending OTP...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>

          {/* Social login separator */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200 dark:border-gray-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-[#1a1a1a] px-3 text-gray-500 dark:text-gray-400 font-medium">
                or
              </span>
            </div>
          </div>

          {/* Social login buttons */}
          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              className="flex items-center justify-center gap-3 w-full h-12 md:h-14 bg-white dark:bg-[#2a2a2a] border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-[#333] transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.14-4.53z"
                />
              </svg>
              <span className="text-gray-700 dark:text-gray-200 font-medium">Continue with Google</span>
            </button>
          </div>

          <div className="text-center text-xs md:text-sm text-gray-500 dark:text-gray-400 pt-2">
            <p className="mb-2">By continuing, you agree to our</p>
            <div className="flex justify-center gap-2 flex-wrap">
              <Link to="/profile/terms" className="underline hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                Terms And Condition
              </Link>
              <span className="text-gray-300 dark:text-gray-700">•</span>
              <Link to="/profile/privacy" className="underline hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                Privacy Policy
              </Link>
              <span className="text-gray-300 dark:text-gray-700">•</span>
              <Link to="/profile/refund" className="underline hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                Content Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  )
}

