import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Phone, User, AlertCircle, Loader2, UtensilsCrossed } from "lucide-react"
import { restaurantAPI } from "@food/api"
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
import loginBg from "@food/assets/loginbanner.png"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { getAppLogo, getRestaurantLoginBanner, subscribeBusinessSettings } from "@common/utils/businessSettings"
import RestaurantAuthFooter from "@food/components/restaurant/RestaurantAuthFooter"


const countryCodes = [
  { code: "+91", country: "IN", flag: "🇮🇳" },
]

export default function RestaurantSignup() {
  const navigate = useNavigate()
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo('restaurant'))
  const [bannerUrl, setBannerUrl] = useState(() => {
    const banner = getRestaurantLoginBanner()
    return (banner && banner.url && banner.active) ? banner.url : loginBg
  })

  useEffect(() => {
    const apply = () => {
      const logo = getAppLogo('restaurant')
      if (logo) setLogoUrl(logo)
      const banner = getRestaurantLoginBanner()
      if (banner && banner.url && banner.active) {
        setBannerUrl(banner.url)
      } else {
        setBannerUrl(loginBg)
      }
    }
    apply()
    return subscribeBusinessSettings(apply)
  }, [])
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

  const validatePhone = (phone) => {
    if (!phone.trim()) {
      return "Phone number is required"
    }
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, "")
    const phoneRegex = /^\d{7,15}$/
    if (!phoneRegex.test(cleanPhone)) {
      return "Phone number must be 7-15 digits"
    }
    return ""
  }

  const validateName = (name) => {
    if (!name.trim()) {
      return "Restaurant name is required"
    }
    if (name.trim().length < 2) {
      return "Restaurant name must be at least 2 characters"
    }
    if (name.trim().length > 50) {
      return "Restaurant name must be less than 50 characters"
    }
    return ""
  }

  const handleChange = (e) => {
    const { name, value } = e.target
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

    // Build full phone number
    const fullPhone = `${formData.countryCode} ${formData.phone}`.trim()

    try {
      // Send OTP with purpose 'register'
      await restaurantAPI.sendOTP(fullPhone, "register")

      // Store auth data in sessionStorage for OTP page
      const authData = {
        method: "phone",
        phone: fullPhone,
        name: formData.name,
        isSignUp: true,
        module: "restaurant",
      }
      sessionStorage.setItem("restaurantAuthData", JSON.stringify(authData))

      navigate("/food/restaurant/otp")
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
          src={bannerUrl}
          alt="Restaurant background"
          className="w-full h-full object-cover"
        />
        {/* Orange half-circle text block attached to the left with animation */}
        <div className="absolute inset-0 flex items-center text-white pointer-events-none">
          <div
            className="bg-[#FF0000]/80 rounded-r-full py-10 xl:py-20 pl-10 xl:pl-14 pr-10 xl:pr-20 max-w-[70%] shadow-xl backdrop-blur-[1px]"
            style={{ animation: "slideInLeft 0.8s ease-out both" }}
          >
            <h1 className="text-3xl xl:text-4xl font-extrabold mb-4 tracking-wide leading-tight">
              JOIN AS
              <br />
              RESTAURANT PARTNER
            </h1>
            <p className="text-base xl:text-lg opacity-95 max-w-xl">
              Register your restaurant and start serving customers.
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
              <div className="h-11 w-11 rounded-xl bg-[#FF0000] flex items-center justify-center text-white shadow-lg overflow-hidden shrink-0">
                <UtensilsCrossed className="h-6 w-6" />
              </div>
            )}
            <div className="flex flex-col items-start">
              <span className="text-2xl font-bold tracking-wide text-[#FF0000]">
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
              Register Your Restaurant
            </h2>
            <p className="text-sm text-gray-500">
              Enter your details to get started.
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="space-y-5 w-full max-w-lg rounded-xl bg-white/80 backdrop-blur-sm p-1 sm:p-2"
          >
            {/* Restaurant name input */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                Restaurant Name
              </Label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                  <User className="h-4 w-4" />
                </span>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Enter restaurant name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`h-11 pl-9 border-gray-300 rounded-md shadow-sm focus-visible:ring-[#FF0000] focus-visible:ring-2 transition-colors placeholder:text-gray-400 ${errors.name ? "border-red-500" : ""}`}
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
                <Select
                  value={formData.countryCode}
                  onValueChange={handleCountryCodeChange}
                >
                  <SelectTrigger className="w-20 sm:w-24 md:w-[100px] text-xs sm:text-sm">
                    <SelectValue placeholder="Code" />
                  </SelectTrigger>
                  <SelectContent>
                    {countryCodes.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        <span className="flex items-center gap-2 text-xs sm:text-sm">
                          <span>{country.flag}</span>
                          <span>{country.code}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex-1 min-w-0">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                      <Phone className="h-4 w-4" />
                    </span>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="Enter phone number"
                      value={formData.phone}
                      onChange={handleChange}
                      className={`h-11 pl-9 border-gray-300 rounded-md shadow-sm focus-visible:ring-[#FF0000] focus-visible:ring-2 transition-colors placeholder:text-gray-400 ${errors.phone ? "border-red-500" : ""}`}
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
              {apiError && !errors.phone && (
                <div className="flex items-center gap-1 text-xs sm:text-sm text-red-600 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  <span>{apiError}</span>
                </div>
              )}
            </div>

            {/* Sign up button */}
            <Button
              type="submit"
              className="mt-2 h-11 w-full bg-[#FF0000] hover:bg-[#FF0000]/90 text-white text-base font-semibold rounded-md shadow-md transition-colors"
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

          {/* Login link */}
          <div className="mt-6 text-center text-sm">
            <span className="text-gray-600">Already have an account? </span>
            <button
              type="button"
              onClick={() => navigate("/food/restaurant/login")}
              className="text-[#FF0000] hover:underline font-medium"
            >
              Login
            </button>
          </div>

          <RestaurantAuthFooter className="mt-8 w-full max-w-lg" />

          {/* Demo credentials / info bar */}
          <div className="mt-8 w-full max-w-lg rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-xs sm:text-sm text-gray-800 flex items-start gap-3">
            <div className="mt-0.5 text-[#FF0000]">
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

