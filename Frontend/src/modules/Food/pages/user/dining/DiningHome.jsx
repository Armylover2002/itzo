import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, CalendarCheck, Loader2, MapPin, Search, Star, UtensilsCrossed } from "lucide-react"
import { userAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { normalizeImageUrl } from "@food/utils/common"
import { useAuth } from "@core/context/AuthContext"
import { toast } from "sonner"
import DiningBannerCarousel from "@food/components/user/dining/DiningBannerCarousel"

const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api(\/v1)?\/?$/i, "")

function DiningRestaurantCard({ entry }) {
  const restaurant = entry.restaurant
  const coverImage = normalizeImageUrl(
    restaurant?.coverImages?.[0] || (typeof restaurant?.profileImage === "string" ? restaurant.profileImage : restaurant?.profileImage?.url),
    BACKEND_ORIGIN,
  )
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <Link to={`/food/user/dining/${entry.restaurantId}`} className="group block overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-[#1a1a1a]">
      <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
        {coverImage && !imageFailed ? (
          <img
            src={coverImage}
            alt={restaurant?.restaurantName}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <UtensilsCrossed className="h-8 w-8 text-gray-300" />
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="truncate font-bold text-gray-900 dark:text-white">{restaurant?.restaurantName}</p>
        <div className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{[restaurant?.area, restaurant?.city].filter(Boolean).join(", ")}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          {restaurant?.rating != null && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
              <Star className="h-3 w-3 fill-emerald-700" /> {Number(restaurant.rating).toFixed(1)}
            </span>
          )}
          {entry.avgCostForTwo > 0 && <span className="text-xs text-gray-500 dark:text-gray-400">₹{entry.avgCostForTwo} for two</span>}
        </div>
      </div>
    </Link>
  )
}

export default function DiningHome() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const bookingsPath = isAuthenticated ? "/food/user/dining/bookings" : "/user/auth/login"
  const bookingsLinkState = isAuthenticated ? undefined : { redirectTo: "/food/user/dining/bookings" }
  const [banners, setBanners] = useState([])
  const [categories, setCategories] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    Promise.all([userAPI.getDiningBanners(), userAPI.getDiningCategories()])
      .then(([bannersRes, categoriesRes]) => {
        setBanners(bannersRes?.data?.data?.banners || [])
        setCategories(categoriesRes?.data?.data?.categories || [])
      })
      .catch(() => {})
  }, [])

  const fetchRestaurants = async () => {
    try {
      setLoading(true)
      const params = {}
      if (activeCategory) params.categoryId = activeCategory
      if (searchQuery.trim()) params.search = searchQuery.trim()
      const response = await userAPI.getDiningRestaurants(params)
      const list = response?.data?.data?.restaurants || []
      setRestaurants(Array.isArray(list) ? list : [])
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load dining restaurants")
      setRestaurants([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(fetchRestaurants, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, searchQuery])

  return (
    <div className="min-h-screen bg-gray-50 pb-10 dark:bg-[#121212]">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-[#1a1a1a] md:hidden">
        <button onClick={() => navigate(-1)} className="rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="flex-1 text-lg font-bold text-gray-900 dark:text-white">Dining</h1>
        <Link
          to={bookingsPath}
          state={bookingsLinkState}
          className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-300"
        >
          <CalendarCheck className="h-4 w-4" />
          My Bookings
        </Link>
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-4 md:pt-8">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="hidden items-center gap-2 md:flex">
            <UtensilsCrossed className="h-6 w-6 text-[#FE5502]" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dining</h1>
          </div>
          <Link
            to={bookingsPath}
            state={bookingsLinkState}
            className="hidden items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-[#FE5502] hover:text-[#FE5502] dark:border-gray-700 dark:text-gray-300 md:flex"
          >
            <CalendarCheck className="h-4 w-4" />
            My Bookings
          </Link>
        </div>
        <p className="mb-5 hidden text-sm text-gray-500 dark:text-gray-400 md:block">Book a table and pay your bill right from the app.</p>

        <DiningBannerCarousel banners={banners} />

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search dining restaurants"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#FE5502] dark:border-gray-800 dark:bg-[#1a1a1a] dark:text-white"
          />
        </div>

        {categories.length > 0 && (
          <div className="mb-5 flex gap-3 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategory("")}
              className="flex shrink-0 flex-col items-center gap-1.5"
            >
              <span className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${!activeCategory ? "border-[#FE5502] bg-[#FE5502]/10 text-[#FE5502]" : "border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400"}`}>
                All
              </span>
              <span className={`text-xs font-medium ${!activeCategory ? "text-[#FE5502]" : "text-gray-600 dark:text-gray-300"}`}>All</span>
            </button>
            {categories.map((cat) => (
              <button
                key={cat._id}
                onClick={() => setActiveCategory(cat._id)}
                className="flex shrink-0 flex-col items-center gap-1.5"
              >
                <span className={`h-14 w-14 overflow-hidden rounded-full border-2 bg-gray-100 transition-colors ${activeCategory === cat._id ? "border-[#FE5502]" : "border-gray-200 dark:border-gray-700"}`}>
                  {cat.image ? (
                    <img src={cat.image} alt={cat.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-bold text-gray-400">
                      {String(cat.name || "C").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className={`max-w-[64px] truncate text-xs font-medium ${activeCategory === cat._id ? "text-[#FE5502]" : "text-gray-600 dark:text-gray-300"}`}>
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#FE5502]" />
          </div>
        ) : restaurants.length === 0 ? (
          <div className="py-16 text-center">
            <UtensilsCrossed className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-base font-semibold text-gray-700 dark:text-gray-300">No dining restaurants found</p>
            <p className="mt-1 text-sm text-gray-400">Try a different search or category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {restaurants.map((r) => (
              <DiningRestaurantCard key={r.restaurantId} entry={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
