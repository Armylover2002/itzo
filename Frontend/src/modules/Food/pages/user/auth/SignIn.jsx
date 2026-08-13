import { useState, useEffect, useRef } from "react"
import { useNavigate, Link, useSearchParams } from "react-router-dom"
import { AlertCircle, Loader2, Mail } from "lucide-react"
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
    <AnimatedPage className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex items-center justify-center p-4">
      {/* Subtle overlay (desktop only) */}
      <div className="fixed inset-0 z-0 hidden md:block opacity-30">
        <img src={loginBanner} alt="" className="w-full h-full object-cover blur-md" />
        <div className="absolute inset-0 bg-white/70 dark:bg-black/90" />
      </div>

      <div className="w-full max-w-[420px] bg-white dark:bg-neutral-900 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] relative z-10 overflow-hidden border border-gray-100 dark:border-neutral-800">
        {/* Banner (Mobile Only) */}
        <div className="md:hidden w-full h-[140px] relative">
          <img src={loginBanner} alt="Food Banner" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-neutral-900 to-transparent" />
        </div>

        <div className="p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">
              Login
            </h2>
          </div>

          <form id="user-signin-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <div className="relative flex items-center group">
                <div className="flex items-center justify-center gap-1.5 px-3 h-12 md:h-14 border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 rounded-xl rounded-r-none font-medium border-r-0 group-focus-within:border-[#FE5502]">
                  <img src="https://flagcdn.com/w20/in.png" alt="India" className="w-5 h-auto rounded-[2px]" />
                  <span>+91</span>

                </div>
                <div className="h-8 w-px bg-gray-300 dark:bg-neutral-700 absolute left-[85px] z-10 group-focus-within:bg-[#FE5502]/50 transition-colors" />
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  placeholder="Phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`flex-1 h-12 md:h-14 text-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white border-gray-300 dark:border-neutral-700 rounded-xl rounded-l-none pl-4 focus-visible:ring-0 focus-visible:border-[#FE5502] ${error ? "border-red-500" : ""} transition-all shadow-none`}
                  aria-invalid={error ? "true" : "false"}
                />
              </div>

              {error && (
                <div className="flex items-center gap-1.5 text-xs text-red-500 pl-1 mt-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              form="user-signin-form"
              className="w-full h-12 md:h-14 bg-[#FE5502] hover:bg-[#E04B00] text-white font-semibold text-base md:text-lg rounded-xl transition-all hover:shadow-lg active:scale-[0.98]"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Sending OTP...
                </>
              ) : (
                "Send One Time Password"
              )}
            </Button>
          </form>

          {/* Social login separator */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200 dark:border-neutral-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white dark:bg-neutral-900 px-4 text-gray-400 dark:text-gray-500 font-medium">
                or
              </span>
            </div>
          </div>

          {/* Social login buttons */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              className="flex items-center justify-center gap-3 w-full h-12 md:h-14 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <Mail className="w-5 h-5 text-[#FE5502]" />
              <span className="text-gray-700 dark:text-gray-200 font-medium text-[15px]">Continue with Email</span>
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-3 w-full h-12 md:h-14 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
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
              <span className="text-gray-700 dark:text-gray-200 font-medium text-[15px]">Continue with Google</span>
            </button>
          </div>

          <div className="text-center text-[11px] md:text-xs text-gray-400 dark:text-gray-500 pt-4 pb-2 border-t border-gray-100 dark:border-neutral-800 mt-6">
            <p className="mb-2">By continuing, you agree to our</p>
            <div className="flex justify-center gap-1.5 flex-wrap">
              <Link to="/profile/terms" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                Terms of Service
              </Link>
              <span>•</span>
              <Link to="/profile/privacy" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                Privacy Policy
              </Link>
              <span>•</span>
              <Link to="/profile/refund" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                Content Policy
              </Link>
              <span>•</span>
              <Link to="/profile/support-policy" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                Support
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  )
}

