import React, { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Routes, Route, Navigate, Link, useLocation, useNavigate } from "react-router-dom"
import { Phone, Lock, ArrowRight, ShieldCheck, Loader2, UserRound, Mail, ChevronDown, ArrowLeft, CheckCircle2, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import api, { authAPI, userAPI } from "@food/api"
import { API_ENDPOINTS } from "@food/api/config"
import { isModuleAuthenticated, setAuthData } from "@food/utils/auth"
import { loadBusinessSettings, getCachedSettings, getAppLogo, getCompanyName, setAppType } from "@common/utils/businessSettings"

import loginBanner from "@food/assets/loginbanner.png"
import foodDiscovery from "@food/assets/food_discovery_bg.png"
import offerBanner from "@food/assets/offerpagebanner.png"
import gourmetBanner from "@food/assets/groumetpagebanner.png"
import collectionsBanner from "@food/assets/collectionspagebanner.png"

const defaultBackgroundImages = [
  loginBanner,
  foodDiscovery,
  offerBanner,
  gourmetBanner,
  collectionsBanner
];

const defaultUserGrowth = {
  headline: "Order Smarter. Save More.",
  subheadline: "Real Restaurant Prices. No Hidden Charges.",
  benefits: [
    "Actual Restaurant Menu Pricing",
    "No Artificial Menu Markup",
    "Transparent Delivery Charges",
    "Affordable Food Delivery",
    "Hyperlocal Delivery",
    "Better Pricing Than Traditional Apps"
  ],
  comparison: {
    traditionalAppsText: "Menu Price + Markup + Fees",
    itzoFoodText: "Actual Menu Price + Delivery Fee"
  },
  keyAdvantages: [
    "Lower Food Costs",
    "More Restaurant Choices",
    "Transparent Billing",
    "Better Local Economy Support"
  ],
  privacyMessage: "Your Privacy Matters: Female customer contact information remains protected and is never shared directly with delivery partners."
}

export default function UnifiedOTPFastLogin() {
  const [backgroundImages, setBackgroundImages] = useState(defaultBackgroundImages)
  const [currentBg, setCurrentBg] = useState(0)
  const [backgroundVideo, setBackgroundVideo] = useState(null)

  useEffect(() => {
    if (backgroundImages.length === 0) return;
    const interval = setInterval(() => {
      setCurrentBg((prev) => (prev + 1) % backgroundImages.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [backgroundImages.length])
  const RESEND_COOLDOWN_SECONDS = 60
  const [phoneNumber, setPhoneNumber] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [showNameInput, setShowNameInput] = useState(false)
  const [showRecoveryModal, setShowRecoveryModal] = useState(false)
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false)
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState("")
  // Holds token/user temporarily while user is on the name step (auth is not finalized yet)
  const [pendingAuthData, setPendingAuthData] = useState(null)
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo('user'))
  const [companyName, setCompanyName] = useState(() => getCompanyName())
  const location = useLocation()
  const navigate = useNavigate()

  const [growthData, setGrowthData] = useState(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [keyboardInset, setKeyboardInset] = useState(0)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setAppType('user')
        const settings = await loadBusinessSettings()
        if (settings) {
          setLogoUrl(getAppLogo('user'))
          setCompanyName(getCompanyName())
          
          const dynamicBanners = [
            settings.userLoginBanner1?.url,
            settings.userLoginBanner2?.url,
            settings.userLoginBanner3?.url,
            settings.userLoginBanner4?.url,
            settings.userLoginBanner5?.url
          ].filter(Boolean);
          
          if (dynamicBanners.length > 0) {
            setBackgroundImages(dynamicBanners);
          }
          if (settings.userLoginVideo?.url) {
            setBackgroundVideo(settings.userLoginVideo.url);
          }
        }
      } catch (error) {}
    }
    fetchSettings()
  }, [])

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

  const searchParams = new URLSearchParams(location.search)
  const referralCode = searchParams.get("ref") || ""
  
  const submitting = useRef(false)
  const redirectTo = typeof location.state?.redirectTo === "string" && location.state.redirectTo.trim()
    ? location.state.redirectTo.trim()
    : "/food/user"

  useEffect(() => {
    if (!isModuleAuthenticated("user")) return
    navigate(redirectTo, { replace: true })
  }, [navigate, redirectTo])

  const clearNameFlow = () => {
    setShowNameInput(false)
    setName("")
    setNameError("")
    setPendingAuthData(null)
  }

  // Strictly validates Indian mobile numbers: exactly 10 digits, starting with 6, 7, 8, or 9.
  const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/

  const normalizedPhone = () => {
    const digits = String(phoneNumber).replace(/\D/g, "").slice(-10)
    return digits
  }

  const handleSendOTP = async (e) => {
    e.preventDefault()
    const phone = normalizedPhone()
    if (!INDIAN_MOBILE_REGEX.test(phone)) {
      toast.error("Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9")
      return
    }
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      clearNameFlow()
      await authAPI.sendOTP(phone, "login", null)
      setOtpSent(true)
      setOtp("")
      setStep(2)
      setResendTimer(RESEND_COOLDOWN_SECONDS)
      toast.success("OTP sent! Check your phone.")
    } catch (err) {
      const code = err?.response?.data?.code || err?.code
      const msg = err?.response?.data?.message || err?.message || "Failed to send OTP."
      if (code === 'ACCOUNT_DELETED' || msg?.toLowerCase().includes('account has been deleted')) {
        setShowRecoveryModal(true)
      } else {
        toast.error(msg)
      }
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleResendOTP = async () => {
    const phone = normalizedPhone()
    if (!INDIAN_MOBILE_REGEX.test(phone)) {
      toast.error("Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9")
      return
    }
    if (resendTimer > 0 || submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      clearNameFlow()
      await authAPI.sendOTP(phone, "login", null)
      setOtp("")
      setOtpSent(true)
      setResendTimer(RESEND_COOLDOWN_SECONDS)
      toast.success("OTP resent successfully.")
    } catch (err) {
      const code = err?.response?.data?.code || err?.code
      const msg = err?.response?.data?.message || err?.message || "Failed to resend OTP."
      if (code === 'ACCOUNT_DELETED' || msg?.toLowerCase().includes('account has been deleted')) {
        setShowRecoveryModal(true)
      } else {
        toast.error(msg)
      }
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleEditNumber = () => {
    setStep(1)
    setOtp("")
    setResendTimer(0)
    clearNameFlow()
  }

  const handleVerifyOTP = async (e) => {
    e.preventDefault()
    const phone = normalizedPhone()
    const otpDigits = String(otp).replace(/\D/g, "").slice(0, 4)
    if (otpDigits.length !== 4) {
      toast.error("Please enter the 4-digit OTP")
      return
    }
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      // Try to get FCM token before verifying OTP
      let fcmToken = null;
      let platform = "web";
      try {
        if (typeof window !== "undefined") {
          if (window.flutter_inappwebview) {
            platform = "mobile";
            const handlerNames = ["getFcmToken", "getFCMToken", "getPushToken", "getFirebaseToken"];
            for (const handlerName of handlerNames) {
              try {
                const t = await window.flutter_inappwebview.callHandler(handlerName, { module: "user" });
                if (t && typeof t === "string" && t.length > 20) {
                  fcmToken = t.trim();
                  break;
                }
              } catch (e) {}
            }
          } else {
            fcmToken = localStorage.getItem("fcm_web_registered_token_user") || null;
          }
        }
      } catch (e) {
        console.warn("Failed to get FCM token during login", e);
      }

      const response = await authAPI.verifyOTP(
        phoneNumber, 
        otpDigits, 
        "login", 
        null, 
        null, 
        "user", 
        null, 
        referralCode, 
        fcmToken, 
        platform
      )
      const data = response?.data?.data || response?.data || {}
      const accessToken = data.accessToken
      const refreshToken = data.refreshToken || null
      const user = data.user

      if (!accessToken || !user) {
        throw new Error("Invalid response from server")
      }

      const hasName =
        user.name &&
        String(user.name).trim().length > 0 &&
        String(user.name).toLowerCase() !== "null"
      const needsName = data.isNewUser === true || !hasName

      if (needsName) {
        // Do NOT save tokens yet — user must provide their name first.
        // Tokens are stored in temporary state; they will be committed after handleSubmitName succeeds.
        setPendingAuthData({ accessToken, refreshToken, user })
        setShowNameInput(true)
        setLoading(false)
        submitting.current = false
        return
      }

      setAuthData("user", accessToken, user, refreshToken)
      window.dispatchEvent(new Event("userAuthChanged"))
      toast.success("Login successful!")
      navigate(redirectTo, { replace: true })
    } catch (err) {
      const status = err?.response?.status
      let msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Invalid OTP. Please try again."
      if (status === 401) {
        if (/deactivat(ed|e)/i.test(String(msg))) {
          msg = "Your account is deactivated. Please contact support."
        } else {
          msg = "Invalid or expired code, or account not active."
        }
      }
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleSubmitName = async (e) => {
    e.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError("Please enter your name")
      return
    }

    if (trimmedName.length < 2) {
      setNameError("Name must be at least 2 characters")
      return
    }

    // Numbers-only names or mobile number as name are not allowed
    if (/^\d+$/.test(trimmedName)) {
      setNameError("Name cannot be a number. Please enter your real name.")
      return
    }

    if (!pendingAuthData?.accessToken) {
      toast.error("Session expired. Please log in again.")
      clearNameFlow()
      setStep(1)
      setOtp("")
      return
    }

    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    setNameError("")

    try {
      // Use the pending token directly in the Authorization header since the user is not
      // officially logged in yet (setAuthData has not been called).
      const response = await api.patch(
        "/food/user/profile",
        { name: trimmedName },
        { headers: { Authorization: `Bearer ${pendingAuthData.accessToken}` } }
      )
      const updatedUser =
        response?.data?.data?.user ||
        response?.data?.user ||
        response?.data?.data ||
        response?.data

      // Now that name is confirmed saved, finalize login.
      setAuthData("user", pendingAuthData.accessToken, { ...(pendingAuthData.user || {}), name: trimmedName, ...(updatedUser || {}) }, pendingAuthData.refreshToken)
      window.dispatchEvent(new Event("userAuthChanged"))
      clearNameFlow()
      toast.success("Welcome! Your profile is ready.")
      navigate(redirectTo, { replace: true })
    } catch (err) {
      const status = err?.response?.status
      let msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to save your name."
      if (status === 401) {
        msg = "Session expired. Please log in again."
        clearNameFlow()
        setStep(1)
        setOtp("")
      }
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  useEffect(() => {
    if (step !== 2 || resendTimer <= 0) return
    const intervalId = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(intervalId)
  }, [step, resendTimer])

  const formatResendTimer = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  // Service images (served from public folder)
  const foodIcon = "/super-app/food.png"

  const groceryIcon = "/super-app/grocery.png"


  const services = [
    { id: 'food', name: 'Food Delivery', icon: foodIcon, label: 'Zomato', color: 'bg-red-500', shadow: 'shadow-red-200' },

    { id: 'grocery', name: 'Quick Commerce', icon: groceryIcon, label: 'Blinkit', color: 'bg-green-500', shadow: 'shadow-green-200' },

  ]

  const uData = (typeof growthData !== 'undefined' ? growthData?.user : null) || defaultUserGrowth;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex flex-col md:flex-row md:items-stretch relative transition-colors duration-1000 font-sans">
      
      {/* Left Section: Consumer Growth Showcase (Desktop only) */}
      <div className="hidden md:flex md:w-1/2 flex-col justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 px-12 xl:px-20 py-16 text-white relative overflow-y-auto shrink-0">
        
        {/* Background video or images for visual flair */}
        <div className="absolute inset-0 opacity-10">
          {backgroundVideo ? (
            <video 
              src={backgroundVideo} 
              autoPlay 
              loop 
              muted 
              playsInline 
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <img src={backgroundImages[currentBg]} alt="bg" className="w-full h-full object-cover blur-sm" />
          )}
        </div>

        <div className="max-w-[500px] mx-auto space-y-8 animate-in fade-in slide-in-from-left-6 duration-500 relative z-10">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FE5502]/10 text-[#FE5502] border border-[#FE5502]/20 uppercase tracking-widest">
              ItzoFood Savings
            </span>
            <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white mb-3 mt-4 leading-tight">
              {uData.headline}
            </h2>
            <p className="text-slate-300 text-sm xl:text-base font-medium">
              {uData.subheadline}
            </p>
          </div>

          {/* Pricing comparison */}
          <div className="bg-white/5 rounded-3xl p-6 border border-white/10 shadow-2xl space-y-5">
            <div className="text-sm font-bold text-slate-300 pb-2 border-b border-white/10 uppercase tracking-wider">Smart Pricing Comparison</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                <span className="text-[10px] text-red-300 font-bold uppercase tracking-wider block mb-1">Traditional Apps</span>
                <span className="text-xs font-semibold text-red-400 leading-relaxed">{uData.comparison?.traditionalAppsText || "Menu Price + Markup + Fees"}</span>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block mb-1">ItzoFood</span>
                <span className="text-xs font-semibold text-emerald-400 leading-relaxed">{uData.comparison?.itzoFoodText || "Actual Menu Price + Delivery Fee"}</span>
              </div>
            </div>
          </div>

          {/* Benefits checklist */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Consumer Advantages</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {uData.benefits?.map((benefit, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-200 font-medium">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Female Privacy callout */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-5 flex items-start gap-3">
            <ShieldAlert className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs text-amber-300 font-bold block mb-1">Safe & Private Delivery</span>
              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                {uData.privacyMessage || "Your Privacy Matters: Female customer contact information remains protected and is never shared directly with delivery partners."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Section: Form Container (Mobile/Desktop) */}
      <div className="w-full md:w-1/2 flex-1 flex flex-col items-center justify-center bg-white dark:bg-neutral-900 relative z-20 px-4 py-8 overflow-y-auto scroll-smooth scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-neutral-800 scrollbar-track-transparent" style={{ WebkitOverflowScrolling: "touch" }}>
        
        {/* Banner (Mobile Only) */}
        <div className="absolute top-0 left-0 right-0 h-[35vh] md:hidden z-0 bg-black">
          {backgroundVideo ? (
            <video 
              src={backgroundVideo} 
              autoPlay 
              loop 
              muted 
              playsInline 
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <AnimatePresence mode="popLayout">
              {backgroundImages.map((img, index) => (
                index === currentBg && (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                    className="absolute inset-0 w-full h-full"
                  >
                    <img src={img} alt={`Slide ${index + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </motion.div>
                )
              ))}
            </AnimatePresence>
          )}
          {backgroundVideo && <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />}
        </div>

        {/* Card Container */}
        <div className="w-full max-w-[420px] bg-white dark:bg-neutral-900 rounded-t-3xl md:rounded-2xl shadow-[0_-8px_30px_rgb(0,0,0,0.12)] md:shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] border-t md:border border-gray-100 dark:border-neutral-800 mt-[30vh] md:mt-0 flex flex-col p-6 md:p-8 space-y-6 relative z-10 animate-in fade-in slide-in-from-bottom-6 duration-500">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => navigate(-1)} 
                type="button"
                className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-600 dark:text-gray-300"
                aria-label="Go back"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h2 className="text-3xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">
                Login
              </h2>
            </div>
          </div>

          <form onSubmit={showNameInput ? handleSubmitName : step === 1 ? handleSendOTP : handleVerifyOTP} className="space-y-4">
            {step === 1 ? (
              <div className="space-y-1">
                <div className="relative flex items-center group">
                  <div className="flex items-center justify-center gap-1.5 px-3 h-12 md:h-14 border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 rounded-xl rounded-r-none font-medium border-r-0 group-focus-within:border-[#FE5502]">
                    <img src="https://flagcdn.com/w20/in.png" alt="India" className="w-5 h-auto rounded-[2px]" />
                    <span>+91</span>
                  </div>
                  <div className="h-8 w-px bg-gray-300 dark:bg-neutral-700 absolute left-[85px] z-10 group-focus-within:bg-[#FE5502]/50 transition-colors" />
                  <input
                    type="tel"
                    required
                    autoFocus
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    maxLength={10}
                    className="flex-1 h-12 md:h-14 w-full text-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white border border-gray-300 dark:border-neutral-700 rounded-xl rounded-l-none pl-4 focus:ring-0 focus:border-[#FE5502] focus:outline-none transition-all shadow-none placeholder:text-gray-400 [&:-webkit-autofill]:[transition:background-color_5000s_ease-in-out_0s] [&:-webkit-autofill]:[-webkit-text-fill-color:inherit] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:#fff]"
                    placeholder="Phone"
                  />
                </div>
              </div>
            ) : showNameInput ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                  <div className="w-10 h-10 bg-[#FE5502]/10 rounded-full flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-[#FE5502]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest leading-none mb-1">Verified Number</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">+91 {phoneNumber}</p>
                  </div>
                  <button type="button" onClick={handleEditNumber} className="text-xs text-[#FE5502] font-semibold hover:underline cursor-pointer">
                    Change
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <UserRound className="w-5 h-5 text-gray-400 group-focus-within:text-[#FE5502] transition-colors" />
                    </div>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value)
                        if (nameError) setNameError("")
                      }}
                      className={`block w-full pl-10 pr-4 py-3 h-12 md:h-14 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white border border-gray-300 dark:border-neutral-700 rounded-xl focus:border-[#FE5502] focus:outline-none transition-all placeholder:text-gray-400 text-lg ${nameError ? "border-red-500" : ""}`}
                      placeholder="Your full name"
                    />
                  </div>

                  {nameError ? (
                    <p className="text-xs font-semibold text-red-500 text-center">{nameError}</p>
                  ) : (
                    <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                      Please enter your name so we can save it to your profile.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                    <div className="w-10 h-10 bg-[#FE5502]/10 rounded-full flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-[#FE5502]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest leading-none mb-1">Sent to</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">+91 {phoneNumber}</p>
                    </div>
                    <button type="button" onClick={handleEditNumber} className="text-xs text-[#FE5502] font-semibold hover:underline cursor-pointer">Edit</button>
                  </div>

                  <div className="flex justify-center gap-3 mt-4">
                    {[0, 1, 2, 3].map((index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="tel"
                        inputMode="numeric"
                        required
                        autoFocus={index === 0}
                        value={otp[index] || ""}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(-1);
                          if (!val) return;
                          const newOtp = otp.split("");
                          newOtp[index] = val;
                          const combined = newOtp.join("").slice(0, 4);
                          setOtp(combined);
                          
                          if (index < 3 && val) {
                            document.getElementById(`otp-${index + 1}`)?.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace") {
                            if (!otp[index] && index > 0) {
                              document.getElementById(`otp-${index - 1}`)?.focus();
                            } else {
                              const newOtp = otp.split("");
                              newOtp[index] = "";
                              setOtp(newOtp.join(""));
                            }
                          }
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
                          if (pasteData) {
                            setOtp(pasteData);
                            document.getElementById(`otp-${Math.min(pasteData.length, 3)}`)?.focus();
                          }
                        }}
                        className="w-12 h-14 md:w-14 md:h-16 text-center text-xl md:text-2xl font-semibold bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 focus:border-[#FE5502] focus:outline-none rounded-xl transition-all text-gray-900 dark:text-white"
                        placeholder="-"
                      />
                    ))}
                  </div>
                  <div className="text-center mt-4">
                    {resendTimer > 0 ? (
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Resend OTP in {formatResendTimer(resendTimer)}
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOTP}
                        disabled={loading}
                        className="text-xs font-semibold text-[#FE5502] hover:underline disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full h-12 md:h-14 mt-2 bg-[#FE5502] hover:bg-[#E04B00] text-white font-semibold text-base md:text-lg rounded-xl transition-all hover:shadow-lg active:scale-[0.98] ${
                loading ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Please wait...
                </div>
              ) : (
                step === 1 ? "Send One Time Password" : showNameInput ? "Save Name & Continue" : "Verify Code"
              )}
            </button>
          </form>

          {/* Mobile Benefit Carousel */}
          {!keyboardInset && (
            <div className="md:hidden w-full pt-1">
              <div className="bg-slate-50 dark:bg-neutral-900/60 border border-slate-100 dark:border-neutral-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-[#FE5502] uppercase tracking-wider">Itzo Savings</span>
                  <div className="flex gap-1">
                    {[0, 1, 2].map((idx) => (
                      <div
                        key={idx}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          currentSlide === idx ? "w-4 bg-[#FE5502]" : "w-1.5 bg-slate-200 dark:bg-neutral-700"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="relative overflow-hidden min-h-[76px] flex items-center">
                  {currentSlide === 0 && (
                    <div className="w-full space-y-0.5 animate-in fade-in slide-in-from-right-4 duration-300">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{uData.headline}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{uData.subheadline}</p>
                    </div>
                  )}

                  {currentSlide === 1 && (
                    <div className="w-full space-y-1 animate-in fade-in slide-in-from-right-4 duration-300">
                      <span className="text-[9px] text-slate-400 font-bold block">SAVINGS DETAIL</span>
                      <div className="flex items-center justify-between bg-white dark:bg-neutral-800 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-neutral-700 text-[10px]">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">{uData.comparison?.itzoFoodText}</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">No Markup</span>
                      </div>
                    </div>
                  )}

                  {currentSlide === 2 && (
                    <div className="w-full space-y-1 animate-in fade-in slide-in-from-right-4 duration-300">
                      <span className="text-[9px] text-amber-600 dark:text-amber-500 font-bold flex items-center gap-1">
                        <ShieldAlert className="h-3.5 w-3.5" /> Private & Secure Delivery
                      </span>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                        Female contact info remains protected & is never shared with riders.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Benefit Images (Uploaded dynamically by Admin) */}
          {!keyboardInset && (uData?.benefitImage1 || uData?.benefitImage2) && (
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
                {uData.benefitImage1 && (
                  <div className="w-full rounded-xl overflow-hidden border border-slate-100 dark:border-neutral-800 shadow-sm bg-slate-50 dark:bg-neutral-900 flex items-center justify-center">
                    <img src={uData.benefitImage1} alt="Benefit 1" className="w-full max-h-[220px] object-contain block" />
                  </div>
                )}
                {uData.benefitImage2 && (
                  <div className="w-full rounded-xl overflow-hidden border border-slate-100 dark:border-neutral-800 shadow-sm bg-slate-50 dark:bg-neutral-900 flex items-center justify-center">
                    <img src={uData.benefitImage2} alt="Benefit 2" className="w-full max-h-[220px] object-contain block" />
                  </div>
                )}
              </div>
            </>
          )}

          <div className="text-center text-[11px] md:text-xs text-gray-400 dark:text-gray-500 pt-4 pb-2 border-t border-gray-100 dark:border-neutral-800 mt-6">
            <p className="mb-2">By continuing, you agree to our</p>
            <div className="flex justify-center gap-1.5 flex-wrap">
              <Link to="/profile/terms" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                Terms & Conditions
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

      {/* Account Deleted - Recovery Modal */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                <ShieldAlert className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Account Deleted</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 leading-relaxed">
                Your account has been deleted. You can request to recover your account. The admin will review your request and restore access if approved.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowRecoveryModal(false)}
                className="flex-1 h-12 border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (isRecoveryLoading) return
                  setIsRecoveryLoading(true)
                  try {
                    const phone = String(phoneNumber).replace(/\D/g, "").slice(-10)
                    await authAPI.requestAccountRecovery(phone)
                    setShowRecoveryModal(false)
                    toast.success("Recovery request submitted! You will be notified once admin approves it.")
                  } catch (err) {
                    const errMsg = err?.response?.data?.message || err?.message || "Failed to submit recovery request."
                    toast.error(errMsg)
                  } finally {
                    setIsRecoveryLoading(false)
                  }
                }}
                disabled={isRecoveryLoading}
                className="flex-1 h-12 bg-[#FE5502] hover:bg-[#E04B00] text-white font-semibold rounded-xl transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isRecoveryLoading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
                ) : (
                  "Request Recovery"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
