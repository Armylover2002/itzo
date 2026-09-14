import { ShieldCheck, Clock3 } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"

export default function PendingVerification() {
  const navigate = useNavigate()
  const location = useLocation()
  const phone =
    location.state?.phone ||
    sessionStorage.getItem("deliveryPendingPhone") ||
    ""
  const reviewMessage =
    location.state?.message ||
    "Your onboarding request is under review. Your documents are currently being verified. You will receive approval once reviewed by admin."

  return (
    <div className="min-h-screen bg-[#f8faf8] px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center">
        <div className="rounded-[28px] border border-[#d8e7d8] bg-white p-7 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e9f8ef] text-[#00B761]">
            <ShieldCheck className="h-8 w-8" />
          </div>

          <div className="space-y-3">
            <p className="inline-flex items-center gap-2 rounded-full bg-[#f3faf5] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0f7a42]">
              <Clock3 className="h-3.5 w-3.5" />
              Verification In Progress
            </p>

            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Your delivery profile is under review
            </h1>

            <p className="text-sm leading-6 text-slate-600">
              {reviewMessage}
            </p>

            {phone ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Registered Number
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{phone}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => navigate("/food/delivery/login", { replace: true })}
              className="w-full rounded-2xl bg-[#00B761] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#00A055]"
            >
              Back to Login
            </button>

            <p className="text-center text-xs leading-5 text-slate-500">
              You can sign in later to check your approval status.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
