import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import {
  ArrowLeft,
  Search,
  Filter,
  ChevronDown,
  Calendar,
  Copy,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  X,
} from "lucide-react"
import { DateRangeCalendar } from "@food/components/ui/date-range-calendar"
import { restaurantAPI } from "@food/api"
import { useRestaurantNotifications } from "@food/hooks/useRestaurantNotifications"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const formatMoney = (value) => `₹${Number(value || 0).toFixed(2)}`

// Initialize with current week if needed
const getCurrentWeek = () => {
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Monday
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6) // Sunday
  return { start: startOfWeek, end: endOfWeek }
}

const getLastWeek = () => {
  const today = new Date()
  const startOfLastWeek = new Date(today)
  startOfLastWeek.setDate(today.getDate() - today.getDay() - 6) // Monday of last week
  const endOfLastWeek = new Date(startOfLastWeek)
  endOfLastWeek.setDate(startOfLastWeek.getDate() + 6) // Sunday of last week
  return { start: startOfLastWeek, end: endOfLastWeek }
}

const getLast2Days = () => {
  const today = new Date()
  const twoDaysAgo = new Date(today)
  twoDaysAgo.setDate(today.getDate() - 2)
  return { start: twoDaysAgo, end: today }
}

const getLast30Days = () => {
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)
  return { start: thirtyDaysAgo, end: today }
}

const currentWeekDates = getCurrentWeek()
const lastWeekDates = getLastWeek()

const dateRangeOptions = [
  { label: "last 2 days", getDates: getLast2Days },
  { label: "this week", getDates: getCurrentWeek },
  { label: "last week", getDates: getLastWeek },
  { label: "last 30 days", getDates: getLast30Days },
  { label: "custom date range", custom: true }
]

// Filter categories and options
const filterCategories = [
  { id: "Order status", label: "Order status" },
  { id: "Ratings", label: "Ratings" },
  { id: "KPT delay", label: "KPT delay" },
  { id: "Complaints", label: "Complaints" },
  { id: "Order type", label: "Order type" }
]

const filterOptions = {
  "Order status": [
    { id: "preparing", label: "Preparing", key: "orderStatus" },
    { id: "ready", label: "Ready", key: "orderStatus" },
    { id: "out-for-delivery", label: "Out for delivery", key: "orderStatus" },
    { id: "delivered", label: "Delivered", key: "orderStatus" },
    { id: "rejected", label: "Rejected", key: "orderStatus" },
    { id: "cancelled", label: "Cancelled", key: "orderStatus" }
  ],
  "Ratings": [
    { id: "5-star", label: "5★ or less", key: "ratings", value: 5 },
    { id: "4-star", label: "4★ or less", key: "ratings", value: 4 },
    { id: "3-star", label: "3★ or less", key: "ratings", value: 3 },
    { id: "2-star", label: "2★ or less", key: "ratings", value: 2 },
    { id: "1-star", label: "1★", key: "ratings", value: 1 }
  ],
  "KPT delay": [
    { id: "0-10", label: "0-10 mins", key: "kptDelay" },
    { id: "10-20", label: "10-20 mins", key: "kptDelay" },
    { id: "20-30", label: "20-30 mins", key: "kptDelay" },
    { id: "30-plus", label: "30+ mins", key: "kptDelay" }
  ],
  "Complaints": [
    { id: "order-delayed", label: "Order delayed", key: "complaints" },
    { id: "wrong-items", label: "Wrong item(s) delivered", key: "complaints" },
    { id: "missing-items", label: "Item(s) missing or not delivered", key: "complaints" },
    { id: "poor-taste", label: "Poor taste or quality", key: "complaints" },
    { id: "poor-packaging", label: "Poor packaging or spillage", key: "complaints" },
    { id: "out-of-stock", label: "Item(s) out of stock", key: "complaints" },
    { id: "not-delivered", label: "Order not delivered", key: "complaints" }
  ],
  "Order type": [
    { id: "self-delivery", label: "Self delivery", key: "orderType" },
    { id: "food-rescue", label: "Food rescue", key: "orderType" },
    { id: "large-order", label: "Large order", key: "orderType" },
    { id: "veg-only", label: "Veg only", key: "orderType" },
    { id: "irctc", label: "IRCTC", key: "orderType" },
    { id: "replacement", label: "Replacement", key: "orderType" },
    { id: "hospital", label: "Hospital", key: "orderType" }
  ]
}

export default function AllOrdersPage() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [searchQuery, setSearchQuery] = useState("")
  const [showCalendar, setShowCalendar] = useState(false)
  const [showDateRangePopup, setShowDateRangePopup] = useState(false)
  const [selectedDateRange, setSelectedDateRange] = useState(dateRangeOptions[1]) // Default to "this week"
  const [startDate, setStartDate] = useState(currentWeekDates.start)
  const [endDate, setEndDate] = useState(currentWeekDates.end)
  const calendarRef = useRef(null)
  
  // Filter states
  const [showFilterPopup, setShowFilterPopup] = useState(false)
  const [activeFilterCategory, setActiveFilterCategory] = useState("Order status")
  const [filterSearch, setFilterSearch] = useState("")
  const [isApplyingFilters, setIsApplyingFilters] = useState(false)
  const [filters, setFilters] = useState({
    orderStatus: [],
    ratings: [],
    kptDelay: [],
    complaints: [],
    orderType: []
  })
  
  // Toast state
  const [showToast, setShowToast] = useState(false)
  
  // Real data states
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [restaurantData, setRestaurantData] = useState(null)
  const { newOrder } = useRestaurantNotifications()
  const ORDERS_PER_PAGE = 10
  const [currentPage, setCurrentPage] = useState(1)

  // Fetch restaurant data
  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (data) {
          setRestaurantData(data)
        }
      } catch (err) {
        // Suppress 401 errors as they're handled by axios interceptor
        if (err.response?.status !== 401) {
          debugError('Error fetching restaurant data:', err)
        }
      }
    }
    fetchRestaurantData()
  }, [])

  // Transform API order to component format
  const transformOrder = useCallback((order) => {
    const createdAt = new Date(order.createdAt)
    const date = createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    const time = createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    
    // Format address (backend: deliveryAddress)
    const addr = order.deliveryAddress || order.address || null
    const address =
      addr?.formattedAddress ||
      addr?.address ||
      (addr?.street ? `${addr.street}, ${addr.city || ""}`.trim() : "") ||
      "Address not available"
    
    // Get restaurant name
    const restaurantName = restaurantData?.name || order.restaurantId?.name || 'Restaurant'
    
    // Get customer name
    const customerName = order.userId?.name || order.customerName || 'Customer'
    
    // Format items
    const items = (order.items || []).map(item => ({
      name: item.name || 'Item',
      quantity: item.quantity || 1,
      price: item.price || 0
    }))
    
    // Determine status (backend: orderStatus)
    let status = (order.orderStatus || order.status || "created").toUpperCase()
    if (status === 'CANCELLED') status = 'CANCELLED'
    else if (status === 'REJECTED') status = 'REJECTED'
    else if (status === 'DELIVERED') status = 'DELIVERED'
    else if (status === 'PREPARING') status = 'PREPARING'
    else if (status === 'READY') status = 'READY'
    else if (status === 'OUT_FOR_DELIVERY' || status === 'OUT FOR DELIVERY') status = 'OUT FOR DELIVERY'
    
    // Get rejection/cancellation reason
    let reason = null
    if (status === 'REJECTED' && order.rejectionReason) {
      reason = `Rejected by Restaurant: ${order.rejectionReason}`
    } else if (status === 'CANCELLED' && order.cancellationReason) {
      reason = `Cancelled by ${order.cancelledBy === 'customer' ? 'customer' : 'restaurant'}: ${order.cancellationReason}`
    } else if (status === 'REJECTED') {
      reason = 'Rejected by Restaurant'
    } else if (status === 'CANCELLED') {
      reason = 'Cancelled by customer'
    }
    
    // Determine tags based on order properties
    const tags = []
    if (order.scheduledAt) tags.push('SCHEDULED')
    if (order.sendCutlery) tags.push('CUTLERY')
    tags.push('HOME DELIVERY')
    // Check if all items are veg
    const allVeg = items.every(item => item.isVeg !== false)
    if (allVeg && items.length > 0) tags.push('VEG ONLY')
    
    return {
      id: order.orderId || order._id?.toString() || '',
      status,
      date,
      time,
      restaurant: restaurantName,
      address,
      customer: customerName,
      items,
      totalPrice: order.pricing?.total || 0,
      reason,
      tags: tags.length > 0 ? tags : undefined,
      createdAt: order.createdAt,
      mongoId: order._id?.toString()
    }
  }, [restaurantData])

  // Fetch orders from backend
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Build query params
        const params = {
          page: 1,
          limit: 1000 // Get all orders, we'll filter by date on frontend
        }
        
        // Fetch all orders (we'll filter by date range on frontend)
        const response = await restaurantAPI.getOrders(params)
        
        if (response.data?.success && response.data.data?.orders) {
          // Transform orders
          const transformedOrders = response.data.data.orders.map(transformOrder)
          
          // Filter by date range
          const filteredByDate = transformedOrders.filter(order => {
            if (!order.createdAt) return false
            const orderDate = new Date(order.createdAt)
            const start = new Date(startDate)
            start.setHours(0, 0, 0, 0)
            const end = new Date(endDate)
            end.setHours(23, 59, 59, 999)
            return orderDate >= start && orderDate <= end
          })
          
          setOrders(filteredByDate)
        } else {
          setOrders([])
        }
      } catch (err) {
        // Suppress 401 errors as they're handled by axios interceptor
        if (err.response?.status !== 401) {
          debugError('Error fetching orders:', err)
          setError(err.message || 'Failed to fetch orders')
        }
        setOrders([])
      } finally {
        setLoading(false)
      }
    }
    
    fetchOrders()
  }, [startDate, endDate, transformOrder])

  // Realtime: instantly prepend new orders (no refresh)
  useEffect(() => {
    if (!newOrder) return
    // Transform & prepend if not already present.
    setOrders((prev) => {
      const id = String(newOrder?.orderId || newOrder?._id || "")
      if (!id) return prev
      if (prev.some((o) => String(o.id) === id || String(o.mongoId) === String(newOrder?._id))) {
        return prev
      }
      const transformed = transformOrder(newOrder)
      return [transformed, ...prev]
    })
  }, [newOrder, transformOrder])

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowCalendar(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Prevent body scroll when popup is open
  useEffect(() => {
    if (showDateRangePopup || showCalendar || showFilterPopup) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showDateRangePopup, showCalendar, showFilterPopup])

  const handleDateRangeChange = (start, end) => {
    setStartDate(start)
    setEndDate(end)
    setSelectedDateRange({ label: "custom date range", start, end, custom: true })
    setShowCalendar(false)
  }

  const handleDateRangeSelect = (option) => {
    if (option.custom) {
      setShowDateRangePopup(false)
      setShowCalendar(true)
    } else {
      const dates = option.getDates()
      setSelectedDateRange(option)
      setStartDate(dates.start)
      setEndDate(dates.end)
      setShowDateRangePopup(false)
    }
  }

  const formatDateRange = () => {
    if (!startDate || !endDate) return "Select date range"
    const startDay = startDate.getDate()
    const endDay = endDate.getDate()
    const month = startDate.toLocaleString('en-US', { month: 'short' })
    const year = startDate.getFullYear().toString().slice(-2)
    return `${startDay} - ${endDay} ${month}'${year}`
  }

  const handleCopyOrderId = (orderId, e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(orderId)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)
  }

  const handleFilterToggle = (option) => {
    const key = option.key
    const value = option.id
    
    // For ratings, only allow one selection (radio button behavior)
    if (key === "ratings") {
      setFilters(prev => ({
        ...prev,
        [key]: prev[key].includes(value) ? [] : [value]
      }))
    } else {
      // For other filters, allow multiple selections (checkbox behavior)
      setFilters(prev => ({
        ...prev,
        [key]: prev[key].includes(value)
          ? prev[key].filter(v => v !== value)
          : [...prev[key], value]
      }))
    }
  }

  const handleClearFilters = () => {
    setFilters({
      orderStatus: [],
      ratings: [],
      kptDelay: [],
      complaints: [],
      orderType: []
    })
    setFilterSearch("")
  }

  const handleApplyFilters = async () => {
    setIsApplyingFilters(true)
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800))
    setIsApplyingFilters(false)
    setShowFilterPopup(false)
  }

  const isFilterChecked = (option) => {
    return filters[option.key]?.includes(option.id) || false
  }

  const hasActiveFilters = () => {
    return Object.values(filters).some(arr => arr.length > 0)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "REJECTED":
      case "CANCELLED":
        return "bg-red-700 text-white"
      case "DELIVERED":
        return "bg-green-600 text-white"
      case "PREPARING":
        return "bg-yellow-600 text-white"
      case "READY":
        return "bg-primary text-white"
      case "OUT FOR DELIVERY":
        return "bg-primary text-white"
      default:
        return "bg-gray-600 text-white"
    }
  }

  const filteredOrders = orders.filter(order => {
    // Search filter - search in order ID (both full ID and numeric part)
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase().trim()
      const orderIdLower = order.id.toLowerCase()
      // Extract numeric part from order ID (e.g., "ORD-1768751659979-588" -> "1768751659979588")
      const numericPart = order.id.replace(/\D/g, '')
      if (!orderIdLower.includes(searchLower) && !numericPart.includes(searchLower)) {
        return false
      }
    }

    // Order status filter
    if (filters.orderStatus.length > 0) {
      const statusMap = {
        'preparing': 'PREPARING',
        'ready': 'READY',
        'out-for-delivery': 'OUT FOR DELIVERY',
        'delivered': 'DELIVERED',
        'rejected': 'REJECTED',
        'cancelled': 'CANCELLED'
      }
      const matchesStatus = filters.orderStatus.some(
        statusId => statusMap[statusId] === order.status
      )
      if (!matchesStatus) return false
    }

    // Order type filter
    if (filters.orderType.length > 0) {
      const hasMatchingTag = order.tags?.some(tag => {
        const tagLower = tag.toLowerCase().replace(/\s+/g, '-')
        return filters.orderType.includes(tagLower)
      })
      if (!hasMatchingTag) return false
    }

    return true
  })

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE))
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ORDERS_PER_PAGE,
    currentPage * ORDERS_PER_PAGE,
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filters, startDate, endDate])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <div className="flex-1">
            <p className="text-sm text-gray-600">Showing order history for</p>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-gray-900">
                {restaurantData?.name || 'Restaurant'}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="px-4 py-4 space-y-3">
        {/* Search Bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilterPopup(true)}
            className={`p-2.5 border rounded-lg transition-colors relative ${
              hasActiveFilters() 
                ? 'bg-[#f3f5f7] border-primary hover:bg-[#e7eaef]' 
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
            aria-label="Filter"
          >
            <Filter className={`w-5 h-5 ${hasActiveFilters() ? 'text-primary' : 'text-gray-900'}`} />
            {hasActiveFilters() && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-white text-xs flex items-center justify-center font-bold">
                {Object.values(filters).flat().length}
              </span>
            )}
          </button>
        </div>

        {/* Date Range Selector */}
        <button
          onClick={() => setShowDateRangePopup(true)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900 capitalize">{selectedDateRange.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{formatDateRange()}</p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        </button>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters() && (
        <div className="px-4 pb-2">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#f3f5f7] border border-[#c3ccd6] rounded-lg p-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              <span className="text-sm text-[#051424]">
                <span className="font-semibold">{Object.values(filters).flat().length}</span> filter{Object.values(filters).flat().length !== 1 ? 's' : ''} applied
              </span>
            </div>
            <button
              onClick={handleClearFilters}
              className="text-xs text-primary hover:text-[#071b32] font-medium hover:underline"
            >
              Clear all
            </button>
          </motion.div>
        </div>
      )}

      {/* Orders List */}
      <div className="px-4 pb-24 space-y-3">
        {loading && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-600 text-sm">Loading orders...</p>
            </div>
          </div>
        )}
        
        {!loading && error && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <div className="flex flex-col items-center gap-3">
              <p className="text-red-600 font-medium text-sm">Error loading orders</p>
              <p className="text-gray-500 text-xs">{error}</p>
            </div>
          </div>
        )}
        
        {!loading && !error && (
          <AnimatePresence mode="popLayout">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <div className="flex flex-col items-center gap-3">
                  <p className="text-gray-900 font-medium text-sm">No orders found</p>
                  <p className="text-gray-500 text-xs">
                    Try changing the date range or search filters.
                  </p>
                </div>
              </div>
            ) : paginatedOrders.map((order, index) => (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ 
                duration: 0.3, 
                delay: Math.min(index * 0.05, 0.3),
                layout: { duration: 0.3 }
              }}
              onClick={() => navigate(`/restaurant/orders/${order.id}`)}
              className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
            {/* Status and Order ID Row */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-1 rounded text-xs font-bold ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
                {order.tags && order.tags.map((tag, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded text-xs font-bold bg-green-600 text-white">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{order.date}, {order.time}</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Order ID */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base font-bold text-gray-900">ID: {order.id}</span>
              <button
                onClick={(e) => handleCopyOrderId(order.id, e)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                aria-label="Copy order ID"
              >
                <Copy className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Restaurant Info */}
            <p className="text-sm text-gray-900 mb-1">
              {order.restaurant}, {order.address}
            </p>

            {/* Customer Info */}
            <p className="text-sm text-gray-600 mb-3">
              Ordered by {order.customer}
            </p>

            {/* Divider */}
            <div className="border-t border-dashed border-gray-300 my-3"></div>

            {/* Order Items */}
            <div className="space-y-2">
              {order.items.slice(0, 1).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-gray-900">
                    {item.quantity} x {item.name}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{formatMoney(item.price)}</span>
                </div>
              ))}
              {order.items.length > 1 && (
                <p className="text-sm text-gray-500">+{order.items.length - 1} more items</p>
              )}
            </div>

            {/* Reason/Status Message */}
            {order.reason && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-sm text-red-600">{order.reason}</p>
              </div>
            )}
            </motion.div>
            ))}
          </AnimatePresence>
        )}

        {!loading && !error && filteredOrders.length > ORDERS_PER_PAGE && (
          <div className="mt-5 rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-gray-500">
                Showing {(currentPage - 1) * ORDERS_PER_PAGE + 1}-
                {Math.min(currentPage * ORDERS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length}
              </p>
              <p className="text-xs font-semibold text-gray-700">
                Page {currentPage} / {totalPages}
              </p>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  currentPage === 1
                    ? "cursor-not-allowed bg-gray-100 text-gray-400"
                    : "bg-gray-900 text-white hover:bg-black"
                }`}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, index) => index + 1)
                  .slice(Math.max(0, currentPage - 2), Math.min(totalPages, currentPage + 1))
                  .map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setCurrentPage(pageNumber)}
                      className={`h-9 min-w-[36px] rounded-lg px-2 text-sm font-semibold transition-colors ${
                        currentPage === pageNumber
                          ? "bg-primary text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  ))}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  currentPage === totalPages
                    ? "cursor-not-allowed bg-gray-100 text-gray-400"
                    : "bg-gray-900 text-white hover:bg-black"
                }`}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Date Range Popup */}
      <AnimatePresence>
        {showDateRangePopup && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowDateRangePopup(false)}
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{
                type: "spring",
                damping: 30,
                stiffness: 300
              }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
              </div>

              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Select date range</h2>
                <button
                  onClick={() => setShowDateRangePopup(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-900" />
                </button>
              </div>

              <div className="px-4 py-3 pb-6 space-y-2">
                {dateRangeOptions.map((option) => {
                  const isSelected =
                    selectedDateRange?.label?.toLowerCase() === option.label.toLowerCase()

                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => handleDateRangeSelect(option)}
                      className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-[#f3f5f7]"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900 capitalize">{option.label}</p>
                        {!option.custom && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {(() => {
                              const dates = option.getDates()
                              const start = dates.start.toLocaleDateString("en-US", { day: "numeric", month: "short" })
                              const end = dates.end.toLocaleDateString("en-US", { day: "numeric", month: "short" })
                              return `${start} - ${end}`
                            })()}
                          </p>
                        )}
                      </div>
                      {isSelected && <span className="text-xs font-semibold text-primary">Selected</span>}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Calendar Popup */}
      <AnimatePresence>
        {showCalendar && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-[60]"
              onClick={() => setShowCalendar(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4"
              onClick={() => setShowCalendar(false)}
            >
              <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
                <DateRangeCalendar
                  startDate={startDate}
                  endDate={endDate}
                  onDateRangeChange={handleDateRangeChange}
                  onClose={() => setShowCalendar(false)}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Filter Popup */}
      <AnimatePresence>
        {showFilterPopup && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowFilterPopup(false)}
            />
            
            {/* Filter Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ 
                type: "spring",
                damping: 30,
                stiffness: 300
              }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 flex flex-col"
              style={{ height: '65vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle */}
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Filters</h2>
                <button
                  onClick={() => setShowFilterPopup(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-900" />
                </button>
              </div>

              {/* Main Content */}
              <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Categories */}
                <div className="w-28 bg-gray-50 border-r border-gray-200 overflow-y-auto">
                  {filterCategories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => {
                        setActiveFilterCategory(category.id)
                        setFilterSearch("")
                      }}
                      className={`w-full px-2 py-3 text-left text-xs transition-colors border-b border-gray-200 ${
                        activeFilterCategory === category.id
                          ? 'bg-white text-gray-900 font-semibold border-2 border-l-black'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>

                {/* Filter Options */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Search Bar */}
                  <div className="p-3 border-b border-gray-200">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search"
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Options List */}
                  <div className="flex-1 overflow-y-auto px-3 py-2">
                    {filterOptions[activeFilterCategory]
                      ?.filter(option => 
                        option.label.toLowerCase().includes(filterSearch.toLowerCase())
                      )
                      .map((option) => {
                        const isChecked = isFilterChecked(option)
                        const isRadio = activeFilterCategory === "Ratings"
                        
                        return (
                          <label
                            key={option.id}
                            className="flex items-center py-2.5 cursor-pointer hover:bg-gray-50 rounded-lg px-2 transition-colors"
                          >
                            <div className="relative flex items-center justify-center">
                              {isRadio ? (
                                <div
                                  onClick={() => handleFilterToggle(option)}
                                  className={`w-5 h-5 rounded-full border-2 cursor-pointer transition-all ${
                                    isChecked 
                                      ? 'border-primary bg-white' 
                                      : 'border-gray-300 bg-white'
                                  }`}
                                >
                                  {isChecked && (
                                    <div className="w-full h-full rounded-full flex items-center justify-center">
                                      <div className="w-3 h-3 rounded-full bg-primary"></div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleFilterToggle(option)}
                                  className="w-5 h-5 border-2 border-gray-300 rounded cursor-pointer transition-all appearance-none checked:bg-primary checked:border-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 relative"
                                  style={{
                                    backgroundImage: isChecked ? `url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e")` : 'none',
                                    backgroundSize: '100% 100%',
                                    backgroundPosition: '50%',
                                    backgroundRepeat: 'no-repeat'
                                  }}
                                />
                              )}
                            </div>
                            <span className="ml-3 text-sm text-gray-900">{option.label}</span>
                          </label>
                        )
                      })}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-200 bg-white">
                <button
                  onClick={handleClearFilters}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  Clear all
                </button>
                <button
                  onClick={handleApplyFilters}
                  disabled={isApplyingFilters}
                  className="flex-1 px-4 py-2.5 bg-black rounded-lg text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isApplyingFilters ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Applying...
                    </>
                  ) : (
                    'Apply'
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isApplyingFilters && !showFilterPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-sm font-medium text-gray-900">Applying filters...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-60 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium">Order ID copied to clipboard</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
