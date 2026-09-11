import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Calendar, Loader2, MapPin, Receipt, UtensilsCrossed, Users } from "lucide-react"
import { userAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { normalizeImageUrl } from "@food/utils/common"
import { formatTime12Hour } from "@food/utils/dining"
import { toast } from "sonner"

const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api(\/v1)?\/?$/i, "")

const statusBadgeClass = (status) => {
  switch (status) {
    case "confirmed": return "bg-blue-50 text-blue-700 border-blue-200"
    case "seated": return "bg-indigo-50 text-indigo-700 border-indigo-200"
    case "completed": return "bg-emerald-50 text-emerald-700 border-emerald-200"
    case "cancelled": return "bg-rose-50 text-rose-700 border-rose-200"
    case "no_show": return "bg-gray-100 text-gray-600 border-gray-200"
    default: return "bg-amber-50 text-amber-700 border-amber-200"
  }
}

const TABS = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
]

function BookingCard({ reservation }) {
  const restaurant = reservation.restaurant
  const image = normalizeImageUrl(
    restaurant?.coverImages?.[0] || (typeof restaurant?.profileImage === "string" ? restaurant.profileImage : restaurant?.profileImage?.url),
    BACKEND_ORIGIN,
  )
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <Link to={`/food/user/dining/bookings/${reservation._id}`} className="flex gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-[#1a1a1a]">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
        {image && !imageFailed ? (
          <img src={image} alt={reservation.restaurantNameSnapshot} className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <UtensilsCrossed className="h-6 w-6 text-gray-300" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-bold text-gray-900 dark:text-white">{reservation.restaurantNameSnapshot}</p>
          <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${statusBadgeClass(reservation.status)}`}>
            {String(reservation.status || "").replace("_", " ")}
          </span>
        </div>
        {restaurant?.area || restaurant?.city ? (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{[restaurant?.area, restaurant?.city].filter(Boolean).join(", ")}</span>
          </p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(reservation.bookingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {formatTime12Hour(reservation.slotStart)}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {reservation.guests}
          </span>
        </div>
        {reservation.billId && (
          <span className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-[#FE5502]">
            <Receipt className="h-3.5 w-3.5" /> Bill ready
          </span>
        )}
      </div>
    </Link>
  )
}

export default function MyDiningBookings() {
  const navigate = useNavigate()
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("all")

  useEffect(() => {
    userAPI.getMyDiningReservations()
      .then((response) => setReservations(response?.data?.data?.reservations || []))
      .catch((error) => toast.error(error?.response?.data?.message || "Failed to load bookings"))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (tab === "all") return reservations
    const now = new Date()
    return reservations.filter((r) => {
      const isPastStatus = ["completed", "cancelled", "no_show"].includes(r.status)
      const isPastDate = new Date(r.bookingDate) < new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const isPast = isPastStatus || isPastDate
      return tab === "past" ? isPast : !isPast
    })
  }, [reservations, tab])

  return (
    <div className="min-h-screen bg-gray-50 pb-10 dark:bg-[#121212]">
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-[#1a1a1a]">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">My Dining Bookings</h1>
        </div>
        <div className="flex items-center gap-2 px-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${tab === t.key ? "border-[#FE5502] text-[#FE5502]" : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#FE5502]" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <UtensilsCrossed className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 font-semibold text-gray-700 dark:text-gray-300">
              {tab === "all" ? "No dining bookings yet" : `No ${tab} bookings`}
            </p>
            {tab !== "past" && (
              <Link to="/food/user/dining" className="mt-3 inline-block text-sm font-semibold text-[#FE5502]">Explore restaurants</Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <BookingCard key={r._id} reservation={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
