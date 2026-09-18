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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@food/components/ui/card"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
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
                alt="ItzoFood"
                className="h-16 w-auto shrink-0 rounded-lg object-contain"
              />
              <div className="flex flex-col gap-1">
                <CardTitle className="text-3xl leading-tight text-gray-900">ECS Login</CardTitle>
                <CardDescription className="text-base text-gray-600">
                  Sign in to access the ECS dashboard.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {error ? (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-bold">{ADMIN_SESSION_EXPIRED_TITLE}</p>
                  <p className="mt-0.5 font-medium leading-relaxed">{error}</p>
                </div>
              </div>
            ) : null}
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Login Method Tabs */}
              <div className="flex border-b border-gray-200 mb-6 bg-slate-50/50 rounded-t-lg p-1">
                <button
                  type="button"
                  className={`flex-1 py-3 text-center text-sm font-semibold transition-all border-b-2 rounded-t-md ${activeTab === 'email' ? 'border-neutral-900 text-neutral-950 font-bold bg-white shadow-xs' : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-slate-100/50'}`}
                  onClick={() => {
                    setActiveTab('email');
                    setEmail('');
                    setError('');
                  }}
                  disabled={isLoading}
                >
                  Login Using Email
                </button>
                <button
                  type="button"
                  className={`flex-1 py-3 text-center text-sm font-semibold transition-all border-b-2 rounded-t-md ${activeTab === 'employee' ? 'border-neutral-900 text-neutral-950 font-bold bg-white shadow-xs' : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-slate-100/50'}`}
                  onClick={() => {
                    setActiveTab('employee');
                    setEmail('');
                    setError('');
                  }}
                  disabled={isLoading}
                >
                  Login Using Employee ID
                </button>
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium text-gray-900">Select Role</Label>
                <Select
                  value={selectedRoleId}
                  onValueChange={setSelectedRoleId}
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-12 text-base w-full">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-4 w-4 text-primary" />
                        Admin
                      </div>
                    </SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r._id} value={r._id}>
                        {r.roleName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {activeTab === 'email' ? (
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-base font-medium text-gray-900">Email Address</Label>
                  <Input
                    id="email"
                    type="text"
                    placeholder="ecs@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    autoComplete="off"
                    required
                    maxLength={100}
                    className="h-12 text-base"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="employeeId" className="text-base font-medium text-gray-900">Employee ID</Label>
                  <Input
                    id="employeeId"
                    type="text"
                    placeholder="EMPL00**"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    autoComplete="off"
                    required
                    maxLength={20}
                    className="h-12 text-base"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password" className="text-base font-medium text-gray-900">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="new-password"
                    required
                    maxLength={50}
                    className="h-12 pr-12 text-base [&::-ms-reveal]:hidden [&::-webkit-password-reveal-button]:hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-800"
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Use your ECS credentials to continue.</span>
                <button
                  type="button"
                  onClick={() => navigate("/ecs/forgot-password")}
                  className="text-black font-medium hover:underline focus:outline-none focus:underline"
                  disabled={isLoading}
                >
                  Forgot Password?
                </button>
              </div>

              <Button
                type="submit"
                className="h-12 w-full bg-[#FF0000] text-white transition-colors hover:bg-[#CC0000] focus-visible:ring-2 focus-visible:ring-[#FF0000] focus-visible:ring-offset-2"
                disabled={isLoading}
              >
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex-col items-start gap-2 text-sm text-gray-500">
            <span>Secure sign-in helps protect admin tools.</span>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}


