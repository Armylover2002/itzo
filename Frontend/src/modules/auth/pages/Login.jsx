import React, { useEffect, useState, useRef } from "react"
import { motion } from "framer-motion"
import { Routes, Route, Navigate, Link, useLocation, useNavigate } from "react-router-dom"
import { Phone, Lock, ArrowRight, ArrowLeft, ShieldCheck, Loader2, UserRound, Headset, Facebook, Instagram, Twitter, Linkedin, Youtube } from "lucide-react"
import { toast } from "sonner"
import { authAPI, userAPI } from "@food/api"
import { isModuleAuthenticated, setAuthData, clearModuleAuth } from "@food/utils/auth"
import { markLocationPromptAfterLogin } from "@food/utils/locationStorage"
import { getCachedSettings, getAppLogo, getCompanyName, setAppType, subscribeBusinessSettings } from "@common/utils/businessSettings"
import AuthCircleLogo from "@shared/components/AuthCircleLogo"

export default function UnifiedOTPFastLogin() {
  const RESEND_COOLDOWN_SECONDS = 60
  const [loginType, setLoginType] = useState("phone") // "phone" | "email"
  const [phoneNumber, setPhoneNumber] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("loginPhoneNumber") || ""
    }
    return ""
  })
  const [emailAddress, setEmailAddress] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState(1)
  const [otpError, setOtpError] = useState("")

  const getIdentifier = () => {
    return loginType === "email" ? emailAddress.trim().toLowerCase() : phoneNumber;
  }
  const [loading, setLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [showNameInput, setShowNameInput] = useState(false)
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState("")
  const [tempAuthData, setTempAuthData] = useState(null)
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo('user'))
  const [companyName, setCompanyName] = useState(() => getCompanyName())
  const [socialLinks, setSocialLinks] = useState(() => getCachedSettings()?.socialLinks || {})
  
  const sliderImages = [
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80",
    "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80",
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&q=80"
  ];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % sliderImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (typeof window === "undefined") return undefined

    // Keep one extra history entry so device/browser back from login
    // routes to user home instead of triggering app-exit behavior.
    window.history.pushState({ userLoginBackGuard: true }, "")

    const handlePopState = () => {
      navigate("/food/user", { replace: true })
    }

    window.addEventListener("popstate", handlePopState)
    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [navigate])

  useEffect(() => {
    setAppType('user')
    const apply = () => {
      setLogoUrl(getAppLogo('user'))
      setCompanyName(getCompanyName())
      setSocialLinks(getCachedSettings()?.socialLinks || {})
    }
    apply()
    return subscribeBusinessSettings(apply)
  }, [])
  const searchParams = new URLSearchParams(location.search)
  const referralCode = searchParams.get("ref") || ""
  
  const submitting = useRef(false)
  const redirectTo = typeof location.state?.redirectTo === "string" && location.state.redirectTo.trim()
    ? location.state.redirectTo.trim()
    : "/portal"

  useEffect(() => {
    if (!isModuleAuthenticated("user")) return
    navigate(redirectTo, { replace: true })
  }, [navigate, redirectTo])

  const clearNameFlow = () => {
    setShowNameInput(false)
    setName("")
    setNameError("")
    if (tempAuthData) {
      clearModuleAuth("user")
      setTempAuthData(null)
    }
  }

  const normalizedPhone = () => {
    const digits = String(phoneNumber).replace(/\D/g, "").slice(-15)
    return digits.length >= 8 ? digits : ""
  }

  const handleSendOTP = async (e) => {
    e.preventDefault()
    const identifier = getIdentifier()
    if (loginType === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(identifier)) {
        toast.error("Please enter a valid email address")
        return
      }
    } else {
      const phoneDigits = String(identifier).replace(/\D/g, "").slice(-15)
      if (phoneDigits.length < 8) {
        toast.error("Please enter a valid phone number (at least 8 digits)")
        return
      }
    }

    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      clearNameFlow()
      await authAPI.sendOTP(identifier, "login", null)
      setOtpSent(true)
      setOtp("")
      setStep(2)
      setResendTimer(RESEND_COOLDOWN_SECONDS)
      toast.success(loginType === "email" ? "Verification code sent to your email!" : "OTP sent! Check your phone.")
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to send OTP."
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleResendOTP = async () => {
    const identifier = getIdentifier()
    if (loginType === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(identifier)) {
        toast.error("Please enter a valid email address")
        return
      }
    } else {
      const phoneDigits = String(identifier).replace(/\D/g, "").slice(-15)
      if (phoneDigits.length < 8) {
        toast.error("Please enter a valid phone number (at least 8 digits)")
        return
      }
    }
    if (resendTimer > 0 || submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      clearNameFlow()
      setOtpError("")
      await authAPI.sendOTP(identifier, "login", null)
      setOtp("")
      setOtpSent(true)
      setResendTimer(RESEND_COOLDOWN_SECONDS)
      toast.success("Verification code resent successfully.")
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to resend OTP."
      toast.error(msg)
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
    setOtpError("")
    const identifier = getIdentifier()
    const otpDigits = String(otp).replace(/\D/g, "").slice(0, 4)
    if (otpDigits.length !== 4) {
      setOtpError("Please enter the 4-digit OTP")
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
                const t = await Promise.race([
                  window.flutter_inappwebview.callHandler(handlerName, { module: "user" }),
                  new Promise((resolve) => setTimeout(() => resolve(null), 800))
                ]);
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
        identifier, 
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
        setTempAuthData({ accessToken, user, refreshToken })
        setShowNameInput(true)
        setLoading(false)
        submitting.current = false
        return
      }

      setAuthData("user", accessToken, user, refreshToken)
      markLocationPromptAfterLogin()
      window.dispatchEvent(new Event("userAuthChanged"))
      toast.success("Login successful!")
      navigate(redirectTo, { replace: true })
    } catch (err) {
      const status = err?.response?.status
      let msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Invalid OTP"
      if (status === 401) {
        if (/deactivat(ed|e)/i.test(String(msg))) {
          msg = "Your account is deactivated. Please contact support."
        } else {
          msg = "Invalid OTP"
        }
      }
      setOtpError(msg)
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

    if (!/^[a-zA-Z\s]+$/.test(trimmedName)) {
      setNameError("Name can only contain letters and spaces")
      return
    }

    if (trimmedName.length < 2) {
      setNameError("Name must be at least 2 characters")
      return
    }

    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    setNameError("")

    try {
      if (tempAuthData?.accessToken) {
         setAuthData("user", tempAuthData.accessToken, tempAuthData.user, tempAuthData.refreshToken)
      }
      const response = await userAPI.updateProfile({ name: trimmedName })
      const updatedUser =
        response?.data?.data?.user ||
        response?.data?.user ||
        response?.data?.data ||
        response?.data
      const storedToken = localStorage.getItem("user_accessToken") || localStorage.getItem("accessToken")
      const storedRefreshToken = localStorage.getItem("user_refreshToken") || null

      if (!storedToken || !updatedUser) {
        throw new Error("Invalid response from server")
      }

      setAuthData("user", storedToken, updatedUser, storedRefreshToken)
      markLocationPromptAfterLogin()
      window.dispatchEvent(new Event("userAuthChanged"))
      clearNameFlow()
      toast.success("Profile saved successfully!")
      navigate(redirectTo, { replace: true })
    } catch (err) {
      if (tempAuthData?.accessToken) {
         clearModuleAuth("user")
      }
      const status = err?.response?.status
      let msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to save your name."
      if (status === 401) {
        msg = "Invalid or expired code, or account not active."
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

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex flex-col lg:flex-row pt-0 sm:pt-0">
      {/* Top Banner section with Image Slider and Curve */}
      <div className="w-full lg:w-1/2 relative h-[350px] md:h-[400px] lg:h-screen flex flex-col items-center justify-center text-center text-white lg:shadow-2xl z-10">
        {/* Background Image Slider */}
        {sliderImages.map((img, idx) => (
          <div
            key={idx}
            className="absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-1000"
            style={{
              backgroundImage: `url('${img}')`,
              opacity: currentImageIndex === idx ? 1 : 0,
            }}
          />
        ))}
        
        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-transparent" />

        {/* Back Button */}
        <button 
          type="button"
          onClick={() => {
            if (showNameInput) {
               setStep(1);
               clearNameFlow();
            } else if (step === 2) {
               setStep(1);
            } else {
               navigate("/");
            }
          }} 
          className="absolute top-6 left-6 z-20 p-2 bg-white/20 hover:bg-white/30 active:scale-95 rounded-full backdrop-blur-sm transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-white" strokeWidth={3} />
        </button>
        
        <div className="relative z-10 flex flex-col items-center mt-[-40px]">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: currentImageIndex * 360 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="mb-4"
          >
            <AuthCircleLogo src={logoUrl} alt={companyName} fallbackText={companyName} />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-5xl font-black tracking-tight mb-2 drop-shadow-lg"
          >
            {companyName}
          </motion.h1>
          <p className="text-xs md:text-sm font-bold text-white/90 tracking-[0.2em] uppercase drop-shadow-md">
            Taste the best, forget the rest
          </p>
        </div>

        {/* Curved Bottom SVG */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-10 lg:hidden">
          <svg
            className="relative block w-full h-[60px] md:h-[80px]"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1440 320"
            preserveAspectRatio="none"
          >
            <path
              fill="currentColor"
              className="text-white dark:text-[#0a0a0a]"
              d="M0,192L48,202.7C96,213,192,235,288,229.3C384,224,480,192,576,192C672,192,768,224,864,213.3C960,203,1056,149,1152,133.3C1248,117,1344,139,1392,149.3L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            ></path>
          </svg>
        </div>
      </div>

      <div className="flex-1 lg:flex-1 lg:w-1/2 max-w-[480px] lg:max-w-none mx-auto w-full px-6 py-4 flex flex-col justify-center lg:items-center -mt-20 lg:mt-0 relative z-20">
        {/* Main Card */}
        <div className="w-full lg:max-w-[480px] bg-white dark:bg-[#1a1a1a] rounded-[2rem] p-6 sm:p-8 md:px-12 md:py-8 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.2)] lg:shadow-none lg:border-none border border-gray-50 dark:border-gray-800">
           <div className="text-center mb-6 mt-[-10px] space-y-2">
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-gray-900 dark:text-white tracking-wide">Login or Signup</h2>
              <div className="h-[2px] w-16 bg-[#6b554b] dark:bg-gray-400 mx-auto rounded-full" />
           </div>

          <form onSubmit={showNameInput ? handleSubmitName : step === 1 ? handleSendOTP : handleVerifyOTP} className="space-y-5">
            {step === 1 ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center border-b-2 border-gray-100 dark:border-gray-800 focus-within:border-primary-orange transition-all py-2 group">
                    <div className="pl-1 flex items-center pointer-events-none">
                      <Phone className="w-5 h-5 text-gray-400 group-focus-within:text-primary-orange transition-colors" />
                    </div>
                    <div className="flex items-center pointer-events-none pl-2">
                       <span className="text-lg font-bold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-800 pr-3">+91</span>
                    </div>
                    <input
                      type="tel"
                      required
                      autoFocus
                      value={phoneNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 10)
                        setPhoneNumber(val)
                        if (typeof window !== "undefined") {
                          sessionStorage.setItem("loginPhoneNumber", val)
                        }
                      }}
                      maxLength={10}
                      className="block w-full pl-3 pr-4 py-1 bg-transparent text-gray-900 dark:text-white outline-none placeholder:text-gray-300 font-bold text-lg"
                      placeholder="Phone number"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                  We will send success notifications and order updates via verification code
                </p>
              </div>
            ) : showNameInput ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                  <div className="w-10 h-10 bg-primary-orange/10 rounded-full flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-primary-orange" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest leading-none mb-1">Verified Account</p>
                    <p className="text-sm font-black text-gray-900 dark:text-white">
                      +91 {phoneNumber}
                    </p>
                  </div>
                  <button type="button" onClick={handleEditNumber} className="text-xs text-primary-orange font-black underline cursor-pointer">
                    Change
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-1 flex items-center pointer-events-none">
                      <UserRound className="w-5 h-5 text-gray-400 group-focus-within:text-primary-orange transition-colors" />
                    </div>
                    <input
                      type="text"
                      required
                      autoFocus
                      maxLength={50}
                      value={name}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && !/^[a-zA-Z\s]*$/.test(val)) return;
                        setName(val)
                        if (nameError) setNameError("")
                      }}
                      className={`block w-full pl-10 pr-4 py-3 bg-transparent text-gray-900 dark:text-white border-b-2 border-gray-100 dark:border-gray-800 focus:border-primary-orange outline-none transition-all placeholder:text-gray-300 font-bold text-lg ${nameError ? "border-red-500" : ""}`}
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
                      <div className="w-10 h-10 bg-primary-orange/10 rounded-full flex items-center justify-center">
                         <ShieldCheck className="w-5 h-5 text-primary-orange" />
                      </div>
                      <div className="flex-1">
                          <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest leading-none mb-1">Sent to</p>
                          <p className="text-sm font-black text-gray-900 dark:text-white">
                            +91 {phoneNumber}
                          </p>
                      </div>
                      <button type="button" onClick={handleEditNumber} className="text-xs text-primary-orange font-black underline cursor-pointer">Edit</button>
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
                          const val = e.target.value;
                          // If there's already a digit and they type another, length > 1. 
                          // We ignore it so they must backspace first.
                          if (val.length > 1) return;
                          
                          const digit = val.replace(/\D/g, "");
                          // We still allow deleting, which is handled via backspace, but if val is empty (e.g., they highlight and press delete) we should handle it
                          if (!digit && val) return;
                          
                          if (otpError) setOtpError("");

                          const newOtp = otp.split("");
                          newOtp[index] = digit || "";
                          const combined = newOtp.join("").slice(0, 4);
                          setOtp(combined);
                          
                          // Focus next
                          if (index < 3 && digit) {
                            document.getElementById(`otp-${index + 1}`)?.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace") {
                            if (otpError) setOtpError("");
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
                          if (otpError) setOtpError("");
                          const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
                          if (pasteData) {
                            setOtp(pasteData);
                            document.getElementById(`otp-${Math.min(pasteData.length, 3)}`)?.focus();
                          }
                        }}
                        className="w-14 h-14 sm:w-16 sm:h-16 text-center text-xl sm:text-3xl font-black bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 focus:border-primary-orange rounded-xl sm:rounded-2xl outline-none transition-all text-gray-900 dark:text-white"
                        placeholder="-"
                      />
                    ))}
                  </div>
                  {otpError && (
                    <div className="text-center mt-2">
                      <p className="text-sm font-bold text-red-500">{otpError}</p>
                    </div>
                  )}
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
                        className="text-xs font-black text-primary-orange underline disabled:opacity-60 disabled:cursor-not-allowed"
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
              className={`w-full py-4 rounded-2xl font-black text-lg transition-all relative overflow-hidden shadow-xl ${
                loading
                  ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-50"
                  : "bg-primary-orange hover:bg-primary-hover text-white hover:shadow-2xl hover:shadow-[#CB202D]/30 active:scale-[0.98] hover:-translate-y-0.5"
              }`}
            >
              {loading ? (
                <Loader2 className="w-7 h-7 animate-spin mx-auto text-white" />
              ) : (
                step === 1 ? "Get Verification Code" : showNameInput ? "Save Name & Continue" : "Continue"
              )}
            </button>
          </form>

          {/* Social Links Section */}
          {step === 1 && (socialLinks.facebook || socialLinks.instagram || socialLinks.twitter || socialLinks.linkedin || socialLinks.youtube) && (
            <div className="mt-8 flex justify-center items-center gap-6">
              {socialLinks.facebook && (
                <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-500 transition-colors">
                  <Facebook className="h-5 w-5" />
                </a>
              )}
              {socialLinks.instagram && (
                <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-pink-600 dark:text-gray-500 dark:hover:text-pink-500 transition-colors">
                  <Instagram className="h-5 w-5" />
                </a>
              )}
              {socialLinks.twitter && (
                <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-400 dark:text-gray-500 dark:hover:text-blue-300 transition-colors">
                  <Twitter className="h-5 w-5" />
                </a>
              )}
              {socialLinks.linkedin && (
                <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-700 dark:text-gray-500 dark:hover:text-blue-600 transition-colors">
                  <Linkedin className="h-5 w-5" />
                </a>
              )}
              {socialLinks.youtube && (
                <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-500 transition-colors">
                  <Youtube className="h-5 w-5" />
                </a>
              )}
            </div>
          )}
        </div>

        {step === 1 && (
          <div className="mt-6 text-center space-y-4">
             <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] leading-relaxed">
               By continuing, you agree to our <br />
               <Link to="/food/user/profile/terms" className="text-gray-900 dark:text-white underline cursor-pointer hover:text-primary-orange transition-colors">Terms And Condition</Link>, <Link to="/food/user/profile/privacy" className="text-gray-900 dark:text-white underline cursor-pointer hover:text-primary-orange transition-colors">Privacy Policy</Link> & <Link to="/food/user/support" className="text-gray-900 dark:text-white underline cursor-pointer hover:text-primary-orange transition-colors">Support</Link>
             </p>
          </div>
        )}
      </div>
    </div>
  )
}
