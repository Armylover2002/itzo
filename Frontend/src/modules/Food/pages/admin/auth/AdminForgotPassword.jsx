import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
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
import { Mail, ArrowLeft, Shield } from "lucide-react"

import { adminAPI } from "@food/api"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { getCachedSettings, getAppLogo, subscribeBusinessSettings } from "@common/utils/businessSettings"

export default function AdminForgotPassword() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: email, 2: OTP, 3: new password
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [resendTimer, setResendTimer] = useState(0)
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo('admin'))
  const [displayCompanyName, setDisplayCompanyName] = useState(() => getCachedSettings()?.companyName || null)
  const inputRefs = useRef(Array(6).fill(null).map(() => null))

  // Apply business settings logo from cache
  useEffect(() => {
    const apply = (settings) => {
      const adminLogo = getAppLogo('admin')
      if (adminLogo) setLogoUrl(adminLogo)
      if (settings?.companyName) setDisplayCompanyName(settings.companyName)
    }
    apply(getCachedSettings())
    return subscribeBusinessSettings(apply)
  }, [])

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setError("")

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError("Email is required")
      return
    }

    setIsLoading(true)
    try {
      await adminAPI.requestForgotPasswordOtp(trimmedEmail)
      setEmail(trimmedEmail)
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
        "This email is not registered as an ECS account or something went wrong."
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

  const handleOtpSubmit = (e) => {
    e.preventDefault()
    setError("")

    const otpCode = otp.join("")
    if (otpCode.length !== 6) {
      setError("Please enter the complete 6-digit OTP")
      return
    }
    setStep(3)
  }

  const handleResendOtp = async () => {
    if (resendTimer > 0) return

    setIsLoading(true)
    setError("")
    try {
      await adminAPI.requestForgotPasswordOtp(email)
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

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setError("")

    if (!newPassword || !confirmPassword) {
      setError("Please fill in all fields")
      return
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)
    try {
      await adminAPI.resetPasswordWithOtp(email, otp.join(""), newPassword)

      navigate("/ecs/login", {
        state: { message: "Password reset successfully. Please login with your new password." },
      })
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to reset password. Please try again."
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
              <img 
                src={logoUrl || "/logo.jpg"} 
                alt="Blaze" 
                className="h-16 w-auto shrink-0 rounded-lg object-contain" 
              />
              <div className="flex flex-col gap-1">
                <CardTitle className="text-3xl leading-tight text-gray-900">
                  {step === 1 && "Forgot Password"}
                  {step === 2 && "Verify OTP"}
                  {step === 3 && "Reset Password"}
                </CardTitle>
                <CardDescription className="text-base text-gray-600">
                  {step === 1 && "Enter your email to receive a verification code"}
                  {step === 2 && "Enter the 6-digit code sent to your email"}
                  {step === 3 && "Enter your new password"}
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
              <form onSubmit={handleEmailSubmit} className="space-y-6">
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
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      autoComplete="email"
                      required
                      className="h-12 pl-10 text-base"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full bg-black text-white transition-colors hover:bg-neutral-900"
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Send Verification Code"}
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
                    Code sent to <span className="font-medium">{email}</span>
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
                  {isLoading ? "Verifying..." : "Verify Code"}
                </Button>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handlePasswordSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-base font-medium text-gray-900">
                    New Password
                  </Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                      <Shield className="h-5 w-5" />
                    </span>
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
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
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-base font-medium text-gray-900">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                      <Shield className="h-5 w-5" />
                    </span>
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
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
                      {showConfirmPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full bg-black text-white transition-colors hover:bg-neutral-900"
                  disabled={isLoading}
                >
                  {isLoading ? "Resetting..." : "Reset Password"}
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
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

