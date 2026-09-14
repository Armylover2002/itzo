import { useState, useEffect } from "react"
import { useNavigate, Link, useSearchParams } from "react-router-dom"
import { Phone, User, AlertCircle, Loader2, Truck } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@food/components/ui/select"
import { deliveryAPI } from "@food/api"
import { clearModuleAuth } from "@food/utils/auth"
import loginBg from "@food/assets/deliveryloginbanner.png"
import { useCompanyName } from "@food/hooks/useCompanyName"
const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }


const countryCodes = [
  { code: "+91", country: "IN", flag: "🇮🇳" },
]

export default function DeliverySignup() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [formData, setFormData] = useState({
    phone: "",
    countryCode: "+91",
    name: "",
  })
  const [errors, setErrors] = useState({
    phone: "",
    name: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState("")

  // Redirect to home if already authenticated
  useEffect(() => {
    const isAuthenticated = localStorage.getItem("delivery_authenticated") === "true"
    if (isAuthenticated) {
      navigate("/food/delivery", { replace: true })
    }
  }, [navigate])

  // Pre-fill form from sessionStorage if data exists (e.g., when coming back from OTP)
  useEffect(() => {
    const stored = sessionStorage.getItem("deliveryAuthData")
    if (stored) {
      try {
        const data = JSON.parse(stored)
        if (data.phone) {
          // Extract digits after +91
          const phoneDigits = data.phone.replace("+91", "").trim()
          setFormData(prev => ({
            ...prev,
            phone: phoneDigits,
            name: data.name || prev.name
          }))
        }
      } catch (err) {
        debugError("Error parsing stored auth data:", err)
      }
    }
  }, [])

  const validatePhone = (phone) => {
    if (!phone.trim()) {
      return "Phone number is required"
    }
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, "")
    const phoneRegex = /^\d{10}$/
    if (!phoneRegex.test(cleanPhone)) {
      return "Phone number must be exactly 10 digits"
    }
    return ""
  }

  const validateName = (name) => {
    if (!name.trim()) {
      return "Name is required"
    }
    if (name.trim().length < 2) {
      return "Name must be at least 2 characters"
    }
    if (name.trim().length > 50) {
      return "Name must be less than 50 characters"
    }
    const nameRegex = /^[a-zA-Z\s'-]+$/
    if (!nameRegex.test(name.trim())) {
      return "Name can only contain letters, spaces, hyphens, and apostrophes"
    }
    return ""
  }

  const handleChange = (e) => {
    let { name, value } = e.target

    // Only allow numbers for phone field and limit to 10 digits
    if (name === "phone") {
      value = value.replace(/\D/g, "").slice(0, 10)
    }

    setFormData({
      ...formData,
      [name]: value,
    })

    // Real-time validation
    if (name === "phone") {
      setErrors({ ...errors, phone: validatePhone(value) })
    } else if (name === "name") {
      setErrors({ ...errors, name: validateName(value) })
    }
  }

  const handleCountryCodeChange = (value) => {
    setFormData({
      ...formData,
      countryCode: value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setApiError("")

    // Validate
    let hasErrors = false
    const newErrors = { phone: "", name: "" }

    const phoneError = validatePhone(formData.phone)
    newErrors.phone = phoneError
    if (phoneError) hasErrors = true

    const nameError = validateName(formData.name)
    newErrors.name = nameError
    if (nameError) hasErrors = true

    setErrors(newErrors)

    if (hasErrors) {
      setIsLoading(false)
      return
    }

    try {
      // Backend: delivery partner must register first (details + documents), then login with OTP.
      // Save name + phone for Step1 (details) and go to registration form.
      const signupDetails = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        countryCode: formData.countryCode || "+91",
        ref: String(searchParams.get("ref") || "").trim() || undefined,
      }
      sessionStorage.setItem("deliverySignupDetails", JSON.stringify(signupDetails))
      sessionStorage.removeItem("deliveryPaymentSuccessData")
      clearModuleAuth("delivery")

      navigate("/food/delivery/signup/details")
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Failed to send OTP. Please try again."
      setApiError(message)
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
          alt="Delivery background"
          className="w-full h-full object-cover"
        />
        {/* Orange half-circle text block attached to the left with animation */}
        <div className="absolute inset-0 flex items-center text-white pointer-events-none">
          <div
            className="bg-red-600/80 rounded-r-full py-10 xl:py-20 pl-10 xl:pl-14 pr-10 xl:pr-20 max-w-[70%] shadow-xl backdrop-blur-[1px]"
            style={{ animation: "slideInLeft 0.8s ease-out both" }}
          >
            <h1 className="text-3xl xl:text-4xl font-extrabold mb-4 tracking-wide leading-tight">
              JOIN AS
              <br />
              DELIVERY PARTNER
            </h1>
            <p className="text-base xl:text-lg opacity-95 max-w-xl">
              Start your journey as a delivery partner and earn flexible income.
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
            <div className="h-11 w-11 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-lg">
              <Truck className="h-6 w-6" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-2xl font-bold tracking-wide text-red-600">
                {companyName}
              </span>
              <span className="text-xs font-medium text-gray-500">
                Delivery Partner
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
              Create Your Account
            </h2>
            <p className="text-sm text-gray-500">
              Enter your details to get started.
            </p>
          </div>
          {apiError && (
            <div className="mb-4 flex items-center gap-1 text-xs sm:text-sm text-red-600">
              <AlertCircle className="h-3 w-3" />
              <span>{apiError}</span>
            </div>
          )}

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="space-y-5 w-full max-w-lg rounded-xl bg-white/80 backdrop-blur-sm p-1 sm:p-2"
          >
            {/* Name input */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                Full Name
              </Label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                  <User className="h-4 w-4" />
                </span>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`h-11 pl-9 border-gray-300 rounded-md shadow-sm focus-visible:ring-red-600 focus-visible:ring-2 transition-colors placeholder:text-gray-400 ${errors.name ? "border-red-500" : ""}`}
                  required
                />
              </div>
              {errors.name && (
                <div className="flex items-center gap-1 text-xs sm:text-sm text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  <span>{errors.name}</span>
                </div>
              )}
            </div>

            {/* Phone input */}
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                Phone Number
              </Label>
              <div className="flex gap-2">
                <div className="flex items-center px-4 h-11 border border-gray-300 bg-gray-50 text-gray-700 rounded-md shrink-0">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                      <Phone className="h-4 w-4" />
                    </span>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="Enter 10-digit number"
                      value={formData.phone}
                      onChange={handleChange}
                      className={`h-11 pl-9 border-gray-300 rounded-md shadow-sm focus-visible:ring-red-600 focus-visible:ring-2 transition-colors placeholder:text-gray-400 ${errors.phone ? "border-red-500" : ""}`}
                      required
                    />
                  </div>
                </div>
              </div>
              {errors.phone && (
                <div className="flex items-center gap-1 text-xs sm:text-sm text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  <span>{errors.phone}</span>
                </div>
              )}
            </div>

            {/* Sign up button */}
            <Button
              type="submit"
              className="mt-2 h-11 w-full bg-red-600 hover:bg-red-600/90 text-white text-base font-semibold rounded-md shadow-md transition-colors"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending OTP...
                </>
              ) : (
                "Send OTP"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm space-y-2">
            <p>
              <span className="text-gray-600">Already have an account? </span>
              <Link
                to="/food/delivery/login"
                className="text-red-600 hover:underline font-medium"
              >
                Login
              </Link>
            </p>
            <p className="text-xs text-gray-500">
              By continuing, you agree to our{" "}
              <Link to="/food/delivery/terms" className="text-red-600 hover:underline">
                Terms and Conditions
              </Link>
            </p>
          </div>

          {/* Demo credentials / info bar */}
          <div className="mt-8 w-full max-w-lg rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-xs sm:text-sm text-gray-800 flex items-start gap-3">
            <div className="mt-0.5 text-red-600">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold mb-1">Demo Credentials</div>
              <div>
                <span className="font-semibold">Phone :</span> +91 9876543210
              </div>
              <div>
                <span className="font-semibold">OTP :</span> 1234
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


