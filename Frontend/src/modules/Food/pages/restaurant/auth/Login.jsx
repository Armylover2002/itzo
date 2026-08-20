import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ShieldCheck, CheckCircle2 } from "lucide-react"
import { Button } from "@food/components/ui/button"
import api, { restaurantAPI } from "@food/api"
import { API_ENDPOINTS } from "@food/api/config"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { isModuleAuthenticated } from "@food/utils/auth"

const DEFAULT_COUNTRY_CODE = "+91"
const countryCodes = [
  { code: DEFAULT_COUNTRY_CODE, country: "IN", flag: "India" },
]

const defaultRestaurantGrowth = {
  headline: "Grow Your Restaurant Without Paying Commission",
  subheadline: "Keep More Profit. Get More Orders. Pay Only ₹30/Day.",
  benefits: [
    "₹30 Daily Subscription",
    "Unlimited Orders",
    "0% Commission",
    "Higher Profit Per Order",
    "Direct Customer Relationship",
    "Loyalty Program Opportunities",
    "Own Delivery Staff Supported",
    "Platform Delivery Support Available"
  ],
  savingsExample: {
    orderValue: 500,
    traditionalCommission: "₹120–₹150 Commission",
    itzoCommission: "₹0 Commission",
    keepsRevenueText: "Restaurant Keeps Full Revenue"
  },
  additionalMessaging: {
    monthlyProfit: "₹59,100",
    yearlyProfit: "₹7,19,050"
  },
  consultingServices: [
    "FSSAI Registration",
    "GST Registration",
    "Trade License",
    "Trademark Registration"
  ]
}

export default function RestaurantLogin() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const phoneInputRef = useRef(null)
  const [formData, setFormData] = useState(() => {
    const saved = sessionStorage.getItem("restaurantLoginPhone")
    return {
      phone: saved || "",
      countryCode: DEFAULT_COUNTRY_CODE,
    }
  })
  const [error, setError] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)

  const [growthData, setGrowthData] = useState(null)
  const [currentSlide, setCurrentSlide] = useState(0)

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

  // Route Protection: if already authenticated, redirect to restaurant dashboard
  useEffect(() => {
    if (isModuleAuthenticated("restaurant")) {
      navigate("/food/restaurant", { replace: true })
    }
  }, [navigate])

  // iOS keyboard fix: removed visualViewport tracking and scrollIntoView
  // to prevent the "floating screen" bounce on iOS WebView/Safari.
  // iOS natively handles scrolling focused inputs into view.

  const validatePhone = (phone, countryCode) => {
    if (!phone || phone.trim() === "") return "Phone number is required"

    const digitsOnly = phone.replace(/\D/g, "")
    if (digitsOnly.length < 7) return "Phone number must be at least 7 digits"
    if (digitsOnly.length > 15) return "Phone number is too long"

    if (digitsOnly.length !== 10) return "Indian phone number must be 10 digits"
    if (!["6", "7", "8", "9"].includes(digitsOnly[0])) {
      return "Invalid Indian mobile number"
    }

    return ""
  }

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10)
    setFormData((prev) => ({ ...prev, phone: value }))
    sessionStorage.setItem("restaurantLoginPhone", value)

    if (error) {
      setError(validatePhone(value, formData.countryCode))
    }
  }

  const handleSendOTP = async () => {
    const phoneError = validatePhone(formData.phone, formData.countryCode)
    setError(phoneError)
    if (phoneError) return

    const fullPhone = `${formData.countryCode || DEFAULT_COUNTRY_CODE} ${formData.phone}`.trim()

    try {
      setIsSending(true)
      await restaurantAPI.sendOTP(fullPhone, "login")

      const authData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        module: "restaurant",
      }
      sessionStorage.setItem("restaurantAuthData", JSON.stringify(authData))
      navigate("/food/restaurant/otp")
    } catch (apiErr) {
      const message =
        apiErr?.response?.data?.message ||
        apiErr?.response?.data?.error ||
        "Failed to send OTP. Please try again."
      setError(message)
    } finally {
      setIsSending(false)
    }
  }

  const isValidPhone = !validatePhone(formData.phone, formData.countryCode)

  const rData = growthData?.restaurant || defaultRestaurantGrowth;

  return (
    <div className="min-h-[100dvh] bg-[#111] lg:bg-slate-900 flex flex-col lg:flex-row overflow-hidden font-sans">
      {/* Left Section: Onboard Growth Showcase (Desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 px-12 xl:px-20 py-16 text-white overflow-y-auto min-h-screen shrink-0 relative" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="max-w-[540px] mx-auto space-y-8 animate-in fade-in slide-in-from-left-6 duration-500">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FE5502]/10 text-[#FE5502] border border-[#FE5502]/20 uppercase tracking-widest">
              ITZO Partner Advantage
            </span>
            <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white mb-3 mt-4 leading-tight">
              {rData.headline}
            </h2>
            <p className="text-slate-300 text-sm xl:text-base font-medium">
              {rData.subheadline}
            </p>
          </div>

          {/* Dynamic Savings visual card */}
          <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <span className="text-sm font-semibold text-slate-300">Mock Order Value</span>
              <span className="text-2xl font-black text-[#FE5502]">₹{rData.savingsExample?.orderValue || 500}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
                <span className="text-[10px] text-red-300 font-bold uppercase tracking-wider block mb-1">Traditional Apps</span>
                <span className="text-sm font-bold text-red-400">{rData.savingsExample?.traditionalCommission || "₹120–₹150 Commission"}</span>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
                <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block mb-1">ItzoFood</span>
                <span className="text-sm font-bold text-emerald-400">{rData.savingsExample?.itzoCommission || "₹0 Commission"}</span>
              </div>
            </div>
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
              <span className="text-xs font-bold text-orange-200 uppercase tracking-wide">{rData.savingsExample?.keepsRevenueText || "Restaurant Keeps Full Revenue"}</span>
              <span className="text-xs font-black text-orange-400 bg-white/10 px-2.5 py-1 rounded-full uppercase">0% Comm</span>
            </div>
          </div>

          {/* Earnings callout */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
              <span className="text-xs text-slate-400 font-bold block mb-1">Est. Monthly Extra Profit</span>
              <span className="text-2xl font-black text-white">{rData.additionalMessaging?.monthlyProfit || "₹59,100"}</span>
            </div>
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
              <span className="text-xs text-slate-400 font-bold block mb-1">Est. Yearly Extra Profit</span>
              <span className="text-2xl font-black text-[#FE5502]">{rData.additionalMessaging?.yearlyProfit || "₹7,19,050"}</span>
            </div>
          </div>

          {/* Platform benefits list */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Platform Benefits</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {rData.benefits?.map((benefit, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-200 font-medium">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* GST/FSSAI Consulting notice */}
          {rData.consultingServices && rData.consultingServices.length > 0 && (
            <div className="bg-orange-950/40 border border-primary/10 rounded-2xl p-4 flex items-start gap-3">
              <ShieldCheck className="h-6 w-6 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-orange-200 font-bold block mb-1">FSSAI & GST Consulting Assistance</span>
                <p className="text-xs text-slate-300 font-medium leading-relaxed">
                  Need support registering your business? We assist with {rData.consultingServices.join(", ")}.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form Section */}
      <div className="w-full lg:w-1/2 flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-10 sm:py-16 bg-white rounded-t-[40px] lg:rounded-none lg:rounded-l-[40px] shadow-[0_-20px_40px_rgba(0,0,0,0.3)] lg:shadow-[-20px_0_40px_rgba(0,0,0,0.1)] relative z-20 overflow-y-auto scroll-smooth scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent" style={{ WebkitOverflowScrolling: "touch" }}>
        
        {/* Hero Image Section (Mobile only - hidden on desktop) */}
        <div className="absolute top-0 left-0 right-0 h-[35vh] lg:hidden z-0 bg-[#111] flex items-center justify-center overflow-hidden">
          <img 
            src="/packaging-promo.jpg" 
            alt="ITZO Packaging" 
            className="w-full max-w-[600px] h-full object-contain drop-shadow-2xl"
          />
        </div>

        {/* Card Container */}
        <div id="login-content" className="w-full max-w-[400px] flex flex-col items-center mt-[30vh] lg:mt-0 relative z-10">
          <div className="w-24 h-24 sm:w-28 sm:h-28 bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-slate-50 mb-6 -mt-20 lg:-mt-0 lg:mb-8 overflow-hidden p-1.5">
            <img 
              src="/itzo-logo-login.jpg" 
              alt="Itzo Logo" 
              className="w-full h-full object-contain scale-110"
            />
          </div>

          <div className="text-center space-y-1.5 sm:space-y-2 mb-6 sm:mb-10">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight lowercase">
              {companyName}
            </h1>
            <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-widest">
              Partner Login
            </p>
          </div>

          <div className="w-full max-w-[400px] flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Registered Mobile Number</label>
                
                <div className="flex items-center gap-2 h-16 bg-slate-50 border border-slate-100 rounded-[32px] px-6 focus-within:border-[#FE5502]/30 focus-within:ring-4 focus-within:ring-[#FE5502]/5 transition-all overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 text-lg">{formData.countryCode}</span>
                  </div>
                  
                  <div className="w-[1px] h-6 bg-slate-200 ml-2" />

                  <input
                    ref={phoneInputRef}
                    type="tel"
                    maxLength={10}
                    inputMode="numeric"
                    autoComplete="tel-national"
                    enterKeyHint="done"
                    placeholder="Mobile number"
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    className="min-w-0 flex-1 h-12 bg-transparent border-0 outline-none ring-0 shadow-none focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none text-left text-lg font-bold leading-none tracking-[0.02em] text-slate-900 placeholder-slate-300 caret-[#FE5502] px-2"
                    style={{ WebkitTextFillColor: "#0f172a", opacity: 1 }}
                  />
                </div>

                {error && (
                  <p className="text-[#FE5502] text-xs font-bold italic ml-4 animate-bounce">
                    {error}
                  </p>
                )}
              </div>

              <Button
                onClick={handleSendOTP}
                disabled={!isValidPhone || isSending}
                className={`w-full h-14 sm:h-16 rounded-[32px] font-black text-base sm:text-lg tracking-widest uppercase transition-all duration-300 ${
                  isValidPhone && !isSending
                    ? "bg-[#FE5502] hover:bg-[#E64D02] text-white shadow-lg shadow-[#FE5502]/20 transform active:scale-[0.98]"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                {isSending ? "Processing..." : "Continue"}
              </Button>
            </div>

            {/* Mobile Benefit Carousel */}
            {!keyboardInset && (
              <div className="lg:hidden w-full mt-6 mb-2">
                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-[#FE5502] uppercase tracking-wider">Partner Benefits</span>
                    <div className="flex gap-1">
                      {[0, 1, 2].map((idx) => (
                        <div
                          key={idx}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            currentSlide === idx ? "w-4 bg-[#FE5502]" : "w-1.5 bg-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="relative overflow-hidden min-h-[96px] flex items-center">
                    {currentSlide === 0 && (
                      <div className="w-full space-y-1 animate-in fade-in slide-in-from-right-4 duration-300">
                        <h4 className="text-sm font-bold text-slate-800">{rData.headline}</h4>
                        <p className="text-xs text-slate-500">{rData.subheadline}</p>
                      </div>
                    )}

                    {currentSlide === 1 && (
                      <div className="w-full space-y-1.5 animate-in fade-in slide-in-from-right-4 duration-300">
                        <span className="text-[10px] text-slate-400 font-bold block">SAVINGS CALCULATOR EXAMPLE</span>
                        <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-xl border border-slate-100 text-xs">
                          <span className="font-semibold text-slate-600">Extra Profit (Monthly / Yearly):</span>
                          <span className="font-bold text-emerald-600">{rData.additionalMessaging?.monthlyProfit} / {rData.additionalMessaging?.yearlyProfit}</span>
                        </div>
                      </div>
                    )}

                    {currentSlide === 2 && (
                      <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300">
                        <span className="text-[10px] text-slate-400 font-bold block mb-1">HIGHLIGHT BENEFITS</span>
                        <div className="flex flex-wrap gap-1.5">
                          {rData.benefits?.slice(0, 4).map((b, i) => (
                            <span key={i} className="text-[10px] font-bold bg-[#FE5502]/5 border border-[#FE5502]/10 text-[#FE5502] px-2.5 py-1 rounded-full">
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
            {!keyboardInset && (rData?.benefitImage1 || rData?.benefitImage2) && (
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
                  {rData.benefitImage1 && (
                    <div className="w-full rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50 flex items-center justify-center">
                      <img src={rData.benefitImage1} alt="Benefit 1" className="w-full max-h-[220px] object-contain block" />
                    </div>
                  )}
                  {rData.benefitImage2 && (
                    <div className="w-full rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50 flex items-center justify-center">
                      <img src={rData.benefitImage2} alt="Benefit 2" className="w-full max-h-[220px] object-contain block" />
                    </div>
                  )}
                </div>
              </>
            )}

            <div className={`text-center pt-4 pb-2 ${keyboardInset ? "hidden" : ""}`}>
              <p className="text-slate-400 text-xs font-medium">
                By logging in, you agree to our <br />
                <button
                  type="button"
                  onClick={() => navigate("/food/restaurant/terms")}
                  className="bg-transparent border-0 p-0 text-[#FE5502] font-bold hover:underline cursor-pointer"
                >
                  Terms & Conditions
                </button>
                <span className="text-slate-300 mx-1">•</span>
                <button
                  type="button"
                  onClick={() => navigate("/food/restaurant/privacy")}
                  className="bg-transparent border-0 p-0 text-[#FE5502] font-bold hover:underline cursor-pointer"
                >
                  Privacy Policy
                </button>
                <span className="text-slate-300 mx-1">•</span>
                <button
                  type="button"
                  onClick={() => navigate("/food/restaurant/support-policy")}
                  className="bg-transparent border-0 p-0 text-[#FE5502] font-bold hover:underline cursor-pointer"
                >
                  Support
                </button>
              </p>
            </div>
          </div>
        </div>

        <div className={`pb-8 text-center ${keyboardInset ? "hidden" : ""}`}>
          <p className="text-[10px] font-black text-slate-300 tracking-[0.2em] uppercase">
            &copy; {new Date().getFullYear()} {companyName.toUpperCase()} PARTNER
          </p>
        </div>
      </div>
    </div>
  )
}
