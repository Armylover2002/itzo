import { useState, useMemo, useRef, useEffect, startTransition, useDeferredValue } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Star, Clock, Search, SlidersHorizontal, ChevronDown, Bookmark, BadgePercent, MapPin, ArrowDownUp, Timer, IndianRupee, UtensilsCrossed, ShieldCheck, X, Loader2, Grid2x2 } from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import {
  CategoryChipRowSkeleton,
  LoadingSkeletonRegion,
  RestaurantGridSkeleton,
} from "@food/components/ui/loading-skeletons"

// Import shared food images - prevents duplication
import { foodImages } from "@food/constants/images"
import api from "@food/api"
import { restaurantAPI, adminAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { useProfile } from "@food/context/ProfileContext"
import { useLocation } from "@food/hooks/useLocation"
import { useZone } from "@food/hooks/useZone"
import { useDelayedLoading } from "@food/hooks/useDelayedLoading"
import { getMenuFromResponse } from "@food/utils/menuItems"

// Filter options
const filterOptions = [
  { id: 'under-30-mins', label: 'Under 30 mins' },
  { id: 'price-match', label: 'Price Match', hasIcon: true },
  { id: 'flat-50-off', label: 'Flat 50% OFF', hasIcon: true },
  { id: 'under-250', label: 'Under ₹250' },
  { id: 'rating-4-plus', label: 'Rating 4.0+' },
]

// Mock data removed - using backend data only

const CATEGORY_PAGE_FILTERS_STORAGE_KEY = "food-category-page-filters-v1"



export default function CategoryPage() {
  const { category } = useParams()
  const navigate = useNavigate()
  const { vegMode } = useProfile()
  const { location } = useLocation()
  const { zoneId, isOutOfService } = useZone(location)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState(category?.toLowerCase() || 'all')
  const [activeFilters, setActiveFilters] = useState(new Set())
  const [favorites, setFavorites] = useState(new Set())
  const [sortBy, setSortBy] = useState(null)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [activeFilterTab, setActiveFilterTab] = useState('sort')
  const [activeScrollSection, setActiveScrollSection] = useState('sort')
  const [isLoadingFilterResults, setIsLoadingFilterResults] = useState(false)
  const filterSectionRefs = useRef({})
  const rightContentRef = useRef(null)
  const categoryScrollRef = useRef(null)
  const menuEnrichmentRequestRef = useRef(0)
  const approvedFoodsCacheRef = useRef(null)
  const approvedFoodsInFlightRef = useRef(null)
  const hasRestoredCategoryFiltersRef = useRef(false)

  // State for categories from admin
  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)

  const [restaurantsData, setRestaurantsData] = useState([])
  const [loadingRestaurants, setLoadingRestaurants] = useState(true)
  const [isEnrichingMenus, setIsEnrichingMenus] = useState(false)
  const [approvedFoodsData, setApprovedFoodsData] = useState([])
  const [categoryKeywords, setCategoryKeywords] = useState({})
  const showCategorySkeleton = useDelayedLoading(loadingCategories)
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const BACKEND_ORIGIN = useMemo(() => API_BASE_URL.replace(/\/api(\/v1)?\/?$/i, ""), [])
  const slugify = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  const normalizeCategoryToken = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  const matchesCategoryText = (value, keywords) => {
    const normalizedValue = normalizeCategoryToken(value)
    if (!normalizedValue) return false

    return keywords.some((keyword) => {
      const normalizedKeyword = normalizeCategoryToken(keyword)
      if (!normalizedKeyword) return false
      return (
        normalizedValue === normalizedKeyword ||
        normalizedValue.includes(normalizedKeyword) ||
        slugify(normalizedValue) === slugify(normalizedKeyword)
      )
    })
  }
  const uniqueByRestaurant = (list) => {
    const seen = new Set()
    return list.filter((row) => {
      // Use distinct keys for dishes vs restaurants to prevent collisions
      const key = row.dishId ? `dish-${row.dishId}` : (row.restaurantId || row.id || `raw-${slugify(row.name)}`)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  const toArray = (value) => {
    if (Array.isArray(value)) return value
    if (!value || typeof value !== "object") return []
    return Object.values(value).filter((entry) => entry && typeof entry === "object")
  }

  const normalizeMenu = (menu) => {
    const rawSections = toArray(menu?.sections)
    return {
      ...menu,
      sections: rawSections.map((section, sectionIndex) => ({
        ...section,
        id: String(section?.id || section?._id || `section-${sectionIndex}`),
        name: section?.name || section?.title || "Unnamed Section",
        items: toArray(section?.items).map((item, itemIndex) => ({
          ...item,
          id: String(item?.id || item?._id || `${sectionIndex}-${itemIndex}`),
        })),
        subsections: toArray(section?.subsections).map((subsection, subsectionIndex) => ({
          ...subsection,
          id: String(subsection?.id || subsection?._id || `subsection-${sectionIndex}-${subsectionIndex}`),
          name: subsection?.name || "Unnamed Subsection",
          items: toArray(subsection?.items).map((item, itemIndex) => ({
            ...item,
            id: String(item?.id || item?._id || `${sectionIndex}-${subsectionIndex}-${itemIndex}`),
          })),
        })),
      })),
    }
  }

  const fetchApprovedFoods = async () => {
    if (Array.isArray(approvedFoodsCacheRef.current)) {
      return approvedFoodsCacheRef.current
    }

    if (approvedFoodsInFlightRef.current) {
      return approvedFoodsInFlightRef.current
    }

    approvedFoodsInFlightRef.current = (async () => {
      try {
        const response = await adminAPI.getFoods({ limit: 1000 })
        const list = response?.data?.data?.foods || []
        const approvedFoods = Array.isArray(list)
          ? list.filter((food) =>
              String(food?.approvalStatus || "").toLowerCase() === "approved" &&
              food?.isAvailable !== false
            )
          : []

        approvedFoodsCacheRef.current = approvedFoods
        return approvedFoods
      } catch {
        approvedFoodsCacheRef.current = []
        return []
      } finally {
        approvedFoodsInFlightRef.current = null
      }
    })()

    return approvedFoodsInFlightRef.current
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const foods = await fetchApprovedFoods()
      if (!cancelled) {
        setApprovedFoodsData(Array.isArray(foods) ? foods : [])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const buildFallbackMenuFromFoods = (foods, restaurant) => {
    const restaurantIds = new Set(
      [
        restaurant?.restaurantId,
        restaurant?.id,
        restaurant?.mongoId,
      ]
        .filter(Boolean)
        .map((value) => String(value).trim())
    )

    const restaurantName = String(restaurant?.name || "").trim().toLowerCase()
    const matchingFoods = foods.filter((food) => {
      const foodRestaurantId = String(food?.restaurantId || "").trim()
      const foodRestaurantName = String(food?.restaurantName || "").trim().toLowerCase()
      return (
        (foodRestaurantId && restaurantIds.has(foodRestaurantId)) ||
        (restaurantName && foodRestaurantName === restaurantName)
      )
    })

    if (matchingFoods.length === 0) {
      return null
    }

    const sectionsMap = new Map()
    matchingFoods.forEach((food, index) => {
      const sectionName = String(food?.categoryName || food?.category || "Varieties").trim() || "Varieties"
      const sectionKey = slugify(sectionName)
      if (!sectionsMap.has(sectionKey)) {
        sectionsMap.set(sectionKey, {
          id: sectionKey || `section-${index}`,
          name: sectionName,
          items: [],
          subsections: [],
        })
      }

      sectionsMap.get(sectionKey).items.push({
        id: String(food?.id || food?._id || `${sectionKey}-${index}`),
        _id: food?._id,
        name: food?.name || "Unnamed Item",
        description: food?.description || "",
        price: Number(food?.price || 0),
        originalPrice: Number(food?.originalPrice || food?.price || 0),
        image: normalizeImageUrl(food?.image),
        foodType: food?.foodType || "Non-Veg",
        isAvailable: food?.isAvailable !== false,
        categoryName: food?.categoryName || sectionName,
        category: food?.categoryName || sectionName,
        preparationTime: food?.preparationTime || "",
        approvalStatus: food?.approvalStatus || "approved",
      })
    })

    return {
      sections: Array.from(sectionsMap.values()),
    }
  }

  const getCategoryFallbackDishesFromApprovedFoods = (categoryId, restaurants) => {
    const keywords = getCategoryKeywords(categoryId)
    if (keywords.length === 0 || !Array.isArray(approvedFoodsData) || approvedFoodsData.length === 0) {
      return []
    }

    const restaurantsById = new Map()
    const restaurantsByName = new Map()
    ;(Array.isArray(restaurants) ? restaurants : []).forEach((restaurant) => {
      const idCandidates = [
        restaurant?.restaurantId,
        restaurant?.id,
        restaurant?.mongoId,
      ]
        .filter(Boolean)
        .map((value) => String(value).trim())

      idCandidates.forEach((value) => {
        if (!restaurantsById.has(value)) {
          restaurantsById.set(value, restaurant)
        }
      })

      const normalizedName = String(restaurant?.name || "").trim().toLowerCase()
      if (normalizedName && !restaurantsByName.has(normalizedName)) {
        restaurantsByName.set(normalizedName, restaurant)
      }
    })

    return approvedFoodsData
      .filter((food) => {
        if (food?.isAvailable === false) return false
        if (String(food?.approvalStatus || "").toLowerCase() !== "approved") return false

        const categoryName = String(food?.categoryName || food?.category || "").toLowerCase()
        const foodName = String(food?.name || "").toLowerCase()
        return (
          matchesCategoryText(categoryName, keywords) ||
          matchesCategoryText(foodName, keywords)
        )
      })
      .map((food, index) => {
        const restaurantId = String(food?.restaurantId || "").trim()
        const restaurantName = String(food?.restaurantName || "").trim()
        const matchedRestaurant =
          restaurantsById.get(restaurantId) ||
          restaurantsByName.get(restaurantName.toLowerCase()) ||
          null

        const fallbackRestaurantName = restaurantName || "Restaurant"
        const fallbackSlug = slugify(fallbackRestaurantName)
        const fallbackImage = normalizeImageUrl(food?.image)

        return {
          ...(matchedRestaurant || {}),
          id: `${restaurantId || fallbackSlug || "restaurant"}-${String(food?.id || food?._id || index)}`,
          restaurantId: restaurantId || matchedRestaurant?.restaurantId || matchedRestaurant?.id || null,
          mongoId: matchedRestaurant?.mongoId || matchedRestaurant?.id || null,
          slug: matchedRestaurant?.slug || fallbackSlug,
          name: matchedRestaurant?.name || fallbackRestaurantName,
          image: matchedRestaurant?.image || fallbackImage,
          images: Array.isArray(matchedRestaurant?.images) && matchedRestaurant.images.length > 0
            ? matchedRestaurant.images
            : (fallbackImage ? [fallbackImage] : []),
          cuisine: matchedRestaurant?.cuisine || null,
          rating: matchedRestaurant?.rating || null,
          deliveryTime: matchedRestaurant?.deliveryTime || null,
          distance: matchedRestaurant?.distance || null,
          offer: matchedRestaurant?.offer || null,
          featuredDish: matchedRestaurant?.featuredDish || food?.name || null,
          featuredPrice: matchedRestaurant?.featuredPrice || Number(food?.price || 0),
          menu: matchedRestaurant?.menu || null,
          dishId: String(food?.id || food?._id || `${restaurantId}-${index}`),
          categoryDish: food,
          categoryDishName: food?.name || "Unnamed Item",
          categoryDishPrice: Number(food?.price || 0),
          categoryDishImage: fallbackImage,
          categoryDishFoodType: food?.foodType || "Non-Veg",
        }
      })
  }

  const normalizeImageUrl = (value) => {
    if (!value) return ""

    const raw =
      typeof value === "string"
        ? value
        : typeof value === "object"
          ? (value.url || value.secure_url || value.imageUrl || value.image || value.src || value.path || "")
          : ""

    if (typeof raw !== "string") return ""
    const trimmed = raw.trim()
    if (!trimmed) return ""
    if (/^data:/i.test(trimmed) || /^blob:/i.test(trimmed)) return trimmed

    const appProtocol = typeof window !== "undefined" ? window.location?.protocol : ""
    const appHost = typeof window !== "undefined" ? window.location?.hostname : ""
    let normalized = trimmed
      .replace(/\\/g, "/")
      .replace(/^(https?):\/(?!\/)/i, "$1://")
      .replace(/^(https?:\/\/)(https?:\/\/)/i, "$1")

    if (/^\/\//.test(normalized)) {
      normalized = `${appProtocol || "https:"}${normalized}`
    }

    const hasSignedParams = (url) =>
      /[?&](X-Amz-|Signature=|Expires=|AWSAccessKeyId=|GoogleAccessId=|token=|sig=|se=|sp=|sv=)/i.test(url)

    if (/^https?:\/\//i.test(normalized)) {
      try {
        const parsed = new URL(normalized, window.location.origin)
        if (
          appHost &&
          appHost !== "localhost" &&
          appHost !== "127.0.0.1" &&
          /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname)
        ) {
          try {
            const backendUrl = new URL(BACKEND_ORIGIN)
            parsed.protocol = backendUrl.protocol
            parsed.hostname = backendUrl.hostname
            parsed.port = backendUrl.port
          } catch {
            parsed.protocol = window.location.protocol
            parsed.hostname = window.location.hostname
            if (window.location.port) parsed.port = window.location.port
          }
        }
        if (appProtocol === "https:" && parsed.protocol === "http:") {
          parsed.protocol = "https:"
        }
        const finalUrl = parsed.toString()
        return hasSignedParams(finalUrl) ? finalUrl : encodeURI(finalUrl)
      } catch {
        return normalized
      }
    }

    const absolutePath = normalized.startsWith("/")
      ? `${BACKEND_ORIGIN}${normalized}`
      : `${BACKEND_ORIGIN}/${normalized.replace(/^\.?\/*/, "")}`

    try {
      const parsed = new URL(absolutePath, window.location.origin)
      if (appProtocol === "https:" && parsed.protocol === "http:") {
        parsed.protocol = "https:"
      }
      const finalUrl = parsed.toString()
      return hasSignedParams(finalUrl) ? finalUrl : encodeURI(finalUrl)
    } catch {
      return absolutePath
    }
  }

  const currentFilterStorageKey = useMemo(
    () => slugify(selectedCategory || category || "all") || "all",
    [selectedCategory, category]
  )

  const parseFirstNumber = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) return value
    const match = String(value || "").match(/(\d+(?:\.\d+)?)/)
    return match ? Number(match[1]) : null
  }

  const getComparableDeliveryTime = (row) => parseFirstNumber(row?.deliveryTime)

  const getComparableDistance = (row) => {
    const raw = String(row?.distance || "").trim().toLowerCase()
    if (!raw) return null

    const parsed = parseFirstNumber(raw)
    if (parsed == null) return null
    if (raw.includes("m") && !raw.includes("km")) {
      return parsed / 1000
    }
    return parsed
  }

  const getComparablePrice = (row) => {
    const raw = row?.categoryDishPrice ?? row?.featuredPrice ?? null
    const parsed = typeof raw === "number" ? raw : parseFirstNumber(raw)
    return Number.isFinite(parsed) ? parsed : null
  }

  const getComparableRating = (row) => {
    const parsed = typeof row?.rating === "number" ? row.rating : parseFirstNumber(row?.rating)
    return Number.isFinite(parsed) ? parsed : null
  }

  const matchesOfferText = (value, pattern) => pattern.test(String(value || ""))

  const applyFiltersAndSorting = (rows) => {
    let nextRows = Array.isArray(rows) ? [...rows] : []

    if (activeFilters.has('under-30-mins')) {
      nextRows = nextRows.filter((row) => {
        const time = getComparableDeliveryTime(row)
        return time != null && time <= 30
      })
    }

    if (activeFilters.has('delivery-under-45')) {
      nextRows = nextRows.filter((row) => {
        const time = getComparableDeliveryTime(row)
        return time != null && time <= 45
      })
    }

    if (activeFilters.has('rating-35-plus')) {
      nextRows = nextRows.filter((row) => {
        const rating = getComparableRating(row)
        return rating != null && rating >= 3.5
      })
    }

    if (activeFilters.has('rating-4-plus')) {
      nextRows = nextRows.filter((row) => {
        const rating = getComparableRating(row)
        return rating != null && rating >= 4.0
      })
    }

    if (activeFilters.has('rating-45-plus')) {
      nextRows = nextRows.filter((row) => {
        const rating = getComparableRating(row)
        return rating != null && rating >= 4.5
      })
    }

    if (activeFilters.has('distance-under-1km')) {
      nextRows = nextRows.filter((row) => {
        const distance = getComparableDistance(row)
        return distance != null && distance <= 1
      })
    }

    if (activeFilters.has('distance-under-2km')) {
      nextRows = nextRows.filter((row) => {
        const distance = getComparableDistance(row)
        return distance != null && distance <= 2
      })
    }

    if (activeFilters.has('price-under-200')) {
      nextRows = nextRows.filter((row) => {
        const price = getComparablePrice(row)
        return price != null && price <= 200
      })
    }

    if (activeFilters.has('under-250')) {
      nextRows = nextRows.filter((row) => {
        const price = getComparablePrice(row)
        return price != null && price <= 250
      })
    }

    if (activeFilters.has('price-under-500')) {
      nextRows = nextRows.filter((row) => {
        const price = getComparablePrice(row)
        return price != null && price <= 500
      })
    }

    if (activeFilters.has('flat-50-off')) {
      nextRows = nextRows.filter((row) => matchesOfferText(row?.offer, /50\s*%/i))
    }

    if (activeFilters.has('price-match')) {
      nextRows = nextRows.filter((row) =>
        matchesOfferText(row?.offer, /price\s*match/i) ||
        matchesOfferText(row?.priceRange, /price\s*match/i) ||
        matchesOfferText(row?.categoryDish?.description, /price\s*match/i)
      )
    }

    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.toLowerCase()
      nextRows = nextRows.filter((row) =>
        row.name?.toLowerCase().includes(query) ||
        row.cuisine?.toLowerCase().includes(query) ||
        row.featuredDish?.toLowerCase().includes(query) ||
        row.categoryDishName?.toLowerCase().includes(query)
      )
    }

    if (sortBy) {
      nextRows.sort((left, right) => {
        if (sortBy === 'price-low' || sortBy === 'price-high') {
          const leftPrice = getComparablePrice(left)
          const rightPrice = getComparablePrice(right)
          if (leftPrice == null && rightPrice == null) return 0
          if (leftPrice == null) return 1
          if (rightPrice == null) return -1
          return sortBy === 'price-low' ? leftPrice - rightPrice : rightPrice - leftPrice
        }

        if (sortBy === 'rating-high' || sortBy === 'rating-low') {
          const leftRating = getComparableRating(left)
          const rightRating = getComparableRating(right)
          if (leftRating == null && rightRating == null) return 0
          if (leftRating == null) return 1
          if (rightRating == null) return -1
          return sortBy === 'rating-high' ? rightRating - leftRating : leftRating - rightRating
        }

        return 0
      })
    }

    return uniqueByRestaurant(nextRows)
  }

  // Fetch categories from admin API
  useEffect(() => {
    let isCancelled = false;

    const fetchCategories = async () => {
      try {
        setLoadingCategories(true)
        const response = await adminAPI.getPublicCategories(zoneId ? { zoneId } : {})

        if (isCancelled) return;

        if (response.data && response.data.success && response.data.data && response.data.data.categories) {
          const categoriesArray = response.data.data.categories

          // Transform API categories to match expected format
          const transformedCategories = [
            { id: 'all', name: "All", image: null, slug: 'all' },
            ...categoriesArray.map((cat) => ({
              id: cat.slug || cat.id,
              name: cat.name,
              image: cat.image || foodImages[0],
              slug: cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-'),
              type: cat.type,
            }))
          ]

          setCategories(transformedCategories)

          // Generate category keywords dynamically from category names
          const keywordsMap = {}
          categoriesArray.forEach((cat) => {
            const categoryId = cat.slug || cat.id
            const categoryName = cat.name.toLowerCase()

            // Generate keywords from category name
            const words = categoryName.split(/[\s-]+/).filter(w => w.length > 0)
            keywordsMap[categoryId] = [categoryName, ...words]
          })

          setCategoryKeywords(keywordsMap)
        } else {
          // Keep default "All" category on error
          setCategories([{ id: 'all', name: "All", image: null, slug: 'all' }])
        }
      } catch (error) {
        if (isCancelled) return;
        debugError('Error fetching categories:', error)
        // Keep default "All" category on error
        setCategories([{ id: 'all', name: "All", image: null, slug: 'all' }])
      } finally {
        if (!isCancelled) setLoadingCategories(false)
      }
    }

    fetchCategories()

    return () => {
      isCancelled = true;
    }
  }, [zoneId])

  // Helper function to check if menu has dishes matching category keywords
  const getCategoryKeywords = (categoryId) => {
    const raw = String(categoryId || "").trim().toLowerCase()
    const fromAdmin = categoryKeywords[raw]
    let keywords = []
    if (Array.isArray(fromAdmin) && fromAdmin.length > 0) {
      keywords = [...fromAdmin]
    } else {
      // Fallback: derive keywords from the slug in URL (e.g. "samosha" -> ["samosha"])
      // This prevents "no data" when admin categories don't include the slug.
      const parts = raw.split(/[\s-]+/).filter(Boolean)
      keywords = parts.length > 0 ? Array.from(new Set([raw, ...parts])) : []
    }

    // Add common variations/misspellings (e.g. "samosha" vs "samosa")
    if (keywords.includes('samosha') || keywords.includes('samosa')) {
      if (!keywords.includes('samosa')) keywords.push('samosa')
      if (!keywords.includes('samosha')) keywords.push('samosha')
    }

    return keywords
  }

  const checkCategoryInMenu = (menu, categoryId) => {
    if (!menu || !menu.sections || !Array.isArray(menu.sections)) {
      return false
    }

    const keywords = getCategoryKeywords(categoryId)
    if (keywords.length === 0) {
      return false
    }

    for (const section of menu.sections) {
      const sectionNameLower = (section.name || '').toLowerCase()
      if (matchesCategoryText(sectionNameLower, keywords)) {
        return true
      }

      if (section.items && Array.isArray(section.items)) {
        for (const item of section.items) {
          const itemNameLower = (item.name || '').toLowerCase()
          const itemCategoryLower = (item.categoryName || item.category || '').toLowerCase()

          if (
            matchesCategoryText(itemNameLower, keywords) ||
            matchesCategoryText(itemCategoryLower, keywords)
          ) {
            return true
          }
        }
      }

      // Also check subsection items (new menu builder can nest items)
      if (section.subsections && Array.isArray(section.subsections)) {
        for (const subsection of section.subsections) {
          const subsectionNameLower = (subsection?.name || "").toLowerCase()
          if (matchesCategoryText(subsectionNameLower, keywords)) {
            return true
          }

          const subItems = Array.isArray(subsection?.items) ? subsection.items : []
          for (const item of subItems) {
            const itemNameLower = (item?.name || "").toLowerCase()
            const itemCategoryLower = (item?.categoryName || item?.category || "").toLowerCase()
            if (
              matchesCategoryText(itemNameLower, keywords) ||
              matchesCategoryText(itemCategoryLower, keywords)
            ) {
              return true
            }
          }
        }
      }
    }

    return false
  }

  // Helper function to get ALL dishes matching a category from menu (returns array of dish info)
  const getAllCategoryDishesFromMenu = (menu, categoryId) => {
    if (!menu || !menu.sections || !Array.isArray(menu.sections)) {
      return []
    }

    const keywords = getCategoryKeywords(categoryId)
    if (keywords.length === 0) {
      return []
    }

    const matchingDishes = []

    for (const section of menu.sections) {
      const sectionNameLower = (section?.name || "").toLowerCase()
      const sectionMatches = matchesCategoryText(sectionNameLower, keywords)

      if (section.items && Array.isArray(section.items)) {
        for (const item of section.items) {
          const itemNameLower = (item.name || '').toLowerCase()
          const itemCategoryLower = (item.categoryName || item.category || '').toLowerCase()

          const itemMatches =
            matchesCategoryText(itemNameLower, keywords) ||
            matchesCategoryText(itemCategoryLower, keywords)

          // If the section name matches the category, include all items in it.
          if (sectionMatches || itemMatches) {
            // Calculate final price considering discounts
            const originalPrice = item.originalPrice || item.price || 0
            const discountPercent = item.discountPercent || 0
            const finalPrice = discountPercent > 0
              ? Math.round(originalPrice * (1 - discountPercent / 100))
              : originalPrice

            // Get dish image (prioritize item image, then section image)
            const dishImage = normalizeImageUrl(item.image?.url || item.image || section.image?.url || section.image)

            matchingDishes.push({
              name: item.name,
              price: finalPrice,
              image: dishImage,
              originalPrice: originalPrice,
              itemId: item._id || item.id || `${item.name}-${finalPrice}`,
              foodType: item.foodType, // Include foodType for vegMode filtering
            })
          }
        }
      }

      // Include subsection items too
      if (section.subsections && Array.isArray(section.subsections)) {
        for (const subsection of section.subsections) {
          const subsectionNameLower = (subsection?.name || "").toLowerCase()
          const subsectionMatches = matchesCategoryText(subsectionNameLower, keywords)
          const subItems = Array.isArray(subsection?.items) ? subsection.items : []

          for (const item of subItems) {
            const itemNameLower = (item?.name || "").toLowerCase()
            const itemCategoryLower = (item?.categoryName || item?.category || "").toLowerCase()
            const itemMatches =
              matchesCategoryText(itemNameLower, keywords) ||
              matchesCategoryText(itemCategoryLower, keywords)

            if (sectionMatches || subsectionMatches || itemMatches) {
              const originalPrice = item?.originalPrice || item?.price || 0
              const discountPercent = item?.discountPercent || 0
              const finalPrice = discountPercent > 0
                ? Math.round(originalPrice * (1 - discountPercent / 100))
                : originalPrice

              const dishImage = normalizeImageUrl(
                item?.image?.url || item?.image || subsection?.image?.url || subsection?.image || section?.image?.url || section?.image
              )

              matchingDishes.push({
                name: item?.name,
                price: finalPrice,
                image: dishImage,
                originalPrice: originalPrice,
                itemId: item?._id || item?.id || `${item?.name}-${finalPrice}`,
                foodType: item?.foodType,
              })
            }
          }
        }
      }
    }

    return matchingDishes
  }

  // Helper function to get FIRST featured dish for a category from menu (for backward compatibility)
  const getCategoryDishFromMenu = (menu, categoryId) => {
    const allDishes = getAllCategoryDishesFromMenu(menu, categoryId)
    return allDishes.length > 0 ? allDishes[0] : null
  }

  // Fetch restaurants from API
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        setLoadingRestaurants(true)
        // IMPORTANT: Do NOT pass zoneId as a hard filter.
        // UX is "show all restaurants", and we only style out-of-service state.
        const params = {}
        const response = await restaurantAPI.getRestaurants(params)

        if (response.data && response.data.success && response.data.data && response.data.data.restaurants) {
          const restaurantsArray = response.data.data.restaurants

          // Helper function to check if value is a default/mock value
          const isDefaultValue = (value, fieldName) => {
            if (!value) return false

            const defaultOffers = [
              "Flat ₹50 OFF above ₹199",
              "Flat 50% OFF",
              "Flat ₹40 OFF above ₹149"
            ]
            const defaultDeliveryTimes = ["25-30 mins", "20-25 mins", "30-35 mins"]
            const defaultDistances = ["1.2 km", "1 km", "0.8 km"]
            const defaultFeaturedPrice = 249

            if (fieldName === 'offer' && defaultOffers.includes(value)) return true
            if (fieldName === 'deliveryTime' && defaultDeliveryTimes.includes(value)) return true
            if (fieldName === 'distance' && defaultDistances.includes(value)) return true
            if (fieldName === 'featuredPrice' && value === defaultFeaturedPrice) return true

            return false
          }

          // Transform restaurants - filter out default values
          const restaurantsWithIds = restaurantsArray
            .filter((restaurant) => {
              const displayName = String(restaurant.restaurantName || restaurant.name || "").trim()
              const hasName = displayName.length > 0
              return hasName
            })
            .map((restaurant) => {
              let deliveryTime = restaurant.estimatedDeliveryTime || null
              let distance = restaurant.distance || null
              let offer = restaurant.offer || null

              if (isDefaultValue(deliveryTime, 'deliveryTime')) deliveryTime = null
              if (isDefaultValue(distance, 'distance')) distance = null
              if (isDefaultValue(offer, 'offer')) offer = null

              const cuisine = restaurant.cuisines && restaurant.cuisines.length > 0
                ? restaurant.cuisines.join(", ")
                : null

              const coverImages = restaurant.coverImages && restaurant.coverImages.length > 0
                ? restaurant.coverImages.map(img => normalizeImageUrl(img.url || img)).filter(Boolean)
                : []

              const fallbackImages = restaurant.menuImages && restaurant.menuImages.length > 0
                ? restaurant.menuImages.map(img => normalizeImageUrl(img.url || img)).filter(Boolean)
                : []

              const allImages = coverImages.length > 0
                ? coverImages
                : (fallbackImages.length > 0
                  ? fallbackImages
                  : (restaurant.profileImage?.url ? [normalizeImageUrl(restaurant.profileImage.url)] : []))

              const image = allImages[0] || null
              const restaurantId = restaurant.restaurantId || restaurant._id

              let featuredDish = restaurant.featuredDish || null
              let featuredPrice = restaurant.featuredPrice || null

              if (featuredPrice && isDefaultValue(featuredPrice, 'featuredPrice')) {
                featuredPrice = null
              }

              const restaurantName = (restaurant.restaurantName || restaurant.name || "").toLowerCase()

              return {
                id: restaurantId,
                name: restaurant.restaurantName || restaurant.name,
                cuisine: cuisine,
                rating: restaurant.rating || null,
                deliveryTime: deliveryTime,
                distance: distance,
                image: image,
                images: allImages,
                priceRange: restaurant.priceRange || null,
                featuredDish: featuredDish,
                featuredPrice: featuredPrice,
                offer: offer,
                slug: restaurant.slug || (restaurant.restaurantName || restaurant.name)?.toLowerCase().replace(/\s+/g, '-'),
                restaurantId: restaurantId,
                mongoId: restaurant._id || null,
                hasPaneer: false,
                category: 'all',
              }
            }).filter(Boolean)

          startTransition(() => {
            setRestaurantsData(restaurantsWithIds)
          })

          setIsEnrichingMenus(true)
          const enrichmentRequestId = ++menuEnrichmentRequestRef.current
          void (async () => {
            try {
              const transformedRestaurants = []

              for (let index = 0; index < restaurantsWithIds.length; index += 4) {
                const batchRestaurants = restaurantsWithIds.slice(index, index + 4)
                const batchResults = await Promise.all(
                  batchRestaurants.map(async (restaurant) => {
                    try {
                      const lookupIds = [
                        restaurant.restaurantId,
                        restaurant.id,
                        restaurant.mongoId,
                        restaurant.slug,
                      ]
                        .filter(Boolean)
                        .map((value) => String(value).trim())
                        .filter((value, valueIndex, arr) => arr.indexOf(value) === valueIndex)

                      let menu = null
                      for (const lookupId of lookupIds) {
                        try {
                          const menuResponse = await restaurantAPI.getMenuByRestaurantId(lookupId, { noCache: true })
                          const rawMenu = getMenuFromResponse(menuResponse)
                          const normalizedMenu = normalizeMenu(rawMenu)
                          if (menuResponse?.data?.success && normalizedMenu?.sections?.length > 0) {
                            menu = normalizedMenu
                            break
                          }
                        } catch (lookupError) {
                          if (lookupError?.response?.status !== 404) {
                            throw lookupError
                          }
                        }
                      }

                      if (!menu || menu.sections.length === 0) {
                        const approvedFoods = await fetchApprovedFoods()
                        menu = buildFallbackMenuFromFoods(approvedFoods, restaurant)
                      }

                      if (menu?.sections?.length > 0) {
                        const hasPaneer = checkCategoryInMenu(menu, 'paneer-tikka')

                        let featuredDish = restaurant.featuredDish
                        let featuredPrice = restaurant.featuredPrice

                        if (!featuredDish || !featuredPrice) {
                          for (const section of (menu.sections || [])) {
                            if (section.items && section.items.length > 0) {
                              const firstItem = section.items[0]
                              if (!featuredDish) featuredDish = firstItem.name
                              if (!featuredPrice) {
                                const originalPrice = firstItem.originalPrice || firstItem.price || 0
                                const discountPercent = firstItem.discountPercent || 0
                                featuredPrice = discountPercent > 0
                                  ? Math.round(originalPrice * (1 - discountPercent / 100))
                                  : originalPrice
                              }
                              break
                            }
                          }
                        }

                        return {
                          ...restaurant,
                          menu: menu,
                          hasPaneer: hasPaneer,
                          featuredDish: featuredDish || null,
                          featuredPrice: featuredPrice || null,
                          categoryMatches: {},
                        }
                      }
                    } catch (error) {
                      debugWarn(`Failed to fetch menu for restaurant ${restaurant.restaurantId}:`, error)
                    }

                    return {
                      ...restaurant,
                      menu: null,
                      hasPaneer: false,
                      categoryMatches: {},
                    }
                  })
                )

                if (enrichmentRequestId !== menuEnrichmentRequestRef.current) return
                transformedRestaurants.push(...batchResults)
              }

              if (enrichmentRequestId === menuEnrichmentRequestRef.current) {
                startTransition(() => {
                  setRestaurantsData(transformedRestaurants)
                })
              }
            } finally {
              if (enrichmentRequestId === menuEnrichmentRequestRef.current) {
                setIsEnrichingMenus(false)
              }
            }
          })()
        } else {
          setRestaurantsData([])
        }
      } catch (error) {
        debugError('Error fetching restaurants:', error)
        setRestaurantsData([])
      } finally {
        setLoadingRestaurants(false)
      }
    }

    fetchRestaurants()
  }, [zoneId, isOutOfService])

  // Update selected category when URL changes
  useEffect(() => {
    if (category && categories && categories.length > 0) {
      const categorySlug = category.toLowerCase()
      const matchedCategory = categories.find(cat =>
        cat.slug === categorySlug ||
        cat.id === categorySlug ||
        cat.name.toLowerCase().replace(/\s+/g, '-') === categorySlug
      )
      if (matchedCategory) {
        setSelectedCategory(matchedCategory.slug || matchedCategory.id)
      } else {
        setSelectedCategory(categorySlug)
      }
    } else if (category) {
      setSelectedCategory(category.toLowerCase())
    }
  }, [category, categories])

  useEffect(() => {
    if (typeof window === "undefined" || !currentFilterStorageKey) return

    hasRestoredCategoryFiltersRef.current = false

    try {
      const raw = window.localStorage.getItem(CATEGORY_PAGE_FILTERS_STORAGE_KEY)
      if (!raw) return

      const stored = JSON.parse(raw)
      const categoryState = stored?.[currentFilterStorageKey]
      if (!categoryState || typeof categoryState !== "object") return

      setSortBy(categoryState.sortBy || null)
      setActiveFilters(new Set(Array.isArray(categoryState.activeFilters) ? categoryState.activeFilters : []))
    } catch {
      setSortBy(null)
      setActiveFilters(new Set())
    } finally {
      hasRestoredCategoryFiltersRef.current = true
    }
  }, [currentFilterStorageKey])

  useEffect(() => {
    if (typeof window === "undefined" || !currentFilterStorageKey) return
    if (!hasRestoredCategoryFiltersRef.current) return

    try {
      const raw = window.localStorage.getItem(CATEGORY_PAGE_FILTERS_STORAGE_KEY)
      const stored = raw ? JSON.parse(raw) : {}
      stored[currentFilterStorageKey] = {
        sortBy,
        activeFilters: Array.from(activeFilters),
      }
      window.localStorage.setItem(CATEGORY_PAGE_FILTERS_STORAGE_KEY, JSON.stringify(stored))
    } catch {
      // Ignore storage failures and keep in-memory filters working.
    }
  }, [currentFilterStorageKey, sortBy, activeFilters])

  useEffect(() => {
    const rail = categoryScrollRef.current
    if (!rail) return

    const selectedButton = rail.querySelector("[data-category-selected='true']")
    if (!selectedButton || typeof selectedButton.scrollIntoView !== "function") return

    selectedButton.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    })
  }, [selectedCategory, categories])

  const toggleFilter = (filterId) => {
    setActiveFilters(prev => {
      const newSet = new Set(prev)
      if (newSet.has(filterId)) {
        newSet.delete(filterId)
      } else {
        newSet.add(filterId)
      }
      return newSet
    })
    // Show loading when filter is toggled
    setIsLoadingFilterResults(true)
    setTimeout(() => {
      setIsLoadingFilterResults(false)
    }, 500)
  }

  // Scroll tracking effect for filter modal
  useEffect(() => {
    if (!isFilterOpen || !rightContentRef.current) return

    const observerOptions = {
      root: rightContentRef.current,
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute('data-section-id')
          if (sectionId) {
            setActiveScrollSection(sectionId)
            setActiveFilterTab(sectionId)
          }
        }
      })
    }, observerOptions)

    Object.values(filterSectionRefs.current).forEach(ref => {
      if (ref) observer.observe(ref)
    })

    return () => observer.disconnect()
  }, [isFilterOpen])

  const toggleFavorite = (id) => {
    setFavorites(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // Filter restaurants based on active filters and selected category
  // If category is selected, expand restaurants into dish cards (one card per matching dish)
  const filteredRecommended = useMemo(() => {
    const sourceData = restaurantsData.length > 0 ? restaurantsData : []
    let filtered = [...sourceData]

    // Filter by category - Dynamic filtering based on menu items
    if (selectedCategory && selectedCategory !== 'all') {
      const expandedDishes = []

      filtered.forEach(r => {
        if (r.menu) {
          const hasCategoryItem = checkCategoryInMenu(r.menu, selectedCategory)
          if (hasCategoryItem) {
            // Get ALL matching dishes for this category
            const categoryDishes = getAllCategoryDishesFromMenu(r.menu, selectedCategory)

            if (categoryDishes.length > 0) {
              const validDishes = vegMode
                ? categoryDishes.filter((dish) => dish.foodType === "Veg")
                : categoryDishes;

              validDishes.forEach((dishForCard) => {
                expandedDishes.push({
                  ...r,
                  id: `${r.id || r.restaurantId}-${dishForCard.itemId}`,
                  dishId: dishForCard.itemId || `${r.id}-dish`,
                  categoryDish: dishForCard,
                  categoryDishName: dishForCard.name,
                  categoryDishPrice: dishForCard.price,
                  categoryDishImage: dishForCard.image,
                })
              })
            }
          }
        }
      })

      filtered = expandedDishes

      if (filtered.length === 0) {
        const fallbackDishes = getCategoryFallbackDishesFromApprovedFoods(selectedCategory, sourceData)
        filtered = vegMode
          ? fallbackDishes.filter((dish) => dish.categoryDishFoodType === "Veg")
          : fallbackDishes
      }
    }

    return applyFiltersAndSorting(filtered)
  }, [selectedCategory, activeFilters, deferredSearchQuery, restaurantsData, categoryKeywords, vegMode, approvedFoodsData, sortBy])

  const filteredAllRestaurants = useMemo(() => {
    const sourceData = restaurantsData.length > 0 ? restaurantsData : []
    let filtered = [...sourceData]

    // Filter by category - Dynamic filtering based on menu items
    // If category is selected, expand restaurants into dish cards (one card per matching dish)
    if (selectedCategory && selectedCategory !== 'all') {
      const expandedDishes = []

      filtered.forEach(r => {
        if (r.menu) {
          const hasCategoryItem = checkCategoryInMenu(r.menu, selectedCategory)
          if (hasCategoryItem) {
            // Get ALL matching dishes for this category
            const categoryDishes = getAllCategoryDishesFromMenu(r.menu, selectedCategory)

            if (categoryDishes.length > 0) {
              const validDishes = vegMode
                ? categoryDishes.filter((dish) => dish.foodType === "Veg")
                : categoryDishes;

              validDishes.forEach((dishForCard) => {
                expandedDishes.push({
                  ...r,
                  id: `${r.id || r.restaurantId}-${dishForCard.itemId}`,
                  dishId: dishForCard.itemId || `${r.id}-dish`,
                  categoryDish: dishForCard,
                  categoryDishName: dishForCard.name,
                  categoryDishPrice: dishForCard.price,
                  categoryDishImage: dishForCard.image,
                })
              })
            }
          }
        }
      })

      filtered = expandedDishes

      if (filtered.length === 0) {
        const fallbackDishes = getCategoryFallbackDishesFromApprovedFoods(selectedCategory, sourceData)
        filtered = vegMode
          ? fallbackDishes.filter((dish) => dish.categoryDishFoodType === "Veg")
          : fallbackDishes
      }
    }

    return applyFiltersAndSorting(filtered)
  }, [selectedCategory, activeFilters, deferredSearchQuery, restaurantsData, categoryKeywords, vegMode, approvedFoodsData, sortBy])

  const showRestaurantSkeleton = useDelayedLoading(
    isLoadingFilterResults || loadingRestaurants || (isEnrichingMenus && selectedCategory !== 'all' && filteredRecommended.length === 0),
    { delay: 140, minDuration: 360 }
  )

  const handleCategorySelect = (category) => {
    const categorySlug = category.slug || category.id
    setSelectedCategory(categorySlug)
    // Update URL to reflect category change
    if (categorySlug === 'all') {
      navigate('/user/category/all')
    } else {
      navigate(`/user/category/${categorySlug}`)
    }
  }

  // Check if should show grayscale (user out of service)
  const shouldShowGrayscale = isOutOfService
  const isCategoryView = selectedCategory && selectedCategory !== 'all'

  return (
    <div className={`min-h-screen bg-white dark:bg-[#0a0a0a] ${shouldShowGrayscale ? 'grayscale opacity-75' : ''}`}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 shadow-sm">
        <div className="max-w-7xl mx-auto">
          {/* Search Bar with Back Button */}
          <div className="flex items-center gap-2 px-3 md:px-6 py-3 border-b border-gray-100 dark:border-gray-800">
            <button
              onClick={() => navigate('/user')}
              className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </button>

            <div className="flex-1 relative max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Restaurant name or a dish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 h-11 md:h-12 rounded-lg border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1a] focus:bg-white dark:focus:bg-[#2a2a2a] focus:border-gray-500 dark:focus:border-gray-600 text-sm md:text-base dark:text-white placeholder:text-gray-600 dark:placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Browse Category Section */}
          <div
            ref={categoryScrollRef}
            className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide px-4 md:px-6 py-3 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {showCategorySkeleton ? (
              <CategoryChipRowSkeleton className="py-3" />
            ) : (
              categories && categories.length > 0 ? categories.map((cat) => {
                const categorySlug = cat.slug || cat.id
                const isSelected = selectedCategory === categorySlug || selectedCategory === cat.id
                const isAllCategory = categorySlug === "all" || cat.id === "all"
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat)}
                    data-category-selected={isSelected ? "true" : "false"}
                    className={`flex flex-col items-center gap-1.5 flex-shrink-0 pb-2 transition-all ${isSelected ? 'border-b-2 border-[#FE5502]' : ''
                      }`}
                  >
                    {isAllCategory ? (
                      <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full border-2 transition-all flex items-center justify-center ${isSelected ? 'border-[#FE5502] shadow-lg bg-[#FFF5F5] dark:bg-[#FE5502]/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#222222]'}`}>
                        <Grid2x2 className={`h-6 w-6 md:h-7 md:w-7 ${isSelected ? 'text-[#FE5502]' : 'text-gray-500 dark:text-gray-400'}`} />
                      </div>
                    ) : cat.image ? (
                  <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 transition-all ${isSelected ? 'border-[#FE5502] shadow-lg' : 'border-transparent'
                        }`}>
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // If the backend image is missing/broken, show initials instead of fake assets.
                            e.target.style.display = 'none'
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        className={`w-16 h-16 md:w-20 md:h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center border-2 transition-all ${isSelected ? 'border-[#FE5502] shadow-lg bg-[#FFF5F5] dark:bg-[#FE5502]/20' : 'border-transparent'
                          }`}
                        aria-label={`${cat.name} category`}
                      >
                        <span className="text-sm md:text-base font-semibold text-gray-600 dark:text-gray-300">
                          {String(cat.name || "?").trim().slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className={`text-xs md:text-sm font-medium whitespace-nowrap ${isSelected ? 'text-[#FE5502] dark:text-[#FE5502]' : 'text-gray-600 dark:text-gray-400'
                      }`}>
                      {cat.name}
                    </span>
                  </button>
                )
              }) : (
                <div className="flex items-center justify-center py-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400">No categories available</span>
                </div>
              )
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row md:flex-wrap gap-2 px-4 md:px-6 py-3">
            {/* Row 1 */}
            <div
              className="flex items-center gap-2 overflow-x-auto md:overflow-x-visible scrollbar-hide pb-1 md:pb-0"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              <Button
                variant="outline"
                onClick={() => setIsFilterOpen(true)}
                className="h-7 md:h-8 px-2.5 md:px-3 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span className="text-xs md:text-sm font-bold text-black dark:text-white">Filters</span>
              </Button>
              {[
                { id: 'under-30-mins', label: 'Under 30 mins' },
                { id: 'delivery-under-45', label: 'Under 45 mins' },
                { id: 'rating-4-plus', label: 'Rating 4.0+' },
                { id: 'rating-45-plus', label: 'Rating 4.5+' },
              ].map((filter) => {
                const isActive = activeFilters.has(filter.id)
                return (
                  <Button
                    key={filter.id}
                    variant="outline"
                    onClick={() => toggleFilter(filter.id)}
                    className={`h-7 md:h-8 px-2.5 md:px-3 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${isActive
                      ? 'bg-[#FE5502] text-white border border-[#FE5502] hover:bg-[#C83C00]'
                      : 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                  >
                    <span className={`text-xs md:text-sm text-black dark:text-white font-bold ${isActive ? 'text-white' : 'text-black dark:text-white'}`}>{filter.label}</span>
                  </Button>
                )
              })}
            </div>

            {/* Row 2 */}
            <div
              className="flex items-center gap-2 overflow-x-auto md:overflow-x-visible scrollbar-hide pb-1 md:pb-0"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {[
                { id: 'distance-under-1km', label: 'Under 1km', icon: MapPin },
                { id: 'distance-under-2km', label: 'Under 2km', icon: MapPin },
                { id: 'flat-50-off', label: 'Flat 50% OFF' },
                { id: 'under-250', label: 'Under ₹250' },
              ].map((filter) => {
                const Icon = filter.icon
                const isActive = activeFilters.has(filter.id)
                return (
                  <Button
                    key={filter.id}
                    variant="outline"
                    onClick={() => toggleFilter(filter.id)}
                    className={`h-7 md:h-8 px-2.5 md:px-3 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${isActive
                      ? 'bg-[#FE5502] text-white border border-[#FE5502] hover:bg-[#C83C00]'
                      : 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                  >
                    {Icon && <Icon className={`h-3.5 w-3.5 md:h-4 md:w-4 ${isActive ? 'text-white' : 'text-gray-900 dark:text-white'}`} />}
                    <span className={`text-xs md:text-sm font-bold ${isActive ? 'text-white' : 'text-black dark:text-white'}`}>{filter.label}</span>
                  </Button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-4 sm:py-6 md:py-8 lg:py-10 space-y-6 md:space-y-8 lg:space-y-10">
        <div className="max-w-7xl mx-auto">
          {/* RECOMMENDED FOR YOU Section - Hide when "All" category is selected */}
          {filteredRecommended.length > 0 && selectedCategory !== 'all' && (
            <section>
              <h2 className="text-xs sm:text-sm md:text-base font-semibold text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-4 md:mb-6">
                RECOMMENDED FOR YOU
              </h2>

              {/* Small Restaurant Cards - Grid - Show all dishes when category is selected */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4">
                {(isCategoryView
                  ? filteredRecommended
                  : filteredRecommended.slice(0, 6)
                ).map((restaurant) => {
                  return (
                    <Link
                      key={restaurant.id}
                      to={`/user/restaurants/${restaurant.name.toLowerCase().replace(/\s+/g, '-')}`}
                      className="block"
                    >
                      <div className={`group ${shouldShowGrayscale ? 'grayscale opacity-75' : ''}`}>
                        {/* Image Container */}
                        <div className="relative aspect-square rounded-xl md:rounded-2xl overflow-hidden mb-2">
                          {/* Use category dish image if available, otherwise restaurant image */}
                          {restaurant.categoryDishImage ? (
                            <img
                              src={restaurant.categoryDishImage}
                              alt={restaurant.categoryDishName || restaurant.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                // Fallback to restaurant image if dish image fails
                                if (restaurant.image) {
                                  e.target.src = restaurant.image
                                } else {
                                  // Show emoji placeholder
                                  e.target.style.display = 'none'
                                  const placeholder = document.createElement('div')
                                  placeholder.className = 'w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-6xl'
                                  placeholder.textContent = '???'
                                  e.target.parentElement.appendChild(placeholder)
                                }
                              }}
                            />
                          ) : restaurant.image ? (
                            <img
                              src={restaurant.image}
                              alt={restaurant.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                // Show emoji placeholder
                                e.target.style.display = 'none'
                                const placeholder = document.createElement('div')
                                placeholder.className = 'w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-6xl'
                                placeholder.textContent = '???'
                                e.target.parentElement.appendChild(placeholder)
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-6xl">
                              ???
                            </div>
                          )}

                          {/* Offer Badge */}
                          {restaurant.offer && (
                            <div className="absolute top-1.5 left-1.5 bg-gradient-to-r from-[#FE5502] to-[#C83C00] text-white text-[10px] md:text-xs font-semibold px-1.5 py-0.5 rounded shadow-sm">
                              {restaurant.offer}
                            </div>
                          )}

                          {/* Rating Badge (NOW ON IMAGE, bottom-left with white border) */}
                          <div className="absolute bottom-0 left-0 bg-green-600 border-[4px] rounded-md border-white text-white text-[11px] md:text-xs font-bold px-1.5 py-0.5 flex items-center gap-0.5">
                            {restaurant.rating}
                            <Star className="h-2.5 w-2.5 md:h-3 md:w-3 fill-white" />
                          </div>
                        </div>

                        <h3 className="font-semibold text-gray-900 dark:text-white text-xs md:text-sm line-clamp-1">
                          {isCategoryView ? (restaurant.categoryDishName || restaurant.featuredDish || restaurant.name) : restaurant.name}
                        </h3>
                        {isCategoryView && (
                          <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                            {restaurant.name}
                          </p>
                        )}
                        {restaurant.deliveryTime && (
                          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-[10px] md:text-xs">
                            <Clock className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            <span>{restaurant.deliveryTime}</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* ALL RESTAURANTS Section */}
          <section className="relative">
            <h2 className="text-xs sm:text-sm md:text-base font-semibold text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-4 md:mb-6">
              ALL RESTAURANTS
            </h2>

            {/* Loading Overlay */}
            {showRestaurantSkeleton && (
              <div className="absolute inset-0 z-10 rounded-lg bg-white/92 backdrop-blur-sm dark:bg-[#1a1a1a]/92">
                <LoadingSkeletonRegion label="Loading restaurants" className="h-full p-1 sm:p-2">
                  <RestaurantGridSkeleton count={4} compact />
                </LoadingSkeletonRegion>
              </div>
            )}

            {/* Large Restaurant Cards */}
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 lg:gap-6 xl:gap-7 items-stretch ${showRestaurantSkeleton ? 'opacity-50' : 'opacity-100'} transition-opacity duration-300`}>
              {filteredAllRestaurants.map((restaurant) => {
                const restaurantSlug = restaurant.name.toLowerCase().replace(/\s+/g, "-")
                const isFavorite = favorites.has(restaurant.id)

                return (
                  <Link key={restaurant.id} to={`/user/restaurants/${restaurantSlug}`} className="h-full flex">
                    <Card className={`overflow-hidden cursor-pointer gap-0 border-0 dark:border-gray-800 group bg-white dark:bg-[#1a1a1a] shadow-md hover:shadow-xl transition-all duration-300 py-0 rounded-md h-full flex flex-col w-full ${shouldShowGrayscale ? 'grayscale opacity-75' : ''
                      }`}>
                      {/* Image Section */}
                      <div className="relative h-44 sm:h-52 md:h-60 lg:h-64 xl:h-72 w-full overflow-hidden rounded-t-md flex-shrink-0">
                        {/* Use category dish image if available, otherwise restaurant image */}
                        {restaurant.categoryDishImage ? (
                          <img
                            src={restaurant.categoryDishImage}
                            alt={restaurant.categoryDishName || restaurant.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              // Fallback to restaurant image if dish image fails
                              if (restaurant.image) {
                                e.target.src = restaurant.image
                              } else {
                                // Show emoji placeholder
                                e.target.style.display = 'none'
                                const placeholder = document.createElement('div')
                                placeholder.className = 'w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-6xl'
                                placeholder.textContent = '???'
                                e.target.parentElement.appendChild(placeholder)
                              }
                            }}
                          />
                        ) : restaurant.image ? (
                          <img
                            src={restaurant.image}
                            alt={restaurant.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              // Show emoji placeholder
                              e.target.style.display = 'none'
                              const placeholder = document.createElement('div')
                              placeholder.className = 'w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-6xl'
                              placeholder.textContent = '???'
                              e.target.parentElement.appendChild(placeholder)
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-6xl">
                            ???
                          </div>
                        )}

                        {/* Category Dish Badge - Top Left (shows category dish if available, otherwise featured dish) */}
                        {(isCategoryView ? restaurant.categoryDishPrice : (restaurant.categoryDishName || restaurant.featuredDish)) && (
                          <div className="absolute top-3 left-3">
                            <div className="bg-gray-800/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs sm:text-sm md:text-base font-medium">
                              {isCategoryView
                                ? `₹${restaurant.categoryDishPrice || restaurant.featuredPrice || 0}`
                                : `${restaurant.categoryDishName || restaurant.featuredDish} • ₹${restaurant.categoryDishPrice || restaurant.featuredPrice}`}
                            </div>
                          </div>
                        )}

                        {/* Ad Badge */}
                        {restaurant.isAd && (
                          <div className="absolute top-3 right-14 bg-black/50 text-white text-[10px] md:text-xs px-2 py-0.5 rounded">
                            Ad
                          </div>
                        )}

                        {/* Bookmark Icon - Top Right */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-3 right-3 h-9 w-9 md:h-10 md:w-10 bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur-sm rounded-lg hover:bg-white dark:hover:bg-[#2a2a2a] transition-colors"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            toggleFavorite(restaurant.id)
                          }}
                        >
                          <Bookmark className={`h-5 w-5 md:h-6 md:w-6 ${isFavorite ? "fill-gray-800 dark:fill-gray-200 text-gray-800 dark:text-gray-200" : "text-gray-600 dark:text-gray-400"}`} strokeWidth={2} />
                        </Button>
                      </div>

                      {/* Content Section */}
                      <CardContent className="p-3 sm:p-4 md:p-5 lg:p-6 gap-0 flex-1 flex flex-col">
                        {/* Restaurant Name & Rating */}
                        <div className="flex items-start justify-between gap-2 mb-2 lg:mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-md md:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white line-clamp-1 lg:line-clamp-2">
                              {isCategoryView ? (restaurant.categoryDishName || restaurant.featuredDish || restaurant.name) : restaurant.name}
                            </h3>
                            {isCategoryView && (
                              <p className="mt-1 text-sm md:text-base text-gray-500 dark:text-gray-400 line-clamp-1">
                                {restaurant.name}
                              </p>
                            )}
                          </div>
                          <div className="flex-shrink-0 bg-green-600 text-white px-2 md:px-3 lg:px-4 py-1 lg:py-1.5 rounded-lg flex items-center gap-1">
                            <span className="text-sm md:text-base lg:text-lg font-bold">{restaurant.rating}</span>
                            <Star className="h-3 w-3 md:h-4 md:w-4 lg:h-5 lg:w-5 fill-white text-white" />
                          </div>
                        </div>

                        {/* Delivery Time & Distance */}
                        {(restaurant.deliveryTime || restaurant.distance) && (
                          <div className="flex items-center gap-1 text-sm md:text-base lg:text-lg text-gray-500 dark:text-gray-400 mb-2 lg:mb-3">
                            {restaurant.deliveryTime && (
                              <>
                                <Clock className="h-4 w-4 md:h-5 md:w-5 lg:h-6 lg:w-6" strokeWidth={1.5} />
                                <span className="font-medium">{restaurant.deliveryTime}</span>
                              </>
                            )}
                            {restaurant.deliveryTime && restaurant.distance && <span className="mx-1">|</span>}
                            {restaurant.distance && (
                              <span className="font-medium">{restaurant.distance}</span>
                            )}
                          </div>
                        )}

                        {/* Offer Badge */}
                        {restaurant.offer && (
                          <div className="flex items-center gap-2 text-sm md:text-base lg:text-lg mt-auto">
                            <BadgePercent className="h-4 w-4 md:h-5 md:w-5 lg:h-6 lg:w-6 text-[#FE5502]" strokeWidth={2} />
                            <span className="text-gray-700 dark:text-gray-300 font-medium">{restaurant.offer}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>

            {/* Empty State */}
            {filteredAllRestaurants.length === 0 && (
              <div className="text-center py-12 md:py-16">
                <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base">
                  {searchQuery
                    ? `No restaurants found for "${searchQuery}"`
                    : "No restaurants found with selected filters"}
                </p>
                <Button
                  variant="outline"
                  className="mt-4 md:mt-6"
                  onClick={() => {
                    setIsLoadingFilterResults(true)
                    setActiveFilters(new Set())
                    setSearchQuery("")
                    setSortBy(null)
                    // Trigger a gentle refresh to ensure data freshness
                    menuEnrichmentRequestRef.current += 1
                    setIsEnrichingMenus(false)
                    setTimeout(() => setIsLoadingFilterResults(false), 500)
                  }}
                >
                  Clear all filters
                </Button>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Filter Modal - Bottom Sheet */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isFilterOpen && (
              <div className="fixed inset-0 z-[100]">
                {/* Backdrop */}
                <div
                  className="absolute inset-0 bg-black/50"
                  onClick={() => setIsFilterOpen(false)}
                />

                {/* Modal Content */}
                <div className="absolute bottom-0 left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-4xl bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl max-h-[85vh] md:max-h-[90vh] flex flex-col animate-[slideUp_0.3s_ease-out]">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">Filters and sorting</h2>
                    <button
                      onClick={() => {
                        setIsLoadingFilterResults(true)
                        setActiveFilters(new Set())
                        setSortBy(null)
                        setTimeout(() => setIsLoadingFilterResults(false), 500)
                      }}
                      className="text-[#FE5502] font-medium text-sm md:text-base hover:underline"
                    >
                      Clear all
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar - Tabs */}
                    <div className="w-24 sm:w-28 md:w-32 bg-gray-50 dark:bg-[#0a0a0a] border-r border-gray-200 dark:border-gray-800 flex flex-col">
                      {[
                        { id: 'sort', label: 'Sort By', icon: ArrowDownUp },
                        { id: 'time', label: 'Time', icon: Timer },
                        { id: 'rating', label: 'Rating', icon: Star },
                        { id: 'distance', label: 'Distance', icon: MapPin },
                        { id: 'price', label: 'Dish Price', icon: IndianRupee },
                        { id: 'offers', label: 'Offers', icon: BadgePercent },
                        { id: 'trust', label: 'Trust', icon: ShieldCheck },
                      ].map((tab) => {
                        const Icon = tab.icon
                        const isActive = activeScrollSection === tab.id || activeFilterTab === tab.id
                        return (
                          <button
                            key={tab.id}
                            onClick={() => {
                              setActiveFilterTab(tab.id)
                              const section = filterSectionRefs.current[tab.id]
                              if (section) {
                                section.scrollIntoView({ behavior: 'smooth', block: 'start' })
                              }
                            }}
                            className={`flex flex-col items-center gap-1 py-4 px-2 text-center relative transition-colors ${isActive ? 'bg-white dark:bg-[#1a1a1a] text-[#FE5502]' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                              }`}
                          >
                            {isActive && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#FE5502] rounded-r" />
                            )}
                            <Icon className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1.5} />
                            <span className="text-xs md:text-sm font-medium leading-tight">{tab.label}</span>
                          </button>
                        )
                      })}
                    </div>

                    {/* Right Content Area - Scrollable */}
                    <div ref={rightContentRef} className="flex-1 overflow-y-auto p-4 md:p-6">
                      {/* Sort By Tab */}
                      <div
                        ref={el => filterSectionRefs.current['sort'] = el}
                        data-section-id="sort"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4">Sort by</h3>
                        <div className="flex flex-col gap-3">
                          {[
                            { id: null, label: 'Relevance' },
                            { id: 'price-low', label: 'Price: Low to High' },
                            { id: 'price-high', label: 'Price: High to Low' },
                            { id: 'rating-high', label: 'Rating: High to Low' },
                            { id: 'rating-low', label: 'Rating: Low to High' },
                          ].map((option) => (
                            <button
                              key={option.id || 'relevance'}
                              onClick={() => setSortBy(option.id)}
                              className={`px-4 md:px-5 py-3 md:py-4 rounded-xl border text-left transition-colors ${sortBy === option.id
                                ? 'border-[#FE5502] bg-[#FFF5F5] dark:bg-[#FE5502]/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-[#FE5502]'
                                }`}
                            >
                              <span className={`text-sm md:text-base font-medium ${sortBy === option.id ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                {option.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Time Tab */}
                      <div
                        ref={el => filterSectionRefs.current['time'] = el}
                        data-section-id="time"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4">Estimated Time</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                          <button
                            onClick={() => toggleFilter('under-30-mins')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('under-30-mins')
                              ? 'border-[#FE5502] bg-[#FFF5F5] dark:bg-[#FE5502]/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-[#FE5502]'
                              }`}
                          >
                            <Timer className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('under-30-mins') ? 'text-[#FE5502]' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('under-30-mins') ? 'text-[#FE5502]' : 'text-gray-700 dark:text-gray-300'}`}>Under 30 mins</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('delivery-under-45')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('delivery-under-45')
                              ? 'border-[#FE5502] bg-[#FFF5F5] dark:bg-[#FE5502]/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-[#FE5502]'
                              }`}
                          >
                            <Timer className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('delivery-under-45') ? 'text-[#FE5502]' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('delivery-under-45') ? 'text-[#FE5502]' : 'text-gray-700 dark:text-gray-300'}`}>Under 45 mins</span>
                          </button>
                        </div>
                      </div>

                      {/* Rating Tab */}
                      <div
                        ref={el => filterSectionRefs.current['rating'] = el}
                        data-section-id="rating"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4">Restaurant Rating</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                          <button
                            onClick={() => toggleFilter('rating-35-plus')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('rating-35-plus')
                              ? 'border-[#FE5502] bg-[#FFF5F5] dark:bg-[#FE5502]/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-[#FE5502]'
                              }`}
                          >
                            <Star className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('rating-35-plus') ? 'text-[#FE5502] fill-[#FE5502]' : 'text-gray-400 dark:text-gray-500'}`} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('rating-35-plus') ? 'text-[#FE5502]' : 'text-gray-700 dark:text-gray-300'}`}>Rated 3.5+</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('rating-4-plus')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('rating-4-plus')
                              ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-600'
                              }`}
                          >
                            <Star className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('rating-4-plus') ? 'text-[#FE5502] fill-[#FE5502]' : 'text-gray-400 dark:text-gray-500'}`} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('rating-4-plus') ? 'text-[#FE5502]' : 'text-gray-700 dark:text-gray-300'}`}>Rated 4.0+</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('rating-45-plus')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('rating-45-plus')
                              ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-600'
                              }`}
                          >
                            <Star className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('rating-45-plus') ? 'text-[#FE5502] fill-[#FE5502]' : 'text-gray-400 dark:text-gray-500'}`} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('rating-45-plus') ? 'text-[#FE5502]' : 'text-gray-700 dark:text-gray-300'}`}>Rated 4.5+</span>
                          </button>
                        </div>
                      </div>

                      {/* Distance Tab */}
                      <div
                        ref={el => filterSectionRefs.current['distance'] = el}
                        data-section-id="distance"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4">Distance</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                          <button
                            onClick={() => toggleFilter('distance-under-1km')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('distance-under-1km')
                              ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-600'
                              }`}
                          >
                            <MapPin className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('distance-under-1km') ? 'text-[#FE5502]' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('distance-under-1km') ? 'text-[#FE5502]' : 'text-gray-700 dark:text-gray-300'}`}>Under 1 km</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('distance-under-2km')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('distance-under-2km')
                              ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-600'
                              }`}
                          >
                            <MapPin className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('distance-under-2km') ? 'text-[#FE5502]' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('distance-under-2km') ? 'text-[#FE5502]' : 'text-gray-700 dark:text-gray-300'}`}>Under 2 km</span>
                          </button>
                        </div>
                      </div>

                      {/* Price Tab */}
                      <div
                        ref={el => filterSectionRefs.current['price'] = el}
                        data-section-id="price"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4">Dish Price</h3>
                        <div className="flex flex-col gap-3 md:gap-4">
                          <button
                            onClick={() => toggleFilter('price-under-200')}
                            className={`px-4 md:px-5 py-3 md:py-4 rounded-xl border text-left transition-colors ${activeFilters.has('price-under-200')
                              ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-600'
                              }`}
                          >
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('price-under-200') ? 'text-[#FE5502]' : 'text-gray-700 dark:text-gray-300'}`}>Under ₹200</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('under-250')}
                            className={`px-4 md:px-5 py-3 md:py-4 rounded-xl border text-left transition-colors ${activeFilters.has('under-250')
                              ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-600'
                              }`}
                          >
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('under-250') ? 'text-[#FE5502]' : 'text-gray-700 dark:text-gray-300'}`}>Under ₹250</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('price-under-500')}
                            className={`px-4 md:px-5 py-3 md:py-4 rounded-xl border text-left transition-colors ${activeFilters.has('price-under-500')
                              ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-600'
                              }`}
                          >
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('price-under-500') ? 'text-[#FE5502]' : 'text-gray-700 dark:text-gray-300'}`}>Under ₹500</span>
                          </button>
                        </div>
                      </div>

                      {/* Offers Tab */}
                      <div
                        ref={el => filterSectionRefs.current['offers'] = el}
                        data-section-id="offers"
                        className="space-y-4 mb-8"
                      >
                        <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4">Offers</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                          <button
                            onClick={() => toggleFilter('flat-50-off')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('flat-50-off')
                              ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-600'
                              }`}
                          >
                            <BadgePercent className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('flat-50-off') ? 'text-[#FE5502]' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('flat-50-off') ? 'text-[#FE5502]' : 'text-gray-700 dark:text-gray-300'}`}>Flat 50% OFF</span>
                          </button>
                          <button
                            onClick={() => toggleFilter('price-match')}
                            className={`flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl border transition-colors ${activeFilters.has('price-match')
                              ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-green-600'
                              }`}
                          >
                            <BadgePercent className={`h-6 w-6 md:h-7 md:w-7 ${activeFilters.has('price-match') ? 'text-[#FE5502]' : 'text-gray-600 dark:text-gray-400'}`} strokeWidth={1.5} />
                            <span className={`text-sm md:text-base font-medium ${activeFilters.has('price-match') ? 'text-[#FE5502]' : 'text-gray-700 dark:text-gray-300'}`}>Price Match</span>
                          </button>
                        </div>
                      </div>

                      {/* Trust Markers Tab */}
                      {activeFilterTab === 'trust' && (
                        <div className="space-y-4">
                          <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">Trust Markers</h3>
                          <div className="flex flex-col gap-3 md:gap-4">
                            <button className="px-4 md:px-5 py-3 md:py-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-[#FE5502] text-left transition-colors">
                              <span className="text-sm md:text-base font-medium text-gray-700 dark:text-gray-300">Top Rated</span>
                            </button>
                            <button className="px-4 md:px-5 py-3 md:py-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-[#FE5502] text-left transition-colors">
                              <span className="text-sm md:text-base font-medium text-gray-700 dark:text-gray-300">Trusted by 1000+ users</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center gap-4 px-4 md:px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1a1a]">
                    <button
                      onClick={() => setIsFilterOpen(false)}
                      className="flex-1 py-3 md:py-4 text-center font-semibold text-gray-700 dark:text-gray-300 text-sm md:text-base"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        setIsLoadingFilterResults(true)
                        setIsFilterOpen(false)
                        // Simulate loading for 500ms
                        setTimeout(() => {
                          setIsLoadingFilterResults(false)
                        }, 500)
                      }}
                      className={`flex-1 py-3 md:py-4 font-semibold rounded-xl transition-colors text-sm md:text-base ${activeFilters.size > 0 || sortBy
                        ? 'bg-[#FE5502] text-white hover:bg-[#C83C00]'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}
                    >
                      {activeFilters.size > 0 || sortBy
                        ? 'Show results'
                        : 'Show results'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      <style>{`
        @keyframes slideUp {
          0% {
            transform: translateY(100%);
          }
          100% {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

