import { useState, useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, HelpCircle, Menu, Search, SlidersHorizontal, Calendar, ChevronLeft, X, Loader2, ChevronRight, Star } from "lucide-react"
import { DateRangeCalendar } from "@food/components/ui/date-range-calendar"
"@food/components/restaurant/BottomNavOrders"
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
  
  const [isComplaintsFilterOpen, setIsComplaintsFilterOpen] = useState(false)
  const [selectedComplaintsFilterCategory, setSelectedComplaintsFilterCategory] = useState("issueType")
  const [complaintsFilterValues, setComplaintsFilterValues] = useState({
    issueType: [],
    reasons: []
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
    if (filterValues.sortBy) {
      filtered.sort((a, b) => {
        const dateA = new Date(a.date); const dateB = new Date(b.date)
        if (filterValues.sortBy === "newest") return dateB - dateA
        if (filterValues.sortBy === "oldest") return dateA - dateB
        if (filterValues.sortBy === "bestRated") return (b.rating ?? 0) - (a.rating ?? 0)
        if (filterValues.sortBy === "worstRated") return (a.rating ?? 0) - (b.rating ?? 0)
        return 0
      })
    }
    setDisplayedReviews(filtered)
  }, [reviews, filterValues])

  const handleFilterReset = () => { setFilterValues({ duration: null, sortBy: "newest", reviewType: [] }); setIsFilterApply() }
  const handleFilterApply = () => { setIsFilterLoading(true); setIsFilterOpen(false); setTimeout(() => setIsFilterLoading(false), 200) }

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

  const handleComplaintsFilterApply = () => { setIsComplaintsLoading(true); setIsComplaintsFilterOpen(false); setTimeout(() => setIsComplaintsLoading(false), 200) }
  const handleComplaintsFilterReset = () => { setComplaintsFilterValues({ issueType: [], reasons: [] }); setComplaintsSearchQuery(""); setIsComplaintsLoading(true); setTimeout(() => setIsComplaintsLoading(false), 200) }

  const handleDateRangeSelect = (range) => {
    setSelectedDateRange(range)
    if (range === "custom") setIsCustomDateOpen(true)
    else { setIsDateSelectorOpen(false); setIsComplaintsLoading(true); setTimeout(() => setIsComplaintsLoading(false), 200) }
  }

  const handleCustomDateApply = () => { setIsCustomDateOpen(false); setIsDateSelectorOpen(false); setIsComplaintsLoading(true); setTimeout(() => setIsComplaintsLoading(false), 200) }

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; touchStartY.current = e.touches[0].clientY; isSwiping.current = false }
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
    <div className="min-h-screen bg-gray-100 flex flex-col" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div className="sticky bg-white top-0 z-40 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] tracking-wider text-gray-500 uppercase">Showing data for</p>
            <p className="text-md font-bold text-gray-900">{restaurantData?.name || "Restaurant"}</p>
          </div>
          <div className="flex items-center gap-2">
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
        
        <div className="flex gap-2 mt-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
                activeTab === tab.id ? "bg-[#0D315B] text-white shadow-lg shadow-[#0D315B]/20" : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4">
        {activeTab === "complaints" ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button onClick={() => setIsDateSelectorOpen(true)} className="flex-1 bg-white p-3 rounded-xl border border-gray-200 flex justify-between items-center">
                <div className="text-left">
                  <p className="text-xs font-bold text-gray-900">{selectedDateRange}</p>
                  <p className="text-[10px] text-gray-500">Select date range</p>
                </div>
                <Calendar className="w-4 h-4 text-gray-400" />
              </button>
              <button onClick={() => setIsComplaintsFilterOpen(true)} className="bg-white p-3 rounded-xl border border-gray-200">
                <SlidersHorizontal className="w-4 h-4 text-gray-900" />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {isComplaintsLoading ? (
                <div className="flex justify-center p-10"><Loader2 className="animate-spin text-gray-400" /></div>
              ) : complaints.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                  <p className="text-sm text-gray-500 font-medium">No complaints found</p>
                </div>
              ) : (
                <div className="space-y-4 pb-20">
                  {complaints.map((complaint) => (
                    <div key={complaint._id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
                      <div className="flex justify-between items-center">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                          complaint.status === 'open' ? 'bg-[#e7eaef] text-[#0b2a4d]' : 'bg-green-100 text-green-600'
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
                        <div className="bg-[#f3f5f7] rounded-xl p-3 border border-[#e7eaef]">
                          <p className="text-[9px] font-black text-primary uppercase mb-1">ECS Response</p>
                          <p className="text-sm text-[#051424] font-medium">{complaint.adminResponse}</p>
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
            <div className="flex gap-2">
              <div className="flex-1 bg-white p-3 rounded-xl border border-gray-200 flex items-center gap-2">
                <Search className="w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search reviews" className="flex-1 text-sm bg-transparent focus:outline-none" />
              </div>
              <button onClick={() => setIsFilterOpen(true)} className="bg-white p-3 rounded-xl border border-gray-200">
                <SlidersHorizontal className="w-4 h-4 text-gray-900" />
              </button>
            </div>

            <div className="space-y-4 pb-20">
              {displayedReviews.map((review) => (
                <div key={review.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
                  <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase">
                    <span>Order #{review.orderNumber}</span>
                    <span>{review.date}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <img src={review.userImage} className="w-8 h-8 rounded-full border border-gray-100" />
                    <p className="font-bold text-gray-900 text-sm">{review.userName}</p>
                    <div className="ml-auto flex items-center gap-1 bg-[#0D315B] text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                      {review.rating} <Star className="w-2 h-2 fill-current" />
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-sm text-gray-800 font-medium italic">"{review.reviewText}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
