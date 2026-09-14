import { useState, useEffect, useRef, useMemo } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { restaurantAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { toast } from "sonner"
import { useLocation } from "@food/hooks/useLocation"
import { useZone } from "@food/hooks/useZone"
import {
  ArrowLeft,
  Search,
  MoreVertical,
  MapPin,
  Clock,
  Tag,
  ChevronDown,
  Info,
  Star,
  SlidersHorizontal,
  Bookmark,
  Share2,
  Plus,
  Minus,
  AlertCircle,
} from "lucide-react"
import { Button } from "@food/components/ui/button"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { useCart } from "@food/context/CartContext"
import { useProfile } from "@food/context/ProfileContext"
import { getCompanyNameAsync } from "@common/utils/businessSettings"
import { isModuleAuthenticated } from "@food/utils/auth"
import { getRoadDistanceKm } from "@/shared/services/roadDistance"
import { parseGeoPoint, normalizeRestaurantLocation } from "@food/utils/geo"
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import {
  buildCartLineId,
  getDefaultFoodVariant,
  getFoodDisplayPrice,
  getFoodPriceLabel,
  getFoodVariants,
  hasFoodVariants,
} from "@food/utils/foodVariants"
import { RestaurantDetailSkeleton } from "@food/components/ui/loading-skeletons"
import RestaurantDetailsHero from "@food/components/user/restaurant-details/RestaurantDetailsHero"
import RestaurantDetailsSummary from "@food/components/user/restaurant-details/RestaurantDetailsSummary"
import RestaurantDetailsOffers from "@food/components/user/restaurant-details/RestaurantDetailsOffers"
import RestaurantDetailsMenuToolbar from "@food/components/user/restaurant-details/RestaurantDetailsMenuToolbar"
import RestaurantDishCard from "@food/components/user/restaurant-details/RestaurantDishCard"
import { FOOD_IMAGE_FALLBACK, RUPEE_SYMBOL, buildRestaurantGallery } from "@food/components/user/restaurant-details/restaurantDetailsUtils"
import RestaurantMenuSections from "@food/components/user/restaurant-details/RestaurantMenuSections"
import RestaurantDetailsOverlays from "@food/components/user/restaurant-details/RestaurantDetailsOverlays"
import RestaurantDetailsErrorBoundary from "@food/components/user/restaurant-details/RestaurantDetailsErrorBoundary"
import RestaurantFloatingMenuButton from "@food/components/user/restaurant-details/RestaurantFloatingMenuButton"
import RestaurantDetailsFssaiFooter from "@food/components/user/restaurant-details/RestaurantDetailsFssaiFooter"
const RESTAURANT_DETAILS_FILTERS_STORAGE_KEY = "food-restaurant-details-filters"

const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }

function RestaurantDetailsContent() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()
  const [searchParams] = useSearchParams()
  const showOnlyUnder250 = searchParams.get('under250') === 'true'
  const targetDishId = useMemo(() => String(searchParams.get('dish') || '').trim(), [searchParams])
  const { addToCart, updateQuantity, removeFromCart, getCartItem, cart } = useCart()
  const { vegMode, addDishFavorite, removeDishFavorite, isDishFavorite, getDishFavorites, getFavorites, addFavorite, removeFavorite, isFavorite, activeAddress } = useProfile()
  
  const userLocation = useMemo(() => {
    if (!activeAddress) return null
    return {
      latitude: activeAddress.location?.coordinates?.[1],
      longitude: activeAddress.location?.coordinates?.[0],
      lat: activeAddress.location?.coordinates?.[1],
      lng: activeAddress.location?.coordinates?.[0],
    }
  }, [activeAddress])

  const deliveryUserPoint = useMemo(() => {
    if (!userLocation) return null
    return {
      lat: userLocation.latitude,
      lng: userLocation.longitude
    }
  }, [userLocation])
  const { zoneId, zone, loading: loadingZone, isOutOfService } = useZone(userLocation)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [quantities, setQuantities] = useState({})
  const [showManageCollections, setShowManageCollections] = useState(false)
  const [showItemDetail, setShowItemDetail] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedItemImageIndex, setSelectedItemImageIndex] = useState(0)
  const [selectedVariantId, setSelectedVariantId] = useState("")
  const [showFilterSheet, setShowFilterSheet] = useState(false)
  const [showLocationSheet, setShowLocationSheet] = useState(false)
  const [showScheduleSheet, setShowScheduleSheet] = useState(false)
  const [showOffersSheet, setShowOffersSheet] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null)
  const [expandedCoupons, setExpandedCoupons] = useState(new Set())
  const [showMenuSheet, setShowMenuSheet] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [availabilityTick, setAvailabilityTick] = useState(Date.now())
  const [showMenuOptionsSheet, setShowMenuOptionsSheet] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [sharePayload, setSharePayload] = useState(null)
  const [expandedAddButtons, setExpandedAddButtons] = useState(new Set())
  const [expandedSections, setExpandedSections] = useState(new Set([0])) // Default: Recommended section is expanded
  const [highlightedDishId, setHighlightedDishId] = useState(null)
  const [loadingMenuItems, setLoadingMenuItems] = useState(true)
  const [selectedMenuCategory, setSelectedMenuCategory] = useState("all")
  const dishCardRefs = useRef({})

  const getLineItemIdForDish = (item, variant = null) =>
    buildCartLineId(item?.itemId || item?._id || item?.id || "", variant?.id || variant?._id || "")

  const getVariantForDish = (item, preferredVariantId = "") => {
    const variants = getFoodVariants(item)
    if (variants.length === 0) return null
    return variants.find((variant) => String(variant.id) === String(preferredVariantId || "")) || variants[0]
  }

  const getDishQuantity = (item, preferredVariantId = "") => {
    const variant = getVariantForDish(item, preferredVariantId)
    const lineItemId = getLineItemIdForDish(item, variant)
    return quantities[lineItemId] || 0
  }

  // Initialize filters from localStorage if available
  const [filters, setFilters] = useState(() => {
    if (typeof window === "undefined" || !slug) {
      return {
        sortBy: null,
        vegNonVeg: null,
        highlyReordered: false,
        spicy: false,
      }
    }
    try {
      const raw = window.localStorage.getItem(RESTAURANT_DETAILS_FILTERS_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        const savedFilters = parsed?.[slug]
        if (savedFilters && typeof savedFilters === "object") {
          return {
            sortBy:
              savedFilters.sortBy === "low-to-high" || savedFilters.sortBy === "high-to-low"
                ? savedFilters.sortBy
                : null,
            vegNonVeg:
              savedFilters.vegNonVeg === "veg" || savedFilters.vegNonVeg === "non-veg"
                ? savedFilters.vegNonVeg
                : null,
            highlyReordered: savedFilters.highlyReordered === true,
            spicy: savedFilters.spicy === true,
          }
        }
      }
    } catch (error) {
      debugWarn("Failed to initialize restaurant filters from localStorage:", error)
    }
    return {
      sortBy: null,
      vegNonVeg: null,
      highlyReordered: false,
      spicy: false,
    }
  })

  // Restaurant data state
  const [restaurant, setRestaurant] = useState(null)
  const [loadingRestaurant, setLoadingRestaurant] = useState(true)
  const [restaurantError, setRestaurantError] = useState(null)
  const fetchedRestaurantRef = useRef(false) // Track if restaurant has been fetched for current slug
  const fetchedSlugRef = useRef(null)

  const hasNonVegItems = useMemo(() => {
    if (!restaurant?.menuSections) return false;
    
    const isPureVegRest = restaurant?.pureVegRestaurant === true || String(restaurant?.pureVegRestaurant).toLowerCase() === "true" || restaurant?.details?.pureVegRestaurant === true || String(restaurant?.details?.pureVegRestaurant).toLowerCase() === "true";
    
    if (isPureVegRest) return false;

    let foundNonVeg = false;
    const checkItem = (item) => {
      const ft = item?.foodType?.toLowerCase()?.trim() || "";
      return item?.isVeg === false || ft === "non-veg" || ft === "nonveg" || ft === "non veg";
    };

    for (const section of restaurant.menuSections) {
      if (Array.isArray(section?.items) && section.items.some(checkItem)) {
        foundNonVeg = true;
        break;
      }
      if (Array.isArray(section?.subsections)) {
        for (const sub of section.subsections) {
          if (Array.isArray(sub?.items) && sub.items.some(checkItem)) {
            foundNonVeg = true;
            break;
          }
        }
      }
      if (foundNonVeg) break;
    }
    return foundNonVeg;
  }, [restaurant?.menuSections]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setAvailabilityTick(Date.now())
    }, 60000)

    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    setSelectedMenuCategory("all")
  }, [slug])

  // Fetch restaurant data from API
  useEffect(() => {
    const fetchRestaurant = async () => {
      if (!slug) return

      // Prevent re-fetching for the same slug. Mobile location/zone updates can
      // trigger transient refetch failures that clear already-rendered content.
      if (fetchedRestaurantRef.current && fetchedSlugRef.current === slug && restaurant) {
        return
      }

      try {
        // Keep the existing page visible on background retries.
        setLoadingRestaurant(!fetchedRestaurantRef.current && !restaurant)
        setRestaurantError(null)

        debugLog('Fetching restaurant with slug:', slug)
        let response = null
        let apiRestaurant = null

        // Restaurant API (works for both ObjectId and slug)
        if (!apiRestaurant) {
          try {
            // First, try to get restaurant directly by slug/ID (no zoneId needed)
            try {
              response = await restaurantAPI.getRestaurantById(slug)
              if (response?.data?.success && response?.data?.data) {
                apiRestaurant = response.data.data
                debugLog('? Found restaurant in restaurant API by slug/ID:', apiRestaurant)
              }
            } catch (directLookupError) {
              // If direct lookup fails, try searching by name.
              // Fallback without zoneId so missing live location never blocks this page.
              debugLog('? Direct lookup failed, trying search by name...')

              const searchVariants = zoneId
                ? [{ limit: 100, zoneId: zoneId, _ts: Date.now() }, { limit: 100, _ts: Date.now() }]
                : [{ limit: 100, _ts: Date.now() }]

              for (const searchParams of searchVariants) {
                try {
                  // Use client TTL cache (60s) — rare fallback path; avoid noCache stampede
                  const searchResponse = await restaurantAPI.getRestaurants(searchParams)
                  const restaurants = searchResponse?.data?.data?.restaurants || searchResponse?.data?.data || []

                  // Try to find by slug match or name match
                  const restaurantName = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                  const matchingRestaurant = restaurants.find(r =>
                    r.slug === slug ||
                    r.name?.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase() ||
                    r.name?.toLowerCase() === restaurantName.toLowerCase()
                  )

                  if (matchingRestaurant) {
                    // Get full restaurant details by ID
                    const fullResponse = await restaurantAPI.getRestaurantById(matchingRestaurant._id || matchingRestaurant.restaurantId)
                    if (fullResponse.data && fullResponse.data.success && fullResponse.data.data) {
                      apiRestaurant = fullResponse.data.data
                      debugLog('? Found restaurant in restaurant API by name search:', apiRestaurant)
                      break
                    }
                  }
                } catch (searchError) {
                  debugWarn('? Search fallback failed for params:', searchParams, searchError?.message)
                }
              }
            }
          } catch (restaurantError) {
            debugError('? Restaurant not found in restaurant API either:', restaurantError)
          }
        }

        if (apiRestaurant) {
          debugLog('? Fetched restaurant from API:', apiRestaurant)
          debugLog('? Restaurant data keys:', Object.keys(apiRestaurant))
          debugLog('? Restaurant name field:', apiRestaurant?.name)
          debugLog('? Restaurant restaurantId:', apiRestaurant?.restaurantId)
          debugLog('? Restaurant _id:', apiRestaurant?._id)
          debugLog('? Restaurant.restaurant:', apiRestaurant?.restaurant)

          // Check if this is a dining restaurant with nested restaurant data
          const actualRestaurant = apiRestaurant?.restaurant || apiRestaurant

          // Helper function to format address with zone and pin code
          const formatRestaurantAddress = (locationObj) => {
            if (!locationObj) return "Location"

            // If location is a string, return it as is
            if (typeof locationObj === 'string') {
              return locationObj
            }

            // PRIORITY 1: Use formattedAddress if it's complete and has pin code
            // formattedAddress usually has the most complete information from Google Maps
            if (locationObj.formattedAddress && locationObj.formattedAddress.trim() !== "" && locationObj.formattedAddress !== "Select location") {
              const isCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(locationObj.formattedAddress.trim())
              if (!isCoordinates) {
                const formattedAddr = locationObj.formattedAddress.trim()
                // Check if it contains a pin code (6 digit number)
                const hasPinCode = /\b\d{6}\b/.test(formattedAddr)
                // If it has pin code, it's complete - use it directly
                if (hasPinCode) {
                  // Clean up the address - remove Google Plus Code if present (e.g., "PV6X+JXX, ")
                  const cleanedAddr = formattedAddr.replace(/^[A-Z0-9]+\+[A-Z0-9]+,\s*/i, '')
                  return cleanedAddr
                }
                // If it has multiple parts (3+), it's likely complete
                if (formattedAddr.split(',').length >= 3) {
                  const cleanedAddr = formattedAddr.replace(/^[A-Z0-9]+\+[A-Z0-9]+,\s*/i, '')
                  return cleanedAddr
                }
              }
            }

            // PRIORITY 2: Build address from location object components (with zone and pin code)
            // This ensures we always show zone and pin code if available
            const addressParts = []

            // Add addressLine1 if available
            if (locationObj.addressLine1 && locationObj.addressLine1.trim() !== "") {
              addressParts.push(locationObj.addressLine1.trim())
            }

            // Add addressLine2 if available
            if (locationObj.addressLine2 && locationObj.addressLine2.trim() !== "") {
              addressParts.push(locationObj.addressLine2.trim())
            }

            // Add area (zone) if available
            if (locationObj.area && locationObj.area.trim() !== "") {
              addressParts.push(locationObj.area.trim())
            }

            // Add city if available
            if (locationObj.city && locationObj.city.trim() !== "") {
              addressParts.push(locationObj.city.trim())
            }

            // Add state if available
            if (locationObj.state && locationObj.state.trim() !== "") {
              addressParts.push(locationObj.state.trim())
            }

            // Add pin code (priority: pincode > zipCode > postalCode)
            const pinCode = locationObj.pincode || locationObj.zipCode || locationObj.postalCode
            if (pinCode && pinCode.toString().trim() !== "") {
              addressParts.push(pinCode.toString().trim())
            }

            // If we have at least 3 parts (complete address), use it
            if (addressParts.length >= 3) {
              return addressParts.join(', ')
            }

            // If we have at least 2 parts, use it
            if (addressParts.length >= 2) {
              return addressParts.join(', ')
            }

            // PRIORITY 3: Fallback to formattedAddress (even if incomplete)
            if (locationObj.formattedAddress && locationObj.formattedAddress.trim() !== "" && locationObj.formattedAddress !== "Select location") {
              const isCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(locationObj.formattedAddress.trim())
              if (!isCoordinates) {
                const cleanedAddr = locationObj.formattedAddress.trim().replace(/^[A-Z0-9]+\+[A-Z0-9]+,\s*/i, '')
                return cleanedAddr
              }
            }

            // PRIORITY 4: Fallback to address field
            if (locationObj.address && locationObj.address.trim() !== "") {
              return locationObj.address.trim()
            }

            // PRIORITY 5: Last fallback - use area or city
            return locationObj.area || locationObj.city || "Location"
          }

          // Get location object for address formatting
          const locationObj = actualRestaurant?.location || apiRestaurant?.location
          debugLog('? Location Object for formatting:', locationObj)
          debugLog('? formattedAddress field:', locationObj?.formattedAddress)
          const formattedAddress = formatRestaurantAddress(locationObj)
          debugLog('? Final Formatted Address:', formattedAddress)

          // Calculate road distance from user to restaurant
          const formatRoadDistance = (distanceInKm) => {
            if (!Number.isFinite(distanceInKm)) return null
            if (distanceInKm >= 1) return `${distanceInKm.toFixed(1)} km`
            return `${Math.round(distanceInKm * 1000)} m`
          }

          // Get restaurant coordinates (same parse + normalize as Cart checkout fee)
          const restaurantPoint = parseGeoPoint(
            normalizeRestaurantLocation(locationObj) || locationObj,
          )
          const restaurantLat = restaurantPoint?.lat
          const restaurantLng = restaurantPoint?.lng

          debugLog('? Restaurant coordinates:', { restaurantLat, restaurantLng, locationObj })

          // Delivery address origin (saved vs current) — matches Home + Cart
          const userLat = deliveryUserPoint?.lat ?? userLocation?.latitude
          const userLng = deliveryUserPoint?.lng ?? userLocation?.longitude

          debugLog('? User location:', { userLat, userLng, userLocation, deliveryUserPoint })

          // Calculate distance if both coordinates are available
          // Direction matches checkout fee: restaurant → user
          let calculatedDistance = null
          if (userLat && userLng && restaurantLat && restaurantLng &&
            !isNaN(userLat) && !isNaN(userLng) && !isNaN(restaurantLat) && !isNaN(restaurantLng)) {
            const distanceInKm = await getRoadDistanceKm(restaurantLat, restaurantLng, userLat, userLng)
            calculatedDistance = formatRoadDistance(distanceInKm)
            debugLog('? Calculated distance from restaurant to user:', calculatedDistance, 'km:', distanceInKm)
          } else {
            debugWarn('? Cannot calculate distance - missing coordinates:', {
              hasUserLocation: !!(userLat && userLng),
              hasRestaurantLocation: !!(restaurantLat && restaurantLng),
              userLat,
              userLng,
              restaurantLat,
              restaurantLng
            })
          }

          // Resolve display category/cuisine with broad API compatibility
          const categoryFromArray = (list) => {
            if (!Array.isArray(list) || list.length === 0) return null
            const firstEntry = list[0]
            if (typeof firstEntry === "string") return firstEntry
            if (firstEntry && typeof firstEntry === "object") {
              return firstEntry.name || firstEntry.label || firstEntry.title || null
            }
            return null
          }

          const resolvedTopCategory =
            actualRestaurant?.topCategory ||
            apiRestaurant?.topCategory ||
            categoryFromArray(actualRestaurant?.topCategories) ||
            categoryFromArray(apiRestaurant?.topCategories) ||
            categoryFromArray(actualRestaurant?.cuisines) ||
            categoryFromArray(apiRestaurant?.cuisines) ||
            categoryFromArray(actualRestaurant?.categories) ||
            categoryFromArray(apiRestaurant?.categories) ||
            actualRestaurant?.cuisine ||
            apiRestaurant?.cuisine ||
            actualRestaurant?.category ||
            apiRestaurant?.category ||
            "Multi-cuisine"

          const onboardingStep2 = actualRestaurant?.onboarding?.step2 || apiRestaurant?.onboarding?.step2 || {}
          const onboardingStep4 = actualRestaurant?.onboarding?.step4 || apiRestaurant?.onboarding?.step4 || {}
          const normalizedProfileImage = actualRestaurant?.profileImage || apiRestaurant?.profileImage || onboardingStep2?.profileImageUrl || null
          const normalizedCoverImages =
            Array.isArray(actualRestaurant?.coverImages) && actualRestaurant.coverImages.length > 0
              ? actualRestaurant.coverImages
              : Array.isArray(apiRestaurant?.coverImages) && apiRestaurant.coverImages.length > 0
                ? apiRestaurant.coverImages
                : []
          const normalizedMenuImages =
            Array.isArray(actualRestaurant?.menuImages) && actualRestaurant.menuImages.length > 0
              ? actualRestaurant.menuImages
              : Array.isArray(apiRestaurant?.menuImages) && apiRestaurant.menuImages.length > 0
                ? apiRestaurant.menuImages
                : Array.isArray(onboardingStep2?.menuImageUrls)
                  ? onboardingStep2.menuImageUrls
                  : []
          const normalizedRestaurantOffers = actualRestaurant?.restaurantOffers || apiRestaurant?.restaurantOffers || {}

          // Transform API data to match expected format with comprehensive fallbacks
          // Handle both dining restaurant and regular restaurant data structures
          const transformedRestaurant = {
            id: actualRestaurant?.restaurantId || actualRestaurant?._id || actualRestaurant?.id || apiRestaurant?.restaurantId || apiRestaurant?._id || null,
            mongoId: actualRestaurant?._id || apiRestaurant?._id || null,
            name:
              actualRestaurant?.name ||
              actualRestaurant?.restaurantName ||
              apiRestaurant?.name ||
              apiRestaurant?.restaurantName ||
              "Unknown Restaurant",
            cuisine: resolvedTopCategory,
            topCategory: resolvedTopCategory,
            rating: actualRestaurant?.rating ?? apiRestaurant?.rating ?? actualRestaurant?.averageRating ?? apiRestaurant?.averageRating ?? 0,
            reviews: actualRestaurant?.totalRatings ?? apiRestaurant?.totalRatings ?? actualRestaurant?.reviewCount ?? apiRestaurant?.reviewCount ?? actualRestaurant?.reviews?.length ?? apiRestaurant?.reviews?.length ?? 0,
            deliveryTime: actualRestaurant?.estimatedDeliveryTime || apiRestaurant?.estimatedDeliveryTime || actualRestaurant?.deliveryTime || apiRestaurant?.deliveryTime || actualRestaurant?.avgDeliveryTime || apiRestaurant?.avgDeliveryTime || "25-30 mins",
            distance: calculatedDistance || actualRestaurant?.distance || apiRestaurant?.distance || actualRestaurant?.distanceFromUser || apiRestaurant?.distanceFromUser || "1.2 km",
            location: formattedAddress,
            locationObject: locationObj, // Store full location object for reference
            pureVegRestaurant: actualRestaurant?.pureVegRestaurant ?? apiRestaurant?.pureVegRestaurant ?? false,
            image: normalizedCoverImages?.[0]?.url
              || normalizedCoverImages?.[0]
              || normalizedProfileImage?.url
              || normalizedProfileImage
              || (normalizedMenuImages.length > 0
                ? (normalizedMenuImages[0]?.url || normalizedMenuImages[0])
                : null)
              || actualRestaurant?.image
              || apiRestaurant?.image
              || null,
            priceRange: actualRestaurant?.priceRange || apiRestaurant?.priceRange || onboardingStep4?.priceRange || "$$",
            offers: Array.isArray(actualRestaurant?.offers) ? actualRestaurant.offers : (Array.isArray(apiRestaurant?.offers) ? apiRestaurant.offers : []), // Will be populated from menu/offers API later
            offerText: actualRestaurant?.offer || apiRestaurant?.offer || onboardingStep4?.offer || "FLAT 50% OFF",
            offerCount: actualRestaurant?.offerCount || apiRestaurant?.offerCount || 0,
            restaurantOffers: {
              goldOffer: {
                title: normalizedRestaurantOffers?.goldOffer?.title || "Gold exclusive offer",
                description: apiRestaurant?.restaurantOffers?.goldOffer?.description || "Free delivery above â‚¹99",
                unlockText: normalizedRestaurantOffers?.goldOffer?.unlockText || "join Gold to unlock",
                buttonText: apiRestaurant?.restaurantOffers?.goldOffer?.buttonText || "Add Gold - â‚¹1",
              },
              coupons: Array.isArray(normalizedRestaurantOffers?.coupons)
                ? normalizedRestaurantOffers.coupons
                : [],
            },
            outlets: Array.isArray(actualRestaurant?.outlets) ? actualRestaurant.outlets : (Array.isArray(apiRestaurant?.outlets) ? apiRestaurant.outlets : []),
            categories: Array.isArray(actualRestaurant?.categories) ? actualRestaurant.categories : (Array.isArray(apiRestaurant?.categories) ? apiRestaurant.categories : []),
            menu: Array.isArray(actualRestaurant?.menu) ? actualRestaurant.menu : (Array.isArray(apiRestaurant?.menu) ? apiRestaurant.menu : []),
            slug: actualRestaurant?.slug || apiRestaurant?.slug || actualRestaurant?.name?.toLowerCase().replace(/\s+/g, '-') || apiRestaurant?.name?.toLowerCase().replace(/\s+/g, '-') || slug || "unknown",
            restaurantId: actualRestaurant?.restaurantId || actualRestaurant?._id || actualRestaurant?.id || apiRestaurant?.restaurantId || apiRestaurant?._id || apiRestaurant?.id || null,
            // Add other fields with defaults
            featuredDish: actualRestaurant?.featuredDish || apiRestaurant?.featuredDish || onboardingStep4?.featuredDish || "Special Dish",
            featuredPrice: actualRestaurant?.featuredPrice || apiRestaurant?.featuredPrice || onboardingStep4?.featuredPrice || 249,
            // Additional safety fields
            openDays: Array.isArray(actualRestaurant?.openDays)
              ? actualRestaurant.openDays
              : (Array.isArray(apiRestaurant?.openDays) ? apiRestaurant.openDays : (Array.isArray(onboardingStep2?.openDays) ? onboardingStep2.openDays : [])),
            deliveryTimings: actualRestaurant?.deliveryTimings || apiRestaurant?.deliveryTimings || {
              openingTime: actualRestaurant?.openingTime || apiRestaurant?.openingTime || onboardingStep2?.deliveryTimings?.openingTime || "09:00",
              closingTime: actualRestaurant?.closingTime || apiRestaurant?.closingTime || onboardingStep2?.deliveryTimings?.closingTime || "22:00",
            },
            outletTimings: actualRestaurant?.outletTimings || apiRestaurant?.outletTimings || null,
            cuisines: Array.isArray(actualRestaurant?.cuisines) ? actualRestaurant.cuisines : (Array.isArray(apiRestaurant?.cuisines) ? apiRestaurant.cuisines : (Array.isArray(onboardingStep2?.cuisines) ? onboardingStep2.cuisines : [])),
            profileImage: normalizedProfileImage,
            coverImages: normalizedCoverImages,
            menuImages: normalizedMenuImages,
            // Menu sections for display (will be populated from menu API)
            menuSections: [],
            // Onboarding data including FSSAI license
            onboarding: actualRestaurant?.onboarding || apiRestaurant?.onboarding || null,
            // Availability fields for grayscale styling
            isActive: actualRestaurant?.isActive !== false, // Default to true if not specified
            isAcceptingOrders: actualRestaurant?.isAcceptingOrders !== false, // Default to true if not specified
          }

          debugLog('? Transformed restaurant:', transformedRestaurant)
          debugLog('? Restaurant ID for menu fetch:', transformedRestaurant.id)

          if (!transformedRestaurant.id) {
            debugError('? No restaurant ID found! Cannot fetch menu.')
          }

          setRestaurant(transformedRestaurant)
          fetchedRestaurantRef.current = true // Mark as fetched
          fetchedSlugRef.current = slug

          // Resolve menu restaurant id (search by name only if id missing)
          let restaurantIdForMenu = transformedRestaurant.id

          if (!restaurantIdForMenu) {
            debugWarn('? No restaurant ID available, searching for restaurant by name...')
            try {
              const searchVariants = zoneId
                ? [{ limit: 100, zoneId: zoneId }, { limit: 100 }]
                : [{ limit: 100 }]

              for (const searchParams of searchVariants) {
                const searchResponse = await restaurantAPI.getRestaurants(searchParams)
                const restaurants = searchResponse?.data?.data?.restaurants || searchResponse?.data?.data || []

                const matchingRestaurant = restaurants.find(r =>
                  r.name?.toLowerCase().trim() === transformedRestaurant.name?.toLowerCase().trim()
                )

                if (matchingRestaurant) {
                  restaurantIdForMenu = matchingRestaurant._id || matchingRestaurant.restaurantId || matchingRestaurant.id
                  debugLog('? Found matching restaurant by name, ID:', restaurantIdForMenu)
                  setRestaurant(prev => ({
                    ...prev,
                    id: restaurantIdForMenu,
                    restaurantId: restaurantIdForMenu
                  }))
                  break
                }
              }
            } catch (searchError) {
              debugError('? Error searching for restaurant:', searchError)
            }
          }

          const normalizedLookupIds = [
            restaurantIdForMenu,
            slug,
            transformedRestaurant.id,
            transformedRestaurant.restaurantId,
            transformedRestaurant.mongoId,
            apiRestaurant?.restaurantId,
            apiRestaurant?._id,
            actualRestaurant?.restaurantId,
            actualRestaurant?._id,
            actualRestaurant?.slug,
          ]
            .filter(Boolean)
            .map((value) => String(value).trim())
            .filter((value, index, arr) => arr.indexOf(value) === index)

          const outletRestaurantId =
            transformedRestaurant.mongoId || actualRestaurant?._id || apiRestaurant?._id

          // Parallel: outlet timings + menu (was sequential). Use API TTL cache (no noCache).
          // Previous-order history fan-out removed — result was never used (dead code).
          // Inventory fetch removed — restaurantAPI.getInventoryByRestaurantId is not defined.
          setLoadingMenuItems(true)
          try {
            const timingsPromise = outletRestaurantId
              ? restaurantAPI
                  .getOutletTimingsByRestaurantId(outletRestaurantId)
                  .then((outletResponse) => {
                    const outletTimingsData =
                      outletResponse?.data?.data?.outletTimings ||
                      outletResponse?.data?.outletTimings
                    if (outletTimingsData) {
                      setRestaurant((prev) => ({ ...prev, outletTimings: outletTimingsData }))
                    }
                  })
                  .catch((outletError) => {
                    debugWarn(
                      "Outlet timings fetch failed, falling back to delivery timings:",
                      outletError?.message,
                    )
                  })
              : Promise.resolve()

            const menuPromise = (async () => {
              if (normalizedLookupIds.length === 0) return

              debugLog('? Fetching menu for restaurant ID:', restaurantIdForMenu)
              let menuResponse = null
              let resolvedMenuLookupId = null
              for (const lookupId of normalizedLookupIds) {
                try {
                  debugLog('? Fetching menu for restaurant lookup ID:', lookupId)
                  const response = await restaurantAPI.getMenuByRestaurantId(lookupId)
                  if (response?.data?.success) {
                    menuResponse = response
                    resolvedMenuLookupId = lookupId
                    break
                  }
                } catch (lookupError) {
                  if (lookupError?.response?.status !== 404) {
                    throw lookupError
                  }
                }
              }
              if (!menuResponse) {
                throw Object.assign(new Error('Menu not found'), { response: { status: 404 } })
              }
              debugLog('? Menu resolved using lookup ID:', resolvedMenuLookupId)
              if (menuResponse.data && menuResponse.data.success && menuResponse.data.data && menuResponse.data.data.menu) {
                const rawSections = menuResponse.data.data.menu.sections || []
                let recommendedMap = {}
                try {
                  recommendedMap = JSON.parse(localStorage.getItem("restaurant_inventory_recommended_map")) || {}
                } catch (e) {}

                const toArray = (value) => {
                  if (Array.isArray(value)) return value
                  if (!value || typeof value !== "object") return []
                  return Object.values(value).filter((entry) => entry && typeof entry === "object")
                }
                const normalizeItem = (item = {}) => {
                  const itemIdStr = String(item.id || item._id || "")
                  let isRecommended = item.isRecommended === true || item.isRecommended === 1 || String(item.isRecommended) === "true"
                  
                  if (recommendedMap[itemIdStr] === true) {
                    isRecommended = true
                  }

                  const isSpicy = item.isSpicy === true || item.isSpicy === 1 || String(item.isSpicy) === "true"
                  let foodType = item.foodType || "Non-Veg"
                  if (typeof foodType === 'string') {
                    if (foodType.toLowerCase() === 'veg') foodType = 'Veg'
                    else if (foodType.toLowerCase() === 'non-veg' || foodType.toLowerCase() === 'nonveg') foodType = 'Non-Veg'
                  }
                  return {
                    ...item,
                    id: String(item.id || item._id || `${Date.now()}-${Math.random()}`),
                    name: item.name || "Unnamed Item",
                    foodType,
                    price: getFoodDisplayPrice(item),
                    otherPrice: item.otherPrice || 0,
                    variants: getFoodVariants(item),
                    variations: getFoodVariants(item),
                    isAvailable: item.isAvailable !== false,
                    isRecommended,
                    isSpicy,
                    description: typeof item.description === "string" ? item.description : "",
                  }
                }
                const menuSections = toArray(rawSections).map((section, sectionIndex) => ({
                  ...section,
                  id: String(section.id || section._id || `section-${sectionIndex}`),
                  name: section.name || section.title || "Unnamed Section",
                  items: toArray(section.items).map(normalizeItem),
                  subsections: toArray(section.subsections).map((subsection, subsectionIndex) => ({
                    ...subsection,
                    id: String(subsection.id || subsection._id || `subsection-${sectionIndex}-${subsectionIndex}`),
                    name: subsection.name || "Unnamed Subsection",
                    items: toArray(subsection.items).map(normalizeItem),
                  })),
                }))

                const recommendedItems = []
                menuSections.forEach(section => {
                  if (section.items && Array.isArray(section.items)) {
                    section.items.forEach(item => {
                      if (isRecommendedItem(item) && item.isAvailable !== false) {
                        recommendedItems.push(item)
                      }
                    })
                  }
                  if (section.subsections && Array.isArray(section.subsections)) {
                    section.subsections.forEach(subsection => {
                      if (subsection.items && Array.isArray(subsection.items)) {
                        subsection.items.forEach(item => {
                          if (isRecommendedItem(item) && item.isAvailable !== false) {
                            recommendedItems.push(item)
                          }
                        })
                      }
                    })
                  }
                })

                let searchedDishSection = null
                if (targetDishId) {
                  const allItemsInMenu = []
                  menuSections.forEach(s => {
                    if (s.items) allItemsInMenu.push(...s.items)
                    if (s.subsections) {
                      s.subsections.forEach(ss => {
                        if (ss.items) allItemsInMenu.push(...ss.items)
                      })
                    }
                  })
                  const matchedItem = allItemsInMenu.find(item => String(item.id || item._id || "").trim() === targetDishId)
                  if (matchedItem) {
                    searchedDishSection = {
                      name: "Result for your search",
                      items: [matchedItem],
                      subsections: [],
                      isSearchResult: true
                    }
                  }
                }

                let finalMenuSections = [...menuSections]
                if (recommendedItems.length > 0) {
                  finalMenuSections = [{ name: "Recommended for you", items: recommendedItems, subsections: [] }, ...finalMenuSections]
                }
                if (searchedDishSection) {
                  finalMenuSections = [searchedDishSection, ...finalMenuSections]
                }

                setRestaurant(prev => ({
                  ...prev,
                  menuSections: finalMenuSections,
                }))

                const defaultExpandedSections = new Set(
                  Array.from({ length: Math.min(3, finalMenuSections.length) }, (_, idx) => idx)
                )
                setExpandedSections(defaultExpandedSections)

                debugLog('Fetched menu sections with recommended items:', finalMenuSections)
              }
            })().catch((menuError) => {
              if (menuError.response && menuError.response.status === 404) {
                debugLog('? Menu not found for this restaurant (might be a dining-only listing).')
              } else {
                debugError('? Error fetching menu:', menuError)
              }
            })

            await Promise.all([timingsPromise, menuPromise])
          } finally {
            setLoadingMenuItems(false)
          }
        } else {
          debugError('? No restaurant data found in API response')
          debugError('? Response:', response)
          debugError('? apiRestaurant:', apiRestaurant)
          if (!fetchedRestaurantRef.current) {
            setRestaurantError('Restaurant not found')
            setRestaurant(null)
          }
        }
      } catch (error) {
        // Check if it's a network error (backend not running)
        const isNetworkError = error.code === 'ERR_NETWORK' || error.message === 'Network Error'

        // Check if it's a 404 error (restaurant doesn't exist)
        const is404Error = error.response?.status === 404

        if (isNetworkError) {
          // Network error - backend is not running
          // Don't show "Restaurant not found" for network errors
          // The axios interceptor will show a toast notification
          debugError('Network error fetching restaurant (backend may not be running):', error)
          if (!fetchedRestaurantRef.current) {
            setRestaurantError('Backend server is not connected. Please make sure the backend is running.')
            setRestaurant(null)
          }
        } else if (is404Error) {
          // 404 error - restaurant doesn't exist in database
          debugLog(`Restaurant "${slug}" not found in database`)
          if (!fetchedRestaurantRef.current) {
            setRestaurantError('Restaurant not found')
            setRestaurant(null)
          }
        } else {
          // Other errors
          debugError('Error fetching restaurant:', error)
          if (!fetchedRestaurantRef.current) {
            setRestaurantError(error.message || 'Failed to load restaurant')
            setRestaurant(null)
          }
        }
      } finally {
        setLoadingRestaurant(false)
        setLoadingMenuItems(false)
      }
    }

    // Reset fetched flag only when URL slug changes.
    // Do not compare with restaurant.slug because canonical API slug may differ
    // from route slug (e.g. "restaurant-2513"), causing refetch loops.
    if (fetchedRestaurantRef.current && fetchedSlugRef.current !== slug) {
      fetchedRestaurantRef.current = false
      fetchedSlugRef.current = null
    }

    fetchRestaurant()
    // Intentionally omit `restaurant` from deps — including it re-ran this effect after
    // setRestaurant and caused redundant work. Guard uses fetchedSlugRef instead.
    // Distance updates when location changes are handled by the dedicated effect below.
  }, [slug, zoneId, deliveryUserPoint?.lat, deliveryUserPoint?.lng])

  // Track previous values to prevent unnecessary recalculations
  const prevCoordsRef = useRef({ userLat: null, userLng: null, restaurantLat: null, restaurantLng: null })
  const prevDistanceRef = useRef(null)

  // Extract restaurant coordinates as stable values (same as Cart checkout)
  const restaurantPoint = useMemo(
    () => parseGeoPoint(
      normalizeRestaurantLocation(restaurant?.locationObject || restaurant?.location)
      || restaurant?.locationObject
      || restaurant?.location,
    ),
    [restaurant?.locationObject, restaurant?.location],
  )
  const restaurantLat = restaurantPoint?.lat ?? null
  const restaurantLng = restaurantPoint?.lng ?? null

  // Recalculate distance when delivery origin or restaurant pin updates
  useEffect(() => {
    if (!restaurant || !deliveryUserPoint?.lat || !deliveryUserPoint?.lng) return
    if (!restaurantLat || !restaurantLng) return

    const userLat = deliveryUserPoint.lat
    const userLng = deliveryUserPoint.lng

    // Check if coordinates have actually changed (with small threshold to avoid floating point issues)
    const coordsChanged =
      Math.abs((prevCoordsRef.current.userLat || 0) - userLat) > 0.0001 ||
      Math.abs((prevCoordsRef.current.userLng || 0) - userLng) > 0.0001 ||
      Math.abs((prevCoordsRef.current.restaurantLat || 0) - restaurantLat) > 0.0001 ||
      Math.abs((prevCoordsRef.current.restaurantLng || 0) - restaurantLng) > 0.0001

    // Skip recalculation if coordinates haven't changed
    if (!coordsChanged && prevDistanceRef.current !== null) {
      return
    }

    // Update refs with current coordinates
    prevCoordsRef.current = { userLat, userLng, restaurantLat, restaurantLng }

    let cancelled = false

    const recalculateDistance = async () => {
      // Same direction as checkout fee: restaurant → user
      const distanceInKm = await getRoadDistanceKm(restaurantLat, restaurantLng, userLat, userLng)
      if (cancelled || !Number.isFinite(distanceInKm)) return

      const calculatedDistance = distanceInKm >= 1
        ? `${distanceInKm.toFixed(1)} km`
        : `${Math.round(distanceInKm * 1000)} m`

      if (calculatedDistance !== prevDistanceRef.current) {
        debugLog('? Recalculated distance restaurant → user:', calculatedDistance, 'km:', distanceInKm)
        prevDistanceRef.current = calculatedDistance

        setRestaurant((prev) => {
          if (prev?.distance === calculatedDistance) return prev
          return {
            ...prev,
            distance: calculatedDistance,
          }
        })
      }
    }

    void recalculateDistance()
    return () => { cancelled = true }
  }, [deliveryUserPoint?.lat, deliveryUserPoint?.lng, restaurantLat, restaurantLng, restaurant])

  // Sync quantities from cart on mount and when restaurant changes
  useEffect(() => {
    if (!restaurant || !restaurant.name) return

    const cartQuantities = {}
    cart.forEach((item) => {
      if (item.restaurant === restaurant.name) {
        cartQuantities[item.id] = item.quantity || 0
      }
    })
    setQuantities(cartQuantities)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.name, cart])

  useEffect(() => {
    if (!selectedItem) {
      setSelectedVariantId("")
      return
    }
    const defaultVariant = getDefaultFoodVariant(selectedItem)
    setSelectedVariantId(defaultVariant?.id || "")
  }, [selectedItem])

  // Helper function to update item quantity in both local state and cart
  const updateItemQuantity = (item, newQuantity, event = null, preferredVariant = null) => {
    // Check authentication
    if (!isModuleAuthenticated('user')) {
      toast.error("Please login to add items to cart")
      navigate('/user/auth/login', { state: { from: location.pathname } })
      return
    }

    // CRITICAL: Check if user is in service zone or restaurant is available
    if (isOutOfService) {
      toast.error('You are outside the service zone. Please select a location within the service area.');
      return;
    }

    const availability = getRestaurantAvailabilityStatus(restaurant)
    if (!availability.isOpen) {
      toast.error("Restaurant is currently offline. Please try again later.")
      return
    }

    const resolvedVariant = preferredVariant || getDefaultFoodVariant(item)
    const lineItemId = getLineItemIdForDish(item, resolvedVariant)

    // Update local state
    setQuantities((prev) => ({
      ...prev,
      [lineItemId]: newQuantity,
    }))

    // CRITICAL: Validate restaurant data before adding to cart
    if (!restaurant || !restaurant.name) {
      debugError('? Cannot add item to cart: Restaurant data is missing!');
      toast.error('Restaurant information is missing. Please refresh the page.');
      return;
    }

    // Ensure we have a valid restaurantId
    const validRestaurantId = restaurant?.restaurantId || restaurant?._id || restaurant?.id;
    if (!validRestaurantId) {
      debugError('? Cannot add item to cart: Restaurant ID is missing!', {
        restaurant: restaurant,
        restaurantId: restaurant?.restaurantId,
        _id: restaurant?._id,
        id: restaurant?.id
      });
      toast.error('Restaurant ID is missing. Please refresh the page.');
      return;
    }

    // Log for debugging
    debugLog('? Adding item to cart:', {
      itemName: item.name,
      restaurantName: restaurant.name,
      restaurantId: validRestaurantId,
      restaurant_id: restaurant._id,
      restaurant_restaurantId: restaurant.restaurantId
    });

    // Prepare cart item with all required properties
    const cartItem = {
      ...item,
      id: lineItemId,
      lineItemId,
      itemId: item.id,
      name: item.name,
      price: resolvedVariant?.price ?? item.price,
      otherPrice: resolvedVariant?.otherPrice ?? item.otherPrice ?? item.originalPrice ?? 0,
      variantId: resolvedVariant?.id || "",
      variantName: resolvedVariant?.name || "",
      variantPrice: resolvedVariant?.price ?? item.price,
      image: item.image,
      restaurant: restaurant.name, // Use restaurant.name directly (already validated)
      restaurantId: validRestaurantId, // Use validated restaurantId
      description: item.description,
      originalPrice: item.originalPrice,
      isVeg: item.isVeg !== false, // Add isVeg property
      preparationTime: item.preparationTime // Add preparationTime property
    }

    // Get source position for animation from event target
    // Prefer currentTarget (the button) over target (might be icon inside button)
    let sourcePosition = null
    if (event) {
      // Use currentTarget (the button element) for accurate button position
      // If currentTarget is not available, try to find the button element
      let buttonElement = event.currentTarget
      if (!buttonElement && event.target) {
        // If we clicked on an icon inside, find the closest button
        buttonElement = event.target.closest('button') || event.target
      }

      if (buttonElement) {
        // Store button reference and current viewport position
        // We'll recalculate position right before animation to account for scroll
        const rect = buttonElement.getBoundingClientRect()
        const scrollX = window.pageXOffset || window.scrollX || 0
        const scrollY = window.pageYOffset || window.scrollY || 0

        // Store both viewport position and scroll at capture time
        // This allows us to adjust for scroll changes later
        sourcePosition = {
          // Viewport-relative position at capture time
          viewportX: rect.left + rect.width / 2,
          viewportY: rect.top + rect.height / 2,
          // Scroll position at capture time
          scrollX: scrollX,
          scrollY: scrollY,
          // Store button identifier to potentially find it again
          itemId: lineItemId,
        }
      }
    }

    // Update cart context
    if (newQuantity <= 0) {
      // Pass sourcePosition and product info for removal animation
      const productInfo = {
        id: lineItemId,
        name: item.name,
        imageUrl: item.image,
      }
      removeFromCart(lineItemId, sourcePosition, productInfo)
    } else {
      const existingCartItem = getCartItem(lineItemId)
      if (existingCartItem) {
        // Prepare product info for animation
        const productInfo = {
          id: lineItemId,
          name: item.name,
          imageUrl: item.image,
        }

        // If incrementing quantity, trigger add animation with sourcePosition
        if (newQuantity > existingCartItem.quantity && sourcePosition) {
          const result = addToCart(cartItem, sourcePosition)
          if (result?.ok === false) {
            toast.error(result.error || 'Cannot add item from different restaurant. Please clear cart first.')
            return
          }
          if (newQuantity > existingCartItem.quantity + 1) {
            updateQuantity(lineItemId, newQuantity)
          }
        }
        // If decreasing quantity, trigger removal animation with sourcePosition
        else if (newQuantity < existingCartItem.quantity && sourcePosition) {
          updateQuantity(lineItemId, newQuantity, sourcePosition, productInfo)
        }
        // Otherwise just update quantity without animation
        else {
          updateQuantity(lineItemId, newQuantity)
        }
      } else {
        // Add to cart first (adds with quantity 1), then update to desired quantity
        // Pass sourcePosition when adding a new item
        const result = addToCart(cartItem, sourcePosition)
        if (result?.ok === false) {
          toast.error(result.error || 'Cannot add item from different restaurant. Please clear cart first.')
          return
        }
        if (newQuantity > 1) {
          updateQuantity(lineItemId, newQuantity)
        }
      }
    }
  }

  const handleDishIncrease = (item, quantity, event) => {
    if (shouldShowGrayscale) return
    if (hasFoodVariants(item)) {
      setSelectedItem(item)
      setSelectedItemImageIndex(0)
      setShowItemDetail(true)
      return
    }
    updateItemQuantity(item, quantity > 0 ? quantity + 1 : 1, event)
  }

  const isRecommendedSection = (section) => {
    const sectionName = section?.name || section?.title || ""
    if (typeof sectionName !== "string") return false
    const name = sectionName.trim().toLowerCase()
    return name === "recommended for you" || name === "result for your search"
  }

  const isRecommendedItem = (item) => {
    return (
      item.isRecommended === true ||
      item.isRecommended === 1 ||
      String(item.isRecommended).toLowerCase() === "true"
    )
  }

  const getSectionDisplayName = (section) => {
    if (isRecommendedSection(section)) {
      return "Recommended for you"
    }
    if (section?.name && typeof section.name === "string" && section.name.trim()) {
      return section.name.trim()
    }
    if (section?.title && typeof section.title === "string" && section.title.trim()) {
      return section.title.trim()
    }
    return "Unnamed Section"
  }

  const normalizeMenuCategoryId = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

  const toRenderableArray = (value) => {
    if (Array.isArray(value)) return value
    if (!value || typeof value !== "object") return []
    return Object.values(value).filter((entry) => entry && typeof entry === "object")
  }

  const getSectionCategoryImage = (section) => {
    const directImage = typeof section?.image === "string" ? section.image.trim() : ""
    if (directImage) return directImage

    const firstSectionItemImage = toRenderableArray(section?.items).find(
      (item) => typeof item?.image === "string" && item.image.trim(),
    )?.image
    if (firstSectionItemImage) return firstSectionItemImage

    const firstSubsectionImage = toRenderableArray(section?.subsections)
      .flatMap((subsection) => toRenderableArray(subsection?.items))
      .find((item) => typeof item?.image === "string" && item.image.trim())?.image

    return firstSubsectionImage || ""
  }

  // Menu categories - dynamically generated from restaurant menu sections
  const menuCategories = useMemo(() => {
    if (!restaurant?.menuSections || !Array.isArray(restaurant.menuSections)) return []

    const isPureVegRest = restaurant?.pureVegRestaurant === true || String(restaurant?.pureVegRestaurant).toLowerCase() === "true" || restaurant?.details?.pureVegRestaurant === true || String(restaurant?.details?.pureVegRestaurant).toLowerCase() === "true"

    return restaurant.menuSections
      .map((section, index) => {
        if (isRecommendedSection(section)) return null
        
        if (isPureVegRest && section?.foodTypeScope?.toLowerCase() === "non-veg") return null

        let validItems = toRenderableArray(section?.items)
        let validSubsections = toRenderableArray(section?.subsections)

        if (isPureVegRest) {
          validItems = validItems.filter(item => item?.foodType?.toLowerCase() !== "non-veg")
          validSubsections = validSubsections.map(sub => ({
            ...sub,
            items: toRenderableArray(sub?.items).filter(item => item?.foodType?.toLowerCase() !== "non-veg")
          }))
        }

        const sectionTitle = getSectionDisplayName(section)
        const itemCount = validItems.length
        const subsectionCount = validSubsections.reduce((sum, sub) => sum + toRenderableArray(sub?.items).length, 0)
        const totalCount = itemCount + subsectionCount

        if (totalCount <= 0) return null

        return {
          id: normalizeMenuCategoryId(section?.categoryId || sectionTitle || index) || `section-${index}`,
          name: sectionTitle,
          image: getSectionCategoryImage(section),
          count: totalCount,
          sectionIndex: index,
        }
      })
      .filter(Boolean)
  }, [restaurant?.menuSections])

  // Count active filters
  const getActiveFilterCount = () => {
    let count = 0
    if (filters.sortBy) count++
    if (filters.vegNonVeg) count++
    if (filters.highlyReordered) count++
    if (filters.spicy) count++
    return count
  }

  const activeFilterCount = getActiveFilterCount()

  useEffect(() => {
    if (typeof window === "undefined" || !slug) return

    try {
      const raw = window.localStorage.getItem(RESTAURANT_DETAILS_FILTERS_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      const nextState = parsed && typeof parsed === "object" ? parsed : {}
      nextState[slug] = filters
      window.localStorage.setItem(RESTAURANT_DETAILS_FILTERS_STORAGE_KEY, JSON.stringify(nextState))
    } catch (error) {
      debugWarn("Failed to persist restaurant filters:", error)
    }
  }, [filters, slug])

  useEffect(() => {
    if (selectedMenuCategory === "all") return
    const categoryStillVisible = menuCategories.some((category) => category.id === selectedMenuCategory)
    if (!categoryStillVisible) {
      setSelectedMenuCategory("all")
    }
  }, [menuCategories, selectedMenuCategory])

  // Handle bookmark click
  const handleBookmarkClick = (item) => {
    if (!isModuleAuthenticated('user')) {
      toast.error("Please login to save dishes")
      navigate('/user/auth/login', { state: { from: window.location.pathname } })
      return
    }
    const restaurantId = restaurant?.restaurantId || restaurant?._id || restaurant?.id
    if (!restaurantId) {
      toast.error("Restaurant information is missing")
      return
    }

    const dishId = item.id || item._id
    if (!dishId) {
      toast.error("Dish information is missing")
      return
    }

    const isFavorite = isDishFavorite(dishId, restaurantId)

    if (isFavorite) {
      // If already bookmarked, remove it
      removeDishFavorite(dishId, restaurantId)
      toast.success("Dish removed from favorites")
    } else {
      // Add to favorites
      const dishData = {
        id: dishId,
        name: item.name,
        description: item.description,
        price: item.price,
        originalPrice: item.originalPrice,
        image: item.image,
        restaurantId: restaurantId,
        restaurantName: restaurant?.name || "",
        restaurantSlug: restaurant?.slug || slug || "",
        foodType: item.foodType,
        isSpicy: item.isSpicy,
        customisable: item.customisable,
      }
      addDishFavorite(dishData)
      toast.success("Dish added to favorites")
    }
  }

  // Handle add to collection
  const handleAddToCollection = () => {
    if (!isModuleAuthenticated('user')) {
      toast.error("Please login to save restaurants")
      navigate('/user/auth/login', { state: { from: window.location.pathname } })
      return
    }
    const restaurantSlug = restaurant?.slug || slug || ""

    if (!restaurantSlug) {
      toast.error("Restaurant information is missing")
      return
    }

    if (!restaurant) {
      toast.error("Restaurant data not available")
      return
    }

    const isAlreadyFavorite = isFavorite(restaurantSlug)

    if (isAlreadyFavorite) {
      // Remove from collection
      removeFavorite(restaurantSlug)
      toast.success("Restaurant removed from collection")
    } else {
      // Add to collection
      addFavorite({
        slug: restaurantSlug,
        name: restaurant.name || "",
        cuisine: restaurant.cuisine || "",
        rating: restaurant.rating || 0,
        deliveryTime: restaurant.deliveryTime || restaurant.estimatedDeliveryTime || "",
        distance: restaurant.distance || "",
        priceRange: restaurant.priceRange || "",
        image: restaurant.profileImageUrl?.url || restaurant.image || ""
      })
      toast.success("Restaurant added to collection")
    }

    setShowMenuOptionsSheet(false)
  }

  // Handle share restaurant
  const handleShareRestaurant = async () => {
    const companyName = await getCompanyNameAsync()
    const restaurantSlug = restaurant?.slug || slug || ""
    const restaurantName = restaurant?.name || "this restaurant"

    // Create share URL
    const shareUrl = `${window.location.origin}/user/restaurants/${restaurantSlug}`
    const shareText = `Check out ${restaurantName} on ${companyName}! ${shareUrl}`

    const payload = {
      title: restaurantName,
      text: shareText,
      url: shareUrl,
    }

    if (isMobileDevice()) {
      openShareModal(payload)
      setShowMenuOptionsSheet(false)
      return
    }

    const shared = await tryNativeShare(payload)
    if (shared) {
      toast.success("Restaurant shared successfully")
      setShowMenuOptionsSheet(false)
      return
    }

    openShareModal(payload)
    setShowMenuOptionsSheet(false)
  }

  // Handle share click
  const handleShareClick = async (item) => {
    const dishId = item.id || item._id
    const restaurantSlug = restaurant?.slug || slug || ""

    // Create share URL
    const shareUrl = `${window.location.origin}/user/restaurants/${restaurantSlug}?dish=${dishId}`
    const shareText = `Check out ${item.name} from ${restaurant?.name || "this restaurant"}! ${shareUrl}`

    const payload = {
      title: `${item.name} - ${restaurant?.name || ""}`,
      text: shareText,
      url: shareUrl,
    }

    if (isMobileDevice()) {
      openShareModal(payload)
      return
    }

    const shared = await tryNativeShare(payload)
    if (shared) {
      toast.success("Dish shared successfully")
      return
    }

    openShareModal(payload)
  }

  // Copy to clipboard helper
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Link copied to clipboard!")
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = text
      textArea.style.position = "fixed"
      textArea.style.opacity = "0"
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand("copy")
        toast.success("Link copied to clipboard!")
      } catch (err) {
        toast.error("Failed to copy link")
      }
      document.body.removeChild(textArea)
    }
  }

  const isMobileDevice = () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false
    const mobileUA = /Android|iPhone|iPad|iPod|Windows Phone|Opera Mini|IEMobile/i.test(navigator.userAgent)
    const smallViewport = window.matchMedia?.("(max-width: 768px)")?.matches
    return Boolean(mobileUA || smallViewport)
  }

  const openShareModal = (payload) => {
    setSharePayload(payload)
    setShowShareModal(true)
  }

  const tryNativeShare = async (payload) => {
    if (typeof navigator === "undefined" || !navigator.share) return false
    try {
      await navigator.share(payload)
      return true
    } catch (error) {
      if (error?.name === "AbortError") return true
      return false
    }
  }

  const openShareTarget = (target) => {
    if (!sharePayload?.url) return

    const text = sharePayload.text || ""
    const url = sharePayload.url
    const encodedText = encodeURIComponent(text)
    const encodedUrl = encodeURIComponent(url)

    let shareLink = ""

    if (target === "whatsapp") {
      shareLink = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`
    } else if (target === "telegram") {
      shareLink = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`
    } else if (target === "email") {
      shareLink = `mailto:?subject=${encodeURIComponent(sharePayload.title || "Check this out")}&body=${encodeURIComponent(`${text}\n\n${url}`)}`
    }

    if (shareLink) {
      window.open(shareLink, "_blank", "noopener,noreferrer")
      setShowShareModal(false)
    }
  }

  const copyShareLink = async () => {
    if (!sharePayload?.url) return
    await copyToClipboard(sharePayload.url)
    setShowShareModal(false)
  }

  const handleSystemShareFromModal = async () => {
    if (!sharePayload) return
    const shared = await tryNativeShare(sharePayload)
    if (shared) {
      setShowShareModal(false)
      toast.success("Shared successfully")
    }
  }

  // Handle item card click
  const handleItemClick = (item) => {
    setSelectedItem(item)
    setSelectedItemImageIndex(0)
    setShowItemDetail(true)
  }

  // Helper function to calculate final price after discount
  const getFinalPrice = (item) => {
    // If discount exists, calculate from originalPrice, otherwise use price directly
    if (item.originalPrice && item.discountAmount && item.discountAmount > 0) {
      // Calculate discounted price from originalPrice
      let discountedPrice = item.originalPrice;
      if (item.discountType === 'Percent') {
        discountedPrice = item.originalPrice - (item.originalPrice * item.discountAmount / 100);
      } else if (item.discountType === 'Fixed') {
        discountedPrice = item.originalPrice - item.discountAmount;
      }
      return Math.max(0, discountedPrice);
    }
    // Otherwise, use price as the final price
    return Math.max(0, item.price || 0);
  };

  // Filter menu items based on active filters
  const filterMenuItems = (items, section = null) => {
    if (!items) return items

    const isRecSection = section ? isRecommendedSection(section) : false

    return items.filter((item) => {
      // Hide non-veg items if the restaurant is pure veg
      const hasProposedVegStatus = restaurant?.pendingProfileChanges?.proposed?.hasOwnProperty('pureVegRestaurant');
      const proposedVegStatus = restaurant?.pendingProfileChanges?.proposed?.pureVegRestaurant;
      const isPureVegRest = hasProposedVegStatus 
        ? (proposedVegStatus === true || String(proposedVegStatus).toLowerCase() === "true")
        : (restaurant?.pureVegRestaurant === true || String(restaurant?.pureVegRestaurant).toLowerCase() === "true" || restaurant?.details?.pureVegRestaurant === true || String(restaurant?.details?.pureVegRestaurant).toLowerCase() === "true");
      
      const ft = item?.foodType?.toLowerCase()?.trim() || ""
      const isNonVegItem = item?.isVeg === false || ft === "non-veg" || ft === "nonveg" || ft === "non veg"
      if (isPureVegRest && isNonVegItem) {
        return false
      }

      // Under 250 filter (when coming from Under 250 page)
      if (showOnlyUnder250) {
        const finalPrice = getFinalPrice(item);
        if (finalPrice > 250) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const itemName = item.name?.toLowerCase() || ""
        if (!itemName.includes(query)) return false
      }

      // VegMode filter - when vegMode is ON, show only Veg items
      // When vegMode is false/null/undefined, show all items (Veg and Non-Veg)
      if (vegMode) {
        if (item.foodType !== "Veg") return false
      }

      // Veg/Non-veg filter (local filter override)
      if (filters.vegNonVeg === "veg") {
        // Show only veg items
        if (item.foodType !== "Veg") return false
      }
      if (filters.vegNonVeg === "non-veg") {
        // Show only non-veg items
        if (item.foodType !== "Non-Veg") return false
      }

      if (filters.highlyReordered && !isRecommendedItem(item) && !isRecSection) return false
      if (filters.spicy && !(item.isSpicy === true || item.isSpicy === 1 || String(item.isSpicy) === 'true')) return false

      return true
    })
  }

  // Sort items based on sortBy filter
  const sortMenuItems = (items) => {
    if (!items) return items
    if (!filters.sortBy) return items

    const sorted = [...items]
    if (filters.sortBy === "low-to-high") {
      return sorted.sort((a, b) => getFinalPrice(a) - getFinalPrice(b))
    } else if (filters.sortBy === "high-to-low") {
      return sorted.sort((a, b) => getFinalPrice(b) - getFinalPrice(a))
    }
    return sorted
  }

  const getSectionSortValue = (section) => {
    const allItems = [
      ...toRenderableArray(section?.items),
      ...toRenderableArray(section?.subsections).flatMap((subsection) => toRenderableArray(subsection?.items)),
    ]

    if (allItems.length === 0) return null

    const prices = allItems
      .map((item) => getFinalPrice(item))
      .filter((price) => Number.isFinite(price))

    if (prices.length === 0) return null

    if (filters.sortBy === "low-to-high") {
      return Math.min(...prices)
    }

    if (filters.sortBy === "high-to-low") {
      return Math.max(...prices)
    }

    return null
  }

  // Helper function to check if a section has any items under Rs 250
  const sectionHasItemsUnder250 = (section) => {
    if (!showOnlyUnder250) return true; // If not filtering, show all sections

    // Check direct items
    if (section.items && section.items.length > 0) {
      const hasUnder250Items = section.items.some(item => {
        if (item.isAvailable === false) return false;
        const finalPrice = getFinalPrice(item);
        return finalPrice <= 250;
      });
      if (hasUnder250Items) return true;
    }

    // Check subsection items
    if (section.subsections && section.subsections.length > 0) {
      for (const subsection of section.subsections) {
        if (subsection.items && subsection.items.length > 0) {
          const hasUnder250Items = subsection.items.some(item => {
            if (item.isAvailable === false) return false;
            const finalPrice = getFinalPrice(item);
            return finalPrice <= 250;
          });
          if (hasUnder250Items) return true;
        }
      }
    }

    return false;
  }

  // Build renderable sections from the current filter state so section/subsection visibility
  // stays in sync with the actual filtered items shown on screen.
  const getFilteredSections = () => {
    if (!restaurant?.menuSections) return []

    const visibleSections = restaurant.menuSections
      .map((section, index) => {
        const filteredItems = sortMenuItems(
          filterMenuItems(
            toRenderableArray(section?.items).filter((item) => item?.isAvailable !== false),
            section
          )
        )

        const filteredSubsections = toRenderableArray(section?.subsections)
          .map((subsection) => ({
            ...subsection,
            items: sortMenuItems(
              filterMenuItems(
                toRenderableArray(subsection?.items).filter((item) => item?.isAvailable !== false),
                section
              )
            ),
          }))
          .filter((subsection) => subsection.items.length > 0)

        return {
          section: {
            ...section,
            items: filteredItems,
            subsections: filteredSubsections,
          },
          originalIndex: index,
        }
      })
      .filter(({ section }) => {
        if (selectedMenuCategory !== "all") {
          if (isRecommendedSection(section)) return false
          const sectionCategoryId = normalizeMenuCategoryId(section?.categoryId || getSectionDisplayName(section))
          if (sectionCategoryId !== selectedMenuCategory) {
            return false
          }
        }

        const hasVisibleItems = toRenderableArray(section?.items).length > 0
        const hasVisibleSubsections = toRenderableArray(section?.subsections).length > 0
        return hasVisibleItems || hasVisibleSubsections
      })

    if (!filters.sortBy) {
      return visibleSections
    }

    return [...visibleSections].sort((left, right) => {
      const leftValue = getSectionSortValue(left.section)
      const rightValue = getSectionSortValue(right.section)

      if (leftValue == null && rightValue == null) return 0
      if (leftValue == null) return 1
      if (rightValue == null) return -1

      return filters.sortBy === "low-to-high"
        ? leftValue - rightValue
        : rightValue - leftValue
    })
  }

  const hasActiveMenuFilters = Boolean(
    showOnlyUnder250 ||
    searchQuery.trim() ||
    !!vegMode ||
    filters.sortBy ||
    filters.vegNonVeg ||
    filters.highlyReordered ||
    filters.spicy
  )

  const filteredSections = useMemo(
    () => getFilteredSections(),
    [restaurant?.menuSections, showOnlyUnder250, searchQuery, vegMode, filters, selectedMenuCategory]
  )

  useEffect(() => {
    if (!hasActiveMenuFilters) return

    const nextExpanded = new Set()
    filteredSections.forEach(({ section, originalIndex }) => {
      nextExpanded.add(originalIndex)
      toRenderableArray(section?.subsections).forEach((_, subIndex) => {
        nextExpanded.add(`${originalIndex}-${subIndex}`)
      })
    })

    setExpandedSections(nextExpanded)
  }, [filteredSections, hasActiveMenuFilters])

  useEffect(() => {
    if (!restaurant?.menuSections || !targetDishId) return

    let matchedItem = null
    const sectionKeysToExpand = new Set()

    restaurant.menuSections.forEach((section, originalIndex) => {
      const sectionItems = toRenderableArray(section?.items)
      const matchedSectionItem = sectionItems.find(
        (item) => String(item?.id || item?._id || "").trim() === targetDishId,
      )

      if (matchedSectionItem && !matchedItem) {
        matchedItem = matchedSectionItem
        sectionKeysToExpand.add(originalIndex)
      }

      const sectionSubsections = toRenderableArray(section?.subsections)
      sectionSubsections.forEach((subsection, subIndex) => {
        const subsectionItems = toRenderableArray(subsection?.items)
        const matchedSubsectionItem = subsectionItems.find(
          (item) => String(item?.id || item?._id || "").trim() === targetDishId,
        )

        if (matchedSubsectionItem && !matchedItem) {
          matchedItem = matchedSubsectionItem
          sectionKeysToExpand.add(originalIndex)
          sectionKeysToExpand.add(`${originalIndex}-${subIndex}`)
        }
      })
    })

    if (!matchedItem) return

    setExpandedSections((prev) => {
      const next = new Set(prev)
      sectionKeysToExpand.forEach((key) => next.add(key))
      return next
    })
    setHighlightedDishId(targetDishId)

    const scrollTimer = window.setTimeout(() => {
      const targetNode = dishCardRefs.current[targetDishId]
      if (targetNode) {
        targetNode.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }, 250)

    const highlightTimer = window.setTimeout(() => {
      setHighlightedDishId((current) => (current === targetDishId ? null : current))
    }, 2600)

    return () => {
      window.clearTimeout(scrollTimer)
      window.clearTimeout(highlightTimer)
    }
  }, [restaurant, targetDishId])

  // Highlight offers/texts for the blue offer line
  const highlightOffers = [
    "Upto 50% OFF",
    restaurant?.offerText || "",
    ...(Array.isArray(restaurant?.offers) ? restaurant.offers.map((offer) => offer?.title || "") : []),
  ]

  // Auto-rotate images every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => {
        const offersLength = Array.isArray(restaurant?.offers) && restaurant.offers.length > 0
          ? restaurant.offers.length
          : 1
        return (prev + 1) % offersLength
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [restaurant?.offers?.length || 0])

  // Auto-rotate highlight offer text every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setHighlightIndex((prev) => (prev + 1) % highlightOffers.length)
    }, 2000)

    return () => clearInterval(interval)
  }, [highlightOffers.length])

  // Show loading state
  if (loadingRestaurant) {
    return <RestaurantDetailSkeleton />
  }

  // Show error state if restaurant not found or network error
  if (restaurantError && !restaurant) {
    const isNetworkError = restaurantError.includes('Backend server is not connected')
    const isNotFoundError = restaurantError === 'Restaurant not found'

    return (
      <AnimatedPage>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className={`h-12 w-12 ${isNetworkError ? 'text-red-500' : 'text-red-500'}`} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                {isNetworkError ? 'Connection Error' : isNotFoundError ? 'Restaurant not found' : 'Error'}
              </h2>
              <p className="text-sm text-gray-600 mb-4 max-w-md">{restaurantError}</p>
              {isNetworkError && (
                <p className="text-xs text-gray-500 mb-4">
                  Make sure the backend server is running at {API_BASE_URL.replace('/api', '')}
                </p>
              )}
              <Button onClick={goBack} variant="outline">
                Go Back
              </Button>
            </div>
          </div>
        </div>
      </AnimatedPage>
    )
  }

  // Show error if restaurant is still null
  if (!restaurant) {
    return (
      <AnimatedPage>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="h-12 w-12 text-red-500" />
            <span className="text-sm text-gray-600">Restaurant not found</span>
            <Button onClick={goBack} variant="outline">
              Go Back
            </Button>
          </div>
        </div>
      </AnimatedPage>
    )
  }

  const availabilityStatus = getRestaurantAvailabilityStatus(restaurant, new Date(availabilityTick))
  const isRestaurantOffline = !availabilityStatus.isOpen
  const shouldShowGrayscale = isOutOfService || isRestaurantOffline
  const galleryImages = buildRestaurantGallery(restaurant)
  const restaurantSlug = restaurant?.slug || slug || ""
  const restaurantId = restaurant?.restaurantId || restaurant?._id || restaurant?.id

  const renderDishCard = (item) => {
    const quantity = getDishQuantity(item)
    return (
      <RestaurantDishCard
        key={item.id}
        item={item}
        quantity={quantity}
        highlighted={highlightedDishId === item.id}
        disabled={shouldShowGrayscale}
        isRecommended={isRecommendedItem(item)}
        isBookmarked={isDishFavorite(item.id, restaurantId)}
        cardRef={(node) => {
          if (node) dishCardRefs.current[item.id] = node
          else delete dishCardRefs.current[item.id]
        }}
        onOpen={() => handleItemClick(item)}
        onBookmark={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleBookmarkClick(item)
        }}
        onShare={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleShareClick(item)
        }}
        onDecrease={(e) => {
          e.stopPropagation()
          if (!shouldShowGrayscale) updateItemQuantity(item, Math.max(0, quantity - 1), e)
        }}
        onIncrease={(e) => {
          e.stopPropagation()
          handleDishIncrease(item, quantity, e)
        }}
      />
    )
  }

  return (
    <AnimatedPage
      id="scrollingelement"
      className={`min-h-screen bg-[#f6f7fb] dark:bg-[#0a0a0a] flex flex-col transition-all duration-300 ${shouldShowGrayscale ? 'grayscale opacity-80' : ''
        }`}
    >
      <RestaurantDetailsHero
        images={galleryImages}
        restaurantName={restaurant?.name}
        isFavorite={isFavorite(restaurantSlug)}
        showSearch={showSearch}
        searchQuery={searchQuery}
        onBack={goBack}
        onToggleSearch={() => setShowSearch(true)}
        onSearchChange={setSearchQuery}
        onClearSearch={() => { setSearchQuery(""); setShowSearch(false); }}
        onOpenMenu={() => setShowMenuOptionsSheet(true)}
        onToggleFavorite={handleAddToCollection}
      />

      <RestaurantDetailsSummary
        restaurant={restaurant}
        isRestaurantOffline={isRestaurantOffline}
        isOutOfService={isOutOfService}
      />

      <RestaurantDetailsMenuToolbar
        activeFilterCount={activeFilterCount}
        filters={filters}
        vegMode={vegMode}
        isPureVeg={restaurant?.pureVegRestaurant === true || String(restaurant?.pureVegRestaurant).toLowerCase() === "true" || restaurant?.details?.pureVegRestaurant === true || String(restaurant?.details?.pureVegRestaurant).toLowerCase() === "true"}
        hasNonVegItems={hasNonVegItems}
        menuCategories={menuCategories}
        selectedMenuCategory={selectedMenuCategory}
        onOpenFilters={() => setShowFilterSheet(true)}
        onToggleVegFilter={() =>
          setFilters((prev) => ({
            ...prev,
            vegNonVeg: prev.vegNonVeg === "veg" ? null : "veg",
          }))
        }
        onToggleNonVegFilter={() =>
          setFilters((prev) => ({
            ...prev,
            vegNonVeg: prev.vegNonVeg === "non-veg" ? null : "non-veg",
          }))
        }
        onSelectCategory={setSelectedMenuCategory}
      />

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pb-8 pt-4 space-y-8">
        <RestaurantMenuSections
          filteredSections={filteredSections}
          hasActiveMenuFilters={hasActiveMenuFilters}
          expandedSections={expandedSections}
          setExpandedSections={setExpandedSections}
          isRecommendedSection={isRecommendedSection}
          toRenderableArray={toRenderableArray}
          loadingMenuItems={loadingMenuItems}
          renderDishCard={renderDishCard}
        />
      </div>

      <RestaurantDetailsFssaiFooter
        registrationNumber={restaurant?.onboarding?.step3?.fssai?.registrationNumber}
      />

      <RestaurantFloatingMenuButton
        hidden={showFilterSheet || showMenuSheet || showMenuOptionsSheet}
        onOpen={() => setShowMenuSheet(true)}
      />

      <RestaurantDetailsOverlays
        showMenuSheet={showMenuSheet}
        setShowMenuSheet={setShowMenuSheet}
        menuCategories={menuCategories}
        showFilterSheet={showFilterSheet}
        setShowFilterSheet={setShowFilterSheet}
        filters={filters}
        setFilters={setFilters}
        vegMode={vegMode}
        activeFilterCount={activeFilterCount}
        onCategoryClick={(sectionIndex) => {
          setExpandedSections((prev) => {
            const newSet = new Set(prev)
            newSet.add(sectionIndex)
            return newSet
          })
        }}
        showLocationSheet={showLocationSheet}
        setShowLocationSheet={setShowLocationSheet}
        restaurant={restaurant}
        showManageCollections={showManageCollections}
        setShowManageCollections={setShowManageCollections}
        selectedItem={selectedItem}
        isDishFavorite={isDishFavorite}
        removeDishFavorite={removeDishFavorite}
        getDishFavorites={getDishFavorites}
        getFavorites={getFavorites}
        showItemDetail={showItemDetail}
        setShowItemDetail={setShowItemDetail}
        selectedItemImageIndex={selectedItemImageIndex}
        setSelectedItemImageIndex={setSelectedItemImageIndex}
        selectedVariantId={selectedVariantId}
        setSelectedVariantId={setSelectedVariantId}
        shouldShowGrayscale={shouldShowGrayscale}
        isRecommendedItem={isRecommendedItem}
        handleBookmarkClick={handleBookmarkClick}
        getDishQuantity={getDishQuantity}
        updateItemQuantity={updateItemQuantity}
        getVariantForDish={getVariantForDish}
        showScheduleSheet={showScheduleSheet}
        setShowScheduleSheet={setShowScheduleSheet}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedTimeSlot={selectedTimeSlot}
        setSelectedTimeSlot={setSelectedTimeSlot}
        showOffersSheet={showOffersSheet}
        setShowOffersSheet={setShowOffersSheet}
        expandedCoupons={expandedCoupons}
        setExpandedCoupons={setExpandedCoupons}
        showMenuOptionsSheet={showMenuOptionsSheet}
        setShowMenuOptionsSheet={setShowMenuOptionsSheet}
        slug={slug}
        isFavorite={isFavorite}
        handleAddToCollection={handleAddToCollection}
        handleShareRestaurant={handleShareRestaurant}
        handleShareClick={handleShareClick}
        showShareModal={showShareModal}
        setShowShareModal={setShowShareModal}
        sharePayload={sharePayload}
        handleSystemShareFromModal={handleSystemShareFromModal}
        openShareTarget={openShareTarget}
        copyShareLink={copyShareLink}
      />
    </AnimatedPage>
  )
}

export default function RestaurantDetails() {
  return (
    <RestaurantDetailsErrorBoundary>
      <RestaurantDetailsContent />
    </RestaurantDetailsErrorBoundary>
  )
}
