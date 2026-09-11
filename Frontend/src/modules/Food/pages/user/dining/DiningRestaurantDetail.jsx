import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Loader2, Minus, Plus, Star, Users, MapPin, UtensilsCrossed } from "lucide-react"
import { userAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { normalizeImageUrl } from "@food/utils/common"
import { useAuth } from "@core/context/AuthContext"
import { toast } from "sonner"

const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api(\/v1)?\/?$/i, "")

const formatDateKey = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

const buildNextDays = (count = 14) => {
  const days = []
  const today = new Date()
  for (let i = 0; i < count; i += 1) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  return days
}

const formatTime12 = (time24) => {
  if (!time24) return ""
  const [h, m] = time24.split(":").map(Number)
  const period = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, "0")} ${period}`
}

export default function DiningRestaurantDetail() {
  const { restaurantId } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [restaurant, setRestaurant] = useState(null)
  const [coverImageFailed, setCoverImageFailed] = useState(false)

  const dateOptions = useMemo(() => buildNextDays(14), [])
  const [selectedDate, setSelectedDate] = useState(dateOptions[0])
  const [guests, setGuests] = useState(2)
  const [availability, setAvailability] = useState(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [specialRequest, setSpecialRequest] = useState("")
  const [booking, setBooking] = useState(false)

  useEffect(() => {
    userAPI.getDiningRestaurantDetail(restaurantId)
      .then((response) => {
        const data = response?.data?.data
        setProfile(data?.profile || null)
        setRestaurant(data?.restaurant || null)
      })
      .catch((error) => toast.error(error?.response?.data?.message || "Failed to load restaurant"))
      .finally(() => setLoading(false))
  }, [restaurantId])

  useEffect(() => {
    setSelectedSlot(null)
    setLoadingSlots(true)
    userAPI.getDiningAvailability(restaurantId, formatDateKey(selectedDate))
      .then((response) => setAvailability(response?.data?.data || null))
      .catch(() => setAvailability({ slots: [] }))
      .finally(() => setLoadingSlots(false))
  }, [restaurantId, selectedDate])

  const handleBook = async () => {
    if (!isAuthenticated) {
      navigate("/user/auth/login", { state: { redirectTo: `/food/user/dining/${restaurantId}` } })
      return
    }
    if (!selectedSlot) {
      toast.error("Please select a time slot")
      return
    }
    if (guests < 1) {
      toast.error("Guest count must be at least 1")
      return
    }
    try {
      setBooking(true)
      const response = await userAPI.createDiningReservation({
        restaurantId,
        date: formatDateKey(selectedDate),
        slotStart: selectedSlot.start,
        guests,
        specialRequest,
      })
      if (response?.data?.success) {
        toast.success("Table booked!")
        navigate("/food/user/dining/bookings")
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to book table")
    } finally {
      setBooking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#FE5502]" />
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="p-6 text-center text-gray-600">
        Restaurant not found.
        <button onClick={() => navigate(-1)} className="mt-3 block text-sm text-[#FE5502] underline">Go back</button>
      </div>
    )
  }

  const coverImage = normalizeImageUrl(
    restaurant.coverImages?.[0] || (typeof restaurant.profileImage === "string" ? restaurant.profileImage : restaurant.profileImage?.url),
    BACKEND_ORIGIN,
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-32 dark:bg-[#121212]">
      <div className="relative">
        <div className="aspect-[16/9] w-full bg-gray-200 sm:aspect-[21/9]">
          {coverImage && !coverImageFailed ? (
            <img src={coverImage} alt={restaurant.restaurantName} className="h-full w-full object-cover" onError={() => setCoverImageFailed(true)} />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <UtensilsCrossed className="h-10 w-10 text-gray-300" />
            </div>
          )}
        </div>
        <button onClick={() => navigate(-1)} className="absolute left-4 top-4 rounded-full bg-white/90 p-2 shadow-sm hover:bg-white">
          <ArrowLeft className="h-5 w-5 text-gray-800" />
        </button>
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{restaurant.restaurantName}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {[restaurant.area, restaurant.city].filter(Boolean).join(", ")}</span>
          {restaurant.rating != null && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
              <Star className="h-3.5 w-3.5 fill-emerald-700" /> {Number(restaurant.rating).toFixed(1)}
            </span>
          )}
          {profile?.avgCostForTwo > 0 && <span>₹{profile.avgCostForTwo} for two</span>}
        </div>
        {Array.isArray(profile?.categoryIds) && profile.categoryIds.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.categoryIds.map((cat) => (
              <span key={cat._id} className="flex items-center gap-1.5 rounded-full border border-gray-200 py-1 pl-1 pr-3 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-300">
                <span className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-gray-100">
                  {cat.image ? (
                    <img src={cat.image} alt={cat.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[9px] font-bold text-gray-400">
                      {String(cat.name || "C").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>
                {cat.name}
              </span>
            ))}
          </div>
        )}
        {profile?.description && <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{profile.description}</p>}

        {Array.isArray(profile?.ambienceImages) && profile.ambienceImages.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {profile.ambienceImages.map((url) => (
              <div key={url} className="aspect-square w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                <img src={url} alt="Ambience" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#1a1a1a]">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Book a Table</h2>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {dateOptions.map((d) => {
              const isSelected = formatDateKey(d) === formatDateKey(selectedDate)
              return (
                <button
                  key={formatDateKey(d)}
                  onClick={() => setSelectedDate(d)}
                  className={`flex shrink-0 flex-col items-center rounded-xl border px-3 py-2 text-xs font-semibold ${isSelected ? "border-[#FE5502] bg-[#FE5502] text-white" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300"}`}
                >
                  <span>{d.toLocaleDateString("en-IN", { weekday: "short" })}</span>
                  <span className="text-sm">{d.getDate()}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Guests</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setGuests((g) => Math.max(1, g - 1))} className="rounded-full border border-gray-300 p-1.5 hover:bg-gray-50 dark:border-gray-700">
                <Minus className="h-4 w-4" />
              </button>
              <span className="flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-white"><Users className="h-4 w-4" /> {guests}</span>
              <button onClick={() => setGuests((g) => g + 1)} className="rounded-full border border-gray-300 p-1.5 hover:bg-gray-50 dark:border-gray-700">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4">
            <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Available Slots</span>
            {loadingSlots ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#FE5502]" /></div>
            ) : (availability?.slots || []).length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">No slots available on this date</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availability.slots.map((slot) => {
                  const disabled = !slot.isAvailable || slot.remaining < guests
                  const isSelected = selectedSlot?.start === slot.start
                  return (
                    <button
                      key={slot.start}
                      disabled={disabled}
                      onClick={() => setSelectedSlot(slot)}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                        disabled ? "cursor-not-allowed border-gray-100 text-gray-300 dark:border-gray-800"
                        : isSelected ? "border-[#FE5502] bg-[#FE5502] text-white"
                        : "border-gray-200 text-gray-700 hover:border-[#FE5502] dark:border-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {formatTime12(slot.start)}
                      <span className="ml-1 text-[10px] opacity-75">({slot.remaining} left)</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Special request (optional)</label>
            <textarea
              value={specialRequest}
              onChange={(event) => setSpecialRequest(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Window seat, birthday celebration, etc."
              className="w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-[#FE5502] dark:border-gray-700 dark:bg-[#121212] dark:text-white"
            />
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-[#1a1a1a]">
        <div className="mx-auto max-w-3xl">
          <button
            onClick={handleBook}
            disabled={booking || !selectedSlot}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FE5502] px-4 py-3.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {booking ? "Booking..." : selectedSlot ? `Book Table — ${formatTime12(selectedSlot.start)}` : "Select a slot to book"}
          </button>
        </div>
      </div>
    </div>
  )
}
