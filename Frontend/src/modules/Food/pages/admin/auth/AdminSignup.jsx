import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { getCachedSettings, getAppLogo, subscribeBusinessSettings } from "@common/utils/businessSettings"
import { Button } from "@food/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@food/components/ui/card"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
import { Mail, User, Lock, Eye, EyeOff, ArrowLeft, Shield } from "lucide-react"

import { authAPI, adminAPI } from "@food/api"
import { setAuthData } from "@food/utils/auth"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function AdminSignup() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: signup form, 2: OTP verification
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [resendTimer, setResendTimer] = useState(0)
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo('admin'))
  const [companyName, setCompanyName] = useState(() => getCachedSettings()?.companyName || null)
  const inputRefs = useRef(Array(6).fill(null).map(() => null))

  // Apply business settings logo from cache
  useEffect(() => {
    const apply = (settings) => {
      const adminLogo = getAppLogo('admin')
      if (adminLogo) setLogoUrl(adminLogo)
      if (settings?.companyName) setCompanyName(settings.companyName)
    }
    apply(getCachedSettings())
    return subscribeBusinessSettings(apply)
  }, [])

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setError("")

    // Validation
    if (!formData.name.trim()) {
      setError("Name is required")
      return
    }

    if (!formData.email.trim()) {
      setError("Email is required")
      return
    }

    if (!formData.password) {
      setError("Password is required")
      return
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long")
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)
    try {
      // Send OTP for registration
      await authAPI.sendOTP(null, "register", formData.email)
      setStep(2)
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
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to send verification code. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text")
    const digits = pastedData.replace(/\D/g, "").slice(0, 6).split("")
    const newOtp = [...otp]
    digits.forEach((digit, i) => {
      if (i < 6) {
        newOtp[i] = digit
      }
    })
    setOtp(newOtp)
    if (digits.length === 6) {
      inputRefs.current[5]?.focus()
    } else {
      inputRefs.current[digits.length]?.focus()
    }
  }

  const handleOtpSubmit = async (e) => {
    e.preventDefault()
    setError("")

    const otpCode = otp.join("")
    if (otpCode.length !== 6) {
      setError("Please enter the complete OTP")
      return
    }

    setIsLoading(true)
    try {
      // Use admin-specific signup endpoint with OTP
      const response = await adminAPI.signupWithOTP(
        formData.name,
        formData.email,
        formData.password,
        otpCode
      )

      const data = response?.data?.data || response?.data

      // If registration successful, store tokens and redirect
      if (data.accessToken && data.admin) {
        // Store admin token and data
        setAuthData("admin", data.accessToken, data.admin)

        // Navigate to admin dashboard
        navigate("/ecs", { replace: true })
      } else {
        throw new Error("Registration failed. Please try again.")
      }
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Invalid OTP or registration failed. Please try again."
      setError(message)
      setOtp(["", "", "", "", "", ""])
      inputRefs.current[0]?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (resendTimer > 0) return

    setIsLoading(true)
    setError("")
    try {
      await authAPI.sendOTP(null, "register", formData.email)
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
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-neutral-50 via-gray-100 to-white relative">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-neutral-900/5 blur-3xl" />
        <div className="absolute right-[-80px] bottom-[-80px] h-72 w-72 rounded-full bg-gray-700/5 blur-3xl" />
      </div>

      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg bg-white/90 backdrop-blur border-neutral-200 shadow-2xl">
          <CardHeader className="pb-4">
            <div className="flex w-full items-center gap-4 sm:gap-5">
              <div className="flex h-14 w-28 shrink-0 items-center justify-center rounded-xl bg-gray-900/5 ring-1 ring-neutral-200">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={companyName || "Logo"}
                    className="h-10 w-24 object-contain"
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                ) : (
                  <span className="text-xs font-bold text-gray-900 truncate px-2">
                    {companyName || "Appzeto"}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <CardTitle className="text-3xl leading-tight text-gray-900">
                  {step === 1 ? "ECS Sign Up" : "Verify Email"}
                </CardTitle>
                <CardDescription className="text-base text-gray-600">
                  {step === 1
                    ? "Create your ECS account"
                    : "Enter the verification code sent to your email"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6">
                {error}
              </div>
            )}

            {step === 1 && (
              <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-base font-medium text-gray-900">
                    Full Name
                  </Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                      <User className="h-5 w-5" />
                    </span>
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      disabled={isLoading}
                      autoComplete="name"
                      required
                      className="h-12 pl-10 text-base"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-base font-medium text-gray-900">
                    Email Address
                  </Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                      <Mail className="h-5 w-5" />
                    </span>
                    <Input
                      id="email"
                      type="email"
                      placeholder="ecs@domain.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      disabled={isLoading}
                      autoComplete="email"
                      required
                      className="h-12 pl-10 text-base"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-base font-medium text-gray-900">
                    Password
                  </Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                      <Lock className="h-5 w-5" />
                    </span>
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password (min 6 characters)"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      disabled={isLoading}
                      autoComplete="new-password"
                      required
                      className="h-12 pl-10 pr-10 text-base"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800"
                      disabled={isLoading}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-base font-medium text-gray-900">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                      <Lock className="h-5 w-5" />
                    </span>
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm password"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({ ...formData, confirmPassword: e.target.value })
                      }
                      disabled={isLoading}
                      autoComplete="new-password"
                      required
                      className="h-12 pl-10 pr-10 text-base"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800"
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full bg-black text-white transition-colors hover:bg-neutral-900"
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Continue"}
                </Button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleOtpSubmit} className="space-y-6">
                <div className="space-y-4">
                  <Label className="text-base font-medium text-gray-900 text-center block">
                    Enter Verification Code
                  </Label>
                  <div className="flex justify-center gap-2">
                    {otp.map((digit, index) => (
                      <Input
                        key={index}
                        ref={(el) => {
                          if (inputRefs.current) {
                            inputRefs.current[index] = el
                          }
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        onPaste={index === 0 ? handleOtpPaste : undefined}
                        className="h-14 w-14 text-center text-2xl font-semibold border-2 focus-visible:ring-2 focus-visible:ring-black"
                        disabled={isLoading}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 text-center">
                    Code sent to <span className="font-medium">{formData.email}</span>
                  </p>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    disabled={isLoading}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Change email
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendTimer > 0 || isLoading}
                    className="text-black hover:underline font-medium disabled:text-gray-400 disabled:no-underline"
                  >
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
                  </button>
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full bg-black text-white transition-colors hover:bg-neutral-900"
                  disabled={isLoading}
                >
                  {isLoading ? "Verifying..." : "Verify & Sign Up"}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex-col items-start gap-2 text-sm text-gray-500">
            <button
              onClick={() => navigate("/ecs/login")}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </button>
            <span>Already have an account?{" "}
              <button
                onClick={() => navigate("/ecs/login")}
                className="text-black hover:underline font-medium"
              >
                Sign in
              </button>
            </span>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}


