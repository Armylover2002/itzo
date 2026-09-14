import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  XCircle,
  RotateCcw,
} from "lucide-react"
import { Button } from "@food/components/ui/button"
import RestaurantAuthFooter from "@food/components/restaurant/RestaurantAuthFooter"
import { restaurantAPI } from "@food/api"
import { useCompanyName } from "@food/hooks/useCompanyName"
import {
  clearModuleAuth,
  clearRestaurantPendingPhone,
  getCurrentUser,
  getModuleToken,
  getRestaurantPendingPhone,
  syncRestaurantStoredUser,
  updateStoredModuleUser,
} from "@food/utils/auth"
import {
  extractRestaurantFromResponse,
  isRestaurantApproved,
  isRestaurantInitialPendingApproval,
} from "@food/utils/restaurantApproval"
import { getAppLogo, subscribeBusinessSettings } from "@common/utils/businessSettings"
import { toast } from "sonner"

const POLL_INTERVAL_MS = 20000

const TIMELINE_STEPS = [
  {
    title: "Application received",
    description: "Your restaurant details and documents were submitted successfully.",
    done: true,
  },
  {
    title: "Admin verification",
    description: "Our team is reviewing your profile, FSSAI, PAN, and outlet information.",
    active: true,
  },
  {
    title: "Dashboard activation",
    description: "Once approved, your partner dashboard unlocks automatically on refresh.",
  },
]

export default function VerificationPending() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const location = useLocation()
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo("restaurant"))
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [restaurantName, setRestaurantName] = useState("")
  const [isRejected, setIsRejected] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const hasMounted = useRef(false)

  const pendingPhone = useMemo(() => {
    const cachedUser = getCurrentUser("restaurant")
    return (
      location.state?.phone ||
      cachedUser?.ownerPhone ||
      cachedUser?.primaryContactNumber ||
      getRestaurantPendingPhone() ||
      ""
    )
  }, [location.state?.phone])

  const checkApprovalStatus = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setCheckingStatus(true)
        setIsRefreshing(true)
      }

      const token = getModuleToken("restaurant")
      if (!token) {
        setCheckingStatus(false)
        setIsRefreshing(false)
        return
      }

      try {
        const response = await restaurantAPI.getCurrentRestaurant()
        const restaurant = extractRestaurantFromResponse(response)

        if (restaurant?.restaurantName || restaurant?.name) {
          setRestaurantName(restaurant.restaurantName || restaurant.name)
        }

        if (restaurant) {
          updateStoredModuleUser("restaurant", restaurant)
          const status = String(restaurant?.status || "").toLowerCase()
          if (status === "rejected") {
            setIsRejected(true)
            setRejectionReason(restaurant.rejectionReason || "Your application did not meet our requirements.")
          } else {
            setIsRejected(false)
          }
        }

        if (restaurant && isRestaurantApproved(restaurant)) {
          syncRestaurantStoredUser(restaurant)
          clearRestaurantPendingPhone()
          toast.success("Your restaurant has been approved!")
          navigate("/food/restaurant", { replace: true })
          return
        }

        const currentStatus = String(restaurant?.status || "").toLowerCase()
        if (restaurant && !isRestaurantInitialPendingApproval(restaurant) && currentStatus !== "rejected") {
          navigate("/food/restaurant", { replace: true })
          return
        }
      } catch {
        // Keep pending screen visible if status check fails.
      } finally {
        if (!silent) {
          setCheckingStatus(false)
          setIsRefreshing(false)
        }
      }
    },
    [navigate],
  )

  useEffect(() => {
    const apply = () => {
      const logo = getAppLogo("restaurant")
      if (logo) setLogoUrl(logo)
    }
    apply()
    return subscribeBusinessSettings(apply)
  }, [])

  useEffect(() => {
    const cachedUser = getCurrentUser("restaurant")
    if (cachedUser?.restaurantName || cachedUser?.name) {
      setRestaurantName(cachedUser.restaurantName || cachedUser.name)
    }

    if (!hasMounted.current) {
      hasMounted.current = true
      checkApprovalStatus()
    }

    const intervalId = window.setInterval(() => {
      checkApprovalStatus({ silent: true })
    }, POLL_INTERVAL_MS)

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        checkApprovalStatus({ silent: true })
      }
    }

    window.addEventListener("focus", handleVisibilityOrFocus)
    document.addEventListener("visibilitychange", handleVisibilityOrFocus)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("focus", handleVisibilityOrFocus)
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus)
    }
  }, [checkApprovalStatus])

  const handleLogout = () => {
    clearModuleAuth("restaurant")
    clearRestaurantPendingPhone()
    navigate("/food/restaurant/login", { replace: true })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f4f6fb]">
      {/* Page-specific background — no login banner */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#FF0000]/8 blur-3xl" />
        <div className="absolute right-0 top-1/4 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-slate-200/40 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.18) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-8 sm:px-6 sm:py-10">
        {/* Top bar */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-11 w-auto rounded-xl object-contain" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FF0000] shadow-md">
                <Store className="h-5 w-5 text-white" />
              </div>
            )}
            <div>
              <p className="text-sm font-black text-slate-900">{companyName}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                Partner verification
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            Pending
          </span>
        </div>

        {/* Hero card — verification-only visual */}
        <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className={`border-b border-slate-100 bg-gradient-to-r px-6 py-8 sm:px-8 sm:py-10 ${
            isRejected 
              ? "from-red-500/10 via-white to-red-50" 
              : "from-[#FF0000]/10 via-white to-amber-50"
          }`}>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <p className={`text-[11px] font-black uppercase tracking-[0.32em] ${
                  isRejected ? "text-red-600" : "text-[#FF0000]"
                }`}>
                  {isRejected ? "Application Rejected" : "Verification in progress"}
                </p>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                  {isRejected ? "Your application was rejected" : "Your restaurant is under review"}
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                  {isRejected
                    ? `We reviewed your application for ${companyName}. Unfortunately, it did not meet our criteria. Please review the feedback and try again.`
                    : `We received your application for ${companyName}. Our team is verifying your details before activating your partner dashboard.`}
                </p>
              </div>

              <div className="relative mx-auto flex h-28 w-28 shrink-0 items-center justify-center sm:mx-0">
                <div className={`absolute inset-0 rounded-full ${isRejected ? 'bg-red-500/10' : 'bg-[#FF0000]/10'}`} />
                <div className={`absolute inset-2 rounded-full border-2 border-dashed ${isRejected ? 'border-red-500/25' : 'border-[#FF0000]/25'}`} />
                <div className={`relative flex h-20 w-20 items-center justify-center rounded-full shadow-lg ${isRejected ? 'bg-red-500 shadow-red-500/25' : 'bg-[#FF0000] shadow-[#FF0000]/25'}`}>
                  {isRejected ? <XCircle className="h-9 w-9 text-white" /> : <Clock3 className="h-9 w-9 text-white" />}
                </div>
                {!isRejected && <Sparkles className="absolute -right-1 top-2 h-5 w-5 text-amber-500" />}
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6 sm:p-8">
            {/* Status */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200`}>
                  {isRejected ? <XCircle className="h-6 w-6 text-red-500" /> : <ShieldCheck className="h-6 w-6 text-[#FF0000]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Current status
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-900">
                    {isRejected ? "Rejected" : "Awaiting admin approval"}
                  </p>
                  {isRejected && rejectionReason && (
                    <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 border border-red-100">
                      <span className="font-semibold block mb-1">Reason:</span>
                      {rejectionReason}
                    </div>
                  )}
                  {restaurantName ? (
                    <p className="mt-1 truncate text-sm font-semibold text-slate-700">
                      {restaurantName}
                    </p>
                  ) : null}
                  {pendingPhone ? (
                    <p className="mt-2 text-sm text-slate-600">
                      Registered phone:{" "}
                      <span className="font-semibold text-slate-800">{pendingPhone}</span>
                    </p>
                  ) : null}
                  {checkingStatus ? (
                    <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Checking latest status...
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {!isRejected && (
              <>
                {/* Timeline */}
                <div>
                  <h2 className="mb-4 text-sm font-black uppercase tracking-wider text-slate-800">
                    What happens next
                  </h2>
                  <div className="space-y-0">
                    {TIMELINE_STEPS.map((step, index) => (
                      <div key={step.title} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-black ${
                              step.done
                                ? "bg-[#FF0000] text-white shadow-md shadow-[#FF0000]/20"
                                : step.active
                                  ? "border-2 border-[#FF0000] bg-[#FF0000]/10 text-[#FF0000]"
                                  : "border border-slate-200 bg-white text-slate-400"
                            }`}
                          >
                            {step.done ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : step.active ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              index + 1
                            )}
                          </div>
                          {index < TIMELINE_STEPS.length - 1 ? (
                            <div
                              className={`my-1 w-0.5 flex-1 min-h-[28px] ${
                                step.done ? "bg-[#FF0000]/30" : "bg-slate-200"
                              }`}
                            />
                          ) : null}
                        </div>
                        <div className={`pb-5 ${index === TIMELINE_STEPS.length - 1 ? "pb-0" : ""}`}>
                          <p
                            className={`text-sm font-bold ${
                              step.active ? "text-[#FF0000]" : "text-slate-900"
                            }`}
                          >
                            {step.title}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm leading-6 text-emerald-900">
                  Once approved, refresh this page or tap <strong>Check status</strong> — you&apos;ll be
                  taken to your dashboard automatically. No need to log in again.
                </div>
              </>
            )}

            {isRejected ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  onClick={() => navigate("/restaurant/onboarding?step=1", { replace: true })}
                  className="h-12 rounded-2xl bg-[#FF0000] text-base font-bold hover:bg-[#E00000]"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Resubmit Application
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLogout}
                  className="h-12 rounded-2xl border-slate-200 bg-white text-base font-semibold text-slate-700"
                >
                  Start Over (Logout)
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  disabled={isRefreshing}
                  onClick={() => checkApprovalStatus()}
                  className="h-12 rounded-2xl bg-[#FF0000] text-base font-bold hover:bg-[#E00000]"
                >
                  {isRefreshing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Check status
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLogout}
                  className="h-12 rounded-2xl border-slate-200 bg-white text-base font-semibold text-slate-700"
                >
                  Sign out
                </Button>
              </div>
            )}
          </div>
        </div>

        <RestaurantAuthFooter className="mt-8" variant="light" />
      </div>
    </div>
  )
}
