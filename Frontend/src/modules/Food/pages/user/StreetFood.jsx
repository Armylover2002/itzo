import { Link } from "react-router-dom"
import { Star, MapPin, Radio } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import PageNavbar from "@food/components/user/PageNavbar"
import OptimizedImage from "@food/components/OptimizedImage"
import { useLocation } from "@food/hooks/useLocation"
import { useZone } from "@food/hooks/useZone"
import { useStreetFoodData } from "@food/hooks/user/useStreetFoodData"

export default function StreetFood() {
  const { location } = useLocation()
  const { zoneId } = useZone(location)
  const { restaurants, loading } = useStreetFoodData(zoneId)

  return (
    <AnimatedPage>
      <div className="relative min-h-screen bg-white dark:bg-[#0a0a0a]">
        <div className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-sm border-b border-gray-100 dark:bg-[#0a0a0a]/95 dark:border-gray-800">
          <PageNavbar textColor="black" zIndex={20} showProfile={false} showLogo={false} />
        </div>

        <div className="mx-auto max-w-7xl px-3 pb-8 pt-4 sm:px-4 md:px-6">
          <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
            Street Food Vendors
          </h1>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Discover live street food stalls near you
          </p>

          {loading ? (
            <div className="flex justify-center items-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FF0000] border-t-transparent" />
            </div>
          ) : restaurants.length === 0 ? (
            <div className="flex justify-center items-center py-16 text-gray-500 dark:text-gray-400">
              No street food vendors available in your area right now.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {restaurants.map((restaurant, index) => {
                const slug = restaurant.slug || String(restaurant.id || restaurant._id || `vendor-${index}`)
                const isLive = Boolean(restaurant.liveTrackingEnabled)
                return (
                  <Link
                    key={restaurant.id || restaurant._id || slug}
                    to={`/user/restaurants/${slug}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-gray-800 dark:bg-[#1a1a1a]"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-50 dark:bg-gray-900">
                      <OptimizedImage
                        src={restaurant.image || restaurant.images?.[0]}
                        alt={restaurant.name}
                        className="h-full w-full"
                        objectFit="cover"
                        priority={index < 4}
                      />
                      {isLive && (
                        <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 backdrop-blur-sm">
                          <Radio className="h-3 w-3 animate-pulse text-red-400" />
                          <span className="text-[10px] font-semibold text-white">LIVE</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="line-clamp-1 text-[13px] font-bold text-gray-900 dark:text-white sm:text-[15px]">
                          {restaurant.name}
                        </h3>
                        {Number(restaurant.rating) > 0 && (
                          <div className="flex shrink-0 items-center gap-0.5 rounded-md bg-green-700 px-1.5 py-0.5 text-white">
                            <span className="text-[10px] font-bold">{Number(restaurant.rating).toFixed(1)}</span>
                            <Star className="h-2.5 w-2.5 fill-white" strokeWidth={0} />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                        <MapPin className="h-3 w-3" />
                        <span className="line-clamp-1">{restaurant.distance || restaurant.location?.area || "Nearby"}</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AnimatedPage>
  )
}
