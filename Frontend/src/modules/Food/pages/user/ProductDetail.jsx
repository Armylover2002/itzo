// old one 



import { useState, useMemo } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"

import { ArrowLeft, Star, Clock, MapPin, ShoppingBag, Plus, Minus, Calendar, ThumbsUp, MessageCircle, Send } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import Footer from "@food/components/user/Footer"
import ScrollReveal from "@food/components/user/ScrollReveal"
import { useCart } from "@food/context/CartContext"
import { useOrders } from "@food/context/OrdersContext"
import { Button } from "@food/components/ui/button"
import { Badge } from "@food/components/ui/badge"
import { Textarea } from "@food/components/ui/textarea"
import { Label } from "@food/components/ui/label"

// Sample product data - in a real app, this would come from an API
const productsData = {
  // Featured Dishes
  1: { id: 1, name: "Margherita Pizza", restaurant: "Pizza Corner", restaurantSlug: "pizza-corner", price: 12.99, image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&h=400&fit=crop&q=80", rating: 4.8, description: "Classic Italian pizza with fresh tomato sauce, mozzarella cheese, and basil leaves. Made with our signature wood-fired crust.", category: "Pizza", ingredients: ["Tomato sauce", "Mozzarella cheese", "Fresh basil", "Olive oil"], preparationTime: "15-20 min", calories: 280 },
  2: { id: 2, name: "Classic Burger", restaurant: "Burger Paradise", restaurantSlug: "burger-paradise", price: 9.99, image: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&h=400&fit=crop&q=80", rating: 4.7, description: "Juicy beef patty with fresh lettuce, tomato, onion, and our special sauce. Served on a toasted bun.", category: "Burgers", ingredients: ["Beef patty", "Lettuce", "Tomato", "Onion", "Special sauce", "Bun"], preparationTime: "10-15 min", calories: 520 },
  3: { id: 3, name: "Salmon Sushi Roll", restaurant: "Sushi Master", restaurantSlug: "sushi-master", price: 15.99, image: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=600&h=400&fit=crop&q=80", rating: 4.9, description: "Fresh salmon with creamy avocado, wrapped in nori and sushi rice. Served with soy sauce and wasabi.", category: "Sushi", ingredients: ["Fresh salmon", "Avocado", "Nori", "Sushi rice", "Soy sauce", "Wasabi"], preparationTime: "20-25 min", calories: 320 },
  4: { id: 4, name: "Chicken Tacos", restaurant: "Taco Fiesta", restaurantSlug: "taco-fiesta", price: 8.99, image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600&h=400&fit=crop&q=80", rating: 4.6, description: "Soft shell tacos with grilled chicken, fresh vegetables, and our signature salsa. Served with lime wedges.", category: "Tacos", ingredients: ["Grilled chicken", "Lettuce", "Tomato", "Onion", "Cheese", "Salsa", "Lime"], preparationTime: "12-15 min", calories: 380 },
  5: { id: 5, name: "Chicken Biryani", restaurant: "Spice Garden", restaurantSlug: "spice-garden", price: 14.99, image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&h=400&fit=crop&q=80", rating: 4.8, description: "Fragrant basmati rice cooked with tender chicken pieces, aromatic spices, and herbs. Served with raita and pickle.", category: "Indian", ingredients: ["Basmati rice", "Chicken", "Onions", "Spices", "Yogurt", "Herbs"], preparationTime: "30-35 min", calories: 650 },
  6: { id: 6, name: "Pad Thai", restaurant: "Thai Express", restaurantSlug: "thai-express", price: 13.99, image: "https://images.unsplash.com/photo-1559314809-0d155b1c5b8e?w=600&h=400&fit=crop&q=80", rating: 4.7, description: "Stir-fried rice noodles with shrimp, tofu, bean sprouts, and peanuts in a tangy tamarind sauce.", category: "Thai", ingredients: ["Rice noodles", "Shrimp", "Tofu", "Bean sprouts", "Peanuts", "Tamarind sauce"], preparationTime: "18-22 min", calories: 420 },
  7: { id: 7, name: "Grilled Salmon", restaurant: "Ocean Breeze", restaurantSlug: "ocean-breeze", price: 18.99, image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600&h=400&fit=crop&q=80", rating: 4.9, description: "Fresh Atlantic salmon grilled to perfection with lemon butter sauce. Served with seasonal vegetables and rice.", category: "Seafood", ingredients: ["Atlantic salmon", "Lemon", "Butter", "Herbs", "Seasonal vegetables", "Rice"], preparationTime: "25-30 min", calories: 480 },
  8: { id: 8, name: "BBQ Ribs", restaurant: "Smokehouse", restaurantSlug: "smokehouse", price: 16.99, image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=400&fit=crop&q=80", rating: 4.8, description: "Slow-cooked pork ribs smothered in our signature BBQ sauce. Served with coleslaw and cornbread.", category: "BBQ", ingredients: ["Pork ribs", "BBQ sauce", "Coleslaw", "Cornbread"], preparationTime: "35-40 min", calories: 720 },
  // Quick Bites
  9: { id: 9, name: "Chicken Wings", restaurant: "Burger Paradise", restaurantSlug: "burger-paradise", price: 8.99, image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&h=400&fit=crop&q=80", rating: 4.8, description: "Crispy fried chicken wings tossed in your choice of sauce. Served with celery sticks and blue cheese dip.", category: "Appetizers", ingredients: ["Chicken wings", "Hot sauce", "Butter", "Celery", "Blue cheese"], preparationTime: "15-18 min", calories: 450 },
  10: { id: 10, name: "French Fries", restaurant: "Burger Paradise", restaurantSlug: "burger-paradise", price: 4.99, image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&h=400&fit=crop&q=80", rating: 4.7, description: "Golden crispy fries made from premium potatoes. Served hot with ketchup.", category: "Sides", ingredients: ["Potatoes", "Salt", "Oil"], preparationTime: "8-10 min", calories: 320 },
  11: { id: 11, name: "Onion Rings", restaurant: "Burger Paradise", restaurantSlug: "burger-paradise", price: 5.99, image: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&h=400&fit=crop&q=80", rating: 4.6, description: "Crispy battered onion rings, perfectly golden and crunchy. Served with dipping sauce.", category: "Sides", ingredients: ["Onions", "Batter", "Oil"], preparationTime: "10-12 min", calories: 280 },
  12: { id: 12, name: "Mozzarella Sticks", restaurant: "Pizza Corner", restaurantSlug: "pizza-corner", price: 6.99, image: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&h=400&fit=crop&q=80", rating: 4.9, description: "Golden fried mozzarella sticks with a crispy exterior and gooey center. Served with marinara sauce.", category: "Appetizers", ingredients: ["Mozzarella cheese", "Breadcrumbs", "Marinara sauce"], preparationTime: "8-10 min", calories: 350 },
  13: { id: 13, name: "Nachos", restaurant: "Taco Fiesta", restaurantSlug: "taco-fiesta", price: 7.99, image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&h=400&fit=crop&q=80", rating: 4.8, description: "Crispy tortilla chips loaded with melted cheese, jalape�os, and your choice of toppings.", category: "Appetizers", ingredients: ["Tortilla chips", "Cheese", "Jalape�os", "Sour cream", "Salsa"], preparationTime: "10-12 min", calories: 420 },
  14: { id: 14, name: "Garlic Bread", restaurant: "Pizza Corner", restaurantSlug: "pizza-corner", price: 4.49, image: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&h=400&fit=crop&q=80", rating: 4.7, description: "Fresh baked bread brushed with garlic butter and herbs. Perfect as a side or appetizer.", category: "Sides", ingredients: ["Bread", "Garlic", "Butter", "Herbs"], preparationTime: "5-8 min", calories: 220 },
  // Trending Now
  15: { id: 15, name: "Spicy Ramen", restaurant: "Noodle House", restaurantSlug: "noodle-house", price: 11.99, image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&h=400&fit=crop&q=80", rating: 4.9, description: "Rich and spicy ramen broth with tender noodles, soft-boiled egg, and fresh vegetables.", category: "Noodles", ingredients: ["Ramen noodles", "Broth", "Egg", "Vegetables", "Spices"], preparationTime: "20-25 min", calories: 480 },
  16: { id: 16, name: "BBQ Chicken Pizza", restaurant: "Pizza Corner", restaurantSlug: "pizza-corner", price: 13.99, image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop&q=80", rating: 4.8, description: "Wood-fired pizza with BBQ sauce, grilled chicken, red onions, and mozzarella cheese.", category: "Pizza", ingredients: ["BBQ sauce", "Grilled chicken", "Red onions", "Mozzarella cheese"], preparationTime: "15-20 min", calories: 380 },
  17: { id: 17, name: "Sushi Platter", restaurant: "Sushi Master", restaurantSlug: "sushi-master", price: 19.99, image: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=600&h=400&fit=crop&q=80", rating: 4.9, description: "Assorted sushi platter with salmon, tuna, and California rolls. Served with soy sauce, wasabi, and pickled ginger.", category: "Sushi", ingredients: ["Salmon", "Tuna", "Avocado", "Rice", "Nori", "Soy sauce"], preparationTime: "25-30 min", calories: 450 },
  18: { id: 18, name: "Loaded Burger", restaurant: "Burger Paradise", restaurantSlug: "burger-paradise", price: 10.99, image: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&h=400&fit=crop&q=80", rating: 4.7, description: "Double beef patty with bacon, cheese, lettuce, tomato, onion, and special sauce. Served with fries.", category: "Burgers", ingredients: ["Double beef patty", "Bacon", "Cheese", "Lettuce", "Tomato", "Onion", "Special sauce"], preparationTime: "12-15 min", calories: 680 },
}

// Restaurant data
const restaurantsData = {
  "pizza-corner": { name: "Pizza Corner", cuisine: "Italian", rating: 4.7, deliveryTime: "15-20 min", distance: "0.5 km", priceRange: "$$", address: "321 Elm Street, New York, NY 10004", phone: "+1 (555) 456-7890" },
  "burger-paradise": { name: "Burger Paradise", cuisine: "American", rating: 4.6, deliveryTime: "20-25 min", distance: "0.8 km", priceRange: "$", address: "456 Oak Avenue, New York, NY 10002", phone: "+1 (555) 234-5678" },
  "sushi-master": { name: "Sushi Master", cuisine: "Japanese", rating: 4.9, deliveryTime: "30-35 min", distance: "2.1 km", priceRange: "$$$", address: "789 Cherry Lane, New York, NY 10003", phone: "+1 (555) 345-6789" },
  "taco-fiesta": { name: "Taco Fiesta", cuisine: "Mexican", rating: 4.5, deliveryTime: "20-25 min", distance: "1.5 km", priceRange: "$", address: "654 Pine Street, New York, NY 10005", phone: "+1 (555) 567-8901" },
  "spice-garden": { name: "Spice Garden", cuisine: "Indian", rating: 4.8, deliveryTime: "25-30 min", distance: "1.8 km", priceRange: "$$", address: "123 Spice Road, New York, NY 10001", phone: "+1 (555) 123-4567" },
  "thai-express": { name: "Thai Express", cuisine: "Thai", rating: 4.7, deliveryTime: "22-28 min", distance: "1.3 km", priceRange: "$$", address: "456 Thai Street, New York, NY 10002", phone: "+1 (555) 234-5678" },
  "ocean-breeze": { name: "Ocean Breeze", cuisine: "Seafood", rating: 4.9, deliveryTime: "30-35 min", distance: "2.5 km", priceRange: "$$$", address: "789 Ocean Drive, New York, NY 10003", phone: "+1 (555) 345-6789" },
  "smokehouse": { name: "Smokehouse", cuisine: "BBQ", rating: 4.8, deliveryTime: "35-40 min", distance: "2.2 km", priceRange: "$$", address: "321 BBQ Lane, New York, NY 10004", phone: "+1 (555) 456-7890" },
  "noodle-house": { name: "Noodle House", cuisine: "Asian", rating: 4.8, deliveryTime: "20-25 min", distance: "1.1 km", priceRange: "$$", address: "654 Noodle Street, New York, NY 10005", phone: "+1 (555) 567-8901" },
}

// Generate sample reviews
const generateReviews = (productName, totalReviews = 20) => {
  const reviews = []
  const names = ["Alex Johnson", "Sarah Chen", "Michael Brown", "Emily Davis", "David Wilson", "Jessica Martinez", "Chris Anderson", "Amanda Taylor", "Ryan Garcia", "Lisa Thompson"]
  const comments = [
    "Absolutely amazing! The flavors were incredible and the quality was top-notch. Highly recommend!",
    "Great experience overall. Food arrived hot and fresh. Will definitely order again!",
    "One of the best dishes I've tried. The quality is outstanding and prices are reasonable.",
    "Delicious food and fast delivery. The packaging was excellent too. Very satisfied!",
    "Excellent service and amazing food quality. This has become my go-to dish.",
    "The food exceeded my expectations! Everything was perfectly cooked and seasoned.",
    "Fast delivery and great tasting food. The portion sizes are generous too.",
    "Love this dish! The food is always fresh and the flavors are authentic.",
    "Outstanding quality and service. The food arrived on time and was still hot.",
    "Highly recommend! The food is delicious and the customer service is excellent."
  ]

  for (let i = 0; i < Math.min(15, totalReviews); i++) {
    const rating = 3.5 + Math.random() * 1.5
    const roundedRating = Math.round(rating * 10) / 10
    reviews.push({
      id: i + 1,
      userName: names[i % names.length],
      userAvatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(names[i % names.length])}&background=ffc107&color=fff&size=128`,
      rating: roundedRating,
      comment: comments[i % comments.length],
      date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      helpful: Math.floor(Math.random() * 50),
      verified: Math.random() > 0.3,
      orderType: ["Delivery", "Dine-in", "Takeout"][Math.floor(Math.random() * 3)]
    })
  }

  return reviews.sort((a, b) => b.rating - a.rating)
}

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()
  const product = productsData[parseInt(id)]
  const { addToCart, isInCart, getCartItem, updateQuantity } = useCart()
  const { getAllOrders } = useOrders()
  const [quantity, setQuantity] = useState(1)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    comment: "",
  })
  const [reviews, setReviews] = useState(() =>
    product ? generateReviews(product.name) : []
  )
  const [helpfulVotes, setHelpfulVotes] = useState(new Set())
  const [replyStates, setReplyStates] = useState({})
  const [replies, setReplies] = useState({})

  const restaurant = product ? restaurantsData[product.restaurantSlug] : null
  const inCart = product ? isInCart(product.id) : false
  const cartItem = product ? getCartItem(product.id) : null
  const orders = getAllOrders()

  // Get order history for this product
  const orderHistory = useMemo(() => {
    if (!product) return []
    return orders.filter(order =>
      order.items?.some(item => item.id === product.id)
    ).slice(0, 5) // Show last 5 orders
  }, [orders, product])

  // Calculate average rating
  const averageRating = useMemo(() => {
    if (reviews.length === 0) return product?.rating || 0
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0)
    return Math.round((sum / reviews.length) * 10) / 10
  }, [reviews, product])

  const handleAddToCart = () => {
    if (product) {
      for (let i = 0; i < quantity; i++) {
        const result = addToCart(product)
        if (result?.ok === false) {
          alert(result.error || "Cannot add item from different restaurant. Please clear cart first.")
          break
        }
      }
    }
  }

  const handleIncrease = () => {
    if (inCart && cartItem) {
      updateQuantity(product.id, cartItem.quantity + 1)
    } else {
      setQuantity(prev => prev + 1)
    }
  }

  const handleDecrease = () => {
    if (inCart && cartItem) {
      if (cartItem.quantity > 1) {
        updateQuantity(product.id, cartItem.quantity - 1)
      }
    } else {
      setQuantity(prev => Math.max(1, prev - 1))
    }
  }

  const handleSubmitReview = (e) => {
    e.preventDefault()
    if (!reviewForm.comment.trim()) {
      alert("Please write a review comment")
      return
    }

    const newReview = {
      id: reviews.length + 1,
      userName: "You",
      userAvatar: `https://ui-avatars.com/api/?name=You&background=ffc107&color=fff&size=128`,
      rating: reviewForm.rating,
      comment: reviewForm.comment,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      helpful: 0,
      verified: true,
      orderType: "Delivery"
    }

    setReviews([newReview, ...reviews])
    setReviewForm({ rating: 5, comment: "" })
    setShowReviewForm(false)
    alert("Thank you for your review!")
  }

  const handleHelpful = (reviewId) => {
    if (helpfulVotes.has(reviewId)) {
      // Already voted, remove vote
      setHelpfulVotes(prev => {
        const newSet = new Set(prev)
        newSet.delete(reviewId)
        return newSet
      })
      setReviews(prev => prev.map(review =>
        review.id === reviewId
          ? { ...review, helpful: Math.max(0, review.helpful - 1) }
          : review
      ))
    } else {
      // New vote
      setHelpfulVotes(prev => new Set(prev).add(reviewId))
      setReviews(prev => prev.map(review =>
        review.id === reviewId
          ? { ...review, helpful: review.helpful + 1 }
          : review
      ))
    }
  }

  const handleReplyClick = (reviewId) => {
    setReplyStates(prev => ({
      ...prev,
      [reviewId]: !prev[reviewId]
    }))
  }

  const handleSubmitReply = (reviewId, replyText) => {
    if (!replyText.trim()) {
      alert("Please write a reply")
      return
    }

    const newReply = {
      id: Date.now(),
      userName: "You",
      userAvatar: `https://ui-avatars.com/api/?name=You&background=ffc107&color=fff&size=128`,
      comment: replyText,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      verified: true
    }

    setReplies(prev => ({
      ...prev,
      [reviewId]: [...(prev[reviewId] || []), newReply]
    }))
    setReplyStates(prev => ({
      ...prev,
      [reviewId]: false
    }))
  }

  const renderStars = (rating, size = "h-4 w-4") => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`${size} ${i < Math.floor(rating)
          ? "fill-yellow-400 text-yellow-400"
          : i < rating
            ? "fill-yellow-200 text-yellow-200"
            : "fill-gray-300 text-gray-300"
          }`}
      />
    ))
  }

  if (!product) {
    return (
      <AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 via-white to-red-50/20 dark:from-[#0a0a0a] dark:via-[#0a0a0a] dark:to-[#0a0a0a]">
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">Product Not Found</h1>
          <Link to="/user">
            <Button>Go Back Home</Button>
          </Link>
        </div>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 via-white to-red-50/20 dark:from-[#0a0a0a] dark:via-[#0a0a0a] dark:to-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12">

        {/* Hero Image Section */}
        <div className="relative w-full h-[350px] sm:h-[400px] md:h-[450px] lg:h-[500px] xl:h-[550px] overflow-hidden rounded-lg md:rounded-xl lg:rounded-2xl mt-4 md:mt-6 lg:mt-8">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover object-center" />

          {/* Back Button - Overlay on Image */}
          <div className="absolute top-4 left-4 z-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={goBack}
              className="rounded-full bg-white/90 backdrop-blur-sm hover:bg-white shadow-md"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>

          {/* Rating Badge - Top Right */}
          <div className="absolute top-4 right-4 z-10">
            <Badge className="bg-[#FF0000] text-white shadow-lg">
              <Star className="h-3 w-3 fill-white text-white mr-1" />
              {averageRating}
            </Badge>
          </div>

          {/* Product Info Card Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-[#1a1a1a] rounded-t-3xl p-4 sm:p-5 md:p-6 lg:p-8">
            <div className="flex items-start gap-4 md:gap-6 lg:gap-8">
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2 md:mb-3">
                  <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white leading-tight break-words">
                    {product.name}
                  </h1>
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base md:text-lg mb-2 md:mb-3 line-clamp-2 lg:line-clamp-3">
                  {product.description}
                </p>
                <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                  <div className="flex items-center gap-1 md:gap-2">
                    {renderStars(averageRating, "h-4 w-4 md:h-5 md:w-5")}
                    <span className="text-gray-900 dark:text-white font-semibold text-sm sm:text-base md:text-lg">{averageRating}</span>
                  </div>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-600 dark:text-gray-300 text-sm sm:text-base md:text-lg underline">
                    {reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'}
                  </span>
                  <span className="text-gray-400">|</span>
                  <Badge variant="outline" className="text-xs sm:text-sm md:text-base">
                    {product.category}
                  </Badge>
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#FF0000]">
                  ₹{(product.price * 83).toFixed(0)}
                </div>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">per serving</p>
              </div>
            </div>
          </div>
        </div>


        <div className="px-4 sm:px-6 md:px-8 lg:px-10 py-6 sm:py-8 md:py-10 lg:py-12 space-y-6 md:space-y-8 lg:space-y-10">
          {/* Product Info */}
          <ScrollReveal>
            <div className="space-y-4">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
                <Link to="/user" className="hover:text-[#FF0000] transition-colors">Home</Link>
                <span>/</span>
                <span className="text-foreground font-medium truncate">{restaurant?.name || "Restaurant"}</span>
                <span>/</span>
                <span className="text-foreground font-medium truncate">{product.name}</span>
              </div>
            </div>
          </ScrollReveal>


          {/* Add to Cart */}
          <ScrollReveal delay={0.3}>
            <div className="space-y-4 pb-4 border-b">
              <h2 className="text-xl font-bold">Order</h2>
              {inCart ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 border border-[#FF0000] rounded-lg">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 hover:bg-[#FFF5F5]"
                      onClick={handleDecrease}
                    >
                      <Minus className="h-5 w-5" />
                    </Button>
                    <span className="px-4 text-lg font-semibold min-w-[2rem] text-center">
                      {cartItem?.quantity || 0}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 hover:bg-[#FFF5F5]"
                      onClick={handleIncrease}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">In cart</p>
                    <p className="text-lg font-bold text-[#FF0000]">
                      ₹{(product.price * 83 * (cartItem?.quantity || 0)).toFixed(0)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 border border-gray-300 rounded-lg">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                    >
                      <Minus className="h-5 w-5" />
                    </Button>
                    <span className="px-4 text-lg font-semibold min-w-[2rem] text-center">
                      {quantity}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => setQuantity(prev => prev + 1)}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                  <div
                    className="flex-1"
                  >
                    <Button
                      onClick={handleAddToCart}
                      className="bg-[#FF0000] hover:opacity-90 text-white"
                    >
                      <ShoppingBag className="h-5 w-5 mr-2" />
                      Add to Cart - ₹{(product.price * 83 * quantity).toFixed(0)}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ScrollReveal>

          {/* Restaurant Info */}
          {restaurant && (
            <ScrollReveal delay={0.1}>
              <div className="space-y-3 md:space-y-4 pb-4 md:pb-6 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg md:text-xl lg:text-2xl font-bold">
                      {restaurant.name}
                    </h3>
                    <p className="text-sm md:text-base text-muted-foreground">{restaurant.cuisine}</p>
                  </div>
                  <Badge className="bg-[#FF0000] text-white text-sm md:text-base">{restaurant.priceRange}</Badge>
                </div>
                <div className="flex items-center gap-4 md:gap-6 flex-wrap text-sm md:text-base">
                  <div className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{restaurant.rating}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{restaurant.deliveryTime}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{restaurant.distance}</span>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          )}

          {/* Product Details */}
          <ScrollReveal delay={0.2}>
            <div className="space-y-4 md:space-y-6 pb-4 md:pb-6 border-b">
              <h2 className="text-xl md:text-2xl lg:text-3xl font-bold">Details</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 text-sm md:text-base">
                <div>
                  <p className="text-muted-foreground mb-1 md:mb-2">Category</p>
                  <p className="font-semibold">{product.category}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 md:mb-2">Preparation Time</p>
                  <p className="font-semibold">{product.preparationTime}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 md:mb-2">Calories</p>
                  <p className="font-semibold">{product.calories} kcal</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 md:mb-2">Ingredients</p>
                  <p className="font-semibold">{product.ingredients.length} items</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground mb-2 text-sm">Ingredients</p>
                <div className="flex flex-wrap gap-2">
                  {product.ingredients.map((ingredient, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {ingredient}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </ScrollReveal>


          {/* Order History */}
          {orderHistory.length > 0 && (
            <ScrollReveal delay={0.4}>
              <div className="space-y-4 pb-4 border-b">
                <h2 className="text-xl font-bold">Your Order History</h2>
                <div className="space-y-3">
                  {orderHistory.map((order) => (
                    <div key={order.id} className="flex items-center justify-between py-3 border-b last:border-0">
                      <div>
                        <p className="font-semibold">Order {order.id}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                          <span>�</span>
                          <span>{order.status}</span>
                        </div>
                      </div>
                      <Badge variant="outline">{order.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          )}

          {/* <ScrollReveal delay={0.5}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Reviews</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'} � Average rating: {averageRating}
                  </p>
                </div>
                {!showReviewForm && (
                  <Button
                    onClick={() => setShowReviewForm(true)}
                    className="bg-[#FF0000] hover:opacity-90 text-white"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Write a Review
                  </Button>
                )}
              </div> */}

          {/* {showReviewForm && (
                <div className="space-y-4 pb-4 border-b">
                  <h3 className="text-lg font-semibold">Write Your Review</h3>
                  <form onSubmit={handleSubmitReview} className="space-y-4">
                    <div>
                      <Label>Your Rating</Label>
                      <div className="flex items-center gap-2 mt-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                          >
                            <Star
                              className={`h-6 w-6 ${star <= reviewForm.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "fill-gray-300 text-gray-300"}`} />
                          </button>
                        ))}
                        <span className="ml-2 text-sm text-muted-foreground">
                          {reviewForm.rating} out of 5
                        </span>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="comment">Your Review</Label>
                      <Textarea
                        id="comment"
                        placeholder="Share your experience..."
                        className="mt-2 min-h-[120px]"
                        value={reviewForm.comment}
                        onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                        required />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowReviewForm(false)
                          setReviewForm({ rating: 5, comment: "" })
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1 bg-gradient-to-r bg-[#FF0000] hover:from-red-600 hover:to-red-600"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Submit Review
                      </Button>
                    </div>
                  </form>
                </div>
              )} */}

          {/* <div className="space-y-4">
                {reviews.length > 0 ? (
                  reviews.map((review, index) => (
                    <ScrollReveal key={review.id} delay={index * 0.05}>
                      <div className="space-y-3 pb-4 border-b last:border-0">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-full overflow-hidden flex-shrink-0">
                            <img
                              src={review.userAvatar}
                              alt={review.userName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold">{review.userName}</h3>
                                  {review.verified && (
                                    <Badge className="bg-blue-500 text-white text-xs px-2 py-0">
                                      Verified
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    {renderStars(review.rating, "h-3 w-3")}
                                    <span className="ml-1 font-medium">{review.rating}</span>
                                  </div>
                                  <span>�</span>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {review.date}
                                  </div>
                                  <span>�</span>
                                  <span>{review.orderType}</span>
                                </div>
                              </div>
                            </div>
                            <p className="text-muted-foreground leading-relaxed">{review.comment}</p>
                            <div className="flex items-center gap-4 pt-2">
                              <button
                                onClick={() => handleHelpful(review.id)}
                                className={`flex items-center gap-2 text-sm transition-colors ${helpfulVotes.has(review.id)
                                    ? "text-[#FF0000] font-semibold"
                                    : "text-muted-foreground hover:text-foreground"
                                  }`}
                              >
                                <ThumbsUp className={`h-4 w-4 ${helpfulVotes.has(review.id) ? "fill-primary-orange" : ""}`} />
                                <span>Helpful ({review.helpful})</span>
                              </button>
                              <button
                                onClick={() => handleReplyClick(review.id)}
                                className={`flex items-center gap-2 text-sm transition-colors ${replyStates[review.id]
                                    ? "text-[#FF0000] font-semibold"
                                    : "text-muted-foreground hover:text-foreground"
                                  }`}
                              >
                                <MessageCircle className="h-4 w-4" />
                                <span>Reply {replies[review.id]?.length > 0 && `(${replies[review.id].length})`}</span>
                              </button>
                            </div>

                            {replyStates[review.id] && (
                              <div className="mt-4 pt-4 border-t space-y-3">
                                <div className="flex items-start gap-3">
                                  <div className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0">
                                    <img
                                      src={`https://ui-avatars.com/api/?name=You&background=ffc107&color=fff&size=64`}
                                      alt="You"
                                      className="w-full h-full object-cover" />
                                  </div>
                                  <div className="flex-1 space-y-2">
                                    <Textarea
                                      placeholder="Write a reply..."
                                      className="min-h-[80px]"
                                      id={`reply-${review.id}`} />
                                    <div className="flex gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleReplyClick(review.id)}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="bg-[#FF0000] hover:opacity-90 text-white"
                                        onClick={() => {
                                          const textarea = document.getElementById(`reply-${review.id}`)
                                          if (textarea) {
                                            handleSubmitReply(review.id, textarea.value)
                                            textarea.value = ""
                                          }
                                        }}
                                      >
                                        <Send className="h-3 w-3 mr-2" />
                                        Post Reply
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {replies[review.id] && replies[review.id].length > 0 && (
                              <div className="mt-4 pt-4 border-t space-y-3">
                                {replies[review.id].map((reply) => (
                                  <div key={reply.id} className="flex items-start gap-3 pl-4 border-l-2 border-gray-200">
                                    <div className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0">
                                      <img
                                        src={reply.userAvatar}
                                        alt={reply.userName}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm">{reply.userName}</span>
                                        {reply.verified && (
                                          <Badge className="bg-blue-500 text-white text-xs px-1.5 py-0">
                                            Verified
                                          </Badge>
                                        )}
                                        <span className="text-xs text-muted-foreground">�</span>
                                        <span className="text-xs text-muted-foreground">{reply.date}</span>
                                      </div>
                                      <p className="text-sm text-muted-foreground leading-relaxed">{reply.comment}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </ScrollReveal>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No reviews yet. Be the first to review!</p>
                  </div>
                )}
              </div> */}
          {/* </div>
          </ScrollReveal> */}
        </div>
      </div>
      <Footer />
    </AnimatedPage>
  )
}

