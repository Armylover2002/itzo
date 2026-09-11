import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Loader2, Users } from "lucide-react"
import { adminAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { normalizeImageUrl } from "@food/utils/common"
import { formatSlotRange } from "@food/utils/dining"
import { toast } from "sonner"

const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api(\/v1)?\/?$/i, "")
const STATUS_OPTIONS = ["", "pending", "confirmed", "seated", "completed", "cancelled", "no_show"]

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

const RestaurantCell = ({ restaurant, nameFallback }) => {
  const image = normalizeImageUrl(
    restaurant?.coverImages?.[0] || (typeof restaurant?.profileImage === "string" ? restaurant.profileImage : restaurant?.profileImage?.url),
    BACKEND_ORIGIN,
  )
  const [failed, setFailed] = useState(false)
  const name = restaurant?.restaurantName || nameFallback || "Unknown"
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-bold text-slate-500">
        {image && !failed ? (
          <img src={image} alt={name} className="h-full w-full object-cover" onError={() => setFailed(true)} />
        ) : (
          String(name).slice(0, 1).toUpperCase()
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900">{name}</p>
        {(restaurant?.area || restaurant?.city) && (
          <p className="truncate text-xs text-slate-400">{[restaurant?.area, restaurant?.city].filter(Boolean).join(", ")}</p>
        )}
      </div>
    </div>
  )
}

export default function DiningBookings() {
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("")
  const [date, setDate] = useState("")

  const fetchReservations = async () => {
    try {
      setLoading(true)
      const params = { limit: 200 }
      if (status) params.status = status
      if (date) params.date = date
      const response = await adminAPI.getDiningBookings(params)
      const list = response?.data?.data?.reservations || []
      setReservations(Array.isArray(list) ? list : [])
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load bookings")
      setReservations([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReservations() }, [status, date])

  const totalGuests = useMemo(() => reservations.reduce((sum, r) => sum + (r.guests || 0), 0), [reservations])

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dining Bookings</h1>
            <p className="mt-1 text-sm text-slate-500">{reservations.length} bookings — {totalGuests} guests</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-900"
              />
            </div>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-900"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt || "all"} value={opt}>{opt ? opt.replace("_", " ") : "All statuses"}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="w-[27%] px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">Restaurant</th>
                <th className="w-[18%] px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">Guest</th>
                <th className="w-[22%] px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">Date / Slot</th>
                <th className="w-[8%] px-4 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <Users className="mx-auto h-4 w-4" />
                </th>
                <th className="w-[15%] px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">Status</th>
                <th className="w-[10%] px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-600">Bill</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-20 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </td></tr>
              ) : reservations.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-20 text-center">
                  <p className="text-lg font-semibold text-slate-700">No bookings found</p>
                </td></tr>
              ) : (
                reservations.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <RestaurantCell restaurant={r.restaurant} nameFallback={r.restaurantNameSnapshot} />
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      <p className="font-medium text-slate-800">{r.userNameSnapshot || "-"}</p>
                      <p className="text-xs text-slate-400">{r.userPhoneSnapshot || ""}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {r.bookingDate ? new Date(r.bookingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "-"} · {formatSlotRange(r.slotStart, r.slotEnd)}
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-medium text-slate-700">{r.guests}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${statusBadgeClass(r.status)}`}>
                        {String(r.status || "").replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-xs text-slate-400">{r.billId ? "Yes" : "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
