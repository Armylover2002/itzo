import { Link, useNavigate } from "react-router-dom"
import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { Star, Clock, MapPin, ArrowDownUp, Timer, ArrowRight, ChevronDown, Bookmark, Share2, Plus, Minus, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Card, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { useLocationSelector } from "@food/components/user/UserLayout"
import { useLocation } from "@food/hooks/useLocation"
import { useZone } from "@food/hooks/useZone"
import { useCart } from "@food/context/CartContext"
import PageNavbar from "@food/components/user/PageNavbar"
import offerImage from "@food/assets/offerimage.png"
import AddToCartAnimation from "@food/components/user/AddToCartAnimation"
import OptimizedImage from "@food/components/OptimizedImage"
import api from "@food/api"
import { restaurantAPI, adminAPI } from "@food/api"
import { isModuleAuthenticated } from "@food/utils/auth"
import { flattenMenuItems, getMenuFromResponse } from "@food/utils/menuItems"
import { calculateDistance, formatDistance } from "@food/utils/common"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}
const RUPEE_SYMBOL = "\u20B9"
const UNDER_250_FILTERS_STORAGE_KEY = "food-under-250-filters"

const readUnder250Filters = () => {
  if (typeof window === "undefined") {
    return {
      selectedSort: null,
      activeCategory: null,
      under30MinsFilter: false,
    }
  }

  try {
    const raw = window.localStorage.getItem(UNDER_250_FILTERS_STORAGE_KEY)
    if (!raw) {
      return {
        selectedSort: null,
        activeCategory: null,
        under30MinsFilter: false,
      }
    }

    const parsed = JSON.parse(raw)
    return {
      selectedSort: typeof parsed?.selectedSort === "string" ? parsed.selectedSort : null,
      activeCategory: typeof parsed?.activeCategory === "string" ? parsed.activeCategory : null,
      under30MinsFilter: parsed?.under30MinsFilter === true,
    }
  } catch {
    return {
      selectedSort: null,
      activeCategory: null,
      under30MinsFilter: false,
    }
  }
}


export default function Under250() {
  const initialFiltersRef = useRef(readUnder250Filters())
  const { location } = useLocation()
  const { zoneId, zoneStatus, isInService, isOutOfService } = useZone(location)
  const navigate = useNavigate()
  const { addToCart, updateQuantity, removeFromCart, getCartItem, cart } = useCart()
  const [activeCategory, setActiveCategory] = useState(initialFiltersRef.current.activeCategory)
  const [showSortPopup, setShowSortPopup] = useState(false)
  const [selectedSort, setSelectedSort] = useState(initialFiltersRef.current.selectedSort)
  const [draftSelectedSort, setDraftSelectedSort] = useState(initialFiltersRef.current.selectedSort)
  const [under30MinsFilter, setUnder30MinsFilter] = useState(initialFiltersRef.current.under30MinsFilter)
  const [showItemDetail, setShowItemDetail] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [itemDetailQuantity, setItemDetailQuantity] = useState(1)
  const [showShareOptions, setShowShareOptions] = useState(false)
  const [quantities, setQuantities] = useState({})
  const [bookmarkedItems, setBookmarkedItems] = useState(new Set())
  const [viewCartButtonBottom, setViewCartButtonBottom] = useState("bottom-20")
  const lastScrollY = useRef(0)
  const scrollLockYRef = useRef(0)
  const itemDetailContentRef = useRef(null)
  const itemDetailGestureRef = useRef({
    startY: 0,
    dragging: false,
  })
  const [categories, setCategories] = useState([])
  const [bannerImages, setBannerImages] = useState([])
  const [loadingBanner, setLoadingBanner] = useState(true)
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0)
  const [under250Restaurants, setUnder250Restaurants] = useState([])
  const [loadingRestaurants, setLoadingRestaurants] = useState(true)
  const [hasScrolledPastBanner, setHasScrolledPastBanner] = useState(false)
  const bannerShellRef = useRef(null)
  const stickyHeaderRef = useRef(null)
  const autoSlideIntervalRef = useRef(null)
  const touchStartXRef = useRef(0)
  const touchStartYRef = useRef(0)
  const touchEndXRef = useRef(0)
  const touchEndYRef = useRef(0)
  const isBannerSwipingRef = useRef(false)

  const sortOptions = [
    { id: null, label: 'Relevance' },
    { id: 'rating-high', label: 'Rating: High to Low' },
    { id: 'delivery-time-low', label: 'Estimated Time: Low to High' },
    { id: 'distance-low', label: 'Distance: Low to High' },
  ]

  const handleClearAll = () => {
    setSelectedSort(null)
    setDraftSelectedSort(null)
    setUnder30MinsFilter(false)
    setActiveCategory(null)
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(UNDER_250_FILTERS_STORAGE_KEY)
    }
  }

  const handleApply = () => {
    setSelectedSort(draftSelectedSort)
    setShowSortPopup(false)
  }

  // Helper function to parse delivery time (e.g., "12-15 mins" -> 12 or average)
  const parseDeliveryTime = (deliveryTime) => {
    if (typeof deliveryTime === "number" && Number.isFinite(deliveryTime)) return deliveryTime
    if (!deliveryTime) return 999 // Default high value for sorting
    const value = String(deliveryTime)
    const rangeMatch = value.match(/(\d+)\s*-\s*(\d+)/)
    if (rangeMatch) {
      return (parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2 // Average
    }
    const match = value.match(/(\d+)/)
    if (match) {
      return parseInt(match[1])
    }
    return 999
  }

  // Helper function to parse distance (e.g., "0.4 km" -> 0.4)
  const parseDistance = (distance) => {
    if (typeof distance === "number" && Number.isFinite(distance)) return distance
    if (!distance) return 999 // Default high value for sorting
    const value = String(distance)
    const match = value.match(/(\d+\.?\d*)/)
    if (match) {
      const numericValue = parseFloat(match[1])
      return value.toLowerCase().includes("m") && !value.toLowerCase().includes("km")
        ? numericValue / 1000
        : numericValue
    }
    return 999
  }

  // Sort and filter restaurants based on selected sort and filters
  const sortedAndFilteredRestaurants = useMemo(() => {
    let filtered = under250Restaurants.map(r => ({ ...r, menuItems: [...(r.menuItems || [])] }))

    // Apply category filter
    if (activeCategory) {
      const selectedCat = categories.find(cat => cat.id === activeCategory)
      if (selectedCat) {
        const catNameLower = selectedCat.name.toLowerCase()
        filtered = filtered.map(restaurant => {
          const matches = restaurant.menuItems.filter(item => 
            (item.category || "").toLowerCase() === catNameLower ||
            (item.sectionName || "").toLowerCase() === catNameLower ||
            (item.subsectionName || "").toLowerCase() === catNameLower
          )
          if (matches.length > 0) {
            return { ...restaurant, menuItems: matches }
          }
          return null
        }).filter(Boolean)
      }
    }

    // Apply "Under 30 mins" filter
    if (under30MinsFilter) {
      filtered = filtered.filter(restaurant => {
        const deliveryTime = parseDeliveryTime(restaurant.deliveryTime)
        return deliveryTime <= 30
      })
    }

    // Apply sorting
    if (selectedSort === 'rating-high') {
      filtered.sort((a, b) => {
        const ratingA = a.rating || 0
        const ratingB = b.rating || 0
        if (ratingB !== ratingA) {
          return ratingB - ratingA
        }
        // Secondary sort by number of dishes
        return (b.menuItems?.length || 0) - (a.menuItems?.length || 0)
      })
    } else if (selectedSort === 'delivery-time-low') {
      filtered.sort((a, b) => {
        const timeA = parseDeliveryTime(a.deliveryTime)
        const timeB = parseDeliveryTime(b.deliveryTime)
        if (timeA !== timeB) {
          return timeA - timeB
        }
        if ((b.rating || 0) !== (a.rating || 0)) {
          return (b.rating || 0) - (a.rating || 0)
        }
        return (a.originalIndex || 0) - (b.originalIndex || 0)
      })
    } else if (selectedSort === 'distance-low') {
      filtered.sort((a, b) => {
        const distA = Number.isFinite(a.distanceInKm) ? a.distanceInKm : parseDistance(a.distance)
        const distB = Number.isFinite(b.distanceInKm) ? b.distanceInKm : parseDistance(b.distance)
        if (distA !== distB) {
          return distA - distB
        }
        if ((b.rating || 0) !== (a.rating || 0)) {
          return (b.rating || 0) - (a.rating || 0)
        }
        return (a.originalIndex || 0) - (b.originalIndex || 0)
      })
    } else {
      // Default: Relevance (keep original order from backend - already sorted by rating)
      // No additional sorting needed
    }

    return filtered
  }, [under250Restaurants, selectedSort, under30MinsFilter, activeCategory, categories])

  // Fetch under-250 banner from public API
  useEffect(() => {
    let cancelled = false
    setLoadingBanner(true)
    api.get('/food/hero-banners/under-250/public')
      .then((res) => {
        if (cancelled) return
        const data = res?.data?.data
        const list = Array.isArray(data?.banners) ? data.banners : (Array.isArray(data) ? data : [])
        const images = list
          .map((banner) => (typeof banner?.imageUrl === "string" ? banner.imageUrl.trim() : ""))
          .filter(Boolean)
        setBannerImages(images)
      })
      .catch(() => {
        if (!cancelled) setBannerImages([])
      })
      .finally(() => {
        if (!cancelled) setLoadingBanner(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    setCurrentBannerIndex((prev) => {
      if (bannerImages.length === 0) return 0
      return Math.min(prev, bannerImages.length - 1)
    })
  }, [bannerImages.length])

  useEffect(() => {
    if (typeof window === "undefined") return

    bannerImages.forEach((src) => {
      if (!src) return
      const img = new window.Image()
      img.src = src
    })
  }, [bannerImages])

  const startBannerAutoSlide = useCallback(() => {
    if (autoSlideIntervalRef.current) {
      clearInterval(autoSlideIntervalRef.current)
    }

    if (bannerImages.length <= 1) return

    autoSlideIntervalRef.current = setInterval(() => {
      if (!isBannerSwipingRef.current) {
        setCurrentBannerIndex((prev) => (prev + 1) % bannerImages.length)
      }
    }, 3500)
  }, [bannerImages.length])

  const resetBannerAutoSlide = useCallback(() => {
    startBannerAutoSlide()
  }, [startBannerAutoSlide])

  useEffect(() => {
    startBannerAutoSlide()

    return () => {
      if (autoSlideIntervalRef.current) {
        clearInterval(autoSlideIntervalRef.current)
      }
    }
  }, [startBannerAutoSlide])

  const handleBannerTouchStart = useCallback((event) => {
    if (bannerImages.length <= 1) return
    touchStartXRef.current = event.touches[0].clientX
    touchStartYRef.current = event.touches[0].clientY
    touchEndXRef.current = event.touches[0].clientX
    touchEndYRef.current = event.touches[0].clientY
    isBannerSwipingRef.current = true
  }, [bannerImages.length])

  const handleBannerTouchMove = useCallback((event) => {
    if (!isBannerSwipingRef.current) return
    touchEndXRef.current = event.touches[0].clientX
    touchEndYRef.current = event.touches[0].clientY
  }, [])

  const handleBannerTouchEnd = useCallback(() => {
    if (!isBannerSwipingRef.current || bannerImages.length <= 1) {
      isBannerSwipingRef.current = false
      return
    }

    const deltaX = touchEndXRef.current - touchStartXRef.current
    const deltaY = Math.abs(touchEndYRef.current - touchStartYRef.current)
    const minSwipeDistance = 40

    if (Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaX) > deltaY) {
      setCurrentBannerIndex((prev) => {
        if (deltaX > 0) {
          return (prev - 1 + bannerImages.length) % bannerImages.length
        }
        return (prev + 1) % bannerImages.length
      })
      resetBannerAutoSlide()
    }

    isBannerSwipingRef.current = false
  }, [bannerImages.length, resetBannerAutoSlide])

  // Fetch restaurants with dishes under ?250 from backend
  useEffect(() => {
    const fetchRestaurantsUnder250 = async () => {
      try {
        setLoadingRestaurants(true)
        const response = await restaurantAPI.getRestaurants(zoneId ? { zoneId } : {})
        const restaurantsRaw = Array.isArray(response?.data?.data?.restaurants)
          ? response.data.data.restaurants
          : []
        const userLat = Number(location?.latitude)
        const userLng = Number(location?.longitude)

        const restaurantsWithUnder250Dishes = await Promise.all(
          restaurantsRaw.map(async (restaurant, index) => {
            const restaurantId = restaurant?.restaurantId || restaurant?._id
            if (!restaurantId) return null

            try {
              const menuResponse = await restaurantAPI.getMenuByRestaurantId(restaurantId)
              const menu = getMenuFromResponse(menuResponse)
              const menuItems = flattenMenuItems(menu)
                .filter((item) => Number(item?.price || 0) <= 250 && item?.isAvailable !== false)
                .map((item) => {
                  const foodType = String(item?.foodType || "").toLowerCase()
                  const isVeg = foodType.includes("veg") && !foodType.includes("non")
                  return {
                    ...item,
                    id: String(item?.id || item?._id || `${restaurantId}-${item?.name || "dish"}`),
                    price: Number(item?.price || 0),
                    isVeg,
                    image:
                      item?.image ||
                      restaurant?.coverImages?.[0]?.url ||
                      restaurant?.coverImages?.[0] ||
                      restaurant?.menuImages?.[0]?.url ||
                      restaurant?.menuImages?.[0] ||
                      restaurant?.profileImage?.url ||
                      "",
                  }
                })

              if (menuItems.length === 0) return null

              const deliveryMinutes =
                Number(restaurant?.estimatedDeliveryTimeMinutes) ||
                Number(restaurant?.estimatedDeliveryTime) ||
                null
              const restaurantLocation = restaurant?.location
              const restaurantLat = Number(
                restaurantLocation?.latitude ??
                (Array.isArray(restaurantLocation?.coordinates) ? restaurantLocation.coordinates[1] : null)
              )
              const restaurantLng = Number(
                restaurantLocation?.longitude ??
                (Array.isArray(restaurantLocation?.coordinates) ? restaurantLocation.coordinates[0] : null)
              )
              const distanceInKm = (
                Number.isFinite(userLat) &&
                Number.isFinite(userLng) &&
                Number.isFinite(restaurantLat) &&
                Number.isFinite(restaurantLng)
              )
                ? calculateDistance(userLat, userLng, restaurantLat, restaurantLng)
                : null
              const fallbackDistance =
                typeof restaurant?.distance === "number"
                  ? formatDistance(restaurant.distance)
                  : (restaurant?.distance || "")

              return {
                id: String(restaurantId),
                restaurantId: String(restaurantId),
                slug:
                  restaurant?.slug ||
                  String(restaurant?.restaurantName || restaurant?.name || "")
                    .toLowerCase()
                    .replace(/\s+/g, "-"),
                name: restaurant?.restaurantName || restaurant?.name || "Restaurant",
                rating: Number(restaurant?.rating || 0),
                totalRatings: Number(restaurant?.totalRatings || restaurant?.ratingCount || 0),
                deliveryTime:
                  restaurant?.estimatedDeliveryTime ||
                  (deliveryMinutes ? `${deliveryMinutes} mins` : "30 mins"),
                distance: distanceInKm !== null ? formatDistance(distanceInKm) : fallbackDistance,
                distanceInKm,
                originalIndex: index,
                menuItems,
              }
            } catch {
              return null
            }
          })
        )

        setUnder250Restaurants(restaurantsWithUnder250Dishes.filter(Boolean))
      } catch (error) {
        debugError('Error fetching restaurants under 250:', error)
        setUnder250Restaurants([])
      } finally {
        setLoadingRestaurants(false)
      }
    }

    fetchRestaurantsUnder250()
  }, [zoneId, isOutOfService, location?.latitude, location?.longitude])

  // Fetch categories from backend (no static fallback list)
  useEffect(() => {
    let cancelled = false

    const fetchCategories = async () => {
      try {
        const response = await adminAPI.getPublicCategories(zoneId ? { zoneId } : {})
        const categoriesRaw = Array.isArray(response?.data?.data?.categories)
          ? response.data.data.categories
          : []

        const mappedCategories = categoriesRaw
          .map((cat, index) => {
            const name = String(cat?.name || "").trim()
            if (!name) return null

            return {
              id: String(cat?.id || cat?._id || cat?.slug || `cat-${index}`),
              name,
              slug: String(cat?.slug || name.toLowerCase().replace(/\s+/g, "-")),
              image:
                cat?.imageUrl ||
                cat?.image ||
                cat?.icon ||
                "",
            }
          })
          .filter(Boolean)

        if (!cancelled) {
          setCategories(mappedCategories)
        }
      } catch (error) {
        debugError("Error fetching under-250 categories:", error)
        if (!cancelled) setCategories([])
      }
    }

    fetchCategories()

    return () => {
      cancelled = true
    }
  }, [zoneId])

  // Sync quantities from cart on mount
  useEffect(() => {
    const cartQuantities = {}
    cart.forEach((item) => {
      cartQuantities[item.id] = item.quantity || 0
    })
    setQuantities(cartQuantities)
  }, [cart])

  useEffect(() => {
    if (!selectedItem || !showItemDetail) return

    const existingQuantity = quantities[selectedItem.id] || 0
    if (existingQuantity > 0) {
      setItemDetailQuantity(existingQuantity)
    }
  }, [quantities, selectedItem, showItemDetail])

  useEffect(() => {
    if (!showSortPopup) return
    setDraftSelectedSort(selectedSort)
  }, [showSortPopup, selectedSort])

  useEffect(() => {
    if (!showSortPopup && !showItemDetail && !showShareOptions) return
    if (typeof window === "undefined") return

    const bodyStyle = document.body.style
    scrollLockYRef.current = window.scrollY

    const originalOverflow = bodyStyle.overflow
    const originalPosition = bodyStyle.position
    const originalTop = bodyStyle.top
    const originalWidth = bodyStyle.width

    bodyStyle.overflow = "hidden"
    bodyStyle.position = "fixed"
    bodyStyle.top = `-${scrollLockYRef.current}px`
    bodyStyle.width = "100%"

    return () => {
      bodyStyle.overflow = originalOverflow
      bodyStyle.position = originalPosition
      bodyStyle.top = originalTop
      bodyStyle.width = originalWidth
      window.scrollTo(0, scrollLockYRef.current)
    }
  }, [showSortPopup, showItemDetail, showShareOptions])

  useEffect(() => {
    if (typeof window === "undefined") return

    if (!selectedSort && !activeCategory && !under30MinsFilter) {
      window.localStorage.removeItem(UNDER_250_FILTERS_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(
      UNDER_250_FILTERS_STORAGE_KEY,
      JSON.stringify({
        selectedSort,
        activeCategory,
        under30MinsFilter,
      })
    )
  }, [selectedSort, activeCategory, under30MinsFilter])

  // Scroll detection for view cart button positioning
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrollDifference = Math.abs(currentScrollY - lastScrollY.current)

      // Only update if scroll difference is significant (avoid flickering)
      if (scrollDifference < 5) {
        return
      }

      // Scroll down -> bottom-0, Scroll up -> bottom-20
      if (currentScrollY > lastScrollY.current) {
        // Scrolling down
        setViewCartButtonBottom("bottom-0")
      } else if (currentScrollY < lastScrollY.current) {
        // Scrolling up
        setViewCartButtonBottom("bottom-20")
      }

      lastScrollY.current = currentScrollY
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    const handleBannerScroll = () => {
      const bannerShell = bannerShellRef.current
      const stickyHeader = stickyHeaderRef.current

      if (!bannerShell) {
        setHasScrolledPastBanner(false)
        return
      }

      const bannerRect = bannerShell.getBoundingClientRect()
      const stickyHeight = stickyHeader?.getBoundingClientRect().height || 0
      setHasScrolledPastBanner(bannerRect.bottom <= stickyHeight)
    }

    handleBannerScroll()
    window.addEventListener("scroll", handleBannerScroll, { passive: true })
    window.addEventListener("resize", handleBannerScroll)

    return () => {
      window.removeEventListener("scroll", handleBannerScroll)
      window.removeEventListener("resize", handleBannerScroll)
    }
  }, [])

  // Helper function to update item quantity in bothlocal state and cart
  const updateItemQuantity = (item, newQuantity, event = null, restaurantName = null) => {
    // Check authentication
    if (!isModuleAuthenticated('user')) {
      toast.error("Please login to add items to cart")
      navigate('/user/auth/login', { state: { from: location.pathname } })
      return
    }

    // CRITICAL: Check if user is in service zone
    if (isOutOfService) {
      toast.error('You are outside the service zone. Please select a location within the service area.')
      return
    }

    // Update local state
    setQuantities((prev) => ({
      ...prev,
      [item.id]: newQuantity,
    }))

    // Find restaurant name from the item or use provided parameter
    const restaurant = restaurantName || item.restaurant || "Under 250"

    // Prepare cart item with all required properties
    const cartItem = {
      id: item.id,
      name: item.name,
      price: item.price,
      otherPrice: item.otherPrice || item.originalPrice || 0,
      image: item.image,
      restaurant: restaurant,
      description: item.description || "",
      originalPrice: item.originalPrice || item.price,
      isVeg: item.isVeg !== undefined ? item.isVeg : (String(item.foodType).toLowerCase() === 'veg'),
    }

    // Get source position for animation from event target
    let sourcePosition = null
    if (event) {
      let buttonElement = event.currentTarget
      if (!buttonElement && event.target) {
        buttonElement = event.target.closest('button') || event.target
      }

      if (buttonElement) {
        const rect = buttonElement.getBoundingClientRect()
        const scrollX = window.pageXOffset || window.scrollX || 0
        const scrollY = window.pageYOffset || window.scrollY || 0

        sourcePosition = {
          viewportX: rect.left + rect.width / 2,
          viewportY: rect.top + rect.height / 2,
          scrollX: scrollX,
          scrollY: scrollY,
          itemId: item.id,
        }
      }
    }

    // Update cart context
    if (newQuantity <= 0) {
      const productInfo = {
        id: item.id,
        name: item.name,
        imageUrl: item.image,
      }
      removeFromCart(item.id, sourcePosition, productInfo)
    } else {
      const existingCartItem = getCartItem(item.id)
      if (existingCartItem) {
        const productInfo = {
          id: item.id,
          name: item.name,
          imageUrl: item.image,
        }

        if (newQuantity > existingCartItem.quantity && sourcePosition) {
          const result = addToCart(cartItem, sourcePosition)
          if (result?.ok === false) {
            toast.error(result.error || 'Cannot add item from different restaurant. Please clear cart first.')
            return
          }
          if (newQuantity > existingCartItem.quantity + 1) {
            updateQuantity(item.id, newQuantity)
          }
        } else if (newQuantity < existingCartItem.quantity && sourcePosition) {
          updateQuantity(item.id, newQuantity, sourcePosition, productInfo)
        } else {
          updateQuantity(item.id, newQuantity)
        }
      } else {
        const result = addToCart(cartItem, sourcePosition)
        if (result?.ok === false) {
          toast.error(result.error || 'Cannot add item from different restaurant. Please clear cart first.')
          return
        }
        if (newQuantity > 1) {
          updateQuantity(item.id, newQuantity)
        }
      }
    }
  }

  const closeItemDetail = useCallback(() => {
    setShowItemDetail(false)
    setShowShareOptions(false)
  }, [])

  const handleItemClick = (item, restaurant) => {
    // Add restaurant info to item for display
    const itemWithRestaurant = {
      ...item,
      restaurant: restaurant.name,
      restaurantSlug: restaurant.slug || restaurant.restaurantId || "",
      description: item.description || `${item.name} from ${restaurant.name}`,
      customisable: item.customisable || false,
      notEligibleForCoupons: item.notEligibleForCoupons || false,
    }
    const existingQuantity = quantities[item.id] || 0
    setItemDetailQuantity(existingQuantity > 0 ? existingQuantity : 1)
    setSelectedItem(itemWithRestaurant)
    setShowShareOptions(false)
    setShowItemDetail(true)
  }

  const handleBookmarkClick = (itemId) => {
    setBookmarkedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const handleShareItem = async (item) => {
    if (!item) return

    const itemId = item.id || item._id
    const restaurantSlug = item.restaurantSlug || item.slug || ""
    const shareUrl = restaurantSlug
      ? `${window.location.origin}/user/restaurants/${restaurantSlug}${itemId ? `?dish=${encodeURIComponent(itemId)}` : ""}`
      : window.location.href

    try {
      if (navigator.share) {
        await navigator.share({
          title: item.name || "Dish",
          text: `Check out ${item.name || "this dish"} from ${item.restaurant || "Under 250"}`,
          url: shareUrl,
        })
        return
      }
    } catch (error) {
      if (error?.name === "AbortError") return
    }

    setShowShareOptions(true)
  }

  const handleShareOption = async (type) => {
    if (!selectedItem) return

    const itemId = selectedItem.id || selectedItem._id
    const restaurantSlug = selectedItem.restaurantSlug || selectedItem.slug || ""
    const shareUrl = restaurantSlug
      ? `${window.location.origin}/user/restaurants/${restaurantSlug}${itemId ? `?dish=${encodeURIComponent(itemId)}` : ""}`
      : window.location.href
    const shareText = `Check out ${selectedItem.name || "this dish"} from ${selectedItem.restaurant || "Under 250"}`
    const encodedUrl = encodeURIComponent(shareUrl)
    const encodedText = encodeURIComponent(`${shareText} ${shareUrl}`)

    try {
      if (type === "copy") {
        await navigator.clipboard.writeText(shareUrl)
        toast.success("Link copied to clipboard!")
      } else if (type === "whatsapp") {
        window.open(`https://wa.me/?text=${encodedText}`, "_blank", "noopener,noreferrer")
      } else if (type === "telegram") {
        window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer")
      } else if (type === "sms") {
        window.location.href = `sms:?&body=${encodedText}`
      } else if (type === "email") {
        window.location.href = `mailto:?subject=${encodeURIComponent(selectedItem.name || "Dish")}&body=${encodedText}`
      }
      setShowShareOptions(false)
    } catch {
      toast.error("Failed to share link")
    }
  }

  const handleItemDetailTouchStart = (e) => {
    if (!showItemDetail) return
    itemDetailGestureRef.current = {
      startY: e.touches?.[0]?.clientY || 0,
      dragging: true,
    }
  }

  const handleItemDetailTouchEnd = (e) => {
    if (!showItemDetail || !itemDetailGestureRef.current.dragging) return

    const endY = e.changedTouches?.[0]?.clientY || 0
    const deltaY = endY - itemDetailGestureRef.current.startY
    const contentScrollTop = itemDetailContentRef.current?.scrollTop || 0

    itemDetailGestureRef.current.dragging = false

    if (contentScrollTop <= 0 && deltaY > 80) {
      closeItemDetail()
    }
  }

  const handleItemDetailWheel = (e) => {
    if (!showItemDetail) return
    const contentScrollTop = itemDetailContentRef.current?.scrollTop || 0
    if (contentScrollTop <= 0 && e.deltaY < -20) {
      closeItemDetail()
    }
  }

  // Check if should show grayscale (only when user is out of service)
  const shouldShowGrayscale = isOutOfService

  return (

    <div className={`relative min-h-screen bg-white dark:bg-[#0a0a0a] ${shouldShowGrayscale ? 'grayscale opacity-75' : ''}`}>
      <div
        ref={stickyHeaderRef}
        className="sticky top-0 left-0 right-0 z-40 w-full md:hidden transition-all duration-300 bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-200"
      >
        <div className="relative z-50 pt-2 sm:pt-3 pb-2">
          <PageNavbar textColor="black" zIndex={20} showProfile={true} showLogo={false} />
        </div>
      </div>

      {/* Banner Section */}
      <div
        ref={bannerShellRef}
        data-banner-shell="true"
        className="relative w-full overflow-hidden h-[clamp(240px,42vw,520px)] md:h-64 lg:h-72"
      >
        {/* Banner Image */}
        {bannerImages.length > 0 && (
          <div
            className="absolute inset-0 z-0 overflow-hidden"
            onTouchStart={handleBannerTouchStart}
            onTouchMove={handleBannerTouchMove}
            onTouchEnd={handleBannerTouchEnd}
          >
            <div
              className="flex h-full w-full transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${currentBannerIndex * 100}%)` }}
            >
              {bannerImages.map((bannerImage, index) => (
                <div key={`${bannerImage}-${index}`} className="relative h-full w-full shrink-0">
                  <OptimizedImage
                    src={bannerImage}
                    alt={`Under 250 Banner ${index + 1}`}
                    className="w-full h-full"
                    objectFit="cover"
                    priority={index === 0}
                    sizes="100vw"
                  />
                </div>
              ))}
            </div>
            {bannerImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/25 px-3 py-1.5 backdrop-blur-sm">
                {bannerImages.map((_, index) => (
                  <button
                    key={`banner-dot-${index}`}
                    type="button"
                    aria-label={`Go to banner ${index + 1}`}
                    onClick={() => {
                      setCurrentBannerIndex(index)
                      resetBannerAutoSlide()
                    }}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      currentBannerIndex === index ? "w-5 bg-white" : "w-2 bg-white/55"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        {bannerImages.length === 0 && !loadingBanner && (
          <div className="absolute top-0 left-0 right-0 bottom-0 z-0 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950 overflow-hidden" />
        )}
      </div>

      {/* Content Section */}
      <div className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 space-y-0 pt-2 sm:pt-3 md:pt-4 lg:pt-6 pb-6 md:pb-8 lg:pb-10">

        <section className="space-y-1 sm:space-y-1.5">
          <div
            className="flex gap-3 sm:gap-4 md:gap-5 overflow-x-auto scrollbar-hide scroll-smooth px-2 sm:px-3 py-2 sm:py-3"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              touchAction: "pan-x pan-y pinch-zoom",
            }}
          >
            {/* All Button */}
            <div className="flex-shrink-0 cursor-pointer" onClick={() => setActiveCategory(null)}>
              <motion.div
                className="flex flex-col items-center gap-1.5 sm:gap-2 w-[62px] sm:w-20 md:w-20"
                whileHover={{ scale: 1.08, y: -2 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <div className={`w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-full overflow-hidden shadow-md transition-all ${!activeCategory ? 'ring-2 ring-[#FE5502] ring-offset-2' : ''}`}>
                  <OptimizedImage
                    src={offerImage}
                    alt="All"
                    className="w-full h-full bg-white rounded-full"
                    objectFit="cover"
                    sizes="(max-width: 640px) 62px, (max-width: 768px) 80px, 80px"
                    placeholder="blur"
                  />
                </div>
                <span className={`text-xs sm:text-xs md:text-sm font-semibold text-gray-800 dark:text-gray-200 text-center pb-1 ${!activeCategory ? 'text-[#FE5502]' : ''}`}>
                  All
                </span>
              </motion.div>
            </div>
            {categories.map((category, index) => {
              const isActive = activeCategory === category.id
              return (
                <div key={category.id} className="flex-shrink-0 cursor-pointer" onClick={() => setActiveCategory(isActive ? null : category.id)}>
                    <motion.div
                      className="flex flex-col items-center gap-1.5 sm:gap-2 w-[62px] sm:w-20 md:w-20"
                      whileHover={{ scale: 1.08, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <div className={`w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-full overflow-hidden shadow-md transition-all ${isActive ? 'ring-2 ring-[#FE5502] ring-offset-2' : ''}`}>
                        <OptimizedImage
                          src={category.image}
                          alt={category.name}
                          className="w-full h-full bg-white rounded-full"
                          objectFit="cover"
                          sizes="(max-width: 640px) 62px, (max-width: 768px) 80px, 80px"
                          placeholder="blur"
                        />
                      </div>
                      <span className={`text-xs sm:text-xs md:text-sm font-semibold text-gray-800 dark:text-gray-200 text-center pb-1 ${isActive ? 'text-[#FE5502]' : ''}`}>
                        {category.name.length > 7 ? `${category.name.slice(0, 7)}...` : category.name}
                      </span>
                    </motion.div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="py-2 sm:py-3 md:py-4">
          <div className="flex items-center gap-2 md:gap-3">
            <Button
              variant="outline"
              onClick={() => setShowSortPopup(true)}
              className="h-8 sm:h-9 md:h-10 px-3 sm:px-4 md:px-5 rounded-md flex items-center gap-2 whitespace-nowrap flex-shrink-0 font-medium transition-all bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm md:text-base"
            >
              <ArrowDownUp className="h-4 w-4 md:h-5 md:w-5 rotate-90" />
              <span className="text-sm md:text-base font-medium">
                {selectedSort ? sortOptions.find(opt => opt.id === selectedSort)?.label : 'Sort'}
              </span>
              <ChevronDown className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setUnder30MinsFilter(!under30MinsFilter)}
              className={`h-8 sm:h-9 md:h-10 px-3 sm:px-4 md:px-5 rounded-md flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 font-medium transition-all text-sm md:text-base ${under30MinsFilter
                ? 'bg-[#FE5502] text-white border border-[#FE5502] hover:bg-[#C83C00]'
                : 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}
            >
              <Timer className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              <span className="text-xs sm:text-sm md:text-base font-medium">Under 30 mins</span>
            </Button>
          </div>
        </section>


        {/* Restaurant Menu Sections */}
        {loadingRestaurants ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-500 dark:text-gray-400">Loading restaurants...</div>
          </div>
        ) : sortedAndFilteredRestaurants.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-500 dark:text-gray-400">
              {under250Restaurants.length === 0
                ? `No restaurants with dishes under ${RUPEE_SYMBOL}250 found.`
                : "No restaurants match the selected filters."}
            </div>
          </div>
        ) : (
          sortedAndFilteredRestaurants.map((restaurant) => {
            const restaurantSlug = restaurant.slug || restaurant.name.toLowerCase().replace(/\s+/g, "-")
            return (
              <section key={restaurant.id} className="pt-4 sm:pt-6 md:pt-8 lg:pt-10">
                {/* Restaurant Header */}
                <div className="flex items-start justify-between mb-3 md:mb-3.5">
                  <div className="flex-1">
                    <h3 className="text-lg sm:text-xl md:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-1">
                      {restaurant.name}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Clock className="h-4 w-4 md:h-4 md:w-4" strokeWidth={1.5} />
                      <span className="font-medium">{restaurant.deliveryTime}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1 bg-green-800 text-white px-1.5 py-0.5 md:px-2 md:py-1 rounded-full">
                      <div className="bg-white text-green-700 px-1 py-1 rounded-full">
                        <Star className="h-3.5 w-3.5 md:h-3 md:w-3 fill-green-800 text-green-800" />
                      </div>
                      <span className="text-xs md:text-xs font-bold">{restaurant.rating}</span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {restaurant.totalRatings > 0 ? `By ${restaurant.totalRatings >= 1000 ? `${(restaurant.totalRatings / 1000).toFixed(1)}K+` : `${restaurant.totalRatings}+`}` : ''}
                    </span>
                  </div>
                </div>

                {/* Menu Items Horizontal Scroll */}
                {restaurant.menuItems && restaurant.menuItems.length > 0 && (
                  <div className="space-y-2 md:space-y-3">
                    <div
                      className="flex md:grid gap-3 sm:gap-4 md:gap-4 lg:gap-5 overflow-x-auto md:overflow-x-visible overflow-y-visible scrollbar-hide scroll-smooth pb-2 md:pb-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4"
                      style={{
                        scrollbarWidth: "none",
                        msOverflowStyle: "none",
                        touchAction: "pan-x pan-y pinch-zoom",
                        overflowY: "hidden",
                      }}
                    >
                      {restaurant.menuItems.map((item, itemIndex) => {
                        const quantity = quantities[item.id] || 0
                        return (
                          <motion.div
                            key={item.id}
                            className="flex-shrink-0 w-[200px] sm:w-[220px] md:w-full bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                            onClick={() => handleItemClick(item, restaurant)}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ duration: 0.4, delay: itemIndex * 0.05 }}
                            whileHover={{ y: -4, scale: 1.01 }}
                          >
                            {/* Item Image */}
                            <div className="relative w-full h-32 sm:h-36 md:h-36 lg:h-40 xl:h-40 overflow-hidden">
                              <motion.div
                                className="absolute inset-0"
                                whileHover={{ scale: 1.08 }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                              >
                                <OptimizedImage
                                  src={item.image}
                                  alt={item.name}
                                  className="w-full h-full"
                                  objectFit="cover"
                                  sizes="(max-width: 640px) 200px, (max-width: 768px) 220px, 280px"
                                  placeholder="blur"
                                  priority={itemIndex < 4}
                                />
                              </motion.div>
                              {/* Gradient Overlay on Hover */}
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"
                                initial={{ opacity: 0 }}
                                whileHover={{ opacity: 1 }}
                                transition={{ duration: 0.3 }}
                              />
                              {/* Veg Indicator */}
                              {item.isVeg && (
                                <motion.div
                                  className="absolute top-2 left-2 md:top-2.5 md:left-2.5 h-4 w-4 rounded border-2 border-green-600 bg-white flex items-center justify-center z-10"
                                  whileHover={{ scale: 1.15 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <div className="h-2 w-2 rounded-full bg-green-600" />
                                </motion.div>
                              )}
                            </div>

                            {/* Item Details */}
                            <div className="p-3 md:p-3.5">
                              <div className="flex items-center gap-1 md:gap-1.5 mb-1 md:mb-1.5">
                                {item.isVeg && (
                                  <div className="h-3 w-3 rounded border border-green-600 bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                                    <div className="h-1.5 w-1.5 rounded-full bg-green-600" />
                                  </div>
                                )}
                                <span className="text-sm md:text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
                                  1 x {item.name}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-base md:text-base lg:text-lg font-bold text-gray-900 dark:text-white">
                                    {RUPEE_SYMBOL}{Math.round(item.price)}
                                  </p>
                                  {item.bestPrice && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Best price</p>
                                  )}
                                </div>
                                {quantity > 0 ? (
                                  <Link to="/user/cart" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      variant={"outline"}
                                      size="sm"
                                      className="bg-[#FFF5F5] text-[#FE5502] border-[#FE5502] hover:bg-[#FE5502] hover:text-white h-7 md:h-7 px-3 text-xs md:text-xs font-semibold"
                                    >
                                      View cart
                                    </Button>
                                  </Link>
                                ) : (
                                  <Button
                                    variant={"outline"}
                                    size="sm"
                                    disabled={shouldShowGrayscale}
                                    className={`h-7 md:h-7 px-3 text-xs md:text-xs font-semibold ${shouldShowGrayscale
                                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-300 dark:border-gray-700 cursor-not-allowed opacity-50'
                                      : 'bg-[#FFF5F5] text-[#FE5502] border-[#FE5502] hover:bg-[#FE5502] hover:text-white'
                                      }`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (!shouldShowGrayscale) {
                                        handleItemClick(item, restaurant)
                                      }
                                    }}
                                  >
                                    Add
                                  </Button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>

                    {/* View Full Menu Button */}
                    <Link className="flex justify-center mt-2 md:mt-3 lg:mt-4" to={`/user/restaurants/${restaurantSlug}?under250=true`}>
                      <Button
                        variant="outline"
                        className="w-min align-center text-center rounded-lg md:rounded-xl mx-auto bg-gray-50 dark:bg-[#1a1a1a] hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-white text-gray-700 border-gray-200 dark:border-gray-800 h-9 md:h-10 lg:h-11 px-4 md:px-6 lg:px-8 text-sm md:text-base lg:text-lg"
                      >
                        View full menu <ArrowRight className="h-4 w-4 md:h-5 md:w-5 lg:h-6 lg:w-6 ml-2 text-gray-700 dark:text-gray-300" />
                      </Button>
                    </Link>
                  </div>
                )}
              </section>
            )
          }))}
      </div>

      {/* Sort Popup - Bottom Sheet */}
      <AnimatePresence>
        {showSortPopup && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowSortPopup(false)}
              className="fixed inset-0 bg-black/50 z-100"
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30
              }}
              className="fixed bottom-0 left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-lg lg:max-w-2xl bg-white dark:bg-[#1a1a1a] rounded-t-3xl shadow-2xl z-[110] max-h-[60vh] md:max-h-[80vh] overflow-hidden flex flex-col"
            >
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 md:px-6 py-4 md:py-5 border-b dark:border-gray-800">
                <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Sort By</h2>
                <button
                  onClick={handleClearAll}
                  className="text-[#FE5502] dark:text-[#F97316] font-medium text-sm md:text-base"
                >
                  Clear all
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-6">
                <div className="flex flex-col gap-3 md:gap-4">
                  {sortOptions.map((option) => (
                    <button
                      key={option.id || 'relevance'}
                      onClick={() => setDraftSelectedSort(option.id)}
                      className={`px-4 md:px-5 lg:px-6 py-3 md:py-4 rounded-xl border text-left transition-colors ${draftSelectedSort === option.id
                        ? 'border-[#FE5502] bg-red-50 dark:bg-red-900/20'
                        : 'border-gray-200 dark:border-gray-800 hover:border-[#FE5502]'
                        }`}
                    >
                      <span className={`text-sm md:text-base lg:text-lg font-medium ${draftSelectedSort === option.id ? 'text-[#FE5502] dark:text-[#F97316]' : 'text-gray-700 dark:text-gray-300'}`}>
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-4 md:gap-6 px-4 md:px-6 py-4 md:py-5 border-t dark:border-gray-800 bg-white dark:bg-[#1a1a1a]">
                <button
                  onClick={() => setShowSortPopup(false)}
                  className="flex-1 py-3 md:py-4 text-center font-semibold text-gray-700 dark:text-gray-300 text-sm md:text-base"
                >
                  Close
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 py-3 md:py-4 font-semibold rounded-xl transition-colors text-sm md:text-base bg-[#FE5502] text-white hover:bg-[#C83C00]"
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Item Detail Popup */}
      <AnimatePresence>
        {showItemDetail && selectedItem && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/40 z-[9999]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeItemDetail}
            />

            {/* Item Detail Bottom Sheet */}
            <motion.div
              className="fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-2xl lg:max-w-4xl xl:max-w-5xl z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl shadow-2xl max-h-[90vh] md:max-h-[85vh] flex flex-col"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.15, type: "spring", damping: 30, stiffness: 400 }}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handleItemDetailTouchStart}
              onTouchEnd={handleItemDetailTouchEnd}
              onWheel={handleItemDetailWheel}
            >
              {/* Close Button - Top Center Above Popup with 4px gap */}
              <div className="absolute -top-[44px] left-1/2 -translate-x-1/2 z-[10001]">
                <motion.button
                  onClick={closeItemDetail}
                  className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-gray-800 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-900 dark:hover:bg-gray-600 transition-colors shadow-lg"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <X className="h-5 w-5 md:h-6 md:w-6 text-white" />
                </motion.button>
              </div>

              {/* Image Section */}
              <div className="relative w-full h-64 md:h-80 lg:h-96 xl:h-[500px] overflow-hidden rounded-t-3xl">
                <OptimizedImage
                  src={selectedItem.image}
                  alt={selectedItem.name}
                  className="w-full h-full"
                  objectFit="cover"
                  sizes="100vw"
                  priority={true}
                  placeholder="blur"
                />
                {/* Bookmark and Share Icons Overlay */}
                <div className="absolute bottom-4 right-4 flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleBookmarkClick(selectedItem.id)
                    }}
                    className={`h-10 w-10 rounded-full border flex items-center justify-center transition-all duration-300 ${bookmarkedItems.has(selectedItem.id)
                      ? "border-red-500 bg-red-50 text-red-500"
                      : "border-white bg-white/90 text-gray-600 hover:bg-white"
                      }`}
                  >
                    <Bookmark
                      className={`h-5 w-5 transition-all duration-300 ${bookmarkedItems.has(selectedItem.id) ? "fill-red-500" : ""
                        }`}
                    />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleShareItem(selectedItem)
                    }}
                    className="h-10 w-10 rounded-full border border-white bg-white/90 text-gray-600 hover:bg-white flex items-center justify-center transition-colors"
                  >
                    <Share2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Content Section */}
              <div
                ref={itemDetailContentRef}
                className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 xl:px-10 py-4 md:py-6 lg:py-8"
              >
                {/* Item Name and Indicator */}
                <div className="flex items-start justify-between mb-3 md:mb-4 lg:mb-6">
                  <div className="flex items-center gap-2 md:gap-3 flex-1">
                    {selectedItem.isVeg && (
                      <div className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7 rounded border-2 border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                        <div className="h-2.5 w-2.5 md:h-3 md:w-3 lg:h-3.5 lg:w-3.5 rounded-full bg-green-600 dark:bg-green-500" />
                      </div>
                    )}
                    <h2 className="text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 dark:text-white">
                      {selectedItem.name}
                    </h2>
                  </div>
                  {/* Bookmark and Share Icons (Desktop) */}
                  <div className="hidden md:flex items-center gap-2 lg:gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleBookmarkClick(selectedItem.id)
                      }}
                      className={`h-8 w-8 lg:h-10 lg:w-10 rounded-full border flex items-center justify-center transition-all duration-300 ${bookmarkedItems.has(selectedItem.id)
                        ? "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400"
                        : "border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                        }`}
                    >
                      <Bookmark
                        className={`h-4 w-4 lg:h-5 lg:w-5 transition-all duration-300 ${bookmarkedItems.has(selectedItem.id) ? "fill-red-500 dark:fill-red-400" : ""
                          }`}
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleShareItem(selectedItem)
                      }}
                      className="h-8 w-8 lg:h-10 lg:w-10 rounded-full border border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex items-center justify-center transition-colors"
                    >
                      <Share2 className="h-4 w-4 lg:h-5 lg:w-5" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm md:text-base lg:text-lg text-gray-600 dark:text-gray-400 mb-4 md:mb-6 lg:mb-8 leading-relaxed">
                  {selectedItem.description || `${selectedItem.name} from ${selectedItem.restaurant || 'Under 250'}`}
                </p>

                {/* Highly Reordered Progress Bar */}
                {selectedItem.customisable && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1 h-0.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#FE5502] rounded-full" style={{ width: '50%' }} />
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
                      highly reordered
                    </span>
                  </div>
                )}

                {/* Not Eligible for Coupons */}
                {selectedItem.notEligibleForCoupons && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-4">
                    NOT ELIGIBLE FOR COUPONS
                  </p>
                )}
              </div>

              {/* Bottom Action Bar */}
              <div className="border-t dark:border-gray-800 border-gray-200 px-4 md:px-6 lg:px-8 xl:px-10 py-4 md:py-5 lg:py-6 bg-white dark:bg-[#1a1a1a]">
                <div className="flex items-center gap-4 md:gap-5 lg:gap-6">
                  {/* Quantity Selector */}
                  <div className={`flex items-center gap-3 md:gap-4 lg:gap-5 border-2 rounded-lg md:rounded-xl px-3 md:px-4 lg:px-5 h-[44px] md:h-[50px] lg:h-[56px] ${shouldShowGrayscale
                    ? 'border-gray-300 dark:border-gray-700 opacity-50'
                    : 'border-gray-300 dark:border-gray-700'
                    }`}>
                    <button
                      onClick={(e) => {
                        if (!shouldShowGrayscale) {
                          e.stopPropagation()
                          setItemDetailQuantity((prev) => Math.max(1, prev - 1))
                        }
                      }}
                      disabled={itemDetailQuantity <= 1 || shouldShowGrayscale}
                      className={`${shouldShowGrayscale
                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed'
                        }`}
                    >
                      <Minus className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7" />
                    </button>
                    <span className={`text-lg md:text-xl lg:text-2xl font-semibold min-w-[2rem] md:min-w-[2.5rem] lg:min-w-[3rem] text-center ${shouldShowGrayscale
                      ? 'text-gray-400 dark:text-gray-600'
                      : 'text-gray-900 dark:text-white'
                      }`}>
                      {itemDetailQuantity}
                    </span>
                    <button
                      onClick={(e) => {
                        if (!shouldShowGrayscale) {
                          e.stopPropagation()
                          setItemDetailQuantity((prev) => prev + 1)
                        }
                      }}
                      disabled={shouldShowGrayscale}
                      className={shouldShowGrayscale
                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }
                    >
                      <Plus className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7" />
                    </button>
                  </div>

                  {/* Add Item Button */}
                  <Button
                    className={`flex-1 h-[44px] md:h-[50px] lg:h-[56px] rounded-lg md:rounded-xl font-semibold flex items-center justify-center gap-2 text-sm md:text-base lg:text-lg ${shouldShowGrayscale
                      ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-600 cursor-not-allowed opacity-50'
                      : 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white'
                      }`}
                    onClick={(e) => {
                      if (!shouldShowGrayscale) {
                        updateItemQuantity(selectedItem, itemDetailQuantity, e)
                        closeItemDetail()
                      }
                    }}
                    disabled={shouldShowGrayscale}
                  >
                    <span>Add item</span>
                    <div className="flex items-center gap-1 md:gap-2">
                      {selectedItem.originalPrice && selectedItem.originalPrice > selectedItem.price && (
                        <span className="text-sm md:text-base lg:text-lg line-through text-red-200">
                          {RUPEE_SYMBOL}{Math.round(selectedItem.originalPrice)}
                        </span>
                      )}
                      <span className="text-base md:text-lg lg:text-xl font-bold">
                        {RUPEE_SYMBOL}{Math.round(selectedItem.price)}
                      </span>
                    </div>
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showShareOptions && selectedItem && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-[10020]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowShareOptions(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.2, type: "spring", damping: 28, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-[10021] bg-white dark:bg-[#1a1a1a] rounded-t-3xl shadow-2xl px-4 py-4"
            >
              <div className="flex justify-center pb-3">
                <div className="w-12 h-1 bg-gray-300 rounded-full" />
              </div>
              <div className="flex items-center justify-between pb-4">
                <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">Share dish</h3>
                <button
                  onClick={() => setShowShareOptions(false)}
                  className="text-sm font-medium text-gray-500 dark:text-gray-400"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "whatsapp", label: "WhatsApp" },
                  { id: "telegram", label: "Telegram" },
                  { id: "sms", label: "SMS" },
                  { id: "email", label: "User Id" },
                  { id: "copy", label: "Copy Link" },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleShareOption(option.id)}
                    className="rounded-2xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-800 dark:text-gray-200 hover:border-[#FE5502] hover:text-[#FE5502] transition-colors"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add to Cart Animation */}
      <AddToCartAnimation dynamicBottom={viewCartButtonBottom} />
    </div>
  )
}

