import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Check, Loader2, Phone, Receipt, Users, X } from "lucide-react"
import { restaurantAPI } from "@food/api"
import { formatSlotRange } from "@food/utils/dining"
import { toast } from "sonner"

const TABS = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
]

const statusBadgeClass = (status) => {
  switch (status) {
    case "confirmed": return "bg-blue-50 text-blue-700 border-blue-200"
    case "seated": return "bg-indigo-50 text-indigo-700 border-indigo-200"
    case "completed": return "bg-emerald-50 text-emerald-700 border-emerald-200"
    case "cancelled": return "bg-rose-50 text-rose-700 border-rose-200"
    case "no_show": return "bg-slate-100 text-slate-600 border-slate-200"
    default: return "bg-amber-50 text-amber-700 border-amber-200"
  }
}

const isSameDay = (a, b) => {
  const d1 = new Date(a)
  const d2 = new Date(b)
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
}

export default function DiningBookingsPage() {
  const navigate = useNavigate()
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("today")
  const [processingId, setProcessingId] = useState(null)

  const fetchReservations = async () => {
    try {
      setLoading(true)
      const response = await restaurantAPI.getDiningReservations({ limit: 300 })
      const list = response?.data?.data?.reservations || []
      setReservations(Array.isArray(list) ? list : [])
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load bookings")
      setReservations([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReservations() }, [])

  const grouped = useMemo(() => {
    const now = new Date()
    const groups = { today: [], upcoming: [], past: [] }
    for (const r of reservations) {
      if (!r.bookingDate) continue
      if (isSameDay(r.bookingDate, now)) groups.today.push(r)
      else if (new Date(r.bookingDate) > now) groups.upcoming.push(r)
      else groups.past.push(r)
    }
    return groups
  }, [reservations])

  const filtered = grouped[tab] || []

  const handleStatusChange = async (reservation, status) => {
    try {
      setProcessingId(reservation._id)
      const response = await restaurantAPI.updateDiningReservationStatus(reservation._id, { status })
      if (response?.data?.success) {
        toast.success("Booking updated")
        fetchReservations()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update booking")
    } finally {
      setProcessingId(null)
    }
  }

  const goToBill = (reservation) => {
    navigate(`/food/restaurant/dining/bookings/${reservation._id}/bill`)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Dining Bookings</h1>
        <p className="mt-1 text-sm text-slate-500">Confirm, seat, and bill your guests' table reservations.</p>
        <div className="mt-4 flex items-center gap-2 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${tab === t.key ? "border-[#0f2d5a] text-[#0f2d5a]" : "border-transparent text-slate-600 hover:text-slate-900"}`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab === t.key ? "bg-[#0f2d5a] text-white" : "bg-slate-100 text-slate-500"}`}>
                {grouped[t.key]?.length ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#0f2d5a]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center">
          <p className="text-lg font-semibold text-slate-700">No {tab} bookings</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-500">
                    {String(r.userNameSnapshot || "G").slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{r.userNameSnapshot || "Guest"}</p>
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${statusBadgeClass(r.status)}`}>
                        {String(r.status || "").replace("_", " ")}
                      </span>
                    </div>
                    {r.userPhoneSnapshot && (
                      <a href={`tel:${r.userPhoneSnapshot}`} className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 hover:text-[#0f2d5a]">
                        <Phone className="h-3 w-3" /> {r.userPhoneSnapshot}
                      </a>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                      <span>{new Date(r.bookingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {formatSlotRange(r.slotStart, r.slotEnd)}</span>
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {r.guests} guests</span>
                    </div>
                    {r.specialRequest && <p className="mt-1 text-xs italic text-slate-400">"{r.specialRequest}"</p>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {r.status === "pending" && (
                    <>
                      <button onClick={() => handleStatusChange(r, "confirmed")} disabled={processingId === r._id} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                        <Check className="h-3.5 w-3.5" /> Confirm
                      </button>
                      <button onClick={() => handleStatusChange(r, "cancelled")} disabled={processingId === r._id} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                        <X className="h-3.5 w-3.5" /> Cancel
                      </button>
                    </>
                  )}
                  {r.status === "confirmed" && (
                    <>
                      <button onClick={() => handleStatusChange(r, "seated")} disabled={processingId === r._id} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                        Mark Seated
                      </button>
                      <button onClick={() => handleStatusChange(r, "no_show")} disabled={processingId === r._id} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                        No Show
                      </button>
                      <button onClick={() => handleStatusChange(r, "cancelled")} disabled={processingId === r._id} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                        Cancel
                      </button>
                    </>
                  )}
                  {r.status === "seated" && (
                    <button onClick={() => goToBill(r)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f2d5a] px-3 py-2 text-xs font-semibold text-white">
                      <Receipt className="h-3.5 w-3.5" /> Build Bill
                    </button>
                  )}
                  {r.status === "completed" && r.billId && (
                    <button onClick={() => goToBill(r)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">
                      <Receipt className="h-3.5 w-3.5" /> View Bill
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
