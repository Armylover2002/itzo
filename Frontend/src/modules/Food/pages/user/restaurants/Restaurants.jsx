import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Clock, MapPin, Heart, Star } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import Footer from "@food/components/user/Footer"
import ScrollReveal from "@food/components/user/ScrollReveal"
import TextReveal from "@food/components/user/TextReveal"
import { Card, CardTitle, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { RestaurantGridSkeleton } from "@food/components/ui/loading-skeletons"
import { useProfile } from "@food/context/ProfileContext"
import { useZone } from "@food/hooks/useZone"
import { useLocation } from "@food/hooks/useLocation"
import { restaurantAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { useDelayedLoading } from "@food/hooks/useDelayedLoading"

const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "")

const normalizeImageUrl = (imageUrl) => {
  if (typeof imageUrl !== "string" || !imageUrl.trim()) return ""
  const trimmed = imageUrl.trim()
  if (/^(https?:)?\/\//i.test(trimmed) || /^data:/i.test(trimmed) || /^blob:/i.test(trimmed)) {
    return trimmed
  }
  return trimmed.startsWith("/")
    ? `${BACKEND_ORIGIN}${trimmed}`
    : `${BACKEND_ORIGIN}/${trimmed}`
}

const pickRestaurantImage = (restaurant) => {
  const candidates = [
    restaurant?.coverImage?.url,
    restaurant?.coverImage,
    ...(Array.isArray(restaurant?.coverImages) ? restaurant.coverImages.map((img) => img?.url || img) : []),
    ...(Array.isArray(restaurant?.menuImages) ? restaurant.menuImages.map((img) => img?.url || img) : []),
    restaurant?.profileImage?.url,
    restaurant?.profileImage,
  ]
  const firstValid = candidates.find((value) => typeof value === "string" && value.trim())
  return normalizeImageUrl(firstValid || "")
}

export default function Restaurants() {
  const { addFavorite, removeFavorite, isFavorite, activeAddress } = useProfile()
  
  const userLocation = useMemo(() => {
    if (!activeAddress) return null
    return {
      latitude: activeAddress.location?.coordinates?.[1],
      longitude: activeAddress.location?.coordinates?.[0]
    }
  }, [activeAddress])

  const { zoneId } = useZone(userLocation)
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const showRestaurantsSkeleton = useDelayedLoading(loading)

  useEffect(() => {
    let cancelled = false

    const fetchRestaurants = async () => {
      try {
        setLoading(true)
        const params = { limit: 300 }
        if (zoneId) {
          params.zoneId = zoneId
        }
        // Use client TTL cache — list rarely needs forced bust on every mount.
        const response = await restaurantAPI.getRestaurants(params)
        const list =
          response?.data?.data?.restaurants ||
          response?.data?.restaurants ||
          []
        if (cancelled) return

        const transformed = list.map((restaurant) => {
          const slug =
            restaurant?.slug ||
            String(restaurant?.name || "")
              .toLowerCase()
              .trim()
              .replace(/\s+/g, "-")
          const cuisine = Array.isArray(restaurant?.cuisines) && restaurant.cuisines.length > 0
            ? restaurant.cuisines[0]
            : "Multi-cuisine"
          return {
            id: restaurant?._id || restaurant?.restaurantId || slug,
            slug,
            name: restaurant?.name || "Unknown Restaurant",
            cuisine,
            rating: Number(restaurant?.rating || 0) || 4.5,
            deliveryTime: restaurant?.estimatedDeliveryTime || (restaurant?.estimatedDeliveryTimeMinutes ? `${restaurant.estimatedDeliveryTimeMinutes} mins` : "25-30 mins"),
            distance: restaurant?.distance ? (typeof restaurant.distance === 'number' ? `${restaurant.distance.toFixed(1)} km` : restaurant.distance) : "1.2 km",
            priceRange: restaurant?.priceRange || "$$",
            image: pickRestaurantImage(restaurant),
          }
        })

        setRestaurants(transformed)
      } catch (error) {
        if (!cancelled) {
          setRestaurants([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchRestaurants()
    return () => {
      cancelled = true
    }
  }, [zoneId])

  const hasRestaurants = restaurants.length > 0

  return (
    <AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 dark:from-[#0a0a0a] via-white dark:via-[#0a0a0a] to-red-50/20 dark:to-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 py-4 sm:py-6 md:py-8 lg:py-10 space-y-4 sm:space-y-6 lg:space-y-8">
        <ScrollReveal>
          <div className="flex items-center gap-3 sm:gap-4 lg:gap-5 mb-4 lg:mb-6">
            <Link to="/">
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 hover:bg-gray-100 dark:hover:bg-gray-800">
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-gray-900 dark:text-gray-100" />
              </Button>
            </Link>
            <TextReveal className="flex items-center gap-2 sm:gap-3 lg:gap-4">
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 dark:text-white">
                All Restaurants
              </h1>
            </TextReveal>
          </div>
        </ScrollReveal>

        {showRestaurantsSkeleton ? (
          <RestaurantGridSkeleton count={4} />
        ) : !hasRestaurants ? (
          <div className="py-16 text-center text-sm text-gray-500">No restaurants available right now.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 xl:gap-6 pt-2 sm:pt-3 lg:pt-4">
            {restaurants.map((restaurant, index) => {
              const favorite = isFavorite(restaurant.slug)

              const handleToggleFavorite = (e) => {
                e.preventDefault()
                e.stopPropagation()
                if (favorite) {
                  removeFavorite(restaurant.slug)
                } else {
                  addFavorite({
                    slug: restaurant.slug,
                    name: restaurant.name,
                    cuisine: restaurant.cuisine,
                    rating: restaurant.rating,
                    deliveryTime: restaurant.deliveryTime,
                    distance: restaurant.distance,
                    priceRange: restaurant.priceRange,
                    image: restaurant.image,
                  })
                }
              }

              return (
                <ScrollReveal key={restaurant.id} delay={index * 0.05}>
                  <Link to={`/restaurants/${restaurant.slug}`} className="h-full flex">
                    <Card className="overflow-hidden cursor-pointer border border-gray-200 dark:border-gray-800 group bg-white dark:bg-[#1a1a1a] hover:shadow-lg dark:hover:shadow-xl dark:hover:shadow-gray-900/50 pb-1 sm:pb-2 lg:pb-3 flex flex-col h-full w-full transition-all duration-300">
                      <div className="flex flex-row min-h-[120px] sm:min-h-[140px] md:min-h-[160px] lg:min-h-[180px] flex-1">
                        <CardContent className="flex-1 flex flex-col justify-between p-3 sm:p-4 md:p-5 lg:p-6 min-w-0 overflow-hidden">
                          <div className="flex-1 flex flex-col justify-between gap-2">
                            <div className="flex-shrink-0">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1 min-w-0 pr-2">
                                  <CardTitle className="text-base sm:text-lg md:text-xl mb-1 line-clamp-2 text-gray-900 dark:text-white">
                                    {restaurant.name}
                                  </CardTitle>
                                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium mb-2 line-clamp-1">
                                    {restaurant.cuisine}
                                  </p>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded-full">
                                      <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-yellow-400 text-yellow-400" />
                                      <span className="font-bold text-xs sm:text-sm text-yellow-700 dark:text-yellow-400">{restaurant.rating.toFixed(1)}</span>
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex-shrink-0 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${favorite ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400"}`}
                                  onClick={handleToggleFavorite}
                                >
                                  <Heart className={`h-4 w-4 sm:h-5 sm:w-5 ${favorite ? "fill-red-500 dark:fill-red-400" : ""}`} />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
                              <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400 flex-wrap">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                                  <span className="font-medium whitespace-nowrap">{restaurant.deliveryTime}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                                  <span className="font-medium whitespace-nowrap">{restaurant.distance}</span>
                                </div>
                              </div>
                              <Button className="bg-primary-orange hover:opacity-90 dark:hover:opacity-80 text-white text-xs sm:text-sm h-7 sm:h-8 px-3 sm:px-4 flex-shrink-0 transition-opacity">
                                Order Now
                              </Button>
                            </div>
                          </div>
                        </CardContent>

                        <div className="w-36 sm:w-44 md:w-56 lg:w-64 xl:w-72 flex-shrink-0 relative overflow-hidden group/image">
                          <img
                            src={restaurant.image || "https://via.placeholder.com/400x300?text=Restaurant"}
                            alt={restaurant.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-l from-black/20 dark:from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </Card>
                  </Link>
                </ScrollReveal>
              )
            })}
          </div>
        )}
      </div>
      <Footer />
    </AnimatedPage>
  )
}

