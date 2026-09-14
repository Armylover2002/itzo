import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, X, Smartphone } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Input } from "@food/components/ui/input"
import { Button } from "@food/components/ui/button"
import { deliveryAPI } from "@food/api"
import { setAuthData as storeAuthData } from "@food/utils/auth"
import { useCompanyName } from "@food/hooks/useCompanyName"
import AuthCircleLogo from "@shared/components/AuthCircleLogo"
import {
  getCachedSettings,
  subscribeBusinessSettings,
  getAppFavicon,
  updateFavicon,
  getAppLogo,
} from "@common/utils/businessSettings"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function DeliveryOTP() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const [otp, setOtp] = useState(["", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [authData, setAuthData] = useState(null)
  const [showNameInput, setShowNameInput] = useState(false)
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState("")
  const [verifiedOtp, setVerifiedOtp] = useState("")
  const [pendingMessage, setPendingMessage] = useState("")
  const [isRejected, setIsRejected] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [deviceToken, setDeviceToken] = useState(null)
  const [activePlatform, setActivePlatform] = useState("web")
  const inputRefs = useRef([])

  const [logoUrl, setLogoUrl] = useState(() => getAppLogo('delivery'))
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

  useEffect(() => {
    // Get auth data from sessionStorage (delivery module key)
    const stored = sessionStorage.getItem("deliveryAuthData")
    if (stored) {
      const data = JSON.parse(stored)
      setAuthData(data)
    } else {
      // No active OTP flow: if already authenticated, go to delivery home
      const token = localStorage.getItem("delivery_accessToken")
      const authenticated = localStorage.getItem("delivery_authenticated") === "true"
      if (token && authenticated) {
        try {
          const parts = token.split('.')
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
            const now = Math.floor(Date.now() / 1000)
            if (payload.exp && payload.exp > now) {
              navigate("/food/delivery", { replace: true })
              return
            }
          }
        } catch (e) {
          // Ignore token parse errors and continue to sign-in redirect
        }
      }

      // No auth data, redirect to sign in
      navigate("/food/delivery/login", { replace: true })
      return
    }

    // OTP field should be empty - delivery boy needs to enter it manually
    // No auto-fill for delivery OTP

    // Start resend timer (60 seconds)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Don't auto-focus - let user manually enter OTP
    // Focus first input only if all fields are empty (small delay to ensure inputs are rendered)
    if (inputRefs.current[0] && otp.every(digit => digit === "")) {
      setTimeout(() => {
        inputRefs.current[0]?.focus()
      }, 100)
    }
  }, [otp])

  const handleChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) {
      return
    }

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setError("")

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 4 digits are entered and we are in OTP step
    if (!showNameInput && newOtp.every((digit) => digit !== "") && newOtp.length === 4) {
      handleVerify(newOtp.join(""))
    }
  }

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === "Backspace") {
      if (otp[index]) {
        // If current input has value, clear it
        const newOtp = [...otp]
        newOtp[index] = ""
        setOtp(newOtp)
      } else if (index > 0) {
        // If current input is empty, move to previous and clear it
        inputRefs.current[index - 1]?.focus()
        const newOtp = [...otp]
        newOtp[index - 1] = ""
        setOtp(newOtp)
      }
    }
    // Handle paste
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

  const handlePaste = (e) => {
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
    if (!showNameInput && digits.length === 4) {
      handleVerify(newOtp.join(""))
      return
    }
    inputRefs.current[digits.length]?.focus()
  }

  const handleVerify = async (otpValue = null) => {
    if (showNameInput) {
      // In name collection step, ignore OTP auto-submit
      return
    }

    const code = otpValue || otp.join("")

    if (code.length !== 4) {
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const phone = authData?.phone
      const purpose = authData?.purpose || "login"
      const providedName = authData?.isSignUp ? authData?.name || null : null
      if (!phone) {
        setError("Phone number not found. Please try again.")
        setIsLoading(false)
        return
      }

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
                  window.flutter_inappwebview.callHandler(handlerName, { module: "delivery" }),
                  new Promise((resolve) => setTimeout(() => resolve(null), 800))
                ]);
                if (t && typeof t === "string" && t.length > 20) {
                  fcmToken = t.trim();
                  break;
                }
              } catch (e) {}
            }
          } else {
            fcmToken = localStorage.getItem("fcm_web_registered_token_delivery") || null;
          }
        }
      } catch (e) {
        debugWarn("Failed to get FCM token during login", e);
      }

      setDeviceToken(fcmToken);
      setActivePlatform(platform);

      // Backend: POST /auth/delivery/verify-otp returns either:
      // - { needsRegistration: true } when no partner exists yet
      // - or { accessToken, refreshToken, user } for existing partners
      const response = await deliveryAPI.verifyOTP(phone, code, purpose, providedName, fcmToken, platform)
      debugLog("Delivery OTP Response:", response)
      const data = response?.data?.data || response?.data || {}
      debugLog("Parsed Delivery OTP Data:", data)

      if (data.pendingApproval === true) {
        sessionStorage.removeItem("deliveryAuthData")
        setIsLoading(false)
        setError("")
        setPendingMessage(data.message || "Your onboarding request is under review. Your documents are currently being verified. You will receive approval once reviewed by admin.")
        setIsRejected(data.isRejected || false)
        setRejectionReason(data.rejectionReason || "")

        if (data.isRejected) {
          const rejectionContext = {
            rejectionReason: data.rejectionReason || "",
            rejectedAt: data.rejectedAt || null,
            rejectedBy: data.rejectedBy || null,
            partnerId: data.partnerId || null,
            phone: data.phone || phone,
            latestSubmissionId: data.latestSubmissionId || null,
            rejectedSubmission: data.rejectedSubmission || null,
          }
          sessionStorage.setItem(
            "deliveryRejectionContext",
            JSON.stringify(rejectionContext)
          )
          navigate("/food/delivery/onboarding/rejected", {
            replace: true,
            state: { rejection: rejectionContext },
          })
        } else {
          // Pending (not rejected): dedicated verification screen — no JWT.
          const digits = String(phone || "").replace(/\D/g, "").slice(-10)
          if (digits) {
            sessionStorage.setItem("deliveryPendingPhone", digits)
          }
          navigate("/food/delivery/verification", {
            replace: true,
            state: {
              phone: digits || phone,
              message: data.message || "",
            },
          })
        }
        return
      }

      const needsRegistration = data.needsRegistration === true

      if (needsRegistration) {
        // No DB record yet; redirect to registration details page WITHOUT creating anything in DB.
        const existingDetailsRaw = sessionStorage.getItem("deliverySignupDetails")
        let existingDetails = {}
        try {
          if (existingDetailsRaw) {
            existingDetails = JSON.parse(existingDetailsRaw)
          }
        } catch (e) {
          debugError("Error parsing existing signup details:", e)
        }

        sessionStorage.removeItem("deliveryAuthData")
        sessionStorage.setItem("deliveryNeedsRegistration", "true")
        const digits = String(phone || "").replace(/\D/g, "")
        const details = {
          ...existingDetails,
          name: existingDetails.name || "",
          phone: digits.slice(-10),
          countryCode: "+91",
        }
        sessionStorage.setItem("deliverySignupDetails", JSON.stringify(details))
        setIsLoading(false)
        navigate("/food/delivery/signup/details", { replace: true })
        return
      }

      const accessToken = data.accessToken
      const refreshToken = data.refreshToken || null
      const user = data.user

      if (!accessToken || !user) {
        throw new Error("Invalid response from server")
      }

      sessionStorage.removeItem("deliveryAuthData")

      try {
        debugLog("Storing auth data for delivery:", { hasToken: !!accessToken, hasUser: !!user })
        storeAuthData("delivery", accessToken, user, refreshToken)
        debugLog("Auth data stored successfully")
      } catch (storageError) {
        debugError("Failed to store authentication data:", storageError)
        setError("Failed to save authentication. Please try again or clear your browser storage.")
        setIsLoading(false)
        return
      }

      window.dispatchEvent(new Event("deliveryAuthChanged"))

      setSuccess(true)
      setIsLoading(false)

      let retryCount = 0
      const maxRetries = 10
      const verifyAndNavigate = () => {
        const storedToken = localStorage.getItem("delivery_accessToken")
        const storedAuth = localStorage.getItem("delivery_authenticated")

        if (storedToken && storedAuth === "true") {
          navigate("/food/delivery", { replace: true })
        } else if (retryCount < maxRetries) {
          retryCount++
          setTimeout(verifyAndNavigate, 100)
        } else {
          setError("Failed to save authentication. Please try again.")
          setIsLoading(false)
        }
      }
      setTimeout(verifyAndNavigate, 200)
    } catch (err) {
      debugError("OTP Verification Error:", err)
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to verify OTP. Please try again."
      setError(message)
      setIsLoading(false)
    }
  }

  const handleSubmitName = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError("Name is required")
      return
    }

    if (!verifiedOtp) {
      setError("OTP verification step missing. Please request a new OTP.")
      return
    }

    setIsLoading(true)
    setError("")
    setNameError("")

    try {
      const phone = authData?.phone
      const purpose = authData?.purpose || "login"
      if (!phone) {
        setError("Phone number not found. Please try again.")
        return
      }

      // Second call with name to auto-register and login
      const response = await deliveryAPI.verifyOTP(phone, verifiedOtp, purpose, trimmedName, deviceToken, activePlatform)
      const data = response?.data?.data || response?.data || {}

      const accessToken = data.accessToken
      const refreshToken = data.refreshToken || null
      const user = data.user

      if (!accessToken || !user) {
        throw new Error("Invalid response from server")
      }

      // Clear auth data from sessionStorage
      sessionStorage.removeItem("deliveryAuthData")

      // Store auth data using utility function to ensure proper role handling
      // The setAuthData function includes error handling and verification
      try {
        debugLog("Storing auth data for delivery (with name):", { hasToken: !!accessToken, hasUser: !!user })
        storeAuthData("delivery", accessToken, user, refreshToken)
        debugLog("Auth data stored successfully")
      } catch (storageError) {
        debugError("Failed to store authentication data:", storageError)
        setError("Failed to save authentication. Please try again or clear your browser storage.")
        setIsLoading(false)
        return
      }

      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new Event("deliveryAuthChanged"))

      setSuccess(true)
      setIsLoading(false)

      // Verify token is stored and then navigate
      let retryCount = 0
      const maxRetries = 10
      const verifyAndNavigate = () => {
        const storedToken = localStorage.getItem("delivery_accessToken")
        const storedAuth = localStorage.getItem("delivery_authenticated")

        debugLog("Verifying token storage (with name):", { hasToken: !!storedToken, authenticated: storedAuth, retryCount })

        if (storedToken && storedAuth === "true") {
          // Token is stored, navigate to delivery home
          debugLog("Token verified, navigating to /delivery")
          navigate("/food/delivery", { replace: true })
        } else if (retryCount < maxRetries) {
          // Token not stored yet, retry after short delay
          retryCount++
          setTimeout(verifyAndNavigate, 100)
        } else {
          // Max retries reached, show error
          debugError("Token storage verification failed after max retries")
          setError("Failed to save authentication. Please try again.")
          setIsLoading(false)
        }
      }

      // Start verification after a small delay
      setTimeout(verifyAndNavigate, 200)
    } catch (err) {
      debugError("Name Submission Error:", err)
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to complete registration. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return

    setIsLoading(true)
    setError("")

    try {
      const phone = authData?.phone
      const purpose = authData?.purpose || "login"
      if (!phone) {
        setError("Phone number not found. Please go back and try again.")
        return
      }

      // Call backend to resend OTP
      await deliveryAPI.sendOTP(phone, purpose)
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to resend OTP. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
    }

    // Reset timer to 60 seconds
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

    setOtp(["", "", "", ""])
    setShowNameInput(false)
    setName("")
    setNameError("")
    setVerifiedOtp("")
    inputRefs.current[0]?.focus()
  }

  const getPhoneNumber = () => {
    if (!authData) return ""
    if (authData.method === "phone") {
      // Format phone number as +91-9098569620
      const phone = authData.phone || ""
      // Remove spaces and format
      const cleaned = phone.replace(/\s/g, "")
      // Add hyphen after country code if not present
      if (cleaned.startsWith("+91") && cleaned.length > 3) {
        return cleaned.slice(0, 3) + "-" + cleaned.slice(3)
      }
      return cleaned
    }
    return authData.email || ""
  }

  if (!authData) {
    return null
  }

  return (
    <>
      <AnimatedPage className="min-h-screen bg-white flex flex-col lg:flex-row font-sans relative overflow-hidden">
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

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-black/40 z-0"></div>

          {/* Curved Bottom Overlay (SVG) */}
          <div className="absolute bottom-0 w-full leading-none z-10 translate-y-[1px] lg:hidden">
            <svg viewBox="0 0 1440 200" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-16 md:h-24">
              <path d="M0,200 L1440,200 L1440,0 C1100,150 340,150 0,0 Z" fill="white" />
            </svg>
          </div>

          {/* Back Button */}
          <button 
            onClick={() => navigate("/food/delivery/login")}
            className="absolute top-6 left-6 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md z-20"
          >
            <ArrowLeft className="w-5 h-5 text-[#d80000]" />
          </button>

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

        {/* Main Content */}
        <div className="flex-1 lg:flex-1 lg:w-1/2 px-4 relative z-20 pb-8 flex lg:flex-col justify-center lg:items-center -mt-8 md:-mt-12 lg:mt-0">
          <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] lg:shadow-none lg:border-none p-6 md:p-8 w-full max-w-[420px] border border-gray-50 h-fit">
            
            {/* Header Icon & Message */}
            <div className="flex flex-col items-center text-center space-y-4 mb-8">
              <div className="w-16 h-16 bg-[#fdf4f4] rounded-full flex items-center justify-center mb-2 shadow-sm">
                <Smartphone className="w-8 h-8 text-[#d80000]" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-[22px] font-bold text-[#1a1a1a] mb-2 leading-tight">
                  Verify your number
                </h2>
                <p className="text-[14px] text-gray-500 leading-relaxed px-4">
                  {showNameInput
                    ? "You're almost done! Please tell us your name to complete registration."
                    : "We have sent a verification code to"}
                </p>
                {!showNameInput && (
                  <p className="text-[15px] font-bold text-[#d80000] mt-1 tracking-wide">
                    {getPhoneNumber()}
                  </p>
                )}
              </div>
            </div>

            {/* Pending approval message – already registered, waiting for admin */}
            {!isRejected && pendingMessage && (
              <div className={`rounded-2xl border p-5 text-center space-y-4 shadow-sm bg-amber-50 border-amber-100 mb-6`}>
                <div className="space-y-2">
                  <p className={`text-[15px] font-bold ${isRejected ? "text-red-800" : "text-amber-800"}`}>
                    {isRejected ? "Application Rejected" : "Pending Verification"}
                  </p>
                  <p className={`text-[13px] leading-relaxed font-medium ${isRejected ? "text-red-700" : "text-amber-700"}`}>
                    {pendingMessage}
                  </p>
                  {isRejected && rejectionReason && (
                    <div className="mt-3 p-3 bg-white/60 rounded-xl border border-red-200">
                      <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1">Reason</p>
                      <p className="text-[13px] text-red-800 font-medium italic">"{rejectionReason}"</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  {isRejected ? (
                    <button
                      type="button"
                      onClick={() => {
                        const phone = authData?.phone
                        const digits = String(phone || "").replace(/\D/g, "")
                        sessionStorage.setItem("deliveryNeedsRegistration", "true")
                        sessionStorage.setItem("deliveryIsRejected", "true")
                        const details = {
                          name: "",
                          phone: digits.slice(-10),
                          countryCode: "+91",
                        }
                        sessionStorage.setItem("deliverySignupDetails", JSON.stringify(details))
                        navigate("/food/delivery/signup/details", { replace: true })
                      }}
                      className="w-full h-12 bg-[#d80000] text-white rounded-xl font-bold text-[14px] hover:bg-red-700 shadow-lg shadow-red-200/50 transition-all active:scale-[0.98]"
                    >
                      Re-apply Now
                    </button>
                  ) : null}
                  
                  <button
                    type="button"
                    onClick={() => navigate("/food/delivery/login", { replace: true })}
                    className={`text-[13px] font-bold transition-colors ${isRejected ? "text-red-600 hover:text-red-800" : "text-amber-700 hover:text-amber-900"}`}
                  >
                    Back to login
                  </button>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="bg-red-50 text-red-600 text-[13px] font-medium p-3 rounded-xl text-center mb-6 border border-red-100 shadow-sm">
                {error}
              </div>
            )}

            {/* OTP Input Fields */}
            {!showNameInput && !pendingMessage && (
              <>
                <div className="flex justify-center gap-3 md:gap-4 mb-8">
                  {otp.map((digit, index) => (
                    <Input
                      key={index}
                      ref={(el) => (inputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={index === 0 ? handlePaste : undefined}
                      disabled={isLoading}
                      autoComplete="off"
                      autoFocus={false}
                      className="w-14 h-14 md:w-16 md:h-16 text-center text-2xl font-bold p-0 border border-gray-200 rounded-xl focus:border-[#d80000] focus:ring-1 focus:ring-[#d80000] focus:bg-white transition-all bg-gray-50 shadow-inner text-[#1a1a1a]"
                    />
                  ))}
                </div>

                {/* Resend Section */}
                <div className="flex flex-col items-center justify-center space-y-2 mt-4">
                  <p className="text-[13px] text-gray-500 font-medium">
                    Didn't receive the code?
                  </p>
                  {resendTimer > 0 ? (
                    <p className="text-[14px] font-bold text-gray-400">
                      Resend SMS in <span className="text-[#d80000]">{resendTimer}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={isLoading}
                      className="text-[14px] font-bold text-[#d80000] hover:text-red-700 disabled:opacity-50 transition-colors"
                    >
                      Resend SMS Now
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Name Input (shown only after OTP verified and user is new) */}
            {showNameInput && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-[13px] font-bold text-gray-700 text-left ml-1">
                    Full name
                  </label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (nameError) setNameError("")
                    }}
                    disabled={isLoading}
                    placeholder="Enter your full name"
                    className={`h-14 border rounded-xl bg-gray-50 text-[15px] px-4 font-medium focus:bg-white transition-all ${
                      nameError ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-gray-200 focus:border-[#d80000] focus:ring-[#d80000]"
                    }`}
                  />
                  {nameError && (
                    <p className="text-[12px] text-red-500 font-medium ml-1">
                      {nameError}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleSubmitName}
                  disabled={isLoading}
                  className="w-full h-14 bg-[#d80000] hover:bg-red-700 active:scale-[0.98] text-white rounded-xl font-bold text-[16px] shadow-lg shadow-red-200/50 transition-all flex items-center justify-center"
                >
                  {isLoading ? "Continuing..." : "Continue"}
                </button>
              </div>
            )}

            {/* Loading Spinner */}
            {isLoading && !showNameInput && (
              <div className="flex justify-center pt-6">
                <Loader2 className="h-8 w-8 text-[#d80000] animate-spin" />
              </div>
            )}
          </div>
        </div>
      </AnimatedPage>

      {isRejected && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 transform transition-all duration-300 animate-in zoom-in-95 duration-300 flex flex-col font-sans">
            {/* Top Red Gradient Banner */}
            <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-8 text-center text-white relative">
              <div className="w-16 h-16 bg-white/20 rounded-2xl mx-auto flex items-center justify-center backdrop-blur-sm mb-3">
                <X className="w-8 h-8 text-white stroke-[3px]" />
              </div>
              <h3 className="text-xl font-black tracking-tight uppercase">Application Rejected</h3>
              <p className="text-white/80 text-xs font-semibold mt-1">Our review team has rejected your delivery partner request.</p>
            </div>
            
            {/* Reason content */}
            <div className="p-6 space-y-4 flex-1">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rejection Reason</span>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-700 text-sm font-medium italic relative overflow-hidden">
                  <span className="absolute -left-1 -top-2 text-7xl text-slate-200/50 pointer-events-none select-none font-serif">“</span>
                  <p className="relative z-10 leading-relaxed font-sans">{rejectionReason}</p>
                </div>
              </div>
              
              <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 flex gap-3">
                <div className="flex-1 text-xs text-amber-800 leading-relaxed font-medium">
                  <strong>Please note:</strong> Re-onboarding will clear your previous details and documents. You must fill out the form entirely from scratch.
                </div>
              </div>
            </div>
            
            {/* Buttons */}
            <div className="px-6 pb-6 pt-2 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const phone = authData?.phone;
                  const digits = String(phone || "").replace(/\D/g, "");
                  sessionStorage.setItem("deliveryNeedsRegistration", "true");
                  sessionStorage.setItem("deliveryIsRejected", "true");
                  const details = {
                    name: "",
                    phone: digits.slice(-10),
                    countryCode: "+91",
                  };
                  sessionStorage.setItem("deliverySignupDetails", JSON.stringify(details));
                  try {
                    // Clear IndexedDB for fresh documents
                    indexedDB.deleteDatabase("DeliverySignupDB");
                  } catch (e) {
                    console.error("Failed to delete IndexedDB:", e);
                  }
                  setIsRejected(false);
                  setPendingMessage("");
                  navigate("/food/delivery/signup/details", { replace: true });
                }}
                className="w-full h-14 bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-700 hover:to-red-600 text-white rounded-2xl font-black text-sm tracking-widest uppercase shadow-lg shadow-red-500/20 active:scale-[0.98] transition-all"
              >
                Re-apply / Start Fresh
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRejected(false);
                  setPendingMessage("");
                  navigate("/food/delivery/login", { replace: true });
                }}
                className="w-full h-12 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-2xl font-bold text-sm tracking-wider transition-all"
              >
                Cancel / Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

