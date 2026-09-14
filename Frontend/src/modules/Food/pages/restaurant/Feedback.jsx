import { useState, useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, HelpCircle, Menu, Search, SlidersHorizontal, Calendar, ChevronLeft, X, Loader2, ChevronRight, Star } from "lucide-react"
import { DateRangeCalendar } from "@food/components/ui/date-range-calendar"
import BottomNavOrders from "@food/components/restaurant/BottomNavOrders"
import { restaurantAPI } from "@food/api"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const REVIEWS_STORAGE_KEY = "restaurant_reviews_data"

const tabs = [
  { id: "complaints", label: "Complaints" },
  { id: "reviews", label: "Reviews" },
]

const normalizeOrderStatus = (order) =>
  String(order?.status || order?.orderStatus || "").toLowerCase()

const normalizeRating = (value) => {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  if (parsed <= 0) return null
  return Math.min(5, Math.round(parsed * 10) / 10)
}

const extractReviewRating = (order) =>
  normalizeRating(
    order?.review?.rating ??
      order?.ratings?.restaurant?.rating ??
      order?.feedback?.rating ??
      order?.rating
  )

const extractReviewText = (order) => {
  const raw =
    order?.review?.comment ??
    order?.review?.text ??
    order?.ratings?.restaurant?.comment ??
    order?.feedback?.comment ??
    order?.feedback?.text ??
    ""
  const normalized = String(raw || "").trim()
  return normalized || "No review text"
}

const toComparableId = (value) =>
  String(value?._id || value || "").trim()

export default function Feedback() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get("tab")
  const [activeTab, setActiveTab] = useState(tabFromUrl === "complaints" ? "complaints" : "reviews")
  const navigate = useNavigate()
  const [isTransitioning, setIsTransitioning] = useState(false)
  
  // Update active tab when URL param changes
  useEffect(() => {
    if (tabFromUrl === "complaints") {
      setActiveTab("complaints")
    } else {
      setActiveTab("reviews")
    }
  }, [tabFromUrl])
  
  // Swipe gesture refs
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const touchStartY = useRef(0)
  const isSwiping = useRef(false)
  
  const feedbackTabs = ["complaints", "reviews"]
  const [reviews, setReviews] = useState([])
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [selectedFilterCategory, setSelectedFilterCategory] = useState("duration")
  const [filterValues, setFilterValues] = useState({
    duration: null,
    sortBy: "newest",
    reviewType: []
  })
  const [isFilterLoading, setIsFilterLoading] = useState(false)
  const [displayedReviews, setDisplayedReviews] = useState([])
  const [reviewsSearchQuery, setReviewsSearchQuery] = useState("")
  
  const [isComplaintsFilterOpen, setIsComplaintsFilterOpen] = useState(false)
  const [selectedComplaintsFilterCategory, setSelectedComplaintsFilterCategory] = useState("issueType")
  const [complaintsFilterValues, setComplaintsFilterValues] = useState({
    issueType: [],
    status: []
  })
  const [complaintsSearchQuery, setComplaintsSearchQuery] = useState("")
  
  const [isDateSelectorOpen, setIsDateSelectorOpen] = useState(false)
  const [selectedDateRange, setSelectedDateRange] = useState("last5days") 
  const [customDateRange, setCustomDateRange] = useState({ start: null, end: null })
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false)
  const [isComplaintsLoading, setIsComplaintsLoading] = useState(false)
  const [complaints, setComplaints] = useState([])

  const [restaurantData, setRestaurantData] = useState(null)
  const [isLoadingRestaurant, setIsLoadingRestaurant] = useState(true)
  const [isLoadingReviews, setIsLoadingReviews] = useState(true)
  const [ratingSummary, setRatingSummary] = useState({
    averageRating: 0,
    totalRatings: 0,
    totalReviews: 0
  })

  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setIsLoadingRestaurant(true)
        const response = await restaurantAPI.getCurrentRestaurant()
        if (response.data?.success && response.data.data?.restaurant) {
          setRestaurantData(response.data.data.restaurant)
        }
      } catch (error) {
        debugError("Error fetching restaurant data:", error)
      } finally {
        setIsLoadingRestaurant(false)
      }
    }
    fetchRestaurantData()
  }, [])

  useEffect(() => {
    const fetchComplaints = async () => {
      if (activeTab !== 'complaints') return
      
      try {
        setIsComplaintsLoading(true)
        const dateRanges = getDateRanges()
        let fromDate = null
        let toDate = null

        switch (selectedDateRange) {
          case 'today':
            fromDate = dateRanges.today
            toDate = new Date()
            break
          case 'yesterday':
            fromDate = dateRanges.yesterday
            toDate = new Date(dateRanges.yesterday)
            toDate.setHours(23, 59, 59, 999)
            break
          case 'thisWeek':
            fromDate = dateRanges.thisWeekStart
            toDate = dateRanges.thisWeekEnd
            break
          case 'lastWeek':
            fromDate = dateRanges.lastWeekStart
            toDate = dateRanges.lastWeekEnd
            break
          case 'thisMonth':
            fromDate = dateRanges.thisMonthStart
            toDate = dateRanges.thisMonthEnd
            break
          case 'lastMonth':
            fromDate = dateRanges.lastMonthStart
            toDate = dateRanges.lastMonthEnd
            break
          case 'last5days':
            fromDate = dateRanges.last5DaysStart
            toDate = dateRanges.last5DaysEnd
            break
          case 'custom':
            if (customDateRange.start && customDateRange.end) {
              fromDate = customDateRange.start
              toDate = customDateRange.end
            }
            break
        }

        const params = {}
        if (fromDate) params.fromDate = fromDate.toISOString()
        if (toDate) params.toDate = toDate.toISOString()
        if (complaintsFilterValues.issueType?.length > 0) {
          params.complaintType = complaintsFilterValues.issueType[0]
        }
        if (complaintsFilterValues.status?.length > 0) {
          params.status = complaintsFilterValues.status[0]
        }
        if (complaintsSearchQuery) params.search = complaintsSearchQuery

        const response = await restaurantAPI.getComplaints(params)
        if (response?.data?.success && response.data.data?.complaints) {
          setComplaints(response.data.data.complaints)
        } else {
          setComplaints([])
        }
      } catch (error) {
        debugError('Error fetching complaints:', error)
        setComplaints([])
      } finally {
        setIsComplaintsLoading(false)
      }
    }

    fetchComplaints()
  }, [activeTab, selectedDateRange, customDateRange, complaintsFilterValues, complaintsSearchQuery])

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setIsLoadingReviews(true)
        let allOrders = []
        let page = 1
        let hasMore = true
        const limit = 1000
        const maxPages = 50

        while (hasMore && page <= maxPages) {
          try {
            const response = await restaurantAPI.getOrders({ 
              page, 
              limit,
              status: 'delivered'
            })
            
            if (response.data?.success && response.data.data?.orders) {
              const orders = response.data.data.orders
              allOrders = [...allOrders, ...orders]
              const totalPages = response.data.data.pagination?.totalPages || response.data.data.totalPages || 1
              if (orders.length < limit || (totalPages > 0 && page >= totalPages)) {
                hasMore = false
              } else {
                page++
              }
            } else {
              hasMore = false
            }
          } catch (pageError) {
            hasMore = false
          }
        }

        const transformedReviews = allOrders
          .filter(order => normalizeOrderStatus(order) === 'delivered')
          .map((order, index) => {
            const orderDate = new Date(order.createdAt || order.deliveredAt || Date.now())
            const day = orderDate.getDate()
            const month = orderDate.toLocaleDateString('en-GB', { month: 'short' })
            const year = orderDate.getFullYear()
            const formattedDate = `${day} ${month}, ${year}`

            const userName = order.userId?.name || order.customerName || 'Customer'
            const userImage = order.userId?.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random`
            const outlet = order.restaurantName || (restaurantData?.name) || 'Restaurant'

            const rating = extractReviewRating(order)
            const reviewText = extractReviewText(order)

            const userOrdersCount = allOrders.filter(o => toComparableId(o.userId) === toComparableId(order.userId)).length

            return {
              id: order._id || order.orderId || `review-${index}`,
              orderNumber: order.orderId || order.orderNumber || String(index),
              outlet: outlet,
              userName: userName,
              userImage: userImage,
              ordersCount: userOrdersCount,
              rating: rating,
              date: formattedDate,
              createdAt: orderDate.toISOString(),
              reviewText: reviewText,
              orderData: order
            }
          })
          .filter(review => review.rating !== null || (review.reviewText && review.reviewText !== 'No review text'))

        const ratings = transformedReviews.map(r => r.rating).filter(r => r !== null)
        const averageRating = ratings.length > 0 ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1) : 0
        
        setRatingSummary({
          averageRating: parseFloat(averageRating),
          totalRatings: ratings.length,
          totalReviews: transformedReviews.length
        })
        setReviews(transformedReviews)
      } catch (error) {
        debugError("Error fetching reviews:", error)
      } finally {
        setIsLoadingReviews(false)
      }
    }

    if (!isLoadingRestaurant) fetchReviews()
  }, [isLoadingRestaurant, restaurantData])

  useEffect(() => {
    let filtered = [...reviews]
    const query = reviewsSearchQuery.trim().toLowerCase()
    if (query) {
      filtered = filtered.filter((review) => {
        const haystack = [
          review.userName,
          review.reviewText,
          review.orderNumber,
          review.outlet,
        ]
          .join(" ")
          .toLowerCase()
        return haystack.includes(query)
      })
    }

    if (filterValues.duration) {
      const now = Date.now()
      const daysMap = { last7days: 7, last30days: 30, last90days: 90 }
      const days = daysMap[filterValues.duration]
      if (days) {
        const cutoff = now - days * 24 * 60 * 60 * 1000
        filtered = filtered.filter((review) => {
          const ts = new Date(review.createdAt || review.orderData?.createdAt || 0).getTime()
          return Number.isFinite(ts) && ts >= cutoff
        })
      }
    }

    if (Array.isArray(filterValues.reviewType) && filterValues.reviewType.length > 0) {
      filtered = filtered.filter((review) => {
        return filterValues.reviewType.some((type) => {
          if (type === "withText") return review.reviewText && review.reviewText !== "No review text"
          if (type === "ratingOnly") return !review.reviewText || review.reviewText === "No review text"
          if (type === "5star") return Number(review.rating) >= 5
          if (type === "4star") return Number(review.rating) >= 4 && Number(review.rating) < 5
          if (type === "3star") return Number(review.rating) >= 3 && Number(review.rating) < 4
          if (type === "lowRated") return Number(review.rating) > 0 && Number(review.rating) <= 2
          return true
        })
      })
    }

    if (filterValues.sortBy) {
      filtered.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime()
        const dateB = new Date(b.createdAt || 0).getTime()
        if (filterValues.sortBy === "newest") return dateB - dateA
        if (filterValues.sortBy === "oldest") return dateA - dateB
        if (filterValues.sortBy === "bestRated") return (b.rating ?? 0) - (a.rating ?? 0)
        if (filterValues.sortBy === "worstRated") return (a.rating ?? 0) - (b.rating ?? 0)
        return 0
      })
    }
    setDisplayedReviews(filtered)
  }, [reviews, filterValues, reviewsSearchQuery])

  const handleFilterReset = () => {
    setFilterValues({ duration: null, sortBy: "newest", reviewType: [] })
    setReviewsSearchQuery("")
  }
  const handleFilterApply = () => {
    setIsFilterLoading(true)
    setIsFilterOpen(false)
    setTimeout(() => setIsFilterLoading(false), 200)
  }

  const formatDate = (date) => {
    const day = date.getDate()
    const month = date.toLocaleString('en-US', { month: 'short' })
    const year = date.getFullYear()
    return `${day} ${month} ${year}`
  }
  const formatDateShort = (date) => {
    const day = date.getDate()
    const month = date.toLocaleString('en-US', { month: 'short' })
    return `${day} ${month}`
  }

  const getDateRanges = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const last5DaysStart = new Date(today)
    last5DaysStart.setDate(last5DaysStart.getDate() - 4)
    
    const thisWeekStart = new Date(today)
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    thisWeekStart.setDate(diff)
    
    const lastWeekStart = new Date(thisWeekStart)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)
    const lastWeekEnd = new Date(thisWeekStart)
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1)
    lastWeekEnd.setHours(23, 59, 59, 999)
    
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
    lastMonthEnd.setHours(23, 59, 59, 999)
    
    return { 
      today, 
      yesterday, 
      thisWeekStart, 
      thisWeekEnd: new Date(), 
      lastWeekStart, 
      lastWeekEnd, 
      thisMonthStart, 
      thisMonthEnd: new Date(), 
      lastMonthStart, 
      lastMonthEnd, 
      last5DaysStart, 
      last5DaysEnd: new Date() 
    }
  }

  const handleComplaintsFilterApply = () => {
    setIsComplaintsFilterOpen(false)
  }
  const handleComplaintsFilterReset = () => {
    setComplaintsFilterValues({ issueType: [], status: [] })
    setComplaintsSearchQuery("")
  }

  const handleDateRangeSelect = (range) => {
    setSelectedDateRange(range)
    if (range === "custom") {
      setIsCustomDateOpen(true)
    } else {
      setIsDateSelectorOpen(false)
      setIsCustomDateOpen(false)
    }
  }

  const handleCustomDateApply = () => {
    if (!customDateRange.start || !customDateRange.end) return
    setSelectedDateRange("custom")
    setIsCustomDateOpen(false)
    setIsDateSelectorOpen(false)
  }

  const dateRangeOptions = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "last5days", label: "Last 5 days" },
    { id: "thisWeek", label: "This week" },
    { id: "lastWeek", label: "Last week" },
    { id: "thisMonth", label: "This month" },
    { id: "lastMonth", label: "Last month" },
    { id: "custom", label: "Custom range" },
  ]

  const complaintsFilterCategories = [
    { id: "issueType", label: "Issue type" },
    { id: "status", label: "Status" },
  ]

  const complaintsFilterOptions = {
    issueType: [
      { value: "food_quality", label: "Food Quality" },
      { value: "wrong_item", label: "Wrong Item" },
      { value: "missing_item", label: "Missing Item" },
      { value: "delivery_issue", label: "Delivery Issue" },
      { value: "packaging", label: "Packaging" },
      { value: "pricing", label: "Pricing" },
      { value: "service", label: "Service" },
      { value: "other", label: "Other" },
    ],
    status: [
      { value: "open", label: "Open" },
      { value: "pending", label: "Pending" },
      { value: "in_progress", label: "In Progress" },
      { value: "resolved", label: "Resolved" },
      { value: "rejected", label: "Rejected" },
    ],
  }

  const reviewsFilterCategories = [
    { id: "duration", label: "Duration" },
    { id: "sortBy", label: "Sort by" },
    { id: "reviewType", label: "Review type" },
  ]

  const reviewsFilterOptions = {
    duration: [
      { value: null, label: "All time" },
      { value: "last7days", label: "Last 7 days" },
      { value: "last30days", label: "Last 30 days" },
      { value: "last90days", label: "Last 90 days" },
    ],
    sortBy: [
      { value: "newest", label: "Newest first" },
      { value: "oldest", label: "Oldest first" },
      { value: "bestRated", label: "Best rated" },
      { value: "worstRated", label: "Worst rated" },
    ],
    reviewType: [
      { value: "withText", label: "With review text" },
      { value: "ratingOnly", label: "Rating only" },
      { value: "5star", label: "5 star" },
      { value: "4star", label: "4 star" },
      { value: "3star", label: "3 star" },
      { value: "lowRated", label: "1–2 star" },
    ],
  }

  const toggleComplaintsFilterValue = (category, value) => {
    setComplaintsFilterValues((prev) => {
      const current = Array.isArray(prev[category]) ? prev[category] : []
      const exists = current.includes(value)
      return {
        ...prev,
        [category]: exists ? current.filter((v) => v !== value) : [value],
      }
    })
  }

  const toggleReviewType = (value) => {
    setFilterValues((prev) => {
      const current = Array.isArray(prev.reviewType) ? prev.reviewType : []
      const exists = current.includes(value)
      return {
        ...prev,
        reviewType: exists ? current.filter((v) => v !== value) : [...current, value],
      }
    })
  }

  const selectedDateRangeLabel = (() => {
    if (selectedDateRange === "custom" && customDateRange.start && customDateRange.end) {
      return `${formatDateShort(customDateRange.start)} - ${formatDateShort(customDateRange.end)}`
    }
    return selectedDateRange.replace(/([A-Z])/g, " $1").trim()
  })()

  const handleTouchStart = (e) => {
    // Don't start swipe gestures from interactive controls (filters / calendar / inputs)
    const target = e.target
    if (target?.closest?.("button, input, textarea, select, a, [role='button']")) {
      isSwiping.current = false
      return
    }
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isSwiping.current = false
  }
  const handleTouchMove = (e) => {
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current)
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current)
    if (deltaX > deltaY && deltaX > 10) isSwiping.current = true
    if (isSwiping.current) touchEndX.current = e.touches[0].clientX
  }
  const handleTouchEnd = () => {
    if (!isSwiping.current) return
    const swipeDistance = touchStartX.current - touchEndX.current
    if (Math.abs(swipeDistance) > 50) {
      if (swipeDistance > 0) setActiveTab("reviews")
      else setActiveTab("complaints")
    }
  }

  return (
    <div className="min-h-full bg-gray-100 flex flex-col lg:bg-slate-50" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div className="sticky bg-white top-0 z-40 px-4 py-3 border-b border-gray-200 lg:backdrop-blur lg:bg-white/95">
        <div className="lg:max-w-6xl lg:mx-auto lg:px-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] tracking-wider text-gray-500 uppercase lg:text-xs">Showing data for</p>
              <p className="text-md font-bold text-gray-900 lg:text-2xl">{restaurantData?.name || "Restaurant"}</p>
              <p className="hidden lg:block text-sm text-gray-500 mt-0.5">Complaints and customer reviews</p>
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => navigate("/food/restaurant/notifications")}
                className="p-1 rounded-full hover:bg-gray-100 active:scale-95 transition-all"
                aria-label="Open notifications"
              >
                <Bell className="w-6 h-6 text-gray-700" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/food/restaurant/help-centre/support")}
                className="p-1 rounded-full hover:bg-gray-100 active:scale-95 transition-all"
                aria-label="Open support"
              >
                <HelpCircle className="w-6 h-6 text-gray-700" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/food/restaurant/explore")}
                className="p-1 rounded-full hover:bg-gray-100 active:scale-95 transition-all"
                aria-label="Open explore"
              >
                <Menu className="w-6 h-6 text-gray-700" />
              </button>
            </div>
          </div>
          
          <div className="flex gap-2 mt-4 lg:mt-5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setSearchParams(tab.id === "complaints" ? { tab: "complaints" } : {})
                }}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all lg:px-8 lg:py-2.5 ${
                  activeTab === tab.id ? "bg-[#FF0000] text-white shadow-lg shadow-[#FF0000]/20" : "bg-white text-gray-600 border border-gray-200 lg:bg-slate-100 lg:border-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 lg:max-w-6xl lg:mx-auto lg:px-8 lg:py-6 lg:w-full">
        {activeTab === "complaints" ? (
          <div className="space-y-4">
            <div className="flex gap-2 lg:gap-3">
              <button
                type="button"
                onClick={() => setIsDateSelectorOpen(true)}
                className="flex-1 bg-white p-3 rounded-xl border border-gray-200 flex justify-between items-center lg:max-w-xs lg:rounded-2xl lg:px-4 lg:py-3 lg:shadow-sm hover:border-gray-300 transition-colors relative z-10"
              >
                <div className="text-left">
                  <p className="text-xs font-bold text-gray-900 lg:text-sm capitalize">{selectedDateRangeLabel}</p>
                  <p className="text-[10px] text-gray-500 lg:text-xs">Select date range</p>
                </div>
                <Calendar className="w-4 h-4 text-gray-400" />
              </button>
              <button
                type="button"
                onClick={() => setIsComplaintsFilterOpen(true)}
                className="bg-white p-3 rounded-xl border border-gray-200 lg:rounded-2xl lg:px-4 lg:shadow-sm hover:border-gray-300 transition-colors relative z-10"
              >
                <SlidersHorizontal className="w-4 h-4 text-gray-900" />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {isComplaintsLoading ? (
                <div className="flex justify-center p-10 lg:py-20"><Loader2 className="animate-spin text-gray-400" /></div>
              ) : complaints.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200 lg:py-24 lg:bg-white">
                  <p className="text-sm text-gray-500 font-medium">No complaints found</p>
                </div>
              ) : (
                <div className="space-y-4 pb-20 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:pb-0 xl:grid-cols-2">
                  {complaints.map((complaint) => (
                    <div key={complaint._id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3 lg:p-5 lg:border-slate-200 lg:shadow-md hover:shadow-lg transition-shadow">
                      <div className="flex justify-between items-center">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                          complaint.status === 'open' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                        }`}>{complaint.status || 'open'}</span>
                        <span className="text-[10px] text-gray-400 font-bold">{new Date(complaint.createdAt).toLocaleDateString()}</span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-400">
                          {complaint.userId?.name?.[0] || 'U'}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{complaint.userId?.name || 'Customer'}</p>
                          <p className="text-[10px] text-gray-500 font-bold uppercase">Order #{complaint.orderId?.orderId || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-3 relative">
                        <p className="text-[10px] font-black text-red-500 uppercase mb-1">{complaint.issueType}</p>
                        <p className="text-sm text-gray-800 font-semibold leading-relaxed">{complaint.description}</p>
                      </div>

                      {complaint.adminResponse && (
                        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                          <p className="text-[9px] font-black text-blue-600 uppercase mb-1">Admin Response</p>
                          <p className="text-sm text-blue-900 font-medium">{complaint.adminResponse}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === "reviews" && ratingSummary.totalReviews > 0 && (
              <div className="hidden lg:flex items-center gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FF0000] text-xl font-bold text-white">
                    {ratingSummary.averageRating}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Average rating</p>
                    <p className="text-xs text-gray-500">{ratingSummary.totalReviews} reviews · {ratingSummary.totalRatings} rated orders</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 lg:gap-3">
              <div className="flex-1 bg-white p-3 rounded-xl border border-gray-200 flex items-center gap-2 lg:max-w-md lg:rounded-2xl lg:px-4 lg:shadow-sm">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={reviewsSearchQuery}
                  onChange={(e) => setReviewsSearchQuery(e.target.value)}
                  placeholder="Search reviews"
                  className="flex-1 text-sm bg-transparent focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsFilterOpen(true)}
                className="bg-white p-3 rounded-xl border border-gray-200 lg:rounded-2xl lg:px-4 lg:shadow-sm hover:border-gray-300 transition-colors relative z-10"
              >
                <SlidersHorizontal className="w-4 h-4 text-gray-900" />
              </button>
            </div>

            {isFilterLoading || isLoadingReviews ? (
              <div className="flex justify-center p-10 lg:py-20"><Loader2 className="animate-spin text-gray-400" /></div>
            ) : displayedReviews.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200 lg:py-24 lg:bg-white">
                <p className="text-sm text-gray-500 font-medium">No reviews found</p>
              </div>
            ) : (
            <div className="space-y-4 pb-20 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:pb-0 xl:grid-cols-2">
              {displayedReviews.map((review) => (
                <div key={review.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3 lg:p-5 lg:border-slate-200 lg:shadow-md hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase">
                    <span>Order #{review.orderNumber}</span>
                    <span>{review.date}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <img src={review.userImage} className="w-8 h-8 rounded-full border border-gray-100" />
                    <p className="font-bold text-gray-900 text-sm">{review.userName}</p>
                    <div className="ml-auto flex items-center gap-1 bg-[#FF0000] text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                      {review.rating} <Star className="w-2 h-2 fill-current" />
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-sm text-gray-800 font-medium italic">"{review.reviewText}"</p>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        )}
      </div>
      <div className="lg:hidden">
        <BottomNavOrders />
      </div>

      {/* Complaints date range selector */}
      <AnimatePresence>
        {isDateSelectorOpen && !isCustomDateOpen && (
          <div className="fixed inset-0 z-[70] flex flex-col justify-end md:justify-center items-center p-0 md:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsDateSelectorOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full md:w-[420px] bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Select date range</h2>
                <button type="button" onClick={() => setIsDateSelectorOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-900" />
                </button>
              </div>
              <div className="p-3 space-y-2 overflow-y-auto max-h-[60vh]">
                {dateRangeOptions.map((option) => {
                  const isSelected = selectedDateRange === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleDateRangeSelect(option.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                        isSelected ? "border-[#FF0000] bg-red-50" : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">{option.label}</p>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom date calendar */}
      <AnimatePresence>
        {isCustomDateOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[70]"
              onClick={() => {
                setIsCustomDateOpen(false)
                setIsDateSelectorOpen(false)
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4"
              onClick={() => {
                setIsCustomDateOpen(false)
                setIsDateSelectorOpen(false)
              }}
            >
              <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
                <DateRangeCalendar
                  startDate={customDateRange.start}
                  endDate={customDateRange.end}
                  onDateRangeChange={(start, end) => {
                    setCustomDateRange({ start, end })
                    if (start && end) {
                      setSelectedDateRange("custom")
                      setIsCustomDateOpen(false)
                      setIsDateSelectorOpen(false)
                    }
                  }}
                  onClose={() => {
                    setIsCustomDateOpen(false)
                    setIsDateSelectorOpen(false)
                  }}
                />
                {customDateRange.start && customDateRange.end && (
                  <button
                    type="button"
                    onClick={handleCustomDateApply}
                    className="mt-3 w-full bg-[#FF0000] text-white font-semibold py-3 rounded-xl"
                  >
                    Apply {formatDate(customDateRange.start)} - {formatDate(customDateRange.end)}
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Complaints filters */}
      <AnimatePresence>
        {isComplaintsFilterOpen && (
          <div className="fixed inset-0 z-[70] flex flex-col justify-end md:justify-center items-center p-0 md:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsComplaintsFilterOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full md:w-[700px] h-[70vh] md:h-[560px] bg-white rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Complaint filters</h2>
                <button type="button" onClick={() => setIsComplaintsFilterOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-900" />
                </button>
              </div>
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={complaintsSearchQuery}
                    onChange={(e) => setComplaintsSearchQuery(e.target.value)}
                    placeholder="Search complaints"
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
              <div className="flex flex-1 overflow-hidden">
                <div className="w-28 bg-gray-50 border-r border-gray-200 overflow-y-auto">
                  {complaintsFilterCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedComplaintsFilterCategory(category.id)}
                      className={`w-full px-2 py-3 text-left text-xs border-b border-gray-200 ${
                        selectedComplaintsFilterCategory === category.id
                          ? "bg-white text-gray-900 font-semibold border-l-2 border-l-black"
                          : "text-gray-600"
                      }`}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                  {(complaintsFilterOptions[selectedComplaintsFilterCategory] || []).map((option) => {
                    const selected = (complaintsFilterValues[selectedComplaintsFilterCategory] || []).includes(option.value)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleComplaintsFilterValue(selectedComplaintsFilterCategory, option.value)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm ${
                          selected ? "bg-red-50 text-[#FF0000] font-semibold" : "hover:bg-gray-50 text-gray-800"
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex gap-3 p-4 border-t border-gray-200">
                <button type="button" onClick={handleComplaintsFilterReset} className="flex-1 py-3 rounded-xl bg-gray-100 font-semibold text-gray-700">
                  Reset
                </button>
                <button type="button" onClick={handleComplaintsFilterApply} className="flex-1 py-3 rounded-xl bg-[#FF0000] font-semibold text-white">
                  Apply
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reviews filters */}
      <AnimatePresence>
        {isFilterOpen && (
          <div className="fixed inset-0 z-[70] flex flex-col justify-end md:justify-center items-center p-0 md:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsFilterOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full md:w-[700px] h-[70vh] md:h-[560px] bg-white rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Review filters</h2>
                <button type="button" onClick={() => setIsFilterOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-900" />
                </button>
              </div>
              <div className="flex flex-1 overflow-hidden">
                <div className="w-28 bg-gray-50 border-r border-gray-200 overflow-y-auto">
                  {reviewsFilterCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedFilterCategory(category.id)}
                      className={`w-full px-2 py-3 text-left text-xs border-b border-gray-200 ${
                        selectedFilterCategory === category.id
                          ? "bg-white text-gray-900 font-semibold border-l-2 border-l-black"
                          : "text-gray-600"
                      }`}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                  {(reviewsFilterOptions[selectedFilterCategory] || []).map((option) => {
                    let selected = false
                    if (selectedFilterCategory === "duration") {
                      selected = filterValues.duration === option.value
                    } else if (selectedFilterCategory === "sortBy") {
                      selected = filterValues.sortBy === option.value
                    } else {
                      selected = (filterValues.reviewType || []).includes(option.value)
                    }
                    return (
                      <button
                        key={String(option.value)}
                        type="button"
                        onClick={() => {
                          if (selectedFilterCategory === "duration") {
                            setFilterValues((prev) => ({ ...prev, duration: option.value }))
                          } else if (selectedFilterCategory === "sortBy") {
                            setFilterValues((prev) => ({ ...prev, sortBy: option.value }))
                          } else {
                            toggleReviewType(option.value)
                          }
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm ${
                          selected ? "bg-red-50 text-[#FF0000] font-semibold" : "hover:bg-gray-50 text-gray-800"
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex gap-3 p-4 border-t border-gray-200">
                <button type="button" onClick={handleFilterReset} className="flex-1 py-3 rounded-xl bg-gray-100 font-semibold text-gray-700">
                  Reset
                </button>
                <button type="button" onClick={handleFilterApply} className="flex-1 py-3 rounded-xl bg-[#FF0000] font-semibold text-white">
                  Apply
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
