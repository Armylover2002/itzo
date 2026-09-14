import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Lenis from "lenis"
import BottomNavbar from "@food/components/restaurant/BottomNavbar"
import MenuOverlay from "@food/components/restaurant/MenuOverlay"
import NewOrderNotification from "@food/components/restaurant/NewOrderNotification"
import { useRestaurantNotifications } from "@food/hooks/useRestaurantNotifications"
import { 
  Home,
  ShoppingBag,
  Store,
  Wallet,
  Menu,
  CheckCircle,
  Loader2
} from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import { useNavigate } from "react-router-dom"
import { restaurantAPI } from "@food/api"
import { RestaurantGridSkeleton } from "@food/components/ui/loading-skeletons"
import { useDelayedLoading } from "@food/hooks/useDelayedLoading"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

function startOfLocalDay(d = new Date()) {
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  return day
}

/** Order volume cards from live API orders (not localStorage wallet mocks). */
function buildOrderSummaryCards(orders) {
  const todayStart = startOfLocalDay()
  const weekStart = new Date(todayStart)
  weekStart.setDate(todayStart.getDate() - 7)
  const monthStart = new Date(todayStart)
  monthStart.setMonth(todayStart.getMonth() - 1)

  let todayCount = 0
  let weekCount = 0
  let monthCount = 0

  for (const order of orders) {
    const created = order?.createdAt ? new Date(order.createdAt) : null
    if (!created || Number.isNaN(created.getTime())) continue
    if (created >= todayStart) todayCount += 1
    if (created >= weekStart) weekCount += 1
    if (created >= monthStart) monthCount += 1
  }

  return [
    { label: "Today", count: todayCount },
    { label: "This Week", count: weekCount },
    { label: "This Month", count: monthCount },
  ]
}

export default function OrdersPage() {
  const navigate = useNavigate()
  // Default to "all" to show all orders (active + history)
  const [activeFilterTab, setActiveFilterTab] = useState("all")
  const [showMenu, setShowMenu] = useState(false)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const showOrdersSkeleton = useDelayedLoading(loading, { delay: 120, minDuration: 360 })

  // Restaurant notifications hook
  const { newOrder, clearNewOrder, isConnected } = useRestaurantNotifications({
    enableSound: false,
  })

  const notificationOrder = newOrder
    ? {
        ...newOrder,
        orderMongoId: newOrder.orderMongoId || newOrder._id || newOrder.id,
        total: newOrder.total ?? newOrder.pricing?.total ?? 0,
        customerAddress: newOrder.customerAddress || newOrder.deliveryAddress || newOrder.address,
      }
    : null

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  const summaryCards = useMemo(() => buildOrderSummaryCards(orders), [orders])

  // Fetch orders from API
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await restaurantAPI.getOrders()
        
        if (response.data?.success && response.data.data?.orders) {
          // Transform API orders to match component structure
          const transformedOrders = response.data.data.orders.map(order => {
            const createdAt = new Date(order.createdAt)
            const now = new Date()
            const diffMs = now - createdAt
            const diffMins = Math.floor(diffMs / 60000)
            const diffHours = Math.floor(diffMs / 3600000)
            const diffDays = Math.floor(diffMs / 86400000)
            
            let timeAgo = ""
            if (diffMins < 1) {
              timeAgo = "Just now"
            } else if (diffMins < 60) {
              timeAgo = `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
            } else if (diffHours < 24) {
              timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
            } else if (diffDays < 7) {
              timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
            } else {
              const weeks = Math.floor(diffDays / 7)
              timeAgo = `${weeks} week${weeks > 1 ? 's' : ''} ago`
            }
            
            return {
              id: order.orderId || order._id,
              mongoId: order._id,
              items: order.items?.length || 0,
              timeAgo: timeAgo,
              deliveryType: 'Home Delivery',
              amount: order.pricing?.total || 0,
              status: order.status || 'pending',
              createdAt: order.createdAt,
              customerName: order.userId?.name || order.customerName || 'Customer',
              customerPhone: order.userId?.phone || order.customerPhone || '',
              address: order.address
            }
          })
          
          setOrders(transformedOrders)
        } else {
          setOrders([])
        }
      } catch (err) {
        debugError('Error fetching orders:', err)
        setError(err.response?.data?.message || 'Failed to fetch orders')
        setOrders([])
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()

    // Socket-first: REST poll only when disconnected.
    if (isConnected) {
      return undefined
    }
    const refreshInterval = setInterval(() => {
      fetchOrders()
    }, 45000)

    return () => {
      clearInterval(refreshInterval)
    }
  }, [isConnected])

  // Refresh orders when new order notification is received
  useEffect(() => {
    if (newOrder) {
      debugLog('?? New order notification received, refreshing orders list')
      const fetchOrders = async () => {
        try {
          const response = await restaurantAPI.getOrders()
          if (response.data?.success && response.data.data?.orders) {
            const transformedOrders = response.data.data.orders.map(order => {
              const createdAt = new Date(order.createdAt)
              const now = new Date()
              const diffMs = now - createdAt
              const diffMins = Math.floor(diffMs / 60000)
              const diffHours = Math.floor(diffMs / 3600000)
              const diffDays = Math.floor(diffMs / 86400000)
              
              let timeAgo = ""
              if (diffMins < 1) {
                timeAgo = "Just now"
              } else if (diffMins < 60) {
                timeAgo = `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
              } else if (diffHours < 24) {
                timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
              } else if (diffDays < 7) {
                timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
              } else {
                const weeks = Math.floor(diffDays / 7)
                timeAgo = `${weeks} week${weeks > 1 ? 's' : ''} ago`
              }
              
              return {
                id: order.orderId || order._id,
                mongoId: order._id,
                items: order.items?.length || 0,
                timeAgo: timeAgo,
                deliveryType: 'Home Delivery',
                amount: order.pricing?.total || 0,
                status: order.status || 'pending',
                createdAt: order.createdAt,
                customerName: order.userId?.name || order.customerName || 'Customer',
                customerPhone: order.userId?.phone || order.customerPhone || '',
                address: order.address
              }
            })
            setOrders(transformedOrders)
          }
        } catch (err) {
          debugError('Error refreshing orders:', err)
        }
      }
      fetchOrders()
    }
  }, [newOrder])

  // Refresh orders when new order notification is cleared
  useEffect(() => {
    if (!newOrder) {
      const fetchOrders = async () => {
        try {
          const response = await restaurantAPI.getOrders()
          if (response.data?.success && response.data.data?.orders) {
            const transformedOrders = response.data.data.orders.map(order => {
              const createdAt = new Date(order.createdAt)
              const now = new Date()
              const diffMs = now - createdAt
              const diffMins = Math.floor(diffMs / 60000)
              const diffHours = Math.floor(diffMs / 3600000)
              const diffDays = Math.floor(diffMs / 86400000)
              
              let timeAgo = ""
              if (diffMins < 1) {
                timeAgo = "Just now"
              } else if (diffMins < 60) {
                timeAgo = `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
              } else if (diffHours < 24) {
                timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
              } else if (diffDays < 7) {
                timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
              } else {
                const weeks = Math.floor(diffDays / 7)
                timeAgo = `${weeks} week${weeks > 1 ? 's' : ''} ago`
              }
              
              return {
                id: order.orderId || order._id,
                mongoId: order._id,
                items: order.items?.length || 0,
                timeAgo: timeAgo,
                deliveryType: 'Home Delivery',
                amount: order.pricing?.total || 0,
                status: order.status || 'pending',
                createdAt: order.createdAt,
                customerName: order.userId?.name || order.customerName || 'Customer',
                customerPhone: order.userId?.phone || order.customerPhone || '',
                address: order.address
              }
            })
            setOrders(transformedOrders)
          }
        } catch (err) {
          debugError('Error refreshing orders:', err)
        }
      }
      fetchOrders()
    }
  }, [newOrder])

  // Calculate filter tab counts dynamically from actual orders
  // Show active orders (pending, confirmed, preparing, ready) and history orders (delivered, cancelled)
  const filterTabs = [
    { 
      id: "all", 
      label: "All", 
      count: orders.length 
    },
    { 
      id: "pending", 
      label: "Pending", 
      count: orders.filter(o => o.status === 'pending').length 
    },
    { 
      id: "confirmed", 
      label: "Confirmed", 
      count: orders.filter(o => o.status === 'confirmed').length 
    },
    { 
      id: "preparing", 
      label: "Preparing", 
      count: orders.filter(o => o.status === 'preparing').length 
    },
    { 
      id: "ready", 
      label: "Ready", 
      count: orders.filter(o => o.status === 'ready').length 
    },
    { 
      id: "delivered", 
      label: "Delivered", 
      count: orders.filter(o => o.status === 'delivered').length 
    },
    { 
      id: "cancelled", 
      label: "Cancelled", 
      count: orders.filter(o => o.status === 'cancelled').length 
    }
  ]

  // Filter orders based on active filter tab
  const filteredOrders = orders.filter(order => {
    if (activeFilterTab === 'all') {
      return true
    }
    return order.status === activeFilterTab
  })

  // Get status badge color based on order status
  const getStatusBadgeColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
      case 'confirmed':
        return "bg-yellow-100 text-yellow-700"
      case 'preparing':
        return "bg-blue-100 text-blue-700"
      case 'ready':
        return "bg-purple-100 text-purple-700"
      case 'out_for_delivery':
        return "bg-indigo-100 text-indigo-700"
      case 'delivered':
        return "bg-green-100 text-green-700"
      case 'cancelled':
        return "bg-red-100 text-red-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  // Format status for display
  const formatStatus = (status) => {
    if (!status) return 'Unknown'
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 pb-24 md:pb-6">
        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 text-center md:text-left">
          Orders
        </h1>

        {/* Main Navigation Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <div className="pb-3 px-2 text-sm md:text-base font-medium text-[#ff8100] relative">
            Regular Order
            <motion.div
              layoutId="activeMainTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff8100]"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
          {summaryCards.map((card, index) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1, ease: [0.4, 0, 0.2, 1] }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card className="bg-white shadow-md border-0 overflow-hidden">
                <CardContent className="p-2 md:p-3 text-center flex flex-col justify-center min-h-[60px] md:min-h-[70px]">
                  <p className="text-gray-900 text-sm md:text-base font-bold mb-0.5 leading-tight">
                    {card.count}
                  </p>
                  <p className="text-gray-600 text-sm md:text-base font-medium">
                    {card.label}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
          <div className="flex gap-3 min-w-max md:flex-wrap md:min-w-0 relative">
            {filterTabs.map((tab, index) => (
              <motion.button
                key={tab.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveFilterTab(tab.id)}
                className={`relative z-10 shrink-0 px-4 py-2 rounded-full text-sm md:text-base font-medium transition-colors ${
                  activeFilterTab === tab.id
                    ? "text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                {activeFilterTab === tab.id && (
                  <motion.div
                    layoutId="activeFilterTab"
                    className="absolute inset-0 bg-[#ff8100] rounded-full z-0"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab.label} {tab.count}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-3 md:space-y-4">
          {showOrdersSkeleton ? (
            <RestaurantGridSkeleton
              count={4}
              className="grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-2"
              compact
            />
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 text-base md:text-lg mb-2">Error: {error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="text-blue-600 hover:underline"
              >
                Retry
              </button>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-base md:text-lg">
                {activeFilterTab === 'all' 
                  ? 'No orders found' 
                  : `No ${activeFilterTab} orders found`}
              </p>
            </div>
          ) : (
            filteredOrders.map((order, index) => (
            <motion.div
              key={order.id || order.mongoId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1, ease: [0.4, 0, 0.2, 1] }}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card 
                className="bg-white shadow-sm border-0 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/restaurant/orders/${order.mongoId || order.id}`)}
              >
                <CardContent className="p-3 md:p-5 py-0 gap-0">
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-2 md:mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 font-bold text-sm md:text-base mb-1 leading-tight">
                        Order #{order.id}
                      </p>
                      <p className="text-gray-500 text-xs md:text-sm mb-1.5">
                        {order.items} Item{order.items !== 1 ? 's' : ''} � {order.customerName}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 ${getStatusBadgeColor(order.status)} text-[10px] md:text-xs font-medium px-2 py-0.5 rounded-full`}>
                          <CheckCircle className="w-2.5 h-2.5 md:w-3 md:h-3" />
                          {formatStatus(order.status)}
                        </span>
                        <span className="text-gray-500 text-[10px] md:text-xs">
                          {order.timeAgo}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Footer Row */}
                  <div className="flex items-center justify-between pt-2 md:pt-3 border-t border-gray-100 pb-3 md:pb-0">
                    <span className="text-blue-600 text-xs md:text-sm font-medium">
                      {order.deliveryType}
                    </span>
                    <div className="text-right">
                      <p className="text-gray-500 text-[10px] md:text-xs mb-0.5">Amount</p>
                      <p className="text-gray-900 font-bold text-sm md:text-base">
                        ₹{order.amount?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Bottom Navigation Bar - Mobile Only */}
      <BottomNavbar onMenuClick={() => setShowMenu(true)} />
      
      {/* Menu Overlay */}
      <MenuOverlay showMenu={showMenu} setShowMenu={setShowMenu} />

      {/* New Order Notification */}
      <NewOrderNotification
        order={notificationOrder}
        onClose={clearNewOrder}
        onViewOrder={(order) => {
          navigate(`/restaurant/orders/${order.orderMongoId || order.orderId}`)
        }}
      />
    </div>
  )
}


