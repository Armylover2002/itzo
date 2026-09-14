import { useState, useEffect } from "react"
import { Link, useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Share2, Trash2, Heart, Star, Clock, MapPin } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import ScrollReveal from "@food/components/user/ScrollReveal"
import { Card, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { Badge } from "@food/components/ui/badge"
import { useProfile } from "@food/context/ProfileContext"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"

export default function CollectionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()
  const { getFavorites, removeFavorite } = useProfile()
  
  // Mock collection data - in real app, fetch from API based on id
  const [collection, setCollection] = useState({
    id: id,
    name: "My Collection",
    dishes: 0,
    restaurants: 0,
    items: []
  })

  // For now, use favorites as collection items
  // In real app, fetch collection items from API
  const favorites = getFavorites()
  
  useEffect(() => {
    // In real app, fetch collection data from API
    // For now, use favorites as placeholder
    setCollection(prev => ({
      ...prev,
      name: `Collection ${id}`,
      items: favorites,
      restaurants: favorites.length,
      dishes: 0
    }))
  }, [id, favorites])

  const handleRemoveItem = (e, slug) => {
    e.preventDefault()
    e.stopPropagation()
    if (window.confirm("Remove this restaurant from collection?")) {
      removeFavorite(slug)
      // Update collection state
      setCollection(prev => ({
        ...prev,
        items: prev.items.filter(item => item.slug !== slug),
        restaurants: prev.restaurants - 1
      }))
    }
  }

  if (collection.items.length === 0) {
    return (
      <AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 via-white to-red-50/20 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <ScrollReveal>
            <div className="flex items-center gap-3 sm:gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full h-8 w-8 sm:h-10 sm:w-10"
                onClick={goBack}
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold">{collection.name}</h1>
            </div>
          </ScrollReveal>
          <Card>
            <CardContent className="py-12 text-center">
              <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg mb-4">This collection is empty</p>
              <Link to="/user">
                <Button className="bg-gradient-to-r bg-primary-orange hover:opacity-90 text-white">
                  Explore Restaurants
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 via-white to-red-50/20 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <ScrollReveal>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full h-8 w-8 sm:h-10 sm:w-10"
                onClick={goBack}
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold">{collection.name}</h1>
                <p className="text-muted-foreground mt-1">
                  {collection.restaurants} {collection.restaurants === 1 ? "restaurant" : "restaurants"}
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          {collection.items.map((restaurant, index) => (
            <ScrollReveal key={restaurant.slug} delay={index * 0.1}>
              <Link to={`/user/restaurants/${restaurant.slug}`}>
                <Card className="overflow-hidden h-full p-0 gap-0">
                  <div className="h-48 w-full relative overflow-hidden">
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
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full bg-white/90 backdrop-blur-sm hover:bg-white text-red-500"
                        onClick={(e) => handleRemoveItem(e, restaurant.slug)}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-bold line-clamp-1 flex-1">{restaurant.name}</h3>
                      <div className="flex items-center gap-1 bg-green-600 text-white px-2 py-1 rounded-lg ml-2">
                        <Star className="h-3 w-3 fill-white" />
                        <span className="text-sm font-bold">{restaurant.rating || "4.5"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Clock className="h-4 w-4" />
                      <span>{restaurant.deliveryTime || "25-30 mins"}</span>
                      <span>�</span>
                      <MapPin className="h-4 w-4" />
                      <span>{restaurant.distance || "2.5 km"}</span>
                    </div>
                    {restaurant.cuisine && (
                      <p className="text-sm text-muted-foreground line-clamp-1">{restaurant.cuisine}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </AnimatedPage>
  )
}

