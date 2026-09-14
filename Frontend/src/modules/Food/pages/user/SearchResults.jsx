import { useState, useMemo, useRef, useEffect, startTransition, useDeferredValue } from "react"
import { useSearchParams, Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Star, Clock, Search, SlidersHorizontal, ChevronDown, Bookmark, BadgePercent, Mic, Grid2x2 } from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { RestaurantGridSkeleton } from "@food/components/ui/loading-skeletons"
import MiniCart from "@food/components/user/MiniCart"
import { useProfile } from "@food/context/ProfileContext"
import { useLocation } from "@food/hooks/useLocation"
import { useZone } from "@food/hooks/useZone"
import { restaurantAPI, adminAPI } from "@food/api"
import { useDelayedLoading } from "@food/hooks/useDelayedLoading"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

// Filter options
const filterOptions = [
  { id: 'under-30-mins', label: 'Under 30 mins' },
  { id: 'price-match', label: 'Price Match', hasIcon: true },
  { id: 'flat-50-off', label: 'Flat 50% OFF', hasIcon: true },
  { id: 'under-250', label: 'Under ₹250' },
  { id: 'rating-4-plus', label: 'Rating 4.0+' },
]
const SEARCH_HISTORY_KEY = "user_recent_searches_v1"

// Mock data removed - using backend data only

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get("q") || ""
  const navigate = useNavigate()
  const { location } = useLocation()
  const { zoneId, isOutOfService } = useZone(location)
  const [searchQuery, setSearchQuery] = useState(query)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [activeFilters, setActiveFilters] = useState(new Set())
  const [favorites, setFavorites] = useState(new Set())
  const categoryScrollRef = useRef(null)
  const menuEnrichmentRequestRef = useRef(0)
  const [restaurantsData, setRestaurantsData] = useState([])
  const [loadingRestaurants, setLoadingRestaurants] = useState(true)
  const [categories, setCategories] = useState([
    { id: 'all', name: "All", image: "" }
  ])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [categoryKeywords, setCategoryKeywords] = useState({})
  const showRestaurantSkeleton = useDelayedLoading(loadingRestaurants)
  const deferredQuery = useDeferredValue(query)
  const slugify = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  const uniqueRestaurants = (list) => {
    const seen = new Set()
    return list.filter((restaurant) => {
      const key = restaurant?.id || restaurant?.restaurantId || slugify(restaurant?.name)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  // Fetch categories from admin API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true)
        const response = await adminAPI.getPublicCategories(zoneId ? { zoneId } : {})

        if (response.data && response.data.success && response.data.data && response.data.data.categories) {
          const categoriesArray = response.data.data.categories

          // Transform API categories to match expected format
          const transformedCategories = [
            { id: 'all', name: "All", image: "" },
            ...categoriesArray.map((cat) => ({
              id: cat.slug || cat.id,
              name: cat.name,
              image: cat.image || cat.imageUrl || "",
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
            // Split by common separators and use individual words
            const words = categoryName.split(/[\s-]+/).filter(w => w.length > 0)
            keywordsMap[categoryId] = [categoryName, ...words]
          })

          setCategoryKeywords(keywordsMap)
        }
      } catch (error) {
        debugError('Error fetching categories:', error)
        // Keep default "All" category on error
      } finally {
        setLoadingCategories(false)
      }
    }

    fetchCategories()
  }, [zoneId])

  // Helper function to check if menu has dishes matching category keywords
  const checkCategoryInMenu = (menu, categoryId) => {
    if (!menu || !menu.sections || !Array.isArray(menu.sections)) {
      return false
    }

    // Get keywords for this category
    const keywords = categoryKeywords[categoryId] || []
    if (keywords.length === 0) {
      return false
    }

    // Check sections and items for category keywords
    for (const section of menu.sections) {
      // Check section name
      const sectionNameLower = (section.name || '').toLowerCase()
      if (keywords.some(keyword => sectionNameLower.includes(keyword))) {
        return true
      }

      // Check items in section
      if (section.items && Array.isArray(section.items)) {
        for (const item of section.items) {
          // Check item name
          const itemNameLower = (item.name || '').toLowerCase()
          if (keywords.some(keyword => itemNameLower.includes(keyword))) {
            return true
          }
          // Check item category
          const itemCategoryLower = (item.category || '').toLowerCase()
          if (keywords.some(keyword => itemCategoryLower.includes(keyword))) {
            return true
          }
        }
      }
    }

    return false
  }

  // Helper function to get featured dish for a category from menu
  const getCategoryDishFromMenu = (menu, categoryId) => {
    if (!menu || !menu.sections || !Array.isArray(menu.sections)) {
      return null
    }

    const keywords = categoryKeywords[categoryId] || []
    if (keywords.length === 0) {
      return null
    }

    // Find first matching item
    for (const section of menu.sections) {
      if (section.items && Array.isArray(section.items)) {
        for (const item of section.items) {
          const itemNameLower = (item.name || '').toLowerCase()
          const itemCategoryLower = (item.category || '').toLowerCase()

          if (keywords.some(keyword =>
            itemNameLower.includes(keyword) || itemCategoryLower.includes(keyword)
          )) {
            return item.name
          }
        }
      }
    }

    return null
  }

  // Fetch restaurants from API
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        setLoadingRestaurants(true)
        debugLog('?? Fetching restaurants from API...')
        // Optional: Add zoneId if available (for sorting/filtering, but show all restaurants)
        const params = {}
        if (zoneId) {
          params.zoneId = zoneId
        }
        const response = await restaurantAPI.getRestaurants(params)

        debugLog('?? Full API Response:', response)
        debugLog('?? Response Data:', response?.data)

        if (response.data && response.data.success && response.data.data && response.data.data.restaurants) {
          const restaurantsArray = response.data.data.restaurants
          debugLog(`? Got ${restaurantsArray.length} restaurants from API`)

          // Check if we have actual data or just defaults
          if (restaurantsArray.length > 0) {
            debugLog('?? First restaurant sample:', {
              id: restaurantsArray[0]._id || restaurantsArray[0].restaurantId,
              name: restaurantsArray[0].name,
              rating: restaurantsArray[0].rating,
              offer: restaurantsArray[0].offer,
              featuredDish: restaurantsArray[0].featuredDish,
              featuredPrice: restaurantsArray[0].featuredPrice,
            })
          }

          // Helper function to check if value is a default/mock value
          const isDefaultValue = (value, fieldName) => {
            if (!value) return false

            // Common default values from backend model
            const defaultOffers = [
              "Flat ₹50 OFF above ₹199",
              "Flat 50% OFF",
              "Flat ₹40 OFF above ₹149"
            ]
            const defaultDeliveryTimes = ["25-30 mins", "20-25 mins", "30-35 mins"]
            const defaultDistances = ["1.2 km", "1 km", "0.8 km"]
            const defaultFeaturedPrice = 249

            if (fieldName === 'offer' && defaultOffers.includes(value)) {
              return true
            }
            if (fieldName === 'deliveryTime' && defaultDeliveryTimes.includes(value)) {
              return true
            }
            if (fieldName === 'distance' && defaultDistances.includes(value)) {
              return true
            }
            if (fieldName === 'featuredPrice' && value === defaultFeaturedPrice) {
              return true
            }

            return false
          }

          // First transform restaurants without menu data - USE ONLY BACKEND DATA
          // Filter out restaurants with only default/mock data
          const restaurantsWithIds = restaurantsArray
            .filter((restaurant) => {
              // Only include restaurants with real data (not just defaults)
              // At minimum, restaurant should have a name and either images or menu
              const hasName = restaurant.name && restaurant.name.trim().length > 0
              const hasRealImage = restaurant.profileImage?.url ||
                (restaurant.coverImages && restaurant.coverImages.length > 0) ||
                (restaurant.menuImages && restaurant.menuImages.length > 0)

              return hasName && hasRealImage
            })
            .map((restaurant) => {
              // Use backend data directly - filter out default values
              let deliveryTime = restaurant.estimatedDeliveryTime || null
              let distance = restaurant.distance || null
              let offer = restaurant.offer || null

              // Filter out default values
              if (isDefaultValue(deliveryTime, 'deliveryTime')) {
                deliveryTime = null
              }
              if (isDefaultValue(distance, 'distance')) {
                distance = null
              }
              if (isDefaultValue(offer, 'offer')) {
                offer = null
              }

              const cuisine = restaurant.cuisines && restaurant.cuisines.length > 0
                ? restaurant.cuisines.join(", ")
                : null

              // Get images from backend only
              const coverImages = restaurant.coverImages && restaurant.coverImages.length > 0
                ? restaurant.coverImages.map(img => img.url || img).filter(Boolean)
                : []

              const fallbackImages = restaurant.menuImages && restaurant.menuImages.length > 0
                ? restaurant.menuImages.map(img => img.url || img).filter(Boolean)
                : []

              // Use backend images only - no fallback placeholder
              const allImages = coverImages.length > 0
                ? coverImages
                : (fallbackImages.length > 0
                  ? fallbackImages
                  : (restaurant.profileImage?.url ? [restaurant.profileImage.url] : []))

              const image = allImages[0] || null // Will be handled in UI
              const restaurantId = restaurant.restaurantId || restaurant._id

              let featuredDish = restaurant.featuredDish || null
              let featuredPrice = restaurant.featuredPrice || null

              // Filter out default featured price
              if (featuredPrice && isDefaultValue(featuredPrice, 'featuredPrice')) {
                featuredPrice = null
              }

              return {
                id: restaurantId,
                name: restaurant.name,
                cuisine: cuisine,
                rating: restaurant.rating || null, // Use backend rating or null
                deliveryTime: deliveryTime,
                distance: distance,
                image: image,
                images: allImages,
                priceRange: restaurant.priceRange || null,
                featuredDish: featuredDish, // Will be set from menu if available
                featuredPrice: featuredPrice, // Will be set from menu if available
                offer: offer, // Use backend offer or null (defaults filtered out)
                slug: restaurant.slug || restaurant.name?.toLowerCase().replace(/\s+/g, '-'),
                restaurantId: restaurantId,
                hasPaneer: false, // Will be updated after menu fetch
                category: 'all',
              }
            })

          startTransition(() => {
            setRestaurantsData(restaurantsWithIds)
          })

          const enrichmentRequestId = ++menuEnrichmentRequestRef.current

          void (async () => {
            const transformedRestaurants = []

            for (let index = 0; index < restaurantsWithIds.length; index += 4) {
              const batchRestaurants = restaurantsWithIds.slice(index, index + 4)
              const batchResults = await Promise.all(
                batchRestaurants.map(async (restaurant) => {
                  try {
                    const menuResponse = await restaurantAPI.getMenuByRestaurantId(restaurant.restaurantId)
                    if (menuResponse.data && menuResponse.data.success && menuResponse.data.data && menuResponse.data.data.menu) {
                      const menu = menuResponse.data.data.menu
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

            debugLog(`? Final transformed restaurants: ${transformedRestaurants.length}`)
            startTransition(() => {
              setRestaurantsData(transformedRestaurants)
            })

            const sectionStatsMap = new Map()
            transformedRestaurants.forEach((restaurant) => {
              const sections = restaurant?.menu?.sections
              if (!Array.isArray(sections)) return
              const seenInRestaurant = new Set()
              sections.forEach((section) => {
                const rawName = String(section?.name || '').trim()
                if (!rawName) return
                const key = slugify(rawName)
                if (!key || seenInRestaurant.has(key)) return
                seenInRestaurant.add(key)

                const existing = sectionStatsMap.get(key) || { name: rawName, count: 0 }
                existing.count += 1
                sectionStatsMap.set(key, existing)
              })
            })

            if (sectionStatsMap.size > 0) {
              const sourceEntries = Array.from(sectionStatsMap.entries())
                .map(([slug, stats]) => [slug, stats.name])

              const getCategoryImageFromMenus = (slug, categoryName) => {
                for (const restaurant of transformedRestaurants) {
                  const menuSections = Array.isArray(restaurant?.menu?.sections) ? restaurant.menu.sections : []
                  for (const section of menuSections) {
                    const sectionSlug = slugify(section?.name || "")
                    if (sectionSlug !== slug && String(section?.name || "").trim().toLowerCase() !== String(categoryName || "").trim().toLowerCase()) {
                      continue
                    }

                    const directItems = Array.isArray(section?.items) ? section.items : []
                    const directImageItem = directItems.find((item) => item?.image)
                    if (directImageItem?.image) return directImageItem.image

                    const subsections = Array.isArray(section?.subsections) ? section.subsections : []
                    for (const subsection of subsections) {
                      const subItems = Array.isArray(subsection?.items) ? subsection.items : []
                      const subImageItem = subItems.find((item) => item?.image)
                      if (subImageItem?.image) return subImageItem.image
                    }

                    if (restaurant?.image) return restaurant.image
                    if (Array.isArray(restaurant?.images) && restaurant.images.length > 0) {
                      return restaurant.images[0]
                    }
                  }
                }
                return ""
              }

              const dynamicCategories = [
                { id: 'all', name: "All", image: "" },
                ...sourceEntries.map(([slug, name]) => ({
                  id: slug,
                  name,
                  image: getCategoryImageFromMenus(slug, name),
                  type: 'menu-section',
                })),
              ]

              const dynamicKeywords = {}
              sourceEntries.forEach(([slug, name]) => {
                const lowered = name.toLowerCase()
                const words = lowered.split(/[\s-]+/).filter((w) => w.length > 0)
                dynamicKeywords[slug] = [lowered, ...words]
              })

              startTransition(() => {
                setCategories(dynamicCategories)
                setCategoryKeywords(dynamicKeywords)
              })
            }
          })()
        } else {
          debugWarn('?? No restaurants in API response. Response structure:', {
            hasData: !!response.data,
            hasSuccess: response.data?.success,
            hasDataField: !!response.data?.data,
            hasRestaurants: !!response.data?.data?.restaurants,
            fullResponse: response.data
          })
          setRestaurantsData([])
        }
      } catch (error) {
        debugError('? Error fetching restaurants:', error)
        debugError('? Error response:', error.response?.data)
        setRestaurantsData([])
      } finally {
        setLoadingRestaurants(false)
      }
    }

    fetchRestaurants()
  }, [zoneId, isOutOfService])

  // Update search query when URL changes
  useEffect(() => {
    if (query) {
      setSearchQuery(query)
      // Try to match query to a category
      const matchedCategory = categories.find(cat =>
        cat.name.toLowerCase() === query.toLowerCase() ||
        cat.id === query.toLowerCase().replace(/\s+/g, '-')
      )
      if (matchedCategory) {
        setSelectedCategory(matchedCategory.id)
      }
    }
  }, [query])

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
  }

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

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      const term = searchQuery.trim()
      try {
        const raw = localStorage.getItem(SEARCH_HISTORY_KEY)
        const parsed = raw ? JSON.parse(raw) : []
        const prev = Array.isArray(parsed) ? parsed : []
        const next = [term, ...prev.filter((item) => String(item).toLowerCase() !== term.toLowerCase())].slice(0, 8)
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next))
      } catch {
        // Ignore storage parsing errors.
      }
      setSearchParams({ q: term })
    }
  }

  const handleCategorySelect = (catId) => {
    setSelectedCategory(catId)
    // Update search query to match category name
    const category = categories.find(c => c.id === catId)
    if (category && category.id !== 'all') {
      setSearchQuery(category.name)
      setSearchParams({ q: category.name })
    } else {
      setSearchQuery("")
      setSearchParams({})
    }
  }

  // Filter restaurants based on search query, selected category, and filters
  const filteredRecommended = useMemo(() => {
    // Use ONLY backend data - no hardcoded fallback
    const sourceData = restaurantsData.length > 0 ? restaurantsData : []
    let filtered = [...sourceData]

    // Filter by search query
    if (deferredQuery.trim()) {
      const lowerQuery = deferredQuery.toLowerCase()
      filtered = filtered.filter(r =>
        r.name?.toLowerCase().includes(lowerQuery) ||
        r.cuisine?.toLowerCase().includes(lowerQuery) ||
        r.featuredDish?.toLowerCase().includes(lowerQuery) ||
        r.category === selectedCategory
      )
    }

    // Filter by category - Dynamic filtering based on menu items
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(r => {
        // If restaurant has menu data, check menu for category items
        if (r.menu) {
          const hasCategoryItem = checkCategoryInMenu(r.menu, selectedCategory)
          if (hasCategoryItem) {
            // Update featured dish for this category
            const categoryDish = getCategoryDishFromMenu(r.menu, selectedCategory)
            if (categoryDish && !r.categoryFeaturedDish) {
              r.categoryFeaturedDish = categoryDish
            }
            return true
          }
          // If menu exists but no match, don't show (menu was checked)
          return false
        }

        // Fallback for hardcoded data or restaurants without menu
        // Check if restaurant matches category (hardcoded data)
        if (r.category === selectedCategory) {
          return true
        }

        // For paneer-tikka (backward compatibility)
        if (selectedCategory === 'paneer-tikka' && r.hasPaneer) {
          return true
        }

        // Check featured dish and cuisine for category keywords
        const keywords = categoryKeywords[selectedCategory] || []
        if (keywords.length > 0) {
          const featuredDishLower = (r.featuredDish || '').toLowerCase()
          const cuisineLower = (r.cuisine || '').toLowerCase()
          const nameLower = (r.name || '').toLowerCase()

          const matches = keywords.some(keyword =>
            featuredDishLower.includes(keyword) ||
            cuisineLower.includes(keyword) ||
            nameLower.includes(keyword)
          )

          if (matches) return true
        }

        // If no match found, don't show restaurant for this category
        return false
      })
    } else if (!deferredQuery.trim()) {
      // Show all restaurants when no category selected (category is 'all')
      // Don't filter - show all restaurants
    }

    // Apply filters
    if (activeFilters.has('under-30-mins')) {
      filtered = filtered.filter(r => {
        if (!r.deliveryTime) return false
        const timeMatch = r.deliveryTime.match(/(\d+)/)
        return timeMatch && parseInt(timeMatch[1]) <= 30
      })
    }
    if (activeFilters.has('rating-4-plus')) {
      filtered = filtered.filter(r => r.rating && r.rating >= 4.0)
    }
    if (activeFilters.has('flat-50-off')) {
      filtered = filtered.filter(r => r.offer && r.offer.includes('50%'))
    }

    return uniqueRestaurants(filtered)
  }, [deferredQuery, selectedCategory, activeFilters, restaurantsData, categoryKeywords, loadingCategories])

  const filteredAllRestaurants = useMemo(() => {
    // Use ONLY backend data - no hardcoded fallback
    const sourceData = restaurantsData.length > 0 ? restaurantsData : []
    let filtered = [...sourceData]

    // Filter by search query - Search in name, cuisine, featured dish
    if (deferredQuery.trim()) {
      const lowerQuery = deferredQuery.toLowerCase()
      filtered = filtered.filter(r => {
        const nameMatch = r.name?.toLowerCase().includes(lowerQuery)
        const cuisineMatch = r.cuisine?.toLowerCase().includes(lowerQuery)
        const dishMatch = r.featuredDish?.toLowerCase().includes(lowerQuery)

        // Also search in menu items if menu is available
        let menuMatch = false
        if (r.menu && r.menu.sections) {
          for (const section of r.menu.sections) {
            if (section.items) {
              for (const item of section.items) {
                if (item.name?.toLowerCase().includes(lowerQuery) ||
                  item.category?.toLowerCase().includes(lowerQuery)) {
                  menuMatch = true
                  break
                }
              }
            }
            if (menuMatch) break
          }
        }

        return nameMatch || cuisineMatch || dishMatch || menuMatch || r.category === selectedCategory
      })
    }

    // Filter by category - Dynamic filtering based on menu items
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(r => {
        // If restaurant has menu data, check menu for category items
        if (r.menu) {
          const hasCategoryItem = checkCategoryInMenu(r.menu, selectedCategory)
          if (hasCategoryItem) {
            // Update featured dish for this category
            const categoryDish = getCategoryDishFromMenu(r.menu, selectedCategory)
            if (categoryDish && !r.categoryFeaturedDish) {
              r.categoryFeaturedDish = categoryDish
            }
            return true
          }
          // If menu exists but no match, don't show (menu was checked)
          return false
        }

        // Fallback for hardcoded data or restaurants without menu
        // Check if restaurant matches category (hardcoded data)
        if (r.category === selectedCategory) {
          return true
        }

        // For paneer-tikka (backward compatibility)
        if (selectedCategory === 'paneer-tikka' && r.hasPaneer) {
          return true
        }

        // Check featured dish and cuisine for category keywords
        const keywords = categoryKeywords[selectedCategory] || []
        if (keywords.length > 0) {
          const featuredDishLower = (r.featuredDish || '').toLowerCase()
          const cuisineLower = (r.cuisine || '').toLowerCase()
          const nameLower = (r.name || '').toLowerCase()

          const matches = keywords.some(keyword =>
            featuredDishLower.includes(keyword) ||
            cuisineLower.includes(keyword) ||
            nameLower.includes(keyword)
          )

          if (matches) return true
        }

        // If no match found, don't show restaurant for this category
        return false
      })
    } else if (!deferredQuery.trim()) {
      // Show all restaurants when no category selected (category is 'all')
      // Don't filter - show all restaurants
    }

    // Apply filters
    if (activeFilters.has('under-30-mins')) {
      filtered = filtered.filter(r => {
        if (!r.deliveryTime) return false
        const timeMatch = r.deliveryTime.match(/(\d+)/)
        return timeMatch && parseInt(timeMatch[1]) <= 30
      })
    }
    if (activeFilters.has('rating-4-plus')) {
      filtered = filtered.filter(r => r.rating && r.rating >= 4.0)
    }
    if (activeFilters.has('under-250')) {
      filtered = filtered.filter(r => r.featuredPrice && r.featuredPrice <= 250)
    }
    if (activeFilters.has('flat-50-off')) {
      filtered = filtered.filter(r => r.offer && r.offer.includes('50%'))
    }

    return uniqueRestaurants(filtered)
  }, [deferredQuery, selectedCategory, activeFilters, restaurantsData, categoryKeywords, loadingCategories])

  const recommendedIds = useMemo(
    () => new Set(filteredRecommended.slice(0, 6).map((restaurant) => restaurant.id)),
    [filteredRecommended]
  )
  const nonRepeatedAllRestaurants = useMemo(
    () => filteredAllRestaurants.filter((restaurant) => !recommendedIds.has(restaurant.id)),
    [filteredAllRestaurants, recommendedIds]
  )

  // Check if should show grayscale (user out of service)
  const shouldShowGrayscale = isOutOfService

  return (
    <div className={`min-h-screen bg-white dark:bg-[#0a0a0a] ${shouldShowGrayscale ? 'grayscale opacity-75' : ''}`}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white dark:bg-[#1a1a1a] shadow-sm">
        <div className="max-w-7xl mx-auto">
          {/* Search Bar with Back Button */}
          <div className="flex items-center gap-2 px-3 sm:px-4 md:px-6 lg:px-8 py-3 md:py-4 border-b border-gray-100 dark:border-gray-800">
            <button
              onClick={() => navigate('/food/user')}
              className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </button>

            <form onSubmit={handleSearch} className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
              <Input
                placeholder="Restaurant name or a dish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 h-11 rounded-lg border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1a] focus:bg-white dark:focus:bg-[#2a2a2a] focus:border-gray-500 dark:focus:border-gray-600 text-sm dark:text-white placeholder:text-gray-600 dark:placeholder:text-gray-400"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2">
                <Mic className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
            </form>
          </div>

          {/* Browse Category Section */}
          <div
            ref={categoryScrollRef}
            className="flex gap-3 sm:gap-4 lg:gap-5 overflow-x-auto scrollbar-hide px-4 sm:px-6 md:px-8 lg:px-10 py-3 md:py-4 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id
              const isAllCategory = cat.id === 'all'
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.id)}
                  className={`flex flex-col items-center gap-1.5 flex-shrink-0 pb-2 transition-all ${isSelected ? 'border-b-2 border-[#FF0000]' : ''
                    }`}
                >
                  {isAllCategory ? (
                    <div className={`w-16 h-16 rounded-full border-2 transition-all flex items-center justify-center ${isSelected ? 'border-[#FF0000] dark:border-[#FF0000] shadow-lg bg-red-50 dark:bg-[#FF0000]/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#222222]'}`}>
                      <Grid2x2 className={`h-6 w-6 ${isSelected ? 'text-[#FF0000]' : 'text-gray-500 dark:text-gray-400'}`} />
                    </div>
                  ) : cat.image ? (
                    <div className={`w-16 h-16 rounded-full overflow-hidden border-2 transition-all ${isSelected ? 'border-[#FF0000] dark:border-[#FF0000] shadow-lg' : 'border-transparent'
                      }`}>
                      <img
                        src={cat.image}
                        alt={cat.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className={`w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center border-2 transition-all ${isSelected ? 'border-[#FF0000] dark:border-[#FF0000] shadow-lg bg-red-50 dark:bg-[#FF0000]/20' : 'border-transparent'
                      }`}>
                      <span className="text-xl">???</span>
                    </div>
                  )}
                  <span className={`text-xs font-medium whitespace-nowrap ${isSelected ? 'text-[#FF0000] dark:text-[#FF0000]' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                    {cat.name}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Filters */}
          <div
            className="flex items-center gap-2 sm:gap-3 lg:gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 md:px-8 lg:px-10 py-3 md:py-4 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {/* Filter Button */}
            <Button
              variant="outline"
              className="h-9 px-3 rounded-lg flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 font-medium bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="text-sm font-bold text-black dark:text-white">Filters</span>
              <ChevronDown className="h-3 w-3" />
            </Button>

            {/* Filter Options */}
            {filterOptions.map((filter) => {
              const isActive = activeFilters.has(filter.id)
              return (
                <Button
                  key={filter.id}
                  variant="outline"
                  onClick={() => toggleFilter(filter.id)}
                  className={`h-9 px-3 rounded-lg flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 transition-all font-medium ${isActive
                    ? 'bg-[#FF0000] text-white border-[#FF0000] hover:bg-[#C83C00] dark:bg-[#FF0000] dark:hover:bg-[#C83C00]'
                    : 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'
                    }`}
                >
                  {filter.hasIcon && filter.id === 'price-match' && (
                    <span className={`text-xs ${isActive ? 'text-white' : 'text-[#FF0000] dark:text-[#FF0000]'}`}>?</span>
                  )}
                  {filter.hasIcon && filter.id === 'flat-50-off' && (
                    <span className={`text-xs ${isActive ? 'text-white' : 'text-[#FF0000] dark:text-[#FF0000]'}`}>?</span>
                  )}
                  <span className={`text-sm font-bold ${isActive ? 'text-white' : 'text-black dark:text-white'}`}>{filter.label}</span>
                </Button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-4 sm:py-6 md:py-8 lg:py-10 space-y-6 md:space-y-8 lg:space-y-10">
        {/* Loading State */}
        {showRestaurantSkeleton && <RestaurantGridSkeleton count={4} compact />}

        {/* RECOMMENDED FOR YOU Section */}
        {!showRestaurantSkeleton && filteredRecommended.length > 0 && (
          <section>
            <h2 className="text-xs sm:text-sm font-semibold text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-4">
              RECOMMENDED FOR YOU
            </h2>

            {/* Small Restaurant Cards - Horizontal Scroll */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4 lg:gap-5">
              {filteredRecommended.slice(0, 6).map((restaurant) => {
                return (
                  <Link
                    key={restaurant.id}
                    to={`/user/restaurants/${restaurant.slug || restaurant.name.toLowerCase().replace(/\s+/g, '-')}`}
                    className="block"
                  >
                    <div className={`group ${shouldShowGrayscale ? 'grayscale opacity-75' : ''}`}>
                      {/* Image Container */}
                      <div className="relative aspect-square rounded-xl overflow-hidden mb-2 bg-gray-200 dark:bg-gray-800">
                        {restaurant.image ? (
                          <img
                            src={restaurant.image}
                            alt={restaurant.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              e.target.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-2xl">???</span>
                          </div>
                        )}
                        {/* Offer Badge - Only show if offer exists */}
                        {restaurant.offer && (
                          <div className="absolute top-1.5 left-1.5 bg-gradient-to-r from-[#FF0000] to-[#C83C00] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                            {restaurant.offer}
                          </div>
                        )}
                      </div>

                      {/* Rating Badge - Only show if rating exists */}
                      {restaurant.rating && (
                        <div className="flex items-center gap-1 mb-1">
                          <div className="bg-green-600 text-white text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            {restaurant.rating}
                            <Star className="h-2.5 w-2.5 fill-white" />
                          </div>
                        </div>
                      )}

                      {/* Restaurant Info */}
                      <h3 className="font-semibold text-gray-900 dark:text-white text-xs line-clamp-1">
                        {restaurant.name}
                      </h3>
                      {restaurant.deliveryTime && (
                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-[10px]">
                          <Clock className="h-2.5 w-2.5" />
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
        <section>
          <h2 className="text-xs sm:text-sm font-semibold text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-4">
            ALL RESTAURANTS
          </h2>

          {/* Large Restaurant Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
            {nonRepeatedAllRestaurants.map((restaurant) => {
              const restaurantSlug = restaurant.name.toLowerCase().replace(/\s+/g, "-")
              const isFavorite = favorites.has(restaurant.id)

              return (
                <Link key={restaurant.id} to={`/user/restaurants/${restaurant.slug || restaurantSlug}`} className="h-full flex">
                  <Card className={`overflow-hidden cursor-pointer border-0 dark:border-gray-800 group bg-white dark:bg-[#1a1a1a] shadow-md hover:shadow-xl transition-all duration-300 py-0 rounded-md flex flex-col h-full w-full ${shouldShowGrayscale ? 'grayscale opacity-75' : ''
                    }`}>
                    {/* Image Section */}
                    <div className="relative h-44 sm:h-52 md:h-60 lg:h-64 xl:h-72 w-full overflow-hidden rounded-t-md flex-shrink-0 bg-gray-200 dark:bg-gray-800">
                      {restaurant.image ? (
                        <img
                          src={restaurant.image}
                          alt={restaurant.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            e.target.style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-800">
                          <span className="text-4xl">???</span>
                        </div>
                      )}

                      {/* Featured Dish Badge - Top Left - Only show if data exists */}
                      {(() => {
                        let displayText = null

                        // If category is selected and restaurant has menu, show category-specific dish
                        if (selectedCategory && selectedCategory !== 'all' && restaurant.menu) {
                          const categoryDish = getCategoryDishFromMenu(restaurant.menu, selectedCategory)
                          if (categoryDish && restaurant.featuredPrice) {
                            displayText = `${categoryDish} • ₹${restaurant.featuredPrice}`
                          }
                        }

                        // Fallback to featured dish
                        if (!displayText && restaurant.featuredDish && restaurant.featuredPrice) {
                          displayText = `${restaurant.featuredDish} • ₹${restaurant.featuredPrice}`
                        }

                        return displayText ? (
                          <div className="absolute top-3 left-3">
                            <div className="bg-gray-800/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium">
                              {displayText}
                            </div>
                          </div>
                        ) : null
                      })()}

                      {/* Ad Badge */}
                      {restaurant.isAd && (
                        <div className="absolute top-3 right-14 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded">
                          Ad
                        </div>
                      )}

                      {/* Bookmark Icon - Top Right */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-3 right-3 h-9 w-9 bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur-sm rounded-lg hover:bg-white dark:hover:bg-[#2a2a2a] transition-colors"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          toggleFavorite(restaurant.id)
                        }}
                      >
                        <Bookmark className={`h-5 w-5 ${isFavorite ? "fill-gray-800 dark:fill-gray-200 text-gray-800 dark:text-gray-200" : "text-gray-600 dark:text-gray-400"}`} strokeWidth={2} />
                      </Button>
                    </div>

                    {/* Content Section */}
                    <CardContent className="p-3 sm:p-4 lg:p-5 flex flex-col flex-grow">
                      {/* Restaurant Name & Rating */}
                      <div className="flex items-start justify-between gap-2 mb-2 lg:mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white line-clamp-1 lg:line-clamp-2">
                            {restaurant.name}
                          </h3>
                        </div>
                        {restaurant.rating && (
                          <div className="flex-shrink-0 bg-green-600 text-white px-2 py-1 lg:px-3 lg:py-1.5 rounded-lg flex items-center gap-1">
                            <span className="text-sm lg:text-base font-bold">{restaurant.rating}</span>
                            <Star className="h-3 w-3 lg:h-4 lg:w-4 fill-white text-white" />
                          </div>
                        )}
                      </div>

                      {/* Delivery Time & Distance - Only show if data exists */}
                      {(restaurant.deliveryTime || restaurant.distance) && (
                        <div className="flex items-center gap-1 text-sm lg:text-base text-gray-500 dark:text-gray-400 mb-2 lg:mb-3">
                          {restaurant.deliveryTime && (
                            <>
                              <Clock className="h-4 w-4 lg:h-5 lg:w-5" strokeWidth={1.5} />
                              <span className="font-medium">{restaurant.deliveryTime}</span>
                            </>
                          )}
                          {restaurant.deliveryTime && restaurant.distance && (
                            <span className="mx-1">|</span>
                          )}
                          {restaurant.distance && (
                            <span className="font-medium">{restaurant.distance}</span>
                          )}
                        </div>
                      )}

                      {/* Offer Badge */}
                      {restaurant.offer && (
                        <div className="flex items-center gap-2 text-sm lg:text-base mt-auto">
                          <BadgePercent className="h-4 w-4 lg:h-5 lg:w-5 text-[#FF0000] dark:text-[#FF0000]" strokeWidth={2} />
                          <span className="text-gray-700 dark:text-gray-300 font-medium">{restaurant.offer}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )
            })}

            {/* Empty State */}
            {nonRepeatedAllRestaurants.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  {query
                    ? `No restaurants found for "${query}"`
                    : "No restaurants found with selected filters"}
                </p>
                <Button
                  variant="outline"
                  className="mt-4 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  onClick={() => {
                    setActiveFilters(new Set())
                    setSearchQuery("")
                    setSelectedCategory('all')
                    setSearchParams({})
                  }}
                >
                  Clear all filters
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>
      <MiniCart />
    </div>
  )
}

