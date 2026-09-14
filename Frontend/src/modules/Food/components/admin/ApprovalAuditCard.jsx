const formatActionDate = (value) => {
  if (!value) return "N/A"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "N/A"

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const getPerformerValue = (performer, key, fallback = "System / Legacy") => {
  const value = performer?.[key]
  if (value === null || value === undefined) return fallback

  const normalized = String(value).trim()
  return normalized || fallback
}

function AuditBlock({ title, performer, tone = "approved", reason, actionLabel }) {
  if (!performer) return null

  const palette = tone === "rejected"
    ? {
        wrapper: "bg-rose-50 border-rose-200",
        title: "text-rose-900",
        divider: "bg-rose-200",
        label: "text-rose-700",
        value: "text-rose-950",
      }
    : {
        wrapper: "bg-emerald-50 border-emerald-200",
        title: "text-emerald-900",
        divider: "bg-emerald-200",
        label: "text-emerald-700",
        value: "text-emerald-950",
      }

  return (
    <div className={`rounded-xl border p-4 ${palette.wrapper}`}>
      <p className={`text-sm font-semibold ${palette.title}`}>{title}</p>
      <div className={`my-3 h-px w-full ${palette.divider}`} />
      <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
        <div>
          <p className={`text-[11px] font-bold uppercase tracking-wider ${palette.label}`}>Name</p>
          <p className={`mt-1 font-medium ${palette.value}`}>{getPerformerValue(performer, "name")}</p>
        </div>
        <div>
          <p className={`text-[11px] font-bold uppercase tracking-wider ${palette.label}`}>Role</p>
          <p className={`mt-1 font-medium ${palette.value}`}>{getPerformerValue(performer, "roleName", getPerformerValue(performer, "role"))}</p>
        </div>
        <div>
          <p className={`text-[11px] font-bold uppercase tracking-wider ${palette.label}`}>Email</p>
          <p className={`mt-1 break-all font-medium ${palette.value}`}>{getPerformerValue(performer, "email")}</p>
        </div>
        <div>
          <p className={`text-[11px] font-bold uppercase tracking-wider ${palette.label}`}>Phone</p>
          <p className={`mt-1 font-medium ${palette.value}`}>{getPerformerValue(performer, "phone")}</p>
        </div>
        {reason ? (
          <div className="md:col-span-2">
            <p className={`text-[11px] font-bold uppercase tracking-wider ${palette.label}`}>Reason</p>
            <p className={`mt-1 whitespace-pre-wrap font-medium ${palette.value}`}>{reason}</p>
          </div>
        ) : null}
        <div className="md:col-span-2">
          <p className={`text-[11px] font-bold uppercase tracking-wider ${palette.label}`}>{actionLabel}</p>
          <p className={`mt-1 font-medium ${palette.value}`}>{formatActionDate(performer?.actionAt)}</p>
        </div>
      </div>
    </div>
  )
}

export default function ApprovalAuditCard({
  approvedBy = null,
  rejectedBy = null,
  rejectionReason = "",
  className = "",
}) {
  if (!approvedBy && !rejectedBy) return null

  return (
    <div className={className}>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h4 className="text-lg font-semibold text-slate-900">Approval Information</h4>
          <p className="text-sm text-slate-500">
            Admin snapshot captured when this application was approved or rejected.
          </p>
        </div>
        <div className="space-y-4">
          <AuditBlock
            title="Approved By"
            performer={approvedBy}
            tone="approved"
            actionLabel="Approved At"
          />
          <AuditBlock
            title="Rejected By"
            performer={rejectedBy}
            tone="rejected"
            reason={String(rejectionReason || "").trim()}
            actionLabel="Rejected At"
          />
        </div>
      </div>
    </div>
  )
}
