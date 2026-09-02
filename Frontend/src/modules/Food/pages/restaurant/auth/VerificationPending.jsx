import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Clock3, ShieldAlert, ShieldCheck, RefreshCw, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@food/components/ui/button"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { restaurantAPI } from "@food/api"
import {
  clearRestaurantPendingPhone,
  getModuleToken,
  getRestaurantPendingPhone,
  setAuthData as storeAuthData,
} from "@food/utils/auth"

export default function VerificationPending() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const location = useLocation()

  const phone = useMemo(() => {
    return location.state?.phone || getRestaurantPendingPhone() || ""
  }, [location.state?.phone])

  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [status, setStatus] = useState("pending")
  const [onboardingData, setOnboardingData] = useState(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [detailsOpen, setDetailsOpen] = useState(false)
  const pollCancelRef = useRef(null)

  // Fetch status from the public (no-auth) onboarding-status endpoint.
  const fetchStatus = async (isManual = false) => {
    if (!phone) {
      setLoading(false)
      return
    }
    if (isManual) setIsRefreshing(true)

    try {
      const res = await restaurantAPI.getOnboardingStatus(phone)
      const data = res?.data?.data || res?.data || {}

      if (data.exists) {
        setOnboardingData(data.data || null)
        setStatus(data.status || "pending")
        setRejectionReason(data.rejectionReason || "")

        if (data.status === "approved") {
          if (pollCancelRef.current) {
            pollCancelRef.current()
            pollCancelRef.current = null
          }
          if (data.auth?.accessToken && data.auth?.user) {
            storeAuthData("restaurant", data.auth.accessToken, data.auth.user, data.auth.refreshToken || null)
            window.dispatchEvent(new Event("restaurantAuthChanged"))
            clearRestaurantPendingPhone()
            toast.success("Congratulations! Your restaurant is approved.")
            setTimeout(() => navigate("/food/restaurant", { replace: true }), 1200)
          }
        }
      }
    } catch (err) {
      // Keep the pending screen visible if the status check fails.
    } finally {
      setLoading(false)
      if (isManual) setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone])

  // Periodic polling — only while genuinely "pending". "approved" auto-logs the
  // user in above; "rejected" needs the restaurant to edit and resubmit, so
  // there's nothing further to wait for either.
  //
  // Starts at 4s (fast feedback right after applying) and backs off up to 60s
  // for long-pending applications, and pauses entirely while the tab is hidden
  // so a forgotten/backgrounded tab doesn't hammer the API forever — resuming
  // with an immediate check as soon as the tab is focused again.
  useEffect(() => {
    if (status !== "pending") return

    let cancelled = false
    let timeoutId = null
    let attempt = 0
    pollCancelRef.current = () => { cancelled = true }

    const scheduleNext = () => {
      if (cancelled) return
      const delay = Math.min(4000 * Math.pow(1.5, attempt), 60000)
      attempt += 1
      timeoutId = setTimeout(async () => {
        if (!cancelled && document.visibilityState === "visible") {
          await fetchStatus(false)
        }
        scheduleNext()
      }, delay)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchStatus(false)
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    scheduleNext()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, status])

  const isRejected = status === "rejected"

  // Re-apply: edit and resubmit the same application. Onboarding.jsx restores
  // all previously submitted fields itself (via the phone stored below), so
  // nothing needs to be seeded here — avoids a second, redundant API call.
  const handleReapply = () => {
    navigate("/food/restaurant/onboarding", { replace: true })
  }

  // Start fresh: same phone number, but a blank form.
  const handleNewApplication = () => {
    navigate("/food/restaurant/onboarding?fresh=1", { replace: true })
  }

  const handleBackToLogin = () => {
    clearRestaurantPendingPhone()
    navigate("/food/restaurant/login", { replace: true })
  }

  const submittedFields = onboardingData
    ? [
        ["Restaurant name", onboardingData.restaurantName],
        ["Owner name", onboardingData.ownerName],
        ["Owner email", onboardingData.ownerEmail],
        ["Owner phone", onboardingData.ownerPhone],
        ["Business type", onboardingData.businessType],
        ["Address", onboardingData.location?.formattedAddress || onboardingData.location?.address],
        ["City", onboardingData.location?.city],
        ["Cuisines", Array.isArray(onboardingData.cuisines) && onboardingData.cuisines.length ? onboardingData.cuisines.join(", ") : null],
        ["Opening hours", onboardingData.openingTime && onboardingData.closingTime ? `${onboardingData.openingTime} - ${onboardingData.closingTime}` : null],
        ["PAN number", onboardingData.panNumber],
        ["GST number", onboardingData.gstRegistered ? onboardingData.gstNumber : "Not registered"],
        ["FSSAI number", onboardingData.fssaiNumber],
        ["Bank account holder", onboardingData.accountHolderName],
        ["Account number", onboardingData.accountNumber ? `••••${String(onboardingData.accountNumber).slice(-4)}` : null],
        ["IFSC code", onboardingData.ifscCode],
      ].filter(([, value]) => value)
    : []

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-md flex-col justify-center">
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="mb-6 flex items-center justify-center">
            <div className={`flex h-16 w-16 items-center justify-center rounded-full ${isRejected ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
              {isRejected ? <ShieldAlert className="h-8 w-8" /> : <Clock3 className="h-8 w-8" />}
            </div>
          </div>

          <div className="mb-6 text-center">
            <p className={`mb-2 text-xs font-semibold uppercase tracking-[0.32em] ${isRejected ? "text-red-600" : "text-amber-600"}`}>
              {isRejected ? "Action needed" : "Verification Pending"}
            </p>
            <h1 className="text-3xl font-extrabold text-slate-950">
              {isRejected ? "Your application needs an update" : "Your restaurant is under review"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {isRejected
                ? "Admin has not approved this submission yet. Review the reason below, update your details, and resubmit."
                : `${companyName} received your onboarding details successfully. Our team will verify your restaurant and activate your dashboard once approval is complete.`}
            </p>
          </div>

          {isRejected && rejectionReason && (
            <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1.5">Reason provided by admin</p>
              <p className="text-sm font-bold text-red-900 leading-relaxed">"{rejectionReason}"</p>
            </div>
          )}

          {!isRejected && (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
                <div className="text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">What happens next</p>
                  <p className="mt-1">We will notify you once the verification is approved.</p>
                  {phone ? (
                    <p className="mt-2 text-slate-500">
                      Registered phone: <span className="font-medium text-slate-700">{phone}</span>
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {submittedFields.length > 0 && (
            <div className="mb-6 rounded-2xl border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left"
              >
                <span className="text-sm font-semibold text-slate-900">Your submitted application details</span>
                {detailsOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
              </button>
              {detailsOpen && (
                <div className="divide-y divide-slate-100 px-4">
                  {submittedFields.map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4 py-2.5 text-sm">
                      <span className="text-slate-500">{label}</span>
                      <span className="text-right font-medium text-slate-800 break-words">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {isRejected ? (
              <>
                <Button
                  className="h-12 w-full rounded-xl bg-red-600 text-base font-semibold hover:bg-red-700 text-white transition-colors"
                  onClick={handleReapply}
                >
                  Edit &amp; Re-apply
                </Button>
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-xl text-base font-semibold"
                  onClick={handleNewApplication}
                >
                  Start New Application
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                className="h-12 w-full rounded-xl text-base font-semibold inline-flex items-center justify-center gap-2"
                onClick={() => fetchStatus(true)}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "Checking..." : "Refresh status"}
              </Button>
            )}
            <Button
              variant="ghost"
              className="h-12 w-full rounded-xl text-base font-semibold"
              onClick={handleBackToLogin}
            >
              Back to login
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
