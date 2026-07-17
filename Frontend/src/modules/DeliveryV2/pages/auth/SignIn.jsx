import { useState, useEffect } from "react"
import { useNavigate, Link, useLocation } from "react-router-dom"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@food/components/ui/select"
import api, { deliveryAPI } from "@food/api"
import { API_ENDPOINTS } from "@food/api/config"
import { clearModuleAuth } from "@food/utils/auth"
import { useCompanyName } from "@food/hooks/useCompanyName"
import {
  CheckCircle2,
  ShieldCheck,
  Award,
  Heart,
  TrendingUp
} from "lucide-react"
import {
  loadBusinessSettings,
  getCachedSettings,
  getAppFavicon,
  updateBrowserFavicon,
} from "@common/utils/businessSettings"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


// Common country codes
const countryCodes = [
  { code: "+91", country: "IN", flag: "🇮🇳" },
]

const defaultDeliveryGrowth = {
  headline: "Earn More. Keep 100% Of Your Delivery Earnings.",
  subheadline: "Zero Commission. Unlimited Opportunities.",
  benefits: [
    "₹30 Daily Access",
    "Unlimited Order Opportunities",
    "100% Delivery Fee Retention",
    "100% Customer Tips",
    "Zero Commission",
    "Weekly Settlement"
  ],
  partnerWelfare: [
    "Accident Insurance up to ₹5 Lakhs",
    "Emergency Medical Support",
    "Welfare Fund Support"
  ],
  operationalBenefits: [
    "Hyperlocal Deliveries",
    "Smart Order Allocation",
    "Flexible Working Hours"
  ],
  driverMarketingBanner: "AB COMMISSION KA KHEL KHATAM!",
  ctaText: "Sirf ₹30 Mein Apni Delivery Agency Shuru Karein."
}

export default function DeliverySignIn() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const referralCode = searchParams.get("ref") || ""
  const [formData, setFormData] = useState({
    phone: "",
    countryCode: "+91",
  })

  const [growthData, setGrowthData] = useState(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [keyboardInset, setKeyboardInset] = useState(0)

  useEffect(() => {
    const fetchGrowthData = async () => {
      try {
        const res = await api.get(`${API_ENDPOINTS.ADMIN.LOGIN_GROWTH_PUBLIC}?role=all`)
        if (res.data.success && res.data.data) {
          setGrowthData(res.data.data)
        }
      } catch (err) {
        console.error("Failed to load onboarding benefits:", err)
      }
    }
    fetchGrowthData()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 3)
    }, 4500)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return undefined

    const updateKeyboardInset = () => {
      const viewport = window.visualViewport
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      setKeyboardInset(inset > 0 ? inset : 0)
    }

    updateKeyboardInset()
    window.visualViewport.addEventListener("resize", updateKeyboardInset)
    window.visualViewport.addEventListener("scroll", updateKeyboardInset)

    return () => {
      window.visualViewport.removeEventListener("resize", updateKeyboardInset)
      window.visualViewport.removeEventListener("scroll", updateKeyboardInset)
    }
  }, [])

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
            phone: phoneDigits
          }))
        }
      } catch (err) {
        debugError("Error parsing stored auth data:", err)
      }
    }
  }, [])

  useEffect(() => {
    const applyDeliveryBranding = () => {
      const deliveryFavicon = getAppFavicon("delivery")
      if (deliveryFavicon) {
        updateBrowserFavicon(deliveryFavicon)
      }
    }

    const cached = getCachedSettings()
    if (cached) {
      applyDeliveryBranding()
    } else {
      loadBusinessSettings().then(() => {
        applyDeliveryBranding()
      })
    }

    const handleSettingsUpdate = (event) => {
      const settings = event?.detail
      if (!settings) return
      const favicon = settings.deliveryFavicon?.url || settings.favicon?.url || ""
      if (favicon) {
        updateBrowserFavicon(favicon)
      }
    }

    window.addEventListener("businessSettingsUpdated", handleSettingsUpdate)
    return () => {
      window.removeEventListener("businessSettingsUpdated", handleSettingsUpdate)
    }
  }, [])
  const [error, setError] = useState("")
  const [isSending, setIsSending] = useState(false)

  // Get selected country details dynamically
  const selectedCountry = countryCodes.find(c => c.code === formData.countryCode) || countryCodes[2] // Default to India (+91)

  const validatePhone = (phone, countryCode) => {
    if (!phone || phone.trim() === "") {
      return "Phone number is required"
    }

    const digitsOnly = phone.replace(/\D/g, "")

    if (digitsOnly.length < 7) {
      return "Phone number must be at least 7 digits"
    }

    // India-specific validation
    // India-specific validation (Fixed to +91 only)
    if (digitsOnly.length !== 10) {
      return "Phone number must be exactly 10 digits"
    }

    return ""
  }

  const handleSendOTP = async () => {
    setError("")

    const phoneError = validatePhone(formData.phone, formData.countryCode)
    if (phoneError) {
      setError(phoneError)
      return
    }

    const fullPhone = `${formData.countryCode} ${formData.phone}`.trim()

    try {
      setIsSending(true)
      // Start a fresh login flow and prevent stale-token auto redirects.
      clearModuleAuth("delivery")

      // Call backend to send OTP for delivery login
      await deliveryAPI.sendOTP(fullPhone, "login")

      // Store auth data in sessionStorage for OTP page
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
        } catch (e) {}
      }

      // Navigate to OTP page
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
    // Only allow digits and limit to 10 digits
    const value = e.target.value.replace(/\D/g, "").slice(0, 10)
    setFormData({
      ...formData,
      phone: value,
    })
  }

  const handleCountryCodeChange = (value) => {
    setFormData({
      ...formData,
      countryCode: value,
    })
  }

  const isValid = !validatePhone(formData.phone, formData.countryCode)

  const dData = growthData?.delivery || defaultDeliveryGrowth;

  return (
    <div className="min-h-[100dvh] bg-[#111] lg:bg-slate-900 flex flex-col lg:flex-row overflow-hidden font-sans">
      
      {/* Left Section: Delivery Partner Showcase (Desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 px-12 xl:px-20 py-16 text-white overflow-y-auto min-h-screen shrink-0 relative" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="max-w-[540px] mx-auto space-y-8 animate-in fade-in slide-in-from-left-6 duration-500">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-widest">
              Sarathi Partner Advantage
            </span>
            <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white mb-3 mt-4 leading-tight">
              {dData.headline}
            </h2>
            <p className="text-slate-300 text-sm xl:text-base font-medium">
              {dData.subheadline}
            </p>
          </div>

          {/* Banner alert */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-black px-6 py-4 rounded-3xl shadow-xl flex items-center justify-between">
            <span className="text-sm uppercase tracking-wider">{dData.driverMarketingBanner || "AB COMMISSION KA KHEL KHATAM!"}</span>
            <TrendingUp className="h-5 w-5 shrink-0 ml-2" />
          </div>

          {/* Core Welfare & Operations cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-3xl p-5 border border-white/10 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Award className="h-4 w-4" />
                Partner Welfare
              </div>
              <ul className="space-y-2">
                {dData.partnerWelfare?.slice(0, 3).map((w, idx) => (
                  <li key={idx} className="text-xs text-slate-300 font-medium flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold mr-1">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white/5 rounded-3xl p-5 border border-white/10 space-y-3">
              <div className="flex items-center gap-2 text-orange-400 font-bold text-xs uppercase tracking-wider">
                <ShieldCheck className="h-4 w-4" />
                Operations Support
              </div>
              <ul className="space-y-2">
                {dData.operationalBenefits?.slice(0, 3).map((op, idx) => (
                  <li key={idx} className="text-xs text-slate-300 font-medium flex items-start gap-1.5">
                    <span className="text-orange-400 font-bold mr-1">•</span>
                    <span>{op}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Benefits list */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Platform Benefits</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {dData.benefits?.map((benefit, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-200 font-medium">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA agency callout */}
          <div className="bg-orange-950/40 border border-primary/10 rounded-3xl p-5 flex items-center justify-between">
            <span className="text-xs font-bold text-orange-200 uppercase tracking-wide leading-relaxed">
              {dData.ctaText || "Sirf ₹30 Mein Apni Delivery Agency Shuru Karein."}
            </span>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="w-full lg:w-1/2 flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-8 sm:py-16 bg-white rounded-t-[40px] lg:rounded-none lg:rounded-l-[40px] shadow-[0_-20px_40px_rgba(0,0,0,0.3)] lg:shadow-[-20px_0_40px_rgba(0,0,0,0.1)] relative z-20 overflow-y-auto scroll-smooth scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent" style={{ WebkitOverflowScrolling: "touch" }}>
        
        {/* Hero Image Section (Mobile only) */}
        <div className="absolute top-0 left-0 right-0 h-[35vh] lg:hidden z-0 bg-[#111] flex items-center justify-center overflow-hidden">
          <img 
            src="/delivery-promo.png" 
            alt="ITZO Uniform" 
            className="w-full max-w-[600px] h-full object-contain drop-shadow-2xl px-4"
          />
        </div>

        {/* Card Container */}
        <div className="w-full max-w-[400px] flex flex-col items-center flex-1 justify-between mt-[30vh] lg:mt-0 relative z-10 animate-in fade-in slide-in-from-bottom-6 duration-500">
          
          <div className="w-full flex flex-col items-center">
            {/* Top Section - Logo and Badge */}
            <div className="flex flex-col items-center pb-6 lg:pb-8">
              <div className="w-20 h-20 sm:w-28 sm:h-28 bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-slate-50 mb-3 -mt-16 lg:-mt-0 lg:mb-6 overflow-hidden p-1.5">
                <img 
                  src="/itzo-delivery-logo.png" 
                  alt="Itzo Logo" 
                  className="w-full h-full object-contain scale-110"
                />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl text-black font-extrabold italic lowercase tracking-tight">
                  {companyName.toLowerCase()}
                </h1>
              </div>

              {/* DELIVERY Badge */}
              <div className="bg-orange-500 px-5 py-1.5 rounded-xl mt-2 shadow-md">
                <span className="text-white font-bold text-xs sm:text-sm uppercase tracking-widest">
                  DELIVERY PARTNER
                </span>
              </div>
            </div>

            <div className="w-full space-y-5">
              {/* Sign In Heading */}
              <div className="space-y-1 text-center pb-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Welcome Aboard
                </h2>
                <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-widest">
                  Login to continue
                </p>
              </div>

              {/* Mobile Number Input */}
              <div className="space-y-3 w-full">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Registered Mobile Number</label>
                
                <div className="flex items-center gap-2 h-16 bg-slate-50 border border-slate-100 rounded-[32px] px-6 focus-within:border-[#FE5502]/30 focus-within:ring-4 focus-within:ring-[#FE5502]/5 transition-all overflow-hidden">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-bold text-slate-900 text-lg">🇮🇳 +91</span>
                  </div>
                  
                  <div className="w-[1px] h-6 bg-slate-200 ml-2" />

                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="Mobile number"
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    autoComplete="off"
                    autoFocus={false}
                    className="min-w-0 flex-1 h-12 bg-transparent border-0 outline-none ring-0 shadow-none focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none text-left text-lg font-bold leading-none tracking-[0.02em] text-slate-900 placeholder-slate-300 caret-[#FE5502] px-2"
                  />
                </div>

                {error && (
                  <p className="text-[#FE5502] text-xs font-bold italic ml-4 animate-bounce">
                    {error}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Section - Continue Button, Mobile Carousel, and Terms */}
          <div className="w-full mt-auto pt-6 pb-2">
            <div className="w-full space-y-5">
              {/* Continue Button */}
              <button
                onClick={handleSendOTP}
                disabled={!isValid || isSending}
                className={`w-full h-14 sm:h-16 rounded-[32px] font-black text-base sm:text-lg tracking-widest uppercase transition-all duration-300 ${
                  isValid && !isSending
                    ? "bg-[#FE5502] hover:bg-[#E64D02] text-white shadow-lg shadow-[#FE5502]/20 transform active:scale-[0.98]"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                {isSending ? "Sending OTP..." : "Continue"}
              </button>

              {/* Mobile Carousel overlay, hidden when keyboard is open */}
              {!keyboardInset && (
                <div className="lg:hidden w-full py-1">
                  <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Sarathi Welfare</span>
                      <div className="flex gap-1">
                        {[0, 1, 2].map((idx) => (
                          <div
                            key={idx}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              currentSlide === idx ? "w-4 bg-orange-500" : "w-1.5 bg-slate-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="relative overflow-hidden min-h-[86px] flex items-center">
                      {currentSlide === 0 && (
                        <div className="w-full space-y-1 animate-in fade-in slide-in-from-right-4 duration-300">
                          <h4 className="text-sm font-bold text-slate-800">{dData.headline}</h4>
                          <p className="text-xs text-slate-500">{dData.subheadline}</p>
                        </div>
                      )}

                      {currentSlide === 1 && (
                        <div className="w-full space-y-1.5 animate-in fade-in slide-in-from-right-4 duration-300">
                          <span className="text-[10px] text-slate-400 font-bold block">PARTNER WELFARE HIGHLIGHTS</span>
                          <div className="flex flex-wrap gap-1.5">
                            {dData.partnerWelfare?.slice(0, 2).map((w, i) => (
                              <span key={i} className="text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-700 px-2 py-0.5 rounded-lg">
                                {w}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {currentSlide === 2 && (
                        <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300">
                          <span className="text-[10px] text-slate-400 font-bold block mb-1">PARTNER ADVANTAGES</span>
                          <div className="flex flex-wrap gap-1">
                            {dData.benefits?.slice(0, 3).map((b, i) => (
                              <span key={i} className="text-[9px] font-bold bg-orange-50 border border-orange-100 text-orange-700 px-2 py-0.5 rounded-md">
                                {b}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Benefit Images (Uploaded dynamically by Admin) */}
              {!keyboardInset && (dData?.benefitImage1 || dData?.benefitImage2) && (
                <>
                  <style>{`
                    .custom-scrollbar {
                      -webkit-overflow-scrolling: touch;
                    }
                    .custom-scrollbar::-webkit-scrollbar {
                      width: 5px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                      background: transparent;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                      background: rgba(254, 85, 2, 0.3);
                      border-radius: 10px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                      background: rgba(254, 85, 2, 0.6);
                    }
                  `}</style>
                  <div className="w-full pt-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-3 scroll-smooth" style={{ WebkitOverflowScrolling: "touch" }}>
                    {dData.benefitImage1 && (
                      <div className="w-full rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50 flex items-center justify-center">
                        <img src={dData.benefitImage1} alt="Benefit 1" className="w-full max-h-[220px] object-contain block" />
                      </div>
                    )}
                    {dData.benefitImage2 && (
                      <div className="w-full rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50 flex items-center justify-center">
                        <img src={dData.benefitImage2} alt="Benefit 2" className="w-full max-h-[220px] object-contain block" />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Terms and Conditions */}
              <div className="text-center">
                <p className="text-slate-400 text-xs font-medium">
                  By logging in, you agree to our <br />
                  <Link to="/food/delivery/terms" className="text-[#FE5502] font-bold hover:underline">
                    Terms & Conditions
                  </Link>
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}


