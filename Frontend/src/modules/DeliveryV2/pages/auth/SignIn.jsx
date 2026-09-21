import { useState, useEffect } from "react"
import { useNavigate, Link, useLocation } from "react-router-dom"
import { deliveryAPI } from "@food/api"
import { clearModuleAuth } from "@food/utils/auth"
import { useCompanyName } from "@food/hooks/useCompanyName"
import {
  getCachedSettings,
  subscribeBusinessSettings,
  getAppFavicon,
  updateFavicon,
  getAppLogo,
} from "@common/utils/businessSettings"
import { ArrowLeft, User, Smartphone, ShieldCheck, ArrowRight, Headphones } from "lucide-react"
import AuthCircleLogo from "@shared/components/AuthCircleLogo"
import LoginGrowthPanel from "@shared/components/LoginGrowthPanel"

const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }

export default function DeliverySignIn() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const referralCode = searchParams.get("ref") || ""
  
  // Image Carousel state
  const bannerImages = [
    '/delivery-banner-new-1.png',
    '/delivery-banner-new-2.png',
  ]
  const [currentImage, setCurrentImage] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % bannerImages.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [bannerImages.length])

  const [formData, setFormData] = useState(() => {
    let initialPhone = "";
    if (typeof window !== "undefined") {
      initialPhone = sessionStorage.getItem("deliveryLoginPhone") || "";
    }
    return {
      phone: initialPhone,
      countryCode: "+91",
    };
  })
  
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo('delivery'))

  useEffect(() => {
    const stored = sessionStorage.getItem("deliveryAuthData")
    if (stored) {
      try {
        const data = JSON.parse(stored)
        if (data.phone) {
          const phoneDigits = data.phone.replace("+91", "").trim()
          setFormData(prev => ({
            ...prev,
            phone: phoneDigits
          }))
        }
      } catch (err) {
        debugError("Error parsing stored auth data:", err)
      }
    }
  }, [])

  useEffect(() => {
    const applyDeliveryBranding = (settings) => {
      const deliveryFavicon =
        getAppFavicon("delivery") ||
        settings?.deliveryFavicon?.url ||
        settings?.favicon?.url
      if (deliveryFavicon) {
        updateFavicon(deliveryFavicon)
      }
      const deliveryLogo = getAppLogo("delivery")
      if (deliveryLogo) {
        setLogoUrl(deliveryLogo)
      }
    }

    if (getCachedSettings()) {
      applyDeliveryBranding()
    }

    return subscribeBusinessSettings((settings) => applyDeliveryBranding(settings))
  }, [])
  
  const [error, setError] = useState("")
  const [isSending, setIsSending] = useState(false)

  const validatePhone = (phone) => {
    if (!phone || phone.trim() === "") {
      return "Phone number is required"
    }

    const digitsOnly = phone.replace(/\D/g, "")

    if (digitsOnly.length !== 10) {
      return "Phone number must be exactly 10 digits"
    }

    return ""
  }

  const handleSendOTP = async () => {
    setError("")

    const phoneError = validatePhone(formData.phone)
    if (phoneError) {
      setError(phoneError)
      return
    }

    const fullPhone = `${formData.countryCode} ${formData.phone}`.trim()

    try {
      setIsSending(true)
      clearModuleAuth("delivery")

      await deliveryAPI.sendOTP(fullPhone, "login")

      const authData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        purpose: "login",
        module: "delivery",
      }
      sessionStorage.setItem("deliveryAuthData", JSON.stringify(authData))

      if (referralCode) {
        try {
          const existingSignupDetails = JSON.parse(sessionStorage.getItem("deliverySignupDetails") || "{}")
          sessionStorage.setItem("deliverySignupDetails", JSON.stringify({
            ...existingSignupDetails,
            ref: referralCode
          }))
        } catch (e) { }
      }

      navigate("/food/delivery/otp")
    } catch (err) {
      debugError("Send OTP Error:", err)
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to send OTP. Please try again."
      setError(message)
    } finally {
      setIsSending(false)
    }
  }

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10)
    setFormData({
      ...formData,
      phone: value,
    })
    if (typeof window !== "undefined") {
      sessionStorage.setItem("deliveryLoginPhone", value)
    }
  }

  const isValid = !validatePhone(formData.phone)

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row font-sans relative overflow-hidden">
      <style>{`
        @keyframes scale-pulse {
          0% { transform: scale(1); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          50% { transform: scale(1.08); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2); }
          100% { transform: scale(1); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        }
        .animate-logo-scale {
          animation: scale-pulse 3s infinite ease-in-out;
        }
        @keyframes zoom-fade {
          0% { transform: scale(1); }
          100% { transform: scale(1.1); }
        }
        .bg-zoom-anim {
          animation: zoom-fade 8s infinite alternate linear;
        }
      `}</style>

      {/* Top Banner section */}
      <div className="relative w-full lg:w-1/2 h-[280px] md:h-[320px] lg:h-screen flex flex-col items-center pt-8 lg:justify-center overflow-hidden rounded-b-[40px] lg:rounded-b-none lg:rounded-r-[40px] lg:shadow-2xl z-10">
        {/* Background Images Carousel */}
        {bannerImages.map((img, index) => (
          <div
            key={index}
            className={`absolute inset-0 w-full h-full bg-cover bg-[center_30%] bg-no-repeat transition-opacity duration-1000 ease-in-out bg-zoom-anim ${
              index === currentImage ? 'opacity-100 z-0' : 'opacity-0 -z-10'
            }`}
            style={{ backgroundImage: `url('${img}')` }}
          />
        ))}

        {/* Overlay gradient for text readability if needed */}
        <div className="absolute inset-0 bg-black/40 z-0"></div>

        {/* Curved Bottom Overlay (SVG) */}
        <div className="absolute bottom-0 w-full leading-none z-10 translate-y-[1px] lg:hidden">
          <svg viewBox="0 0 1440 200" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-16 md:h-24">
            <path d="M0,200 L1440,200 L1440,0 C1100,150 340,150 0,0 Z" fill="white" />
          </svg>
        </div>

        {/* Back Button */}

        {/* Content */}
        <div className="relative z-20 flex flex-col items-center mt-2">
          <div className="mb-2">
            <AuthCircleLogo
              src={logoUrl}
              alt={companyName}
              fallbackText={companyName}
              accentClassName="bg-[#d80000]"
              className="h-24 w-24 animate-logo-scale ring-4 ring-[#d80000]/90"
            />
          </div>

          {/* Company Name */}
          <h1 className="text-4xl font-black tracking-tight text-white mb-3 drop-shadow-md">
            {companyName}
          </h1>

          {/* DELIVERY PARTNER Badge */}
          <div className="bg-[#d80000] px-5 py-1.5 rounded-full shadow-sm mb-3">
            <span className="text-white font-bold text-[12px] uppercase tracking-wider">
              Delivery Partner
            </span>
          </div>

          {/* Tagline */}
          <div className="flex items-center gap-3">
            <div className="h-[2px] w-6 bg-[#d80000]"></div>
            <p className="text-white text-[15px] font-medium drop-shadow-sm">Deliver happiness, every time</p>
            <div className="h-[2px] w-6 bg-[#d80000]"></div>
          </div>
        </div>
      </div>

      {/* Main Content - Form Card */}
      <div className="flex-1 lg:flex-1 lg:w-1/2 px-4 relative z-20 pb-8 flex lg:flex-col justify-center lg:items-center -mt-8 md:-mt-12 lg:mt-0">
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] lg:shadow-none lg:border-none p-6 md:p-8 w-full max-w-[420px] border border-gray-50 h-fit">
          
          {/* Header Row: Icon + Texts */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-full bg-[#fff0f0] flex items-center justify-center shrink-0">
              <User className="w-6 h-6 text-[#d80000]" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-[22px] font-bold text-[#1a1a1a] leading-tight">
                <span className="text-[#d80000]">Login</span> to your account
              </h2>
              <p className="text-[14px] text-gray-500 mt-0.5">
                Enter your mobile number to continue
              </p>
            </div>
          </div>

          {/* Mobile Number Input Group */}
          <label htmlFor="delivery-login-phone" className="block text-[13px] font-semibold text-gray-700 mb-2">
            Mobile Number
          </label>
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden h-14 mb-4 focus-within:border-[#d80000] focus-within:ring-1 focus-within:ring-[#d80000] transition-all bg-white shadow-sm">
            {/* Country Code Block */}
            <div className="flex items-center gap-1.5 px-3 border-r border-gray-200 bg-white h-full shrink-0">
              <span className="text-lg leading-none">🇮🇳</span>
              <span className="text-[14px] font-bold text-gray-800">+91</span>
            </div>
            
            {/* Input Block */}
            <div className="flex flex-1 items-center px-2.5 h-full bg-white min-w-0">
              <Smartphone className="w-4 h-4 text-[#d80000] mr-1.5 shrink-0 sm:mr-2" strokeWidth={1.5} />
              <input
                id="delivery-login-phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                placeholder="Enter 10-digit mobile number"
                value={formData.phone}
                onChange={handlePhoneChange}
                className="w-full min-w-0 h-full text-[15px] font-medium text-gray-900 placeholder:text-gray-400 placeholder:font-normal placeholder:text-[13px] sm:placeholder:text-[14px] outline-none bg-transparent"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500 mb-2 pl-1">{error}</p>}

          {/* Verification Note Box */}
          <div className="bg-[#fdf4f4] rounded-xl p-3.5 flex items-center gap-3 mb-6">
            <ShieldCheck className="w-5 h-5 text-[#d80000] shrink-0" strokeWidth={2} />
            <p className="text-[13px] text-gray-700 font-medium">
              We will send you a verification code on this number
            </p>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSendOTP}
            disabled={!isValid || isSending}
            className={`w-full h-14 rounded-xl flex items-center justify-center relative font-bold text-[16px] transition-all
              ${isValid && !isSending
                ? "bg-[#d80000] hover:bg-red-700 active:scale-[0.98] text-white shadow-lg shadow-red-200/50"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
          >
            {isSending ? "Sending Code..." : "Get Verification Code"}
            {isValid && !isSending && (
              <div className="absolute right-2 w-10 h-10 bg-white rounded-full flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-[#d80000]" strokeWidth={2.5} />
              </div>
            )}
          </button>

          {/* OR Divider */}
          <div className="flex items-center justify-center gap-4 my-6">
            <div className="h-[1px] w-12 bg-gray-200"></div>
            <span className="text-[13px] text-gray-400 font-medium">or</span>
            <div className="h-[1px] w-12 bg-gray-200"></div>
          </div>

          {/* Terms text */}
          <p className="text-[13px] text-center text-gray-500 px-2 leading-relaxed font-medium">
            By continuing, you agree to our<br/>
            <Link to="/food/delivery/terms" className="text-[#d80000] hover:underline">Terms & Conditions</Link>
            {" , "}
            <Link to="/food/delivery/privacy" className="text-[#d80000] hover:underline">Privacy Policy</Link>
            {" & "}
            <Link to="/food/delivery/support" className="text-[#d80000] hover:underline">Support</Link>
          </p>

          <LoginGrowthPanel role="delivery" className="mt-6" />
        </div>
      </div>
    </div>
  )
}
