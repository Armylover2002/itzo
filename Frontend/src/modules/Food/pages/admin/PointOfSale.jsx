import { useState, useEffect } from 'react'
import { Search, TrendingUp, TrendingDown, DollarSign, ShoppingCart, XCircle, Star, Calendar, BarChart3, Users, Package } from 'lucide-react'
import { adminAPI } from '@food/api'
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function PointOfSale() {
  const [restaurants, setRestaurants] = useState([])
  const [selectedRestaurant, setSelectedRestaurant] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [restaurantData, setRestaurantData] = useState(null)
  const [paymentSummary, setPaymentSummary] = useState(null)
  const [showSearchResults, setShowSearchResults] = useState(false)

  const getRestaurantName = (restaurant) => {
    return String(
      restaurant?.name ||
      restaurant?.restaurantName ||
      restaurant?.restaurant?.name ||
      '',
    ).trim()
  }

  const getRestaurantCode = (restaurant) => {
    return String(
      restaurant?.restaurantId ||
      restaurant?.restaurantCode ||
      restaurant?.restaurant?.restaurantId ||
      restaurant?._id ||
      '',
    ).trim()
  }

  const normalizeRestaurants = (rawList) => {
    if (!Array.isArray(rawList)) return []

    return rawList
      .map((restaurant) => {
        const id = String(
          restaurant?._id ||
          restaurant?.id ||
          restaurant?.restaurant?._id ||
          restaurant?.restaurantId ||
          '',
        ).trim()
        if (!id) return null

        const resolvedName = getRestaurantName(restaurant) || `Restaurant ${id.slice(-6)}`
        const resolvedCode = getRestaurantCode(restaurant)

        return {
          ...restaurant,
          _id: id,
          name: resolvedName,
          restaurantId: resolvedCode,
        }
      })
      .filter(Boolean)
  }

  // Default analytics shape before the API responds
  const [analyticsData, setAnalyticsData] = useState({
    totalOrders: 0,
    cancelledOrders: 0,
    completedOrders: 0,
    averageRating: 0,
    totalRatings: 0,
    monthlyProfit: 0,
    yearlyProfit: 0,
    averageOrderValue: 0,
    totalRevenue: 0,
    restaurantEarning: 0,
    restaurantProfit: 0,
    monthlyOrders: 0,
    yearlyOrders: 0,
    averageMonthlyProfit: 0,
    averageYearlyProfit: 0,
    status: 'active',
    joinDate: '',
    totalCustomers: 0,
    repeatCustomers: 0,
    cancellationRate: 0,
    completionRate: 0
  })

  // Fetch restaurants list
  useEffect(() => {
    fetchRestaurants()
  }, [])

  // Fetch restaurant analytics when restaurant is selected
  useEffect(() => {
    if (selectedRestaurant) {
      fetchRestaurantAnalytics(selectedRestaurant)
    } else {
      setRestaurantData(null)
      setPaymentSummary(null)
      setAnalyticsData({
        totalOrders: 0,
        cancelledOrders: 0,
        completedOrders: 0,
        averageRating: 0,
        totalRatings: 0,
        monthlyProfit: 0,
        yearlyProfit: 0,
        averageOrderValue: 0,
        totalRevenue: 0,
        restaurantEarning: 0,
        restaurantProfit: 0,
        monthlyOrders: 0,
        yearlyOrders: 0,
        averageMonthlyProfit: 0,
        averageYearlyProfit: 0,
        status: 'active',
        joinDate: '',
        totalCustomers: 0,
        repeatCustomers: 0,
        cancellationRate: 0,
        completionRate: 0
      })
    }
  }, [selectedRestaurant])

  const fetchRestaurants = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getRestaurants({ limit: 1000, isActive: true })
      if (response?.data?.success) {
        const rawRestaurants = response.data.data?.restaurants || response.data.data || []
        setRestaurants(normalizeRestaurants(rawRestaurants))
      }
    } catch (error) {
      debugError('Error fetching restaurants:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRestaurantAnalytics = async (restaurantId) => {
    try {
      setLoading(true)
      
      // Validate restaurantId
      if (!restaurantId) {
        debugError('Restaurant ID is required')
        return
      }
      
      debugLog('Fetching analytics for restaurant:', restaurantId)
      
      // Fetch comprehensive restaurant analytics from backend
      const analyticsResponse = await adminAPI.getRestaurantAnalytics(restaurantId)
      
      debugLog('Analytics response:', analyticsResponse)
      
      if (analyticsResponse?.data?.success && analyticsResponse.data.data) {
        const { restaurant, analytics, paymentSummary: apiPaymentSummary } = analyticsResponse.data.data
        
        debugLog('Analytics data received:', analytics)
        // Set restaurant data
        setRestaurantData(restaurant)
        setPaymentSummary(apiPaymentSummary || null)

        // Set analytics data - ensure all values are numbers, not null/undefined
        setAnalyticsData({
          totalOrders: Number(analytics.totalOrders) || 0,
          cancelledOrders: Number(analytics.cancelledOrders) || 0,
          completedOrders: Number(analytics.completedOrders) || 0,
          averageRating: Number(analytics.averageRating) || 0,
          totalRatings: Number(analytics.totalRatings) || 0,
          monthlyProfit: analytics.monthlyProfit || 0,
          yearlyProfit: analytics.yearlyProfit || 0,
          averageOrderValue: analytics.averageOrderValue || 0,
          totalRevenue: analytics.totalRevenue || 0,
          restaurantEarning: analytics.restaurantEarning || 0,
          restaurantProfit: analytics.restaurantProfit || 0,
          monthlyOrders: analytics.monthlyOrders || 0,
          yearlyOrders: analytics.yearlyOrders || 0,
          averageMonthlyProfit: analytics.averageMonthlyProfit || 0,
          averageYearlyProfit: analytics.averageYearlyProfit || 0,
          status: analytics.status || 'inactive',
          joinDate: analytics.joinDate || restaurant.createdAt || new Date(),
          totalCustomers: analytics.totalCustomers || 0,
          repeatCustomers: analytics.repeatCustomers || 0,
          cancellationRate: analytics.cancellationRate || 0,
          completionRate: analytics.completionRate || 0
        })
      } else {
        // Fallback to empty data if API fails
        setPaymentSummary(null)
        setAnalyticsData({
          totalOrders: 0,
          cancelledOrders: 0,
          completedOrders: 0,
          averageRating: 0,
          totalRatings: 0,
          monthlyProfit: 0,
          yearlyProfit: 0,
          averageOrderValue: 0,
          totalRevenue: 0,
          restaurantEarning: 0,
          restaurantProfit: 0,
          monthlyOrders: 0,
          yearlyOrders: 0,
          averageMonthlyProfit: 0,
          averageYearlyProfit: 0,
          status: 'inactive',
          joinDate: new Date(),
          totalCustomers: 0,
          repeatCustomers: 0,
          cancellationRate: 0,
          completionRate: 0
        })
      }
    } catch (error) {
      debugError('Error fetching restaurant analytics:', error)
      debugError('Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
        restaurantId: selectedRestaurant
      })
      
      // Show user-friendly error message
      if (error?.response?.status === 404) {
        debugWarn('Restaurant not found')
      } else if (error?.response?.status === 400) {
        debugWarn('Invalid restaurant ID')
      } else {
        debugWarn('Failed to fetch analytics. Please try again.')
      }
      
      // Set empty data on error
      setPaymentSummary(null)
      setAnalyticsData({
        totalOrders: 0,
        cancelledOrders: 0,
        completedOrders: 0,
        averageRating: 0,
        totalRatings: 0,
        monthlyProfit: 0,
        yearlyProfit: 0,
        averageOrderValue: 0,
        totalRevenue: 0,
        restaurantEarning: 0,
        restaurantProfit: 0,
        monthlyOrders: 0,
        yearlyOrders: 0,
        averageMonthlyProfit: 0,
        averageYearlyProfit: 0,
        status: 'inactive',
        joinDate: new Date(),
        totalCustomers: 0,
        repeatCustomers: 0,
        cancellationRate: 0,
        completionRate: 0
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredRestaurants = restaurants.filter(restaurant => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      restaurant.name?.toLowerCase().includes(query) ||
      restaurant.restaurantId?.toLowerCase().includes(query) ||
      restaurant._id?.toLowerCase().includes(query)
    )
  })

  // Handle restaurant selection from search
  const handleRestaurantSelect = (restaurantId) => {
    setSelectedRestaurant(restaurantId)
    const selected = restaurants.find(r => r._id === restaurantId)
    if (selected) {
      setSearchQuery(selected.name)
    }
    setShowSearchResults(false)
  }

  // Handle search input change
  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchQuery(value)
    setShowSearchResults(value.trim().length > 0)
    
    // If search is cleared, clear selection
    if (!value.trim()) {
      setSelectedRestaurant('')
      setShowSearchResults(false)
    }
  }

  const formatCurrency = (amount) => {
    return `\u20B9 ${amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`
  }

  const formatNumber = (num) => {
    return num?.toLocaleString('en-IN') || '0'
  }

  const getSelectedRestaurantName = () => {
    const restaurant = restaurants.find(r => r._id === selectedRestaurant)
    return restaurant?.name || 'Select Restaurant'
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-neutral-200 overflow-x-hidden w-full" style={{ maxWidth: '100vw', boxSizing: 'border-box' }}>
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
        
        {/* Header Section */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#334257] mb-2">Restaurant POS Analytics & Benefits</h1>
          <p className="text-sm text-[#8a94aa]">Track restaurant performance, profits, and commission details</p>
                </div>

        {/* Restaurant Selection Card */}
        <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6 mb-6">
          <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#334257] mb-2">
                Search Restaurant by Name or ID <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
                    <input
                      type="text"
                      value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => {
                    if (searchQuery.trim()) {
                      setShowSearchResults(true)
                    }
                  }}
                  onBlur={() => {
                    // Delay to allow click on results
                    setTimeout(() => setShowSearchResults(false), 200)
                  }}
                  placeholder="Type restaurant name or ID to search..."
                  className="w-full h-11 pl-10 pr-3 rounded-md border border-[#e3e6ef] bg-white text-sm text-[#4a5671] focus:outline-none focus:ring-1 focus:ring-[#006fbd]"
                />
                
                {/* Search Results Dropdown */}
                {showSearchResults && filteredRestaurants.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-[#e3e6ef] rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredRestaurants.map(restaurant => (
                      <button
                        key={restaurant._id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleRestaurantSelect(restaurant._id)
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-[#f9fafc] cursor-pointer border-b border-[#e3e6ef] last:border-b-0 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-[#334257]">{restaurant.name}</p>
                            <p className="text-xs text-[#8a94aa]">ID: {restaurant.restaurantId || restaurant._id}</p>
                          </div>
                          {selectedRestaurant === restaurant._id && (
                            <div className="w-2 h-2 bg-[#006fbd] rounded-full"></div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* No Results Message */}
                {showSearchResults && searchQuery.trim() && filteredRestaurants.length === 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-[#e3e6ef] rounded-md shadow-lg p-4">
                    <p className="text-sm text-[#8a94aa] text-center">No restaurants found matching "{searchQuery}"</p>
                  </div>
                )}
                  </div>
              {selectedRestaurant && (
                <p className="text-xs text-green-600 mt-2">
                  Selected: {getSelectedRestaurantName()}
                </p>
              )}
        </div>

            {/* Alternative: Dropdown Selector */}
            <div>
                    <label className="block text-sm font-medium text-[#334257] mb-2">
                Or Select from Dropdown
                    </label>
                    <div className="relative">
                      <select 
                  value={selectedRestaurant}
                  onChange={(e) => {
                    setSelectedRestaurant(e.target.value)
                    const selected = restaurants.find(r => r._id === e.target.value)
                    if (selected) {
                      setSearchQuery(selected.name)
                    }
                  }}
                        className="w-full h-11 rounded-md border border-[#e3e6ef] bg-white px-3 pr-10 text-sm text-[#4a5671] focus:outline-none focus:ring-1 focus:ring-[#006fbd]"
                      >
                  <option value="">Select Restaurant</option>
                  {restaurants.map(restaurant => (
                    <option key={restaurant._id} value={restaurant._id}>
                      {restaurant.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  </div>
                </div>

        {/* Analytics Dashboard */}
        {selectedRestaurant && !loading ? (
          <div className="space-y-6">
            {/* Restaurant Header Info */}
            <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[#334257] mb-1">{getSelectedRestaurantName()}</h2>
                  <p className="text-sm text-[#8a94aa]">
                    Restaurant ID: {restaurants.find(r => r._id === selectedRestaurant)?.restaurantId || selectedRestaurant}
                  </p>
                </div>
                <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  analyticsData.status === 'active' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {analyticsData.status === 'active' ? 'Active' : 'Inactive'}
                </div>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Orders */}
              <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-[#f0e7f9] rounded-lg">
                    <ShoppingCart className="w-6 h-6 text-primary" />
                  </div>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <h3 className="text-sm font-medium text-[#8a94aa] mb-1">Total Orders</h3>
                <p className="text-2xl font-bold text-[#334257]">{formatNumber(analyticsData.totalOrders)}</p>
                <p className="text-xs text-[#8a94aa] mt-2">Completed: {formatNumber(analyticsData.completedOrders)}</p>
                </div>

              {/* Cancelled Orders */}
              <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-red-100 rounded-lg">
                    <XCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <span className="text-sm font-semibold text-red-600">{analyticsData.cancellationRate.toFixed(1)}%</span>
                </div>
                <h3 className="text-sm font-medium text-[#8a94aa] mb-1">Cancelled Orders</h3>
                <p className="text-2xl font-bold text-[#334257]">{formatNumber(analyticsData.cancelledOrders)}</p>
                <p className="text-xs text-[#8a94aa] mt-2">Cancellation Rate</p>
                </div>

              {/* Average Rating */}
              <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <Star className="w-6 h-6 text-yellow-600 fill-yellow-600" />
                  </div>
                  <span className="text-sm font-semibold text-green-600">+{analyticsData.averageRating}</span>
                </div>
                <h3 className="text-sm font-medium text-[#8a94aa] mb-1">Average Rating</h3>
                <p className="text-2xl font-bold text-[#334257]">{analyticsData.averageRating.toFixed(1)}</p>
                <p className="text-xs text-[#8a94aa] mt-2">From {formatNumber(analyticsData.totalRatings)} reviews</p>
              </div>
            </div>

            {/* Profit & Revenue Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Profit */}
              <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <Calendar className="w-6 h-6 text-green-600" />
                  </div>
                    <div>
                      <h3 className="text-base font-semibold text-[#334257]">Monthly Profit</h3>
                      <p className="text-xs text-[#8a94aa]">Current Month</p>
                  </div>
                  </div>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-[#334257] mb-2">{formatCurrency(analyticsData.monthlyProfit)}</p>
                  <div className="flex items-center gap-4 mt-4 text-sm">
                    <div>
                      <span className="text-[#8a94aa]">Orders: </span>
                      <span className="font-semibold text-[#334257]">{formatNumber(analyticsData.monthlyOrders)}</span>
                    </div>
                    <div>
                      <span className="text-[#8a94aa]">Avg/Month: </span>
                      <span className="font-semibold text-[#334257]">{formatCurrency(analyticsData.averageMonthlyProfit)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Yearly Profit */}
              <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-[#f0e7f9] rounded-lg">
                      <BarChart3 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-[#334257]">Yearly Profit</h3>
                      <p className="text-xs text-[#8a94aa]">Current Year</p>
                    </div>
                  </div>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-[#334257] mb-2">{formatCurrency(analyticsData.yearlyProfit)}</p>
                  <div className="flex items-center gap-4 mt-4 text-sm">
                    <div>
                      <span className="text-[#8a94aa]">Orders: </span>
                      <span className="font-semibold text-[#334257]">{formatNumber(analyticsData.yearlyOrders)}</span>
              </div>
                    <div>
                      <span className="text-[#8a94aa]">Avg/Year: </span>
                      <span className="font-semibold text-[#334257]">{formatCurrency(analyticsData.averageYearlyProfit)}</span>
            </div>
          </div>
        </div>
        </div>
      </div>

            {/* Detailed Financial Breakdown */}
            <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
              <h3 className="text-lg font-semibold text-[#334257] mb-4">Financial Breakdown</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-[#e3e6ef]">
                    <span className="text-sm text-[#8a94aa]">Subtotal (Dish Price)</span>
                    <span className="text-base font-semibold text-[#334257]">{formatCurrency(paymentSummary?.subtotal || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-[#e3e6ef]">
                    <span className="text-sm text-[#8a94aa]">Total Revenue</span>
                    <span className="text-base font-semibold text-[#334257]">{formatCurrency(analyticsData.totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-[#e3e6ef]">
                    <span className="text-sm text-[#8a94aa]">Restaurant Share</span>
                    <span className="text-base font-semibold text-green-600">{formatCurrency(analyticsData.restaurantEarning)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-[#e3e6ef]">
                    <span className="text-sm text-[#8a94aa]">Restaurant Profit</span>
                    <span className="text-base font-semibold text-emerald-700">{formatCurrency(analyticsData.restaurantProfit)}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-[#e3e6ef]">
                    <span className="text-sm text-[#8a94aa]">Average Order Value</span>
                    <span className="text-base font-semibold text-[#334257]">{formatCurrency(analyticsData.averageOrderValue)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-[#e3e6ef]">
                    <span className="text-sm text-[#8a94aa]">Completion Rate</span>
                    <span className="text-base font-semibold text-green-600">{analyticsData.completionRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Restaurant Payments (from FoodTransaction ledger) */}
            <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
              <h3 className="text-lg font-semibold text-[#334257] mb-4">Restaurant Payments (Completed Orders)</h3>
              <p className="text-xs text-[#8a94aa] mb-4">
                Breakdown based on transaction ledger. “Subtotal” reflects total dish value (food price).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-[#e3e6ef]">
                    <span className="text-sm text-[#8a94aa]">Subtotal (Dish Price)</span>
                    <span className="text-sm font-semibold text-[#334257]">{formatCurrency(paymentSummary?.subtotal || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#e3e6ef]">
                    <span className="text-sm text-[#8a94aa]">Tax</span>
                    <span className="text-sm font-semibold text-[#334257]">{formatCurrency(paymentSummary?.tax || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#e3e6ef]">
                    <span className="text-sm text-[#8a94aa]">Delivery Fee</span>
                    <span className="text-sm font-semibold text-[#334257]">{formatCurrency(paymentSummary?.deliveryFee || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#e3e6ef]">
                    <span className="text-sm text-[#8a94aa]">Platform Fee</span>
                    <span className="text-sm font-semibold text-[#334257]">{formatCurrency(paymentSummary?.platformFee || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#e3e6ef]">
                    <span className="text-sm text-[#8a94aa]">Discount</span>
                    <span className="text-sm font-semibold text-[#334257]">{formatCurrency(paymentSummary?.discount || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm font-semibold text-[#334257]">Total Order Value</span>
                    <span className="text-sm font-bold text-[#006fbd]">{formatCurrency(paymentSummary?.total || 0)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-[#e3e6ef]">
                    <span className="text-sm text-[#8a94aa]">Restaurant Share</span>
                    <span className="text-sm font-semibold text-green-700">{formatCurrency(paymentSummary?.restaurantShare || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#e3e6ef]">
                    <span className="text-sm text-[#8a94aa]">Rider Share</span>
                    <span className="text-sm font-semibold text-[#334257]">{formatCurrency(paymentSummary?.riderShare || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-[#8a94aa]">Platform Net Profit</span>
                    <span className="text-sm font-semibold text-[#334257]">{formatCurrency(paymentSummary?.platformNetProfit || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Additional Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Statistics */}
              <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-[#f0e7f9] rounded-lg">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold text-[#334257]">Customer Statistics</h3>
                  </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#8a94aa]">Total Customers</span>
                    <span className="text-sm font-semibold text-[#334257]">{formatNumber(analyticsData.totalCustomers)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#8a94aa]">Repeat Customers</span>
                    <span className="text-sm font-semibold text-[#334257]">{formatNumber(analyticsData.repeatCustomers)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#8a94aa]">Customer Retention</span>
                    <span className="text-sm font-semibold text-green-600">
                      {analyticsData.totalCustomers > 0 
                        ? ((analyticsData.repeatCustomers / analyticsData.totalCustomers) * 100).toFixed(1) 
                        : '0'}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Restaurant Details */}
              <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-[#f0e7f9] rounded-lg">
                    <Package className="w-5 h-5 text-[#550fa8]" />
                  </div>
                  <h3 className="text-base font-semibold text-[#334257]">Restaurant Details</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#8a94aa]">Join Date</span>
                    <span className="text-sm font-semibold text-[#334257]">
                      {new Date(analyticsData.joinDate).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#8a94aa]">Status</span>
                    <span className={`text-sm font-semibold px-2 py-1 rounded ${
                      analyticsData.status === 'active' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {analyticsData.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#8a94aa]">Total Reviews</span>
                    <span className="text-sm font-semibold text-[#334257]">{formatNumber(analyticsData.totalRatings)}</span>
                  </div>
          </div>
              </div>
              </div>

            {/* Order Statistics Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-6">
              <h3 className="text-lg font-semibold text-[#334257] mb-4">Order Statistics Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-[#f7f3fc] rounded-lg">
                  <p className="text-2xl font-bold text-primary">{formatNumber(analyticsData.totalOrders)}</p>
                  <p className="text-xs text-[#8a94aa] mt-1">Total Orders</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{formatNumber(analyticsData.completedOrders)}</p>
                  <p className="text-xs text-[#8a94aa] mt-1">Completed</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{formatNumber(analyticsData.cancelledOrders)}</p>
                  <p className="text-xs text-[#8a94aa] mt-1">Cancelled</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{analyticsData.completionRate.toFixed(1)}%</p>
                  <p className="text-xs text-[#8a94aa] mt-1">Success Rate</p>
                </div>
              </div>
            </div>
          </div>
        ) : selectedRestaurant && loading ? (
          <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#006fbd] mx-auto mb-4"></div>
            <p className="text-sm text-[#8a94aa]">Loading restaurant analytics...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-[#e3e6ef] p-12 text-center">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#d1d7e6] flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-[#8a94aa]" />
            </div>
            <p className="text-base font-medium text-[#334257] mb-2">Select a Restaurant</p>
            <p className="text-sm text-[#8a94aa] max-w-md mx-auto">
              Please select a restaurant from the dropdown above to view detailed analytics, profit information, and payment details.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

