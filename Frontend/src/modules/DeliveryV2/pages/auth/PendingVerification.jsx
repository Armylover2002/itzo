import { useState, useEffect, useRef, useMemo } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { 
  ShieldCheck, 
  Clock3, 
  CheckCircle2, 
  XCircle, 
  RotateCw, 
  ArrowRight, 
  Edit3, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Bike, 
  FileText, 
  CreditCard, 
  Eye, 
  X, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle,
  RefreshCw,
  LogOut,
  Sparkles
} from "lucide-react"
import { deliveryAPI } from "@food/api"
import { setAuthData as storeAuthData } from "@food/utils/auth"
import { toast } from "sonner"

export default function PendingVerification() {
  const navigate = useNavigate()
  const location = useLocation()

  // Retrieve phone from location state, sessionStorage, or localStorage
  const initialPhone = useMemo(() => {
    const raw =
      location.state?.phone ||
      sessionStorage.getItem("deliveryPendingPhone") ||
      localStorage.getItem("deliveryPendingPhone") ||
      ""
    return String(raw).trim()
  }, [location.state?.phone])

  const [phone, setPhone] = useState(initialPhone)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [onboardingData, setOnboardingData] = useState(null)
  const [status, setStatus] = useState(location.state?.isRejected ? "rejected" : "pending")
  const [rejectionReason, setRejectionReason] = useState(location.state?.rejectionReason || "")
  const [applicationType, setApplicationType] = useState("new")
  const [expandedSection, setExpandedSection] = useState(true)
  const [previewImage, setPreviewImage] = useState(null)
  const [isApprovedSuccess, setIsApprovedSuccess] = useState(false)
  const pollCancelRef = useRef(null)

  // Ensure phone is persisted
  useEffect(() => {
    if (phone) {
      sessionStorage.setItem("deliveryPendingPhone", phone)
      localStorage.setItem("deliveryPendingPhone", phone)
    } else {
      // Try to recover phone from signup details in storage
      try {
        const stored = sessionStorage.getItem("deliverySignupDetails")
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed.phone) {
            const recoveredPhone = `${parsed.countryCode || "+91"} ${parsed.phone}`.trim()
            setPhone(recoveredPhone)
            sessionStorage.setItem("deliveryPendingPhone", recoveredPhone)
            localStorage.setItem("deliveryPendingPhone", recoveredPhone)
          }
        }
      } catch (_) {}
    }
  }, [phone])

  // Fetch status from API
  const fetchStatus = async (isManual = false) => {
    if (!phone) {
      setLoading(false)
      return
    }

    if (isManual) setIsRefreshing(true)

    try {
      const res = await deliveryAPI.getOnboardingStatus(phone)
      const data = res?.data?.data || res?.data || {}

      if (data.exists) {
        setOnboardingData(data.data || null)
        setStatus(data.status || "pending")
        setApplicationType(data.applicationType || "new")
        setRejectionReason(data.rejectionReason || "")

        // AUTO-LOGIN IF APPROVED
        if (data.status === "approved") {
          if (pollCancelRef.current) {
            pollCancelRef.current()
            pollCancelRef.current = null
          }

          setIsApprovedSuccess(true)

          if (data.auth?.accessToken && data.auth?.user) {
            try {
              storeAuthData("delivery", data.auth.accessToken, data.auth.user, data.auth.refreshToken || null)
              window.dispatchEvent(new Event("deliveryAuthChanged"))
              toast.success("Congratulations! Your delivery account is approved! 🎉")
              
              // Clean up pending session
              sessionStorage.removeItem("deliveryPendingPhone")
              localStorage.removeItem("deliveryPendingPhone")

              setTimeout(() => {
                navigate("/food/delivery", { replace: true })
              }, 1500)
            } catch (err) {
              console.error("Failed to auto-login approved delivery partner:", err)
            }
          }
        }
      }
    } catch (err) {
      console.warn("Failed to check onboarding status:", err)
    } finally {
      setLoading(false)
      if (isManual) setIsRefreshing(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchStatus()
  }, [phone])

  // Periodic polling for status changes — only while genuinely "pending".
  // "approved" auto-logs the user in above; "rejected" needs the seller to edit and
  // resubmit, so there's nothing further to wait for either.
  //
  // Starts at 4s (fast feedback right after applying) and backs off up to 60s for
  // long-pending applications, and pauses entirely while the tab is hidden so a
  // forgotten/backgrounded tab doesn't hammer the API forever — resuming with an
  // immediate check as soon as the tab is focused again.
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
  }, [phone, status])

  // Action: Re-apply (Edit and Resubmit)
  const handleReapply = () => {
    const digits = String(phone || "").replace(/\D/g, "")
    const phoneKey = digits.slice(-10)

    const details = {
      name: onboardingData?.name || "",
      phone: phoneKey,
      email: onboardingData?.email || "",
      countryCode: onboardingData?.countryCode || "+91",
      address: onboardingData?.address || "",
      city: onboardingData?.city || "",
      state: onboardingData?.state || "",
      vehicleType: onboardingData?.vehicleType || "bike",
      vehicleName: onboardingData?.vehicleName || "",
      vehicleNumber: onboardingData?.vehicleNumber || "",
      drivingLicenseNumber: onboardingData?.drivingLicenseNumber || "",
      panNumber: onboardingData?.panNumber || "",
      aadharNumber: onboardingData?.aadharNumber || "",
      ref: "",
    }

    const docs = {
      profilePhoto: onboardingData?.profilePhoto || null,
      aadharPhoto: onboardingData?.aadharPhoto || null,
      panPhoto: onboardingData?.panPhoto || null,
      drivingLicensePhoto: onboardingData?.drivingLicensePhoto || null,
    }

    // Save prefilled data in both sessionStorage and localStorage
    sessionStorage.setItem("deliverySignupDetails", JSON.stringify(details))
    sessionStorage.setItem("deliverySignupDocs", JSON.stringify(docs))
    sessionStorage.setItem("deliveryNeedsRegistration", "true")
    sessionStorage.setItem("deliveryIsReapplying", "true")

    if (phoneKey) {
      localStorage.setItem(`deliverySignup_${phoneKey}_details`, JSON.stringify(details))
      localStorage.setItem(`deliverySignup_${phoneKey}_docs`, JSON.stringify(docs))
      localStorage.setItem(`deliverySignup_${phoneKey}_needsRegistration`, "true")
    }

    toast.info("Your details have been loaded. Please edit and resubmit.")
    navigate("/food/delivery/signup/details", { replace: true })
  }

  // Action: Start New Onboarding from scratch
  const handleNewOnboarding = () => {
    const digits = String(phone || "").replace(/\D/g, "")
    const phoneKey = digits.slice(-10)

    sessionStorage.removeItem("deliverySignupDetails")
    sessionStorage.removeItem("deliverySignupDocs")
    sessionStorage.removeItem("deliveryIsReapplying")
    sessionStorage.setItem("deliveryNeedsRegistration", "true")

    if (phoneKey) {
      localStorage.removeItem(`deliverySignup_${phoneKey}_details`)
      localStorage.removeItem(`deliverySignup_${phoneKey}_docs`)
      localStorage.removeItem(`deliverySignup_${phoneKey}_needsRegistration`)
    }

    const freshDetails = {
      name: "",
      phone: phoneKey,
      countryCode: "+91",
    }
    sessionStorage.setItem("deliverySignupDetails", JSON.stringify(freshDetails))
    if (phoneKey) {
      localStorage.setItem(`deliverySignup_${phoneKey}_details`, JSON.stringify(freshDetails))
    }

    toast.info("Starting a fresh registration.")
    navigate("/food/delivery/signup/details", { replace: true })
  }

  // Action: Exit / Back to login
  const handleExit = () => {
    sessionStorage.removeItem("deliveryPendingPhone")
    localStorage.removeItem("deliveryPendingPhone")
    sessionStorage.removeItem("deliveryAuthData")
    navigate("/food/delivery/login", { replace: true })
  }

  const isRejected = status === "rejected"
  const isApproved = status === "approved" || isApprovedSuccess
  const isPending = !isRejected && !isApproved

  if (!phone) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Session Not Found</h2>
          <p className="text-sm text-slate-600">
            We could not find an active delivery application session. Please sign in to check your status.
          </p>
          <button
            onClick={() => navigate("/food/delivery/login", { replace: true })}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900">Sarathi Partner Application</h1>
              <p className="text-xs text-slate-500">{phone}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchStatus(true)}
              disabled={isRefreshing}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />
            </button>
            <button
              onClick={handleExit}
              className="text-xs font-semibold text-slate-600 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Exit
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-6 pb-20">
        
        {/* Approved Success State */}
        {isApproved && (
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-emerald-500/20 text-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto shadow-inner ring-4 ring-white/30">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5" /> Approved
              </span>
              <h2 className="text-2xl sm:text-3xl font-black">Welcome Aboard, Partner!</h2>
              <p className="text-sm text-emerald-50 max-w-md mx-auto">
                Your delivery application has been approved by the admin team. You are being redirected to your dashboard...
              </p>
            </div>
            <button
              onClick={() => navigate("/food/delivery", { replace: true })}
              className="mt-2 inline-flex items-center gap-2 px-6 py-3 bg-white text-emerald-700 font-bold rounded-2xl shadow-lg hover:bg-emerald-50 transition-all active:scale-95 text-sm"
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Pending / Under Review State */}
        {isPending && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-emerald-100 shadow-[0_10px_40px_rgba(16,185,129,0.06)] relative overflow-hidden space-y-5">
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50 rounded-full blur-3xl -z-0 pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-10 relative">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 shadow-sm">
                  <Clock3 className="w-7 h-7 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      Under Review
                    </span>
                    {applicationType === "reapplied" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">
                        <RotateCw className="w-3 h-3" /> Re-applied
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                    Your Profile is Under Review
                  </h2>
                </div>
              </div>

              <button
                onClick={() => fetchStatus(true)}
                disabled={isRefreshing}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                Check Status
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs text-slate-600 space-y-1.5">
              <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Verification In Progress
              </p>
              <p>
                Our team is currently reviewing your uploaded identity documents and vehicle details. Once verified, this screen will automatically activate your dashboard.
              </p>
              <div className="pt-2 flex items-center gap-2 text-[11px] font-medium text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live status checking active (every few seconds)
              </div>
            </div>
          </div>
        )}

        {/* Rejected State */}
        {isRejected && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-red-200 shadow-[0_10px_40px_rgba(239,68,68,0.08)] space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100 shadow-sm">
                <XCircle className="w-7 h-7" />
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-red-100 text-red-800">
                  Action Required
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                  Application Not Approved
                </h2>
              </div>
            </div>

            {/* Rejection Reason Card */}
            <div className="bg-red-50/80 border border-red-200 rounded-2xl p-4.5 space-y-2">
              <p className="text-xs font-bold text-red-900 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                Admin Feedback / Reason
              </p>
              <p className="text-sm text-red-800 font-medium leading-relaxed bg-white/70 p-3 rounded-xl border border-red-100 italic">
                "{rejectionReason || "Please review your submitted documents and re-apply with clear and accurate information."}"
              </p>
              <p className="text-xs text-red-700">
                You can easily update your details or re-upload your documents using the button below.
              </p>
            </div>

            {/* Actions for Rejection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleReapply}
                className="w-full py-3.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-lg shadow-red-600/20 text-sm flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <Edit3 className="w-4 h-4" />
                Re-apply & Edit Details
              </button>

              <button
                type="button"
                onClick={handleNewOnboarding}
                className="w-full py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <RotateCw className="w-4 h-4" />
                Start Fresh Onboarding
              </button>
            </div>
          </div>
        )}

        {/* Submitted Data Review Accordion */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setExpandedSection(prev => !prev)}
            className="w-full px-6 py-4.5 bg-slate-50/80 hover:bg-slate-100/80 flex items-center justify-between transition-colors border-b border-slate-200"
          >
            <div className="flex items-center gap-2.5 text-left">
              <FileText className="w-5 h-5 text-slate-700" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Your Submitted Application Details</h3>
                <p className="text-xs text-slate-500">Review all information and uploaded documents</p>
              </div>
            </div>
            <div className="p-1 rounded-lg bg-white border border-slate-200 text-slate-600">
              {expandedSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {expandedSection && (
            <div className="p-6 space-y-6 animate-in fade-in duration-300">
              
              {loading ? (
                <div className="py-12 text-center space-y-2 text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-500" />
                  <p className="text-xs">Loading submitted profile details...</p>
                </div>
              ) : onboardingData ? (
                <div className="space-y-6">
                  
                  {/* Section 1: Personal & Contact Details */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" /> Personal Details
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-semibold uppercase text-slate-400">Full Name</span>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">{onboardingData.name || "N/A"}</p>
                      </div>
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-semibold uppercase text-slate-400">Phone Number</span>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">{onboardingData.phone || phone}</p>
                      </div>
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-semibold uppercase text-slate-400">Email</span>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">{onboardingData.email || "Not Provided"}</p>
                      </div>
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-semibold uppercase text-slate-400">Location / City</span>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">
                          {[onboardingData.city, onboardingData.state].filter(Boolean).join(", ") || "N/A"}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 sm:col-span-2">
                        <span className="text-[10px] font-semibold uppercase text-slate-400">Complete Address</span>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{onboardingData.address || "N/A"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Vehicle Information */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Bike className="w-3.5 h-3.5 text-slate-500" /> Vehicle Information
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-semibold uppercase text-slate-400">Vehicle Type</span>
                        <p className="text-sm font-bold text-slate-800 mt-0.5 capitalize">{onboardingData.vehicleType || "Bike"}</p>
                      </div>
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-semibold uppercase text-slate-400">Vehicle Brand/Model</span>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">{onboardingData.vehicleName || "Not Specified"}</p>
                      </div>
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-semibold uppercase text-slate-400">Registration Number</span>
                        <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">{onboardingData.vehicleNumber || "N/A"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Identity & Government Documents */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-slate-500" /> Identity Documents & Photos
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      {/* Driving License */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between space-y-3">
                        <div>
                          <span className="text-[10px] font-semibold uppercase text-slate-400">Driving License</span>
                          <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">
                            {onboardingData.drivingLicenseNumber || "N/A"}
                          </p>
                        </div>
                        {onboardingData.drivingLicensePhoto ? (
                          <div 
                            onClick={() => setPreviewImage({ url: onboardingData.drivingLicensePhoto, title: "Driving License" })}
                            className="relative h-32 rounded-xl overflow-hidden bg-slate-200 cursor-pointer group border border-slate-300/60"
                          >
                            <img 
                              src={onboardingData.drivingLicensePhoto} 
                              alt="Driving License" 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity text-xs font-bold gap-1">
                              <Eye className="w-4 h-4" /> Click to Zoom
                            </div>
                          </div>
                        ) : (
                          <div className="h-24 bg-slate-100 rounded-xl flex items-center justify-center text-xs text-slate-400">
                            No Photo Uploaded
                          </div>
                        )}
                      </div>

                      {/* Aadhaar Card */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between space-y-3">
                        <div>
                          <span className="text-[10px] font-semibold uppercase text-slate-400">Aadhaar Card</span>
                          <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">
                            {onboardingData.aadharNumber 
                              ? onboardingData.aadharNumber.replace(/(\d{4})(?=\d)/g, "$1 ")
                              : "N/A"}
                          </p>
                        </div>
                        {onboardingData.aadharPhoto ? (
                          <div 
                            onClick={() => setPreviewImage({ url: onboardingData.aadharPhoto, title: "Aadhaar Card" })}
                            className="relative h-32 rounded-xl overflow-hidden bg-slate-200 cursor-pointer group border border-slate-300/60"
                          >
                            <img 
                              src={onboardingData.aadharPhoto} 
                              alt="Aadhaar Card" 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity text-xs font-bold gap-1">
                              <Eye className="w-4 h-4" /> Click to Zoom
                            </div>
                          </div>
                        ) : (
                          <div className="h-24 bg-slate-100 rounded-xl flex items-center justify-center text-xs text-slate-400">
                            No Photo Uploaded
                          </div>
                        )}
                      </div>

                      {/* PAN Card */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between space-y-3">
                        <div>
                          <span className="text-[10px] font-semibold uppercase text-slate-400">PAN Card</span>
                          <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">
                            {onboardingData.panNumber || "N/A"}
                          </p>
                        </div>
                        {onboardingData.panPhoto ? (
                          <div 
                            onClick={() => setPreviewImage({ url: onboardingData.panPhoto, title: "PAN Card" })}
                            className="relative h-32 rounded-xl overflow-hidden bg-slate-200 cursor-pointer group border border-slate-300/60"
                          >
                            <img 
                              src={onboardingData.panPhoto} 
                              alt="PAN Card" 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity text-xs font-bold gap-1">
                              <Eye className="w-4 h-4" /> Click to Zoom
                            </div>
                          </div>
                        ) : (
                          <div className="h-24 bg-slate-100 rounded-xl flex items-center justify-center text-xs text-slate-400">
                            No Photo Uploaded
                          </div>
                        )}
                      </div>

                      {/* Profile Photo */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between space-y-3">
                        <div>
                          <span className="text-[10px] font-semibold uppercase text-slate-400">Profile Photo</span>
                          <p className="text-sm font-bold text-slate-900 mt-0.5">
                            {onboardingData.name || "Delivery Partner"}
                          </p>
                        </div>
                        {onboardingData.profilePhoto ? (
                          <div 
                            onClick={() => setPreviewImage({ url: onboardingData.profilePhoto, title: "Profile Photo" })}
                            className="relative h-32 rounded-xl overflow-hidden bg-slate-200 cursor-pointer group border border-slate-300/60"
                          >
                            <img 
                              src={onboardingData.profilePhoto} 
                              alt="Profile" 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity text-xs font-bold gap-1">
                              <Eye className="w-4 h-4" /> Click to Zoom
                            </div>
                          </div>
                        ) : (
                          <div className="h-24 bg-slate-100 rounded-xl flex items-center justify-center text-xs text-slate-400">
                            No Photo Uploaded
                          </div>
                        )}
                      </div>

                    </div>
                  </div>

                  {/* Section 4: Bank Details (if available) */}
                  {(onboardingData.bankAccountNumber || onboardingData.upiId) && (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-slate-500" /> Payout / Bank Details
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-semibold uppercase text-slate-400">Account Holder</span>
                          <p className="text-sm font-bold text-slate-800 mt-0.5">{onboardingData.bankAccountHolderName || "N/A"}</p>
                        </div>
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-semibold uppercase text-slate-400">Bank & IFSC</span>
                          <p className="text-sm font-bold text-slate-800 mt-0.5">
                            {[onboardingData.bankName, onboardingData.bankIfscCode].filter(Boolean).join(" - ") || "N/A"}
                          </p>
                        </div>
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-semibold uppercase text-slate-400">Account Number</span>
                          <p className="text-sm font-mono font-bold text-slate-800 mt-0.5">{onboardingData.bankAccountNumber || "N/A"}</p>
                        </div>
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-semibold uppercase text-slate-400">UPI ID</span>
                          <p className="text-sm font-bold text-slate-800 mt-0.5">{onboardingData.upiId || "N/A"}</p>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-500">
                  No profile information could be loaded for this phone number.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-xs text-slate-500 text-center sm:text-left">
            Need help? Contact support team at support@itzo.in
          </p>

          <button
            type="button"
            onClick={handleExit}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 underline py-2 transition-colors"
          >
            Back to Sign In
          </button>
        </div>

      </main>

      {/* High-Res Image Lightbox Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl space-y-3 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2">
              <h4 className="text-sm font-bold text-slate-800">{previewImage.title}</h4>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-slate-950 max-h-[75vh] flex items-center justify-center">
              <img 
                src={previewImage.url} 
                alt={previewImage.title} 
                className="max-h-[75vh] w-auto max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
