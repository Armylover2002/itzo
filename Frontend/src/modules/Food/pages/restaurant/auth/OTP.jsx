import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, ShieldCheck, Timer, RefreshCw, X } from "lucide-react"
import loginBg from "@food/assets/loginbanner.png"
import { Button } from "@food/components/ui/button"
import { restaurantAPI } from "@food/api"
import { clearOnboardingDraft } from "@food/utils/onboardingDraftStorage"
import {
  setAuthData as setRestaurantAuthData,
  setRestaurantPendingPhone,
} from "@food/utils/auth"
import { isRestaurantOnboardingComplete, checkOnboardingStatus } from "@food/utils/onboardingUtils"
import { isRestaurantInitialPendingApproval } from "@food/utils/restaurantApproval"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { getAppLogo, getRestaurantLoginBanner, subscribeBusinessSettings } from "@common/utils/businessSettings"
import AuthCircleLogo from "@shared/components/AuthCircleLogo"

const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }

export default function RestaurantOTP() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo('restaurant'))
  const [bannerUrl, setBannerUrl] = useState(() => {
    const banner = getRestaurantLoginBanner()
    return (banner && banner.url && banner.active) ? banner.url : loginBg
  })

  const sliderImages = [
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80",
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&q=80",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80"
  ];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % sliderImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

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
  const [otp, setOtp] = useState(["", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [resendTimer, setResendTimer] = useState(0)
  const [authData, setAuthData] = useState(null)
  const [contactInfo, setContactInfo] = useState("")
  const [focusedIndex, setFocusedIndex] = useState(null)
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const inputRefs = useRef([])
  const hasSubmittedRef = useRef(false)
  const otpSectionRef = useRef(null)
  const [rejectionModalData, setRejectionModalData] = useState({
    isOpen: false,
    reason: "",
    phone: "",
  })

  useEffect(() => {
    const stored = sessionStorage.getItem("restaurantAuthData")
    if (stored) {
      const data = JSON.parse(stored)
      setAuthData(data)

      if (data.method === "email" && data.email) {
        setContactInfo(data.email)
      } else if (data.phone) {
        const phoneMatch = data.phone?.match(/(\+\d+)\s*(.+)/)
        if (phoneMatch) {
          const formattedPhone = `${phoneMatch[1]} ${phoneMatch[2].replace(/\D/g, "")}`
          setContactInfo(formattedPhone)
        } else {
          setContactInfo(data.phone || "")
        }
      }
    } else {
      navigate("/food/restaurant/login")
      return
    }

    setResendTimer(60)
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [navigate])

  useEffect(() => {
    const focusFirstInput = () => inputRefs.current[0]?.focus()
    const frameId = requestAnimationFrame(() => {
      focusFirstInput()
      window.setTimeout(focusFirstInput, 120)
    })
    return () => cancelAnimationFrame(frameId)
  }, [authData])

  useEffect(() => {
    if (typeof window === "undefined") return

    const viewport = window.visualViewport
    if (!viewport) return

    const updateKeyboardState = () => {
      const keyboardHeight = Math.max(0, window.innerHeight - viewport.height)
      setKeyboardOffset(keyboardHeight > 120 ? keyboardHeight : 0)
    }

    updateKeyboardState()
    viewport.addEventListener("resize", updateKeyboardState)
    viewport.addEventListener("scroll", updateKeyboardState)

    return () => {
      viewport.removeEventListener("resize", updateKeyboardState)
      viewport.removeEventListener("scroll", updateKeyboardState)
    }
  }, [])

  useEffect(() => {
    if (focusedIndex == null) return

    const targetInput = inputRefs.current[focusedIndex]
    if (!targetInput) return

    const id = window.setTimeout(() => {
      try {
        targetInput.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        })
        otpSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        })
      } catch {
        // no-op
      }
    }, 120)

    return () => window.clearTimeout(id)
  }, [focusedIndex, keyboardOffset])

  const handleChange = (index, value) => {
    if (value && !/^\d$/.test(value)) {
      return
    }

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setError("")

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }

    if (newOtp.every((digit) => digit !== "") && newOtp.length === 4) {
      handleVerify(newOtp.join(""))
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (otp[index]) {
        const newOtp = [...otp]
        newOtp[index] = ""
        setOtp(newOtp)
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus()
        const newOtp = [...otp]
        newOtp[index - 1] = ""
        setOtp(newOtp)
      }
    }
    if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, "").slice(0, 4).split("")
        const newOtp = [...otp]
        digits.forEach((digit, i) => {
          if (i < 4) {
            newOtp[i] = digit
          }
        })
        setOtp(newOtp)
        if (digits.length === 4) {
          handleVerify(newOtp.join(""))
        } else {
          inputRefs.current[digits.length]?.focus()
        }
      })
    }
  }

  const handlePaste = (index, e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text")
    const digits = pastedData.replace(/\D/g, "").slice(0, 4).split("")
    const newOtp = [...otp]
    digits.forEach((digit, i) => {
      if (i < 4) {
        newOtp[i] = digit
      }
    })
    setOtp(newOtp)
    if (digits.length === 4) {
      handleVerify(newOtp.join(""))
    } else {
      inputRefs.current[digits.length]?.focus()
    }
  }

  const handleVerify = async (otpValue = null) => {
    // Always gate — including paste/auto-fill paths that pass otpValue.
    if (hasSubmittedRef.current || isLoading) {
      return
    }

    const code = String(otpValue ?? otp.join("")).replace(/\D/g, "").slice(0, 4)

    if (code.length !== 4) {
      setError("Please enter the complete 4-digit code")
      return
    }

    hasSubmittedRef.current = true
    setIsLoading(true)
    setError("")

    try {
      if (!authData) {
        throw new Error("Session expired. Please try logging in again.")
      }

      const phone = authData.method === "phone" ? authData.phone : null
      const email = authData.method === "email" ? authData.email : null
      const purpose = authData.isSignUp ? "register" : "login"

      const response = await restaurantAPI.verifyOTP(phone, code, purpose, null, email)
      const data = response?.data?.data || response?.data

      const needsRegistration = data?.needsRegistration === true
      const normalizedPhone = data?.phone || phone

      if (data?.registrationToken) {
        sessionStorage.setItem("restaurant_registrationToken", data.registrationToken)
      }

      if (needsRegistration) {
        const displayPhone = String(normalizedPhone || phone || "")
          .replace(/\D/g, "")
          .slice(-10)
        setRestaurantPendingPhone(normalizedPhone || phone)
        sessionStorage.removeItem("restaurantAuthData")
        sessionStorage.removeItem("restaurantLoginPhone")
        const resumeStep = Number(data?.resumeStep)
        const onboardingPath =
          resumeStep >= 2 && resumeStep <= 4
            ? `/food/restaurant/onboarding?step=${resumeStep}`
            : "/food/restaurant/onboarding"
        navigate(onboardingPath, {
          replace: true,
          state: { verifiedPhone: displayPhone },
        })
        return
      }

      if (data?.isRejected === true) {
        setIsLoading(false)
        setRejectionModalData({
          isOpen: true,
          reason: data.rejectionReason || "Please update your details and re-apply.",
          phone: normalizedPhone,
        })
        return
      }

      const accessToken = data?.accessToken
      const refreshToken = data?.refreshToken ?? null
      const restaurant = data?.user ?? data?.restaurant

      if (accessToken && restaurant) {
        const sessionPhone = String(
          normalizedPhone || restaurant?.ownerPhone || restaurant?.primaryContactNumber || phone || "",
        )
          .replace(/\D/g, "")
          .slice(-10)
        if (sessionPhone) {
          setRestaurantPendingPhone(sessionPhone)
        }

        setRestaurantAuthData("restaurant", accessToken, restaurant, refreshToken)
        window.dispatchEvent(new Event("restaurantAuthChanged"))
        sessionStorage.removeItem("restaurantAuthData")
        sessionStorage.removeItem("restaurantLoginPhone")

        if (data?.isPendingApproval || isRestaurantInitialPendingApproval(restaurant)) {
          navigate("/food/restaurant/pending-verification", {
            replace: true,
            state: {
              phone:
                restaurant?.ownerPhone ||
                restaurant?.primaryContactNumber ||
                normalizedPhone ||
                phone ||
                "",
            },
          })
          return
        }

        setTimeout(async () => {
          if (authData?.isSignUp) {
            navigate("/food/restaurant/onboarding", { replace: true })
          } else {
            try {
              const onboardingComplete = isRestaurantOnboardingComplete(restaurant)
              if (!onboardingComplete) {
                const incompleteStep = await checkOnboardingStatus()
                if (incompleteStep) {
                  navigate(`/food/restaurant/onboarding?step=${incompleteStep}`, { replace: true })
                  return
                }
              }
              navigate("/food/restaurant", { replace: true })
            } catch (err) {
              navigate("/food/restaurant", { replace: true })
            }
          }
        }, 500)
      }
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Invalid OTP. Please try again."

      if (/pending approval/i.test(message)) {
        const pendingPhone = authData?.phone || authData?.email || contactInfo
        if (pendingPhone) {
          setRestaurantPendingPhone(pendingPhone)
        }
        sessionStorage.removeItem("restaurantAuthData")
        sessionStorage.removeItem("restaurantLoginPhone")
        navigate("/food/restaurant/pending-verification", {
          replace: true,
          state: { phone: pendingPhone || "" },
        })
        return
      }

      setError(message)
      setOtp(["", "", "", ""])
      hasSubmittedRef.current = false
      inputRefs.current[0]?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return

    setIsLoading(true)
    setError("")

    try {
      if (!authData) {
        throw new Error("Session expired. Please go back and try again.")
      }

      const purpose = authData.isSignUp ? "register" : "login"
      const phone = authData.method === "phone" ? authData.phone : null
      const email = authData.method === "email" ? authData.email : null

      await restaurantAPI.sendOTP(phone, purpose, email)
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to resend OTP. Please try again."
      setError(message)
    }

    setResendTimer(60)
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    setIsLoading(false)
    setOtp(["", "", "", ""])
    hasSubmittedRef.current = false
    inputRefs.current[0]?.focus()
  }

  const isOtpComplete = otp.every((digit) => digit !== "")

  if (!authData) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-800 lg:bg-white flex flex-col lg:flex-row pt-0 sm:pt-0 font-sans">
      {/* Top Banner section with Image Slider and Curve */}
      <div className="w-full lg:w-1/2 relative h-[350px] md:h-[450px] lg:h-screen flex flex-col items-center justify-center text-center text-white lg:shadow-2xl z-10">
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
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-transparent" />

        {/* Back Button */}
        <button 
          type="button"
          onClick={() => navigate("/food/restaurant/login")} 
          className="absolute top-6 left-6 z-20 p-2 bg-white/20 hover:bg-white/30 active:scale-95 rounded-full backdrop-blur-sm transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-white" strokeWidth={3} />
        </button>

        <div className="relative z-10 flex flex-col items-center mt-[-40px]">
          <div className="mb-4">
            <AuthCircleLogo src={logoUrl} alt={companyName} fallbackText={companyName} />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2 drop-shadow-lg text-white">
            {companyName}
          </h1>
          <p className="text-xs md:text-sm font-bold text-white/90 tracking-[0.2em] uppercase drop-shadow-md">
            Taste the best, forget the rest
          </p>
        </div>

        {/* Curved Bottom SVG (Hidden on Desktop) */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-10 lg:hidden">
          <svg
            className="relative block w-full h-[60px] md:h-[80px]"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1440 320"
            preserveAspectRatio="none"
          >
            <path
              fill="currentColor"
              className="text-slate-800"
              d="M0,192L48,202.7C96,213,192,235,288,229.3C384,224,480,192,576,192C672,192,768,224,864,213.3C960,203,1056,149,1152,133.3C1248,117,1344,139,1392,149.3L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            ></path>
          </svg>
        </div>
      </div>

      <div className="flex-1 bg-slate-800 lg:bg-white max-w-full w-full lg:w-1/2 relative z-20 flex flex-col items-center lg:justify-center">
        <div className="w-full max-w-[480px] px-6 py-4 flex flex-col justify-start sm:justify-center -mt-20 lg:mt-0">
          <div className="bg-white rounded-3xl p-6 sm:p-8 md:px-10 md:py-8 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.3)] lg:shadow-none lg:border-none border border-gray-50">


          <div className="text-center space-y-2 mb-6 sm:mb-10">
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-gray-900 tracking-wide">
              Verify OTP
            </h2>
            <div className="h-[2px] w-16 bg-[#0D315B] mx-auto rounded-full mt-2 mb-4" />
            <p className="text-gray-500 text-sm leading-relaxed px-4">
              We have sent a verification code to
            </p>
            <p className="text-[15px] font-bold text-[#0D315B] tracking-wide">
              {contactInfo}
            </p>
          </div>

          <div className="w-full max-w-[400px] flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-4 duration-500 lg:flex-none lg:gap-6">
            <div className="space-y-6">
              <div ref={otpSectionRef} className="flex justify-center gap-4">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={(e) => handlePaste(index, e)}
                    onFocus={() => setFocusedIndex(index)}
                    onBlur={() => setFocusedIndex(null)}
                    disabled={isLoading}
                    className={`shrink-0 w-12 h-14 sm:w-14 sm:h-16 bg-slate-50 border-2 rounded-2xl text-center text-2xl font-black text-slate-900 focus:outline-none transition-all duration-300 ${error
                        ? "border-red-500 bg-red-50"
                        : focusedIndex === index
                          ? "border-[#0D315B] ring-4 ring-[#0D315B]/10 shadow-lg bg-white"
                          : "border-slate-100"
                      }`}
                  />
                ))}
              </div>

              {error && (
                <p className="text-[#0D315B] text-xs font-bold text-center italic animate-pulse">
                  {error}
                </p>
              )}

              <div className="space-y-3">
                <Button
                  onClick={() => handleVerify()}
                  disabled={isLoading || !isOtpComplete}
                  className={`w-full h-14 sm:h-16 rounded-[32px] font-black text-base sm:text-lg tracking-widest uppercase shadow-lg transition-all duration-300 ${isOtpComplete && !isLoading
                      ? "bg-[#0D315B] hover:bg-[#E64D02] text-white shadow-[#0D315B]/20 transform active:scale-[0.98]"
                      : "border-2 border-slate-300 bg-white text-slate-600 shadow-sm cursor-not-allowed"
                    }`}
                >
                  {isLoading ? "Verifying..." : "Verify Code"}
                </Button>

                <div className="flex flex-col items-center gap-4">
                  {resendTimer > 0 ? (
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-black tracking-widest uppercase">
                      <Timer className="w-4 h-4 text-[#0D315B]" />
                      RESEND IN <span className="text-[#0D315B]">{resendTimer}S</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleResend}
                      disabled={isLoading}
                      className="flex items-center gap-2 text-[#0D315B] font-black text-xs tracking-widest uppercase hover:underline"
                    >
                      <RefreshCw className="w-4 h-4" />
                      RESEND CODE
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>

        <div className="py-3 text-center mt-auto pt-6 w-full absolute bottom-4 hidden lg:block">
          <p className="text-[10px] font-black text-slate-300 tracking-[0.2em] uppercase">
            SECURE VERIFICATION SYSTEM &bull; {companyName.toUpperCase()}
          </p>
        </div>
      </div>

      {rejectionModalData.isOpen && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 transform transition-all duration-300 animate-in zoom-in-95 duration-300 flex flex-col">
            {/* Top Red Gradient Banner */}
            <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-8 text-center text-white relative">
              <div className="w-16 h-16 bg-white/20 rounded-2xl mx-auto flex items-center justify-center backdrop-blur-sm mb-3">
                <X className="w-8 h-8 text-white stroke-[3px]" />
              </div>
              <h3 className="text-xl font-black tracking-tight uppercase">Application Rejected</h3>
              <p className="text-white/80 text-xs font-semibold mt-1">Our review team has rejected your onboarding request.</p>
            </div>

            {/* Reason content */}
            <div className="p-6 space-y-4 flex-1">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rejection Reason</span>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-700 text-sm font-medium italic relative overflow-hidden">
                  <span className="absolute -left-1 -top-2 text-7xl text-slate-200/50 pointer-events-none select-none font-serif">“</span>
                  <p className="relative z-10 leading-relaxed font-sans">{rejectionModalData.reason}</p>
                </div>
              </div>

              <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 flex gap-3">
                <div className="flex-1 text-xs text-amber-800 leading-relaxed font-medium">
                  <strong>Please note:</strong> Re-onboarding will clear your previous draft. You must fill out the form entirely from scratch.
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="px-6 pb-6 pt-2 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={async () => {
                  await clearOnboardingDraft()
                  sessionStorage.setItem("restaurantReonboard", "true")
                  if (rejectionModalData.phone) {
                    localStorage.setItem("restaurant_pendingPhone", rejectionModalData.phone);
                  }
                  setRejectionModalData({ isOpen: false, reason: "", phone: "" });
                  navigate("/food/restaurant/onboarding", { replace: true });
                }}
                className="w-full h-14 bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-700 hover:to-red-600 text-white rounded-2xl font-black text-sm tracking-widest uppercase shadow-lg shadow-red-500/20 active:scale-[0.98] transition-all"
              >
                Re-apply / Start Fresh
              </button>
              <button
                type="button"
                onClick={() => setRejectionModalData({ isOpen: false, reason: "", phone: "" })}
                className="w-full h-12 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-2xl font-bold text-sm tracking-wider transition-all"
              >
                Cancel / Go Back
              </button>
            </div>
          </div>
        </div>
      )}

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
      `}</style>
    </div>
  )
}
