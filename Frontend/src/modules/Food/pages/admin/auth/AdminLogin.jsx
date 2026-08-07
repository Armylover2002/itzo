import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { adminAPI } from "@food/api"
import { setAuthData, isModuleAuthenticated } from "@food/utils/auth"
import { getDefaultAdminLandingPath, resolveAdminPermissionsForUser } from "@food/utils/adminPermissions"
import { loadBusinessSettings, getCachedSettings, getAppLogo } from "@common/utils/businessSettings"
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
import { Eye, EyeOff, UserCircle } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@food/components/ui/select"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function AdminLogin() {
  const navigate = useNavigate()
  const location = useLocation()
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
      setSuccessMessage(message)
      window.history.replaceState({}, document.title, location.pathname)
    }
  }, [location.state?.message, location.pathname])

  // Route Protection: if already authenticated, redirect to admin dashboard
  useEffect(() => {
    if (isModuleAuthenticated("admin")) {
      navigate("/ecs", { replace: true })
    }
  }, [navigate])

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

  // Fetch business settings logo on mount
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const settings = await loadBusinessSettings()
        const adminLogo = getAppLogo('admin')
        if (adminLogo) {
          setLogoUrl(adminLogo)
        }
        if (settings?.companyName) {
          setCompanyName(settings.companyName)
        }
      } catch (error) {
        // Silently fail and use default logo
        debugWarn("Failed to load business settings logo:", error)
      }
    }
    fetchLogo()

    // Listen for business settings updates
    const handleSettingsUpdate = async () => {
      // Force reload settings from backend
      const settings = await loadBusinessSettings();
      const adminLogo = getAppLogo('admin');
      if (adminLogo) {
        setLogoUrl(adminLogo);
      }
    };
    window.addEventListener('businessSettingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate);
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccessMessage("")
    if (submittingRef.current) return

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError("User Id is required")
      return
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@(?!(gmail\\.comm|yahoo\\.con)$)[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address")
      return
    }
    if (!password) {
      setError("Password is required")
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    submittingRef.current = true
    setIsLoading(true)

    try {
      const response = await adminAPI.login(trimmedEmail, password, selectedRoleId)
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
      setAuthData("admin", accessToken, adminUser, refreshToken)
      const resolvedPermissions = await resolveAdminPermissionsForUser(adminUser)
      const landingPath = getDefaultAdminLandingPath(adminUser, resolvedPermissions)
      navigate(landingPath, { replace: true })
    } catch (err) {
      let message = "Login failed. Please check your credentials.";
      
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        message = "Network error: Cannot connect to server. Please check if backend is running.";
      } else if (err?.response?.data?.message || err?.response?.data?.error) {
        message = err.response.data.message || err.response.data.error;
      }

      setError(message)
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
          <span className="text-2xl font-bold text-[#FE5502]">
            {companyName || "Appzeto"}
          </span>
        )}
      </div>

      {/* Main Login Card */}
      <Card className="w-full max-w-md bg-white border-0 shadow-lg rounded-sm py-4 px-2">
        <h2 className="text-black text-center text-2xl font-bold mt-2">ECS Portal Login</h2>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {successMessage && (
              <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {successMessage}
              </div>
            )}
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Role Dropdown */}
            <div className="relative">
              <Select
                value={selectedRoleId}
                onValueChange={setSelectedRoleId}
                disabled={isLoading}
              >
                <SelectTrigger className="h-12 text-base w-full border-gray-300 rounded-sm focus:ring-[#FE5502] focus:border-[#FE5502] text-gray-500">
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

            {/* User Id */}
            <div className="relative">
              <Input
                id="email"
                type="text"
                placeholder="User Id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="off"
                required
                className="h-12 pl-4 pr-12 text-base border-gray-300 rounded-sm focus-visible:ring-1 focus-visible:ring-[#FE5502] focus-visible:border-[#FE5502] placeholder:text-gray-400"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <UserCircle className="h-5 w-5 text-[#FE5502]" fill="currentColor" strokeWidth={1} />
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
                className="h-12 pl-4 pr-12 text-base border-gray-300 rounded-sm focus-visible:ring-1 focus-visible:ring-[#FE5502] focus-visible:border-[#FE5502] placeholder:text-gray-400 [&::-ms-reveal]:hidden [&::-webkit-password-reveal-button]:hidden"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-[#FE5502]" />
                ) : (
                  <Eye className="h-5 w-5 text-[#FE5502]" />
                )}
              </button>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-start justify-between pt-2">
              <Button
                type="submit"
                className="h-10 px-8 bg-[#FE5502] hover:bg-[#E04B00] text-white rounded-sm font-medium transition-colors"
                disabled={isLoading}
              >
                {isLoading ? "Wait..." : "Login"}
              </Button>
              
              <div className="flex flex-col items-end space-y-2">
                <button
                  type="button"
                  onClick={() => navigate("/ecs/forgot-password")}
                  className="text-[15px] text-[#FE5502] hover:underline focus:outline-none"
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
        Copyright © {companyName || "Appzeto"} Limited
      </div>
    </div>
  )
}


