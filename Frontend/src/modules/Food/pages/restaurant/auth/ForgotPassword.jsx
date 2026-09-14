import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Mail, ArrowLeft, Lock, Eye, EyeOff } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@food/components/ui/card"
import loginBg from "@food/assets/loginbanner.png"
import { getRestaurantLoginBanner, subscribeBusinessSettings } from "@common/utils/businessSettings"
import { restaurantAPI } from "@food/api"

export default function RestaurantForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: email, 2: OTP, 3: new password
  const [bannerUrl, setBannerUrl] = useState(() => {
    const banner = getRestaurantLoginBanner()
    return (banner && banner.url && banner.active) ? banner.url : loginBg
  })

  useEffect(() => {
    const apply = () => {
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
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [resendTimer, setResendTimer] = useState(0)
  const inputRefs = useRef(Array(6).fill(null).map(() => null))

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setError("")
    
    if (!email.trim()) {
      setError("Email is required")
      return
    }

    setIsLoading(true)
    try {
      await restaurantAPI.sendOTP(null, "reset-password", email)
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
        "Failed to send OTP. Please try again."
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
      await restaurantAPI.verifyOTP(null, otpCode, "reset-password", null, email)
      setStep(3)
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Invalid OTP. Please try again."
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
      await restaurantAPI.sendOTP(null, "reset-password", email)
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
      const response = await restaurantAPI.resetPassword(email, otp.join(""), newPassword)

      const data = response?.data || {}
      if (!data.success) {
        throw new Error(data.message || "Failed to reset password")
      }

      navigate("/restaurant/login", {
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
    <div className="h-screen w-full flex bg-white overflow-hidden">
      {/* Left image section */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img
          src={bannerUrl}
          alt="Restaurant background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 flex items-center text-white pointer-events-none">
          <div className="bg-[#FF0000]/80 rounded-r-full py-10 xl:py-20 pl-10 xl:pl-14 pr-10 xl:pr-20 max-w-[70%] shadow-xl backdrop-blur-[1px]">
            <h1 className="text-3xl xl:text-4xl font-extrabold mb-4 tracking-wide leading-tight">
              RESET YOUR
              <br />
              PASSWORD
            </h1>
            <p className="text-base xl:text-lg opacity-95 max-w-xl">
              Follow the steps to securely reset your restaurant panel password.
            </p>
          </div>
        </div>
      </div>

      {/* Right form section */}
      <div className="w-full lg:w-1/2 h-full flex flex-col items-center justify-center px-6 sm:px-10 lg:px-16">
        <Card className="w-full max-w-lg bg-white/80 backdrop-blur-sm border border-gray-200 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl sm:text-3xl font-semibold text-gray-900">
              {step === 1 && "Forgot Password"}
              {step === 2 && "Verify OTP"}
              {step === 3 && "Reset Password"}
            </CardTitle>
            <CardDescription className="text-sm text-gray-500">
              {step === 1 && "Enter your email to receive a verification code"}
              {step === 2 && "Enter the 6-digit code sent to your email"}
              {step === 3 && "Enter your new password"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {step === 1 && (
              <form onSubmit={handleEmailSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email Address
                  </Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                      <Mail className="h-4 w-4" />
                    </span>
                    <Input
                      id="email"
                      type="email"
                      placeholder="restaurant@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      autoComplete="email"
                      required
                      className="h-11 pl-9 border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full bg-[#FF0000] hover:bg-[#FF0000]/90 text-white"
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Send Verification Code"}
                </Button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleOtpSubmit} className="space-y-5">
                <div className="space-y-4">
                  <Label className="text-sm font-medium text-gray-700 text-center block">
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
                        className="h-14 w-14 text-center text-2xl font-semibold border-2 focus-visible:ring-2 focus-visible:ring-[#FF0000]"
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
                    className="flex items-center gap-2 text-[#FF0000] hover:text-[#FF0000]/80 transition-colors"
                    disabled={isLoading}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Change email
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendTimer > 0 || isLoading}
                    className="text-[#FF0000] hover:underline font-medium disabled:text-gray-400 disabled:no-underline"
                  >
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
                  </button>
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full bg-[#FF0000] hover:bg-[#FF0000]/90 text-white"
                  disabled={isLoading}
                >
                  {isLoading ? "Verifying..." : "Verify Code"}
                </Button>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handlePasswordSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700">
                    New Password
                  </Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                      <Lock className="h-4 w-4" />
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
                      className="h-11 pl-9 pr-10 border-gray-300 rounded-md"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800"
                      disabled={isLoading}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                      <Lock className="h-4 w-4" />
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
                      className="h-11 pl-9 pr-10 border-gray-300 rounded-md"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800"
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full bg-[#FF0000] hover:bg-[#FF0000]/90 text-white"
                  disabled={isLoading}
                >
                  {isLoading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            )}

            <div className="pt-4 border-t">
              <button
                onClick={() => navigate("/restaurant/login")}
                className="flex items-center gap-2 text-sm text-[#FF0000] hover:text-[#FF0000]/80 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

