import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { adminAPI } from "@food/api"
import { setAuthData } from "@food/utils/auth"
import { getDefaultAdminLandingPath, resolveAdminPermissionsForUser } from "@food/utils/adminPermissions"
import { getCachedSettings, getAppLogo, subscribeBusinessSettings } from "@common/utils/businessSettings"
import { Button } from "@food/components/ui/button"
import {
  Card,
  CardContent,
} from "@food/components/ui/card"
import { Input } from "@food/components/ui/input"
import { AlertCircle, Eye, EyeOff, UserCircle } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@food/components/ui/select"
import { z } from "zod"
import { toast } from "sonner"
import {
  ADMIN_SESSION_EXPIRED_MESSAGE,
  ADMIN_SESSION_EXPIRED_TITLE,
  consumeAdminSessionExpired,
} from "@/shared/utils/adminSession"

const emailLoginSchema = z.object({
  email: z.string()
    .trim()
    .min(1, "Email Address is required")
    .max(100, "Email must not exceed 100 characters")
    .email("Please enter a valid email address"),
  password: z.string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters")
    .max(50, "Password must not exceed 50 characters"),
})

const employeeLoginSchema = z.object({
  employeeId: z.string()
    .trim()
    .min(1, "Employee ID is required")
    .max(20, "Employee ID must not exceed 20 characters")
    .regex(/^EMPL\d+$/i, "Please enter a valid Employee ID format (e.g., EMPL0001)"),
  password: z.string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters")
    .max(50, "Password must not exceed 50 characters"),
})

const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }


export default function AdminLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState("email")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo('admin'))
  const [companyName, setCompanyName] = useState(() => getCachedSettings()?.companyName || null)
  const submittingRef = useRef(false)
  const [roles, setRoles] = useState([])
  const [selectedRoleId, setSelectedRoleId] = useState("ADMIN")

  useEffect(() => {
    const message = location.state?.message
    if (message) {
      toast.success(message)
      window.history.replaceState({}, document.title, location.pathname)
    }
  }, [location.state?.message, location.pathname])

  useEffect(() => {
    const expiredReason = consumeAdminSessionExpired()
    const expiredFromState = Boolean(location.state?.sessionExpired)
    if (!expiredReason && !expiredFromState) return

    setError(ADMIN_SESSION_EXPIRED_MESSAGE)
    toast.error(ADMIN_SESSION_EXPIRED_TITLE, { description: ADMIN_SESSION_EXPIRED_MESSAGE })
    window.history.replaceState({}, document.title, location.pathname)
  }, [location.state?.sessionExpired, location.pathname])

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await adminAPI.getPublicRoles()
        if (response?.data?.data) {
          setRoles(response.data.data)
        }
      } catch (err) {
        debugWarn("Failed to fetch roles:", err)
      }
    }
    fetchRoles()
  }, [])

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submittingRef.current) return

    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()

    if (activeTab === "email") {
      const validation = emailLoginSchema.safeParse({
        email: trimmedEmail,
        password: trimmedPassword
      })
      if (!validation.success) {
        toast.error(validation.error.errors[0].message)
        return
      }
    } else {
      const validation = employeeLoginSchema.safeParse({
        employeeId: trimmedEmail,
        password: trimmedPassword
      })
      if (!validation.success) {
        toast.error(validation.error.errors[0].message)
        return
      }
    }

    submittingRef.current = true
    setIsLoading(true)

    try {
      const response = await adminAPI.login(trimmedEmail, trimmedPassword, selectedRoleId)
      const data = response?.data?.data || response?.data || {}

      const accessToken = data.accessToken
      const adminUser = data.user || data.admin
      const refreshToken = data.refreshToken ?? null

      if (!accessToken || !adminUser) {
        throw new Error("Invalid response from server")
      }
      if (!refreshToken) {
        throw new Error("Invalid response from server: missing refresh token")
      }
      toast.success("Login successful")
      setAuthData("admin", accessToken, adminUser, refreshToken)
      const resolvedPermissions = await resolveAdminPermissionsForUser(adminUser)
      const landingPath = getDefaultAdminLandingPath(adminUser, resolvedPermissions)
      window.location.href = landingPath
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Login failed. Please check your credentials."
      toast.error(message)
    } finally {
      setIsLoading(false)
      submittingRef.current = false
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc] relative flex flex-col items-center justify-center p-4 font-sans">

      {/* Top Logo */}
      <div className="mb-8">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={companyName || "Logo"}
            className="h-12 md:h-24 lg:h-32 object-contain"
            loading="lazy"
            onError={(e) => {
              e.target.style.display = 'none'
            }}
          />
        ) : (
          <span className="text-2xl font-bold text-[#6412C6]">
            {companyName || "ItzoFood"}
          </span>
        )}
      </div>

      {/* Main Login Card */}
      <Card className="w-full max-w-md bg-white border-0 shadow-lg rounded-sm py-4 px-2">
        <h2 className="text-black text-center text-2xl font-bold mt-2">ECS Portal Login</h2>
        <CardContent className="pt-6">
          {error ? (
            <div className="mb-5 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-bold">{ADMIN_SESSION_EXPIRED_TITLE}</p>
                <p className="mt-0.5 font-medium leading-relaxed">{error}</p>
              </div>
            </div>
          ) : null}
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Role Dropdown */}
            <div className="relative">
              <Select
                value={selectedRoleId}
                onValueChange={setSelectedRoleId}
                disabled={isLoading}
              >
                <SelectTrigger className="h-12 text-base w-full border-gray-300 rounded-sm focus:ring-[#6412C6] focus:border-[#6412C6] text-gray-500">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">ECS</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r._id} value={r._id}>
                      {r.roleName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* User Id / Employee Id */}
            <div className="relative">
              <Input
                id="email"
                type="text"
                placeholder={activeTab === 'email' ? "Email Address" : "Employee ID (e.g. EMPL0001)"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="off"
                required
                maxLength={activeTab === 'email' ? 100 : 20}
                className="h-12 pl-4 pr-12 text-base border-gray-300 rounded-sm focus-visible:ring-1 focus-visible:ring-[#6412C6] focus-visible:border-[#6412C6] placeholder:text-gray-400"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <UserCircle className="h-5 w-5 text-[#6412C6]" fill="currentColor" strokeWidth={1} />
              </div>
            </div>

            {/* Password */}
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                required
                maxLength={50}
                className="h-12 pl-4 pr-12 text-base border-gray-300 rounded-sm focus-visible:ring-1 focus-visible:ring-[#6412C6] focus-visible:border-[#6412C6] placeholder:text-gray-400 [&::-ms-reveal]:hidden [&::-webkit-password-reveal-button]:hidden"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-[#6412C6]" />
                ) : (
                  <Eye className="h-5 w-5 text-[#6412C6]" />
                )}
              </button>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-start justify-between pt-2">
              <Button
                type="submit"
                className="h-10 px-8 bg-[#6412C6] hover:bg-[#4E0E9A] text-white rounded-sm font-medium transition-colors"
                disabled={isLoading}
              >
                {isLoading ? "Wait..." : "Login"}
              </Button>

              <div className="flex flex-col items-end space-y-2">
                <button
                  type="button"
                  onClick={() => navigate("/ecs/forgot-password")}
                  className="text-[15px] text-[#6412C6] hover:underline focus:outline-none"
                  disabled={isLoading}
                >
                  Forgot Password
                </button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Copyright */}
      <div className="mt-12 text-gray-800 text-[15px]">
        Copyright © {companyName || "ItzoFood"} Limited
      </div>
    </div>
  )
}


