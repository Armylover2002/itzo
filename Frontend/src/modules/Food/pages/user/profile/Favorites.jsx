import { Link } from "react-router-dom"
import { useState } from "react"

import { Heart, Star, Clock, MapPin, ArrowRight, ArrowLeft, Bookmark } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import ScrollReveal from "@food/components/user/ScrollReveal"
import { Card, CardHeader, CardTitle, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { useProfile } from "@food/context/ProfileContext"
import { toast } from "sonner"

export default function Favorites() {
  const { getFavorites, removeFavorite, getDishFavorites, removeDishFavorite } = useProfile()
  const restaurantFavorites = getFavorites()
  const dishFavorites = getDishFavorites()
  const [activeTab, setActiveTab] = useState("restaurants")

  const handleRemoveFavorite = (e, slug) => {
    e.preventDefault()
    e.stopPropagation()
    if (window.confirm("Remove this restaurant from favorites?")) {
      removeFavorite(slug)
      toast.success("Restaurant removed from favorites")
    }
  }

  const handleRemoveDishFavorite = (e, dishId, restaurantId) => {
    e.preventDefault()
    e.stopPropagation()
    if (window.confirm("Remove this dish from favorites?")) {
      removeDishFavorite(dishId, restaurantId)
      toast.success("Dish removed from favorites")
    }
  }

  const totalFavorites = restaurantFavorites.length + dishFavorites.length

  if (totalFavorites === 0) {
    return (
      <><AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 via-white to-red-50/20 dark:from-[#0a0a0a] dark:via-[#0a0a0a] dark:to-[#0a0a0a] p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <ScrollReveal>
            <div className="flex items-center gap-3 sm:gap-4">
              <Link to="/user/profile">
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 sm:h-10 sm:w-10">
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
          </Link>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">My Favorites</h1>
        </div>
      </ScrollReveal>
        <Card>
          <CardContent className="py-12 text-center">
            <Bookmark className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg mb-4">You haven't added any favorites yet</p>
            <Link to="/user">
              <Button className="bg-gradient-to-r bg-primary-orange hover:opacity-90 text-white">
                Explore Restaurants
              </Button>
            </Link>
          </CardContent>
        </Card>
        </div>
      </AnimatedPage></>
    )
  }

  return (
    <AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 via-white to-red-50/20 dark:from-[#0a0a0a] dark:via-[#0a0a0a] dark:to-[#0a0a0a] p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <ScrollReveal>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <Link to="/user/profile">
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 sm:h-10 sm:w-10">
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold">My Favorites</h1>
                <p className="text-gray-700 dark:text-gray-300 mt-1 text-sm font-semibold">
                  {dishFavorites.length || 0} {dishFavorites.length === 1 ? "dish" : "dishes"} • {restaurantFavorites.length || 0} {restaurantFavorites.length === 1 ? "restaurant" : "restaurants"}
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setActiveTab("restaurants")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "restaurants"
                ? "border-b-2 border-primary-orange text-primary-orange"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            Restaurants ({restaurantFavorites.length})
          </button>
          <button
            onClick={() => setActiveTab("dishes")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "dishes"
                ? "border-b-2 border-primary-orange text-primary-orange"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            Dishes ({dishFavorites.length})
          </button>
        </div>

        {/* Restaurants Tab */}
        {activeTab === "restaurants" && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {restaurantFavorites.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Bookmark className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-lg mb-4">No restaurants saved yet</p>
                <Link to="/user">
                  <Button className="bg-gradient-to-r bg-primary-orange hover:opacity-90 text-white">
                    Explore Restaurants
                  </Button>
                </Link>
              </div>
            ) : (
              restaurantFavorites.map((restaurant, index) => (
            <ScrollReveal key={restaurant.slug} delay={index * 0.1}>
              <Link to={`/user/restaurants/${restaurant.slug}`}>
                <Card className="overflow-hidden h-full">
                  <div className="h-32 w-full relative overflow-hidden">
                    <img
                      src={restaurant.image}
                      alt={restaurant.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.target.src = `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop&q=80`
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute top-2 right-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white text-red-500"
                        onClick={(e) => handleRemoveFavorite(e, restaurant.slug)}
                      >
                        <Bookmark className="h-4 w-4 fill-red-500" />
                      </Button>
                    </div>
                    <div className="absolute bottom-2 left-2">
                      <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="font-bold text-xs">{restaurant.rating}</span>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-3 space-y-2">
                    <div>
                      <CardTitle className="text-sm font-bold mb-0.5 line-clamp-1">
                        {restaurant.name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground font-medium line-clamp-1">
                        {restaurant.cuisine}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-2 border-t">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span className="font-medium">{restaurant.deliveryTime}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="font-medium">{restaurant.distance}</span>
                      </div>
                    </div>
                    <Button className="w-full bg-gradient-to-r bg-primary-orange hover:opacity-90 text-white text-xs py-1.5 h-8">
                      View Restaurant
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            </ScrollReveal>
              ))
            )}
          </div>
        )}

        {/* Dishes Tab */}
        {activeTab === "dishes" && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {dishFavorites.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Bookmark className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-lg mb-4">No dishes saved yet</p>
                <Link to="/user">
                  <Button className="bg-gradient-to-r bg-primary-orange hover:opacity-90 text-white">
                    Explore Dishes
                  </Button>
                </Link>
              </div>
            ) : (
              dishFavorites.map((dish, index) => {
                const restaurantSlug = dish.restaurantSlug || ""
                return (
                  <ScrollReveal key={`${dish.id}-${dish.restaurantId}`} delay={index * 0.1}>
                    <Link to={`/food/user/restaurants/${restaurantSlug}?dish=${dish.id}`}>
                      <Card className="overflow-hidden h-full cursor-pointer hover:shadow-lg transition-shadow">
                        <div className="h-32 w-full relative overflow-hidden">
                          <img
                            src={dish.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop&q=80"}
                            alt={dish.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop&q=80"
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                          <div className="absolute top-2 right-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white text-red-500"
                              onClick={(e) => handleRemoveDishFavorite(e, dish.id, dish.restaurantId)}
                            >
                              <Bookmark className="h-4 w-4 fill-red-500" />
                            </Button>
                          </div>
                        </div>
                        <CardContent className="p-3 space-y-2">
                          <div>
                            <CardTitle className="text-sm font-bold mb-0.5 line-clamp-1">
                              {dish.name}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {dish.restaurantName || "Restaurant"}
                            </p>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-2 border-t">
                            <div className="flex items-center gap-1">
                              {dish.foodType === "Veg" ? (
                                <div className="w-3 h-3 border-2 border-green-600 flex items-center justify-center rounded-sm">
                                  <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                                </div>
                              ) : (
                                <div className="w-3 h-3 border-2 border-red-600 flex items-center justify-center rounded-sm">
                                  <div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div>
                                </div>
                              )}
                              <span className="text-muted-foreground font-medium text-xs">{dish.foodType || "N/A"}</span>
                            </div>
                            <div className="text-sm font-bold text-primary-orange">
                              {"\u20B9"}{Math.round(dish.price || 0)}
                            </div>
                          </div>
                          <Button className="w-full bg-gradient-to-r bg-primary-orange hover:opacity-90 text-white text-xs py-1.5 h-8">
                            View Dish
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </CardContent>
                      </Card>
                    </Link>
                  </ScrollReveal>
                )
              })
            )}
          </div>
        )}
      </div>
    </AnimatedPage>
  )
}

