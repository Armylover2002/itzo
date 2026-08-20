import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, ShieldCheck, Timer, RefreshCw } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { restaurantAPI } from "@food/api"
import {
  setAuthData as setRestaurantAuthData,
  setRestaurantPendingPhone,
} from "@food/utils/auth"
import { checkOnboardingStatus, isRestaurantOnboardingComplete } from "@food/utils/onboardingUtils"
import { useCompanyName } from "@food/hooks/useCompanyName"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

export default function RestaurantOTP() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const [otp, setOtp] = useState(["", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [resendTimer, setResendTimer] = useState(0)
  const [authData, setAuthData] = useState(null)
  const [contactInfo, setContactInfo] = useState("") 
  const [focusedIndex, setFocusedIndex] = useState(null)
  const [pendingMessage, setPendingMessage] = useState("")
  const [isRejected, setIsRejected] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const inputRefs = useRef([])
  const hasSubmittedRef = useRef(false)
  const otpSectionRef = useRef(null)

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
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [])

  // iOS keyboard fix: prevent viewport bounce by NOT using scrollIntoView or
  // tracking visualViewport resize. iOS Safari/WebView natively scrolls focused
  // inputs into view; fighting it with JS causes the "floating screen" bounce.
  // We simply let the browser handle scroll positioning.

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
      if (!hasSubmittedRef.current) {
        hasSubmittedRef.current = true
        handleVerify(newOtp.join(""))
      }
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
    const code = otpValue || otp.join("")

    if (hasSubmittedRef.current && !otpValue) {
      return
    }

    if (code.length !== 4) {
      setError("Please enter the complete 4-digit code")
      hasSubmittedRef.current = false
      return
    }

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

      if (data?.pendingApproval === true) {
        setIsRejected(data.isRejected || false)
        setRejectionReason(data.rejectionReason || "")
        setPendingMessage(data.message || "")
        
        if (!data.isRejected) {
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
        }
        setIsLoading(false)
        return
      }

      const needsRegistration = data?.needsRegistration === true
      const normalizedPhone = data?.phone || phone

      if (needsRegistration) {
        setRestaurantPendingPhone(normalizedPhone)
        sessionStorage.removeItem("restaurantAuthData")
        sessionStorage.removeItem("restaurantLoginPhone")
        navigate("/food/restaurant/onboarding", { replace: true })
        return
      }

      const accessToken = data?.accessToken
      const refreshToken = data?.refreshToken ?? null
      const restaurant = data?.user ?? data?.restaurant

      if (accessToken && restaurant) {
        setRestaurantAuthData("restaurant", accessToken, restaurant, refreshToken)
        window.dispatchEvent(new Event("restaurantAuthChanged"))
        sessionStorage.removeItem("restaurantAuthData")
        sessionStorage.removeItem("restaurantLoginPhone")

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
    inputRefs.current[0]?.focus()
  }

  const isOtpComplete = otp.every((digit) => digit !== "")

  if (!authData) {
    return null
  }

  return (
    <div
      className="h-[100dvh] bg-white flex flex-col font-sans overflow-y-auto overflow-x-hidden"
    >
      {/* Curved Header Background */}
      <div className="relative h-[240px] sm:h-[300px] w-full bg-[#FE5502] overflow-hidden">
        {/* Abstract Circles like in the image */}
        <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute top-20 -right-10 w-64 h-64 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-white/5" />
        
        {/* The dominant curve */}
        <div className="absolute bottom-0 w-full h-[100px] bg-white rounded-t-[100px] shadow-[0_-20px_40px_rgba(0,0,0,0.05)]" />
        
        {/* Back Button */}
        <button
          onClick={() => navigate("/food/restaurant/login")}
          className="absolute top-10 sm:top-12 left-6 sm:left-8 p-2.5 sm:p-3 bg-white shadow-xl rounded-full text-[#FE5502] hover:scale-110 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center px-4 sm:px-8 -mt-12 sm:-mt-16 z-10 overflow-hidden">
        {/* Central Logo / Branding */}
        <div className="w-28 h-28 sm:w-32 sm:h-32 bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-slate-50 mb-4 sm:mb-6 overflow-hidden">
          <div className="text-center">
             <div className="w-16 h-16 bg-[#FE5502] rounded-2xl mx-auto flex items-center justify-center transform rotate-12 shadow-lg mb-1">
                <ShieldCheck className="w-8 h-8 text-white -rotate-12" />
             </div>
          </div>
        </div>

        <div className="text-center space-y-1.5 sm:space-y-2 mb-6 sm:mb-10">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight lowercase">
            verify otp
          </h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-relaxed">
            Sent to <span className="text-[#FE5502] font-black">{contactInfo}</span>
          </p>
        </div>

        <div className="w-full max-w-[400px] flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-4 duration-500">
          {isRejected ? (
            <div className="space-y-6">
              <div className="rounded-3xl border p-6 text-center shadow-2xl bg-red-50 border-red-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />
                <div className="space-y-3 relative z-10">
                  <p className="text-xl font-black text-red-600 tracking-tight uppercase">
                    Application Rejected
                  </p>
                  <p className="text-sm font-semibold leading-relaxed text-red-800/80">
                    {pendingMessage}
                  </p>
                  {rejectionReason && (
                    <div className="mt-4 p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-red-100 shadow-sm text-left">
                      <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1.5">Reason provided by admin</p>
                      <p className="text-sm font-bold text-red-900 leading-relaxed">"{rejectionReason}"</p>
                    </div>
                  )}
                </div>
                <div className="mt-8 flex flex-col gap-3 relative z-10">
                  <Button
                    onClick={() => {
                      const pendingPhone = authData?.phone || authData?.email || contactInfo
                      setRestaurantPendingPhone(pendingPhone)
                      sessionStorage.removeItem("restaurantAuthData")
                      sessionStorage.removeItem("restaurantLoginPhone")
                      navigate("/food/restaurant/onboarding", { replace: true })
                    }}
                    className="w-full h-14 rounded-full bg-red-600 hover:bg-red-700 text-white font-black text-sm tracking-widest uppercase shadow-lg shadow-red-600/20 transition-all active:scale-[0.98]"
                  >
                    Re-Onboard Now
                  </Button>
                  <button
                    onClick={() => navigate("/food/restaurant/login", { replace: true })}
                    className="text-[11px] mt-2 font-black tracking-widest uppercase text-red-600/70 hover:text-red-800 transition-colors"
                  >
                    Back to login
                  </button>
                </div>
              </div>
            </div>
          ) : (
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
                  className={`w-12 h-14 sm:w-14 sm:h-16 bg-slate-50 border-2 rounded-2xl text-center text-2xl font-black text-slate-900 focus:outline-none transition-all duration-300 ${
                    error 
                      ? "border-red-500 bg-red-50" 
                      : focusedIndex === index 
                        ? "border-[#FE5502] ring-4 ring-[#FE5502]/10 shadow-lg bg-white" 
                        : "border-slate-100"
                  }`}
                />
              ))}
            </div>

            {error && (
              <p className="text-[#FE5502] text-xs font-bold text-center italic animate-pulse">
                {error}
              </p>
            )}

            <div className="space-y-3">
              <Button
                onClick={() => handleVerify()}
                disabled={isLoading || !isOtpComplete}
                className={`w-full h-14 sm:h-16 rounded-[32px] font-black text-base sm:text-lg tracking-widest uppercase shadow-lg transition-all duration-300 ${
                  isOtpComplete && !isLoading
                    ? "bg-[#FE5502] hover:bg-[#E64D02] text-white shadow-[#FE5502]/20 transform active:scale-[0.98]"
                    : "bg-slate-100 text-slate-300 cursor-not-allowed"
                }`}
              >
                {isLoading ? "Verifying..." : "Verify Code"}
              </Button>

              <div className="flex flex-col items-center gap-4">
                {resendTimer > 0 ? (
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-black tracking-widest uppercase">
                    <Timer className="w-4 h-4 text-[#FE5502]" />
                    RESEND IN <span className="text-[#FE5502]">{resendTimer}S</span>
                  </div>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={isLoading}
                    className="flex items-center gap-2 text-[#FE5502] font-black text-xs tracking-widest uppercase hover:underline"
                  >
                    <RefreshCw className="w-4 h-4" />
                    RESEND CODE
                  </button>
                )}
              </div>
            </div>
          </div>
          )}
        </div>
      </div>

      <div className="py-3 text-center">
          <p className="text-[10px] font-black text-slate-300 tracking-[0.2em] uppercase">
            SECURE VERIFICATION SYSTEM &bull; {companyName.toUpperCase()}
          </p>
      </div>
    </div>
  )
}
