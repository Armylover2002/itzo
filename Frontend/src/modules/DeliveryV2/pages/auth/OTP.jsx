import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2 } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Input } from "@food/components/ui/input"
import { Button } from "@food/components/ui/button"
import { deliveryAPI } from "@food/api"
import { setAuthData as storeAuthData } from "@food/utils/auth"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function DeliveryOTP() {
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
                const t = await window.flutter_inappwebview.callHandler(handlerName, { module: "delivery" });
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
        setPendingMessage(data.message || "Your account is pending admin verification. You will be notified once approved.")
        setIsRejected(data.isRejected || false)
        setRejectionReason(data.rejectionReason || "")
        return
      }

      const needsRegistration = data.needsRegistration === true

      if (needsRegistration) {
        // No DB record yet; redirect to registration details page WITHOUT creating anything in DB.
        const digits = String(phone || "").replace(/\D/g, "")
        const phoneKey = digits.slice(-10)

        // Try to restore previously saved onboarding data (phone-scoped localStorage first, then sessionStorage)
        let existingDetails = {}
        try {
          const localStored = localStorage.getItem(`deliverySignup_${phoneKey}_details`)
          const sessionStored = sessionStorage.getItem("deliverySignupDetails")
          const raw = localStored || sessionStored
          if (raw) {
            existingDetails = JSON.parse(raw)
          }
        } catch (e) {
          debugError("Error parsing existing signup details:", e)
        }

        sessionStorage.removeItem("deliveryAuthData")
        const details = {
          ...existingDetails,
          name: existingDetails.name || "",
          phone: phoneKey,
          countryCode: "+91",
        }
        // Persist to both localStorage (survives app restart) and sessionStorage (same-session compat)
        localStorage.setItem(`deliverySignup_${phoneKey}_details`, JSON.stringify(details))
        sessionStorage.setItem("deliverySignupDetails", JSON.stringify(details))
        localStorage.setItem(`deliverySignup_${phoneKey}_needsRegistration`, "true")
        sessionStorage.setItem("deliveryNeedsRegistration", "true")
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
    <AnimatedPage className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="relative flex items-center justify-center py-4 px-4 border-b border-gray-200">
        <button
          onClick={() => navigate("/food/delivery/login")}
          className="absolute left-4 top-1/2 -translate-y-1/2"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-black" />
        </button>
        <h1 className="text-lg font-bold text-black">OTP Verification</h1>
      </div>

      {/* Main Content */}
      <div className="flex flex-col justify-center px-6 pt-8 pb-12">
        <div className="max-w-md mx-auto w-full space-y-8">
          {/* Message */}
          <div className="text-center space-y-2">
            <p className="text-base text-black">
              {showNameInput
                ? "You're almost done! Please tell us your name to complete registration."
                : "We have sent a verification code to"}
            </p>
            {!showNameInput && (
              <p className="text-base text-black font-medium">
                {getPhoneNumber()}
              </p>
            )}
          </div>

          {/* Pending approval message – already registered, waiting for admin */}
          {pendingMessage && (
            <div className={`rounded-xl border p-5 text-center space-y-4 shadow-sm ${isRejected ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"}`}>
              <div className="space-y-2">
                <p className={`text-sm font-semibold ${isRejected ? "text-red-800" : "text-amber-800"}`}>
                  {isRejected ? "Application Rejected" : "Pending Verification"}
                </p>
                <p className={`text-sm leading-relaxed ${isRejected ? "text-red-700" : "text-amber-700"}`}>
                  {pendingMessage}
                </p>
                {isRejected && rejectionReason && (
                  <div className="mt-2 p-3 bg-white/50 rounded-lg border border-red-200">
                    <p className="text-xs font-medium text-red-600 uppercase tracking-wider mb-1">Reason</p>
                    <p className="text-sm text-red-800 italic">"{rejectionReason}"</p>
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
                      const phoneKey = digits.slice(-10)

                      // Try to restore previously saved onboarding data for this phone
                      let existingDetails = {}
                      try {
                        const localStored = localStorage.getItem(`deliverySignup_${phoneKey}_details`)
                        if (localStored) existingDetails = JSON.parse(localStored)
                      } catch (_) {}

                      const details = {
                        ...existingDetails,
                        name: existingDetails.name || "",
                        phone: phoneKey,
                        countryCode: "+91",
                      }
                      localStorage.setItem(`deliverySignup_${phoneKey}_details`, JSON.stringify(details))
                      sessionStorage.setItem("deliverySignupDetails", JSON.stringify(details))
                      localStorage.setItem(`deliverySignup_${phoneKey}_needsRegistration`, "true")
                      sessionStorage.setItem("deliveryNeedsRegistration", "true")
                      navigate("/food/delivery/signup/details", { replace: true })
                    }}
                    className="w-full py-3 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 shadow-md transition-all active:scale-95"
                  >
                    Re-apply Now
                  </button>
                ) : null}
                
                <button
                  type="button"
                  onClick={() => navigate("/food/delivery/login", { replace: true })}
                  className={`text-sm font-medium underline transition-colors ${isRejected ? "text-red-600 hover:text-red-800" : "text-amber-700 hover:text-amber-900"}`}
                >
                  Back to login
                </button>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-500 text-center">
              {error}
            </p>
          )}

          {/* OTP Input Fields */}
          {!showNameInput && !pendingMessage && (
            <>
              <div className="flex justify-center gap-2">
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
                    className="w-12 h-12 text-center text-lg font-semibold p-0 border border-black rounded-md focus-visible:ring-0 focus-visible:border-black bg-white"
                  />
                ))}
              </div>

              {/* Resend Section */}
              <div className="text-center space-y-1">
                <p className="text-sm text-black">
                  Didn't get the OTP?
                </p>
                {resendTimer > 0 ? (
                  <p className="text-sm text-gray-500">
                    Resend SMS in {resendTimer}s
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isLoading}
                    className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  >
                    Resend SMS
                  </button>
                )}
              </div>
            </>
          )}

          {/* Name Input (shown only after OTP verified and user is new) */}
          {showNameInput && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-black text-left">
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
                  placeholder="Enter your name"
                  className={`h-11 border ${nameError ? "border-red-500" : "border-gray-300"
                    }`}
                />
                {nameError && (
                  <p className="text-xs text-red-500 text-left">
                    {nameError}
                  </p>
                )}
              </div>

              <Button
                onClick={handleSubmitName}
                disabled={isLoading}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                {isLoading ? "Continuing..." : "Continue"}
              </Button>
            </div>
          )}

          {/* Loading Spinner */}
          {isLoading && !showNameInput && (
            <div className="flex justify-center pt-4">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
          )}
        </div>
      </div>

    </AnimatedPage>
  )
}

