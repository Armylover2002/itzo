import { useMemo, useState, useEffect } from "react"
import { Package, Truck, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import OrdersTopbar from "@food/components/admin/orders/OrdersTopbar"
import OrderDetectDeliveryTable from "@food/components/admin/orders/OrderDetectDeliveryTable"
import ViewOrderDialog from "@food/components/admin/orders/ViewOrderDialog"
import FilterPanel from "@food/components/admin/orders/FilterPanel"
import SettingsDialog from "@food/components/admin/orders/SettingsDialog"
import { useGenericTableManagement } from "@food/components/admin/orders/useGenericTableManagement"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const getOrderStatus = (order) => String(order?.orderStatus || order?.status || "").toLowerCase()
const isCancelledOrder = (status, cancelledAt) =>
  status === "cancelled" ||
  status === "cancelled_by_user" ||
  status === "cancelled_by_restaurant" ||
  status === "cancelled_by_admin" ||
  Boolean(cancelledAt)

// Function to map backend order status to frontend display status
const mapOrderStatus = (order) => {
  const status = getOrderStatus(order)
  const { deliveryPartnerName, deliveryState, cancelledAt } = order

  // If cancelled, show as Rejected
  if (isCancelledOrder(status, cancelledAt)) {
    return "Rejected"
  }

  // If delivered, show as Ordered Delivered
  if (status === 'delivered') {
    return "Ordered Delivered"
  }

  // Check delivery state phases
  if (deliveryState?.currentPhase === 'at_delivery' || deliveryState?.currentPhase === 'at_drop') {
    return "Reached Drop"
  }

  if (deliveryState?.currentPhase === 'at_pickup') {
    return "Delivery Boy Reached Pickup"
  }

  // Order ID Accepted
  if (deliveryState?.status === 'order_confirmed' || deliveryState?.currentPhase === 'en_route_to_delivery' || deliveryState?.orderIdConfirmedAt) {
    return "Order ID Accepted"
  }

  // If delivery boy is assigned
  if (deliveryPartnerName) {
    return "Delivery Boy Assigned"
  }

  // Map backend status to frontend status
  const statusMap = {
    'created': 'Ordered',
    'pending': 'Ordered',
    'confirmed': 'Restaurant Accepted',
    'preparing': 'Restaurant Accepted',
    'ready_for_pickup': 'Restaurant Accepted',
    'ready': 'Restaurant Accepted',
    'picked_up': 'Order ID Accepted',
    'out_for_delivery': 'Order ID Accepted',
  }

  return statusMap[status] || 'Ordered'
}

// Function to build status history from order data
const buildStatusHistory = (order) => {
  const history = []
  const { createdAt, tracking, deliveryState, deliveryPartnerName, deliveryPartnerPhone, cancelledAt } = order
  const status = getOrderStatus(order)

  // Format timestamp helper
  const formatTimestamp = (date) => {
    if (!date) return null
    const d = new Date(date)
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  // Ordered - always first
  history.push({
    status: "Ordered",
    timestamp: formatTimestamp(createdAt) || "N/A"
  })

  // Rejected (if cancelled)
  if (isCancelledOrder(status, cancelledAt)) {
    history.push({
      status: "Rejected",
      timestamp: formatTimestamp(cancelledAt) || formatTimestamp(order.updatedAt) || "N/A"
    })
    return history
  }

  // Restaurant Accepted (confirmed)
  if (tracking?.confirmed?.status && tracking?.confirmed?.timestamp) {
    history.push({
      status: "Restaurant Accepted",
      timestamp: formatTimestamp(tracking.confirmed.timestamp)
    })
  } else if (status === 'confirmed' || status === 'preparing' || status === 'ready' || status === 'ready_for_pickup') {
    history.push({
      status: "Restaurant Accepted",
      timestamp: formatTimestamp(order.updatedAt) || "N/A"
    })
  }

  // Delivery Boy Assigned
  if (deliveryPartnerName) {
    history.push({
      status: "Delivery Boy Assigned",
      timestamp: formatTimestamp(deliveryState?.acceptedAt) || formatTimestamp(order.updatedAt) || "N/A",
      deliveryBoy: deliveryPartnerName || "Delivery Boy",
      deliveryBoyNumber: deliveryPartnerPhone || "N/A"
    })
  }

  // Delivery Boy Reached Pickup
  if (deliveryState?.reachedPickupAt) {
    history.push({
      status: "Delivery Boy Reached Pickup",
      timestamp: formatTimestamp(deliveryState.reachedPickupAt)
    })
  } else if (deliveryState?.currentPhase === 'at_pickup') {
    history.push({
      status: "Delivery Boy Reached Pickup",
      timestamp: formatTimestamp(order.updatedAt) || "N/A"
    })
  }

  // Order ID Accepted
  if (deliveryState?.orderIdConfirmedAt) {
    history.push({
      status: "Order ID Accepted",
      timestamp: formatTimestamp(deliveryState.orderIdConfirmedAt)
    })
  } else if (deliveryState?.status === 'order_confirmed' || deliveryState?.currentPhase === 'en_route_to_delivery') {
    history.push({
      status: "Order ID Accepted",
      timestamp: formatTimestamp(order.updatedAt) || "N/A"
    })
  }

  // Reached Drop - must come before Ordered Delivered
  // Check multiple conditions to ensure we catch it even if order is already delivered
  if (deliveryState?.reachedDropAt) {
    // First priority: use reachedDropAt timestamp if available
    history.push({
      status: "Reached Drop",
      timestamp: formatTimestamp(deliveryState.reachedDropAt)
    })
  } else if (
    deliveryState?.currentPhase === 'at_delivery' ||
    deliveryState?.currentPhase === 'at_drop' ||
    deliveryState?.status === 'en_route_to_delivery'
  ) {
    // Second priority: check if currently at delivery phase
    history.push({
      status: "Reached Drop",
      timestamp: formatTimestamp(order.updatedAt) || "N/A"
    })
  } else if (status === 'delivered' && deliveryPartnerName) {
    // Third priority: if order is delivered and delivery boy was assigned,
    // it means reached drop must have happened (can't deliver without reaching drop)
    // Only add if not already added above
    const hasReachedDrop = history.some(h => h.status === "Reached Drop")
    if (!hasReachedDrop) {
      history.push({
        status: "Reached Drop",
        timestamp: formatTimestamp(order.deliveredAt) || formatTimestamp(order.updatedAt) || "N/A"
      })
    }
  }

  // Ordered Delivered - must come after Reached Drop
  if (status === 'delivered' && tracking?.delivered?.timestamp) {
    history.push({
      status: "Ordered Delivered",
      timestamp: formatTimestamp(tracking.delivered.timestamp)
    })
  } else if (status === 'delivered') {
    history.push({
      status: "Ordered Delivered",
      timestamp: formatTimestamp(order.deliveredAt) || formatTimestamp(order.updatedAt) || "N/A"
    })
  }

  return history
}

// Transform backend order to frontend format
const transformOrder = (order, index) => {
  const user = order?.userId && typeof order.userId === "object" ? order.userId : null
  const restaurant = order?.restaurantId && typeof order.restaurantId === "object" ? order.restaurantId : null
  const deliveryFromDispatch =
    order?.dispatch?.deliveryPartnerId && typeof order.dispatch.deliveryPartnerId === "object"
      ? order.dispatch.deliveryPartnerId
      : null

  const deliveryBoyName =
    order.deliveryPartnerName ||
    order.deliveryBoyName ||
    deliveryFromDispatch?.name ||
    order.deliveryPartnerId?.name ||
    null

  const deliveryBoyNumber =
    order.deliveryPartnerPhone ||
    order.deliveryBoyNumber ||
    deliveryFromDispatch?.phone ||
    order.deliveryPartnerId?.phone ||
    null

  const normalizedOrder = {
    ...order,
    status: order.status || order.orderStatus,
    deliveryPartnerName: deliveryBoyName,
    deliveryPartnerPhone: deliveryBoyNumber,
  }

  const orderDate = new Date(order.createdAt)
  const dateStr = orderDate.toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  }).toUpperCase()
  const timeStr = orderDate.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  }).toUpperCase()

  const displayStatus = mapOrderStatus(normalizedOrder)
  const statusHistory = buildStatusHistory(normalizedOrder)

  const paymentMethod = order.payment?.method || order.paymentMethod || ""
  let paymentType = order.paymentType
  if (!paymentType) {
    if (paymentMethod === "cash" || paymentMethod === "cod") paymentType = "Cash on Delivery"
    else if (paymentMethod === "wallet") paymentType = "Wallet"
    else if (paymentMethod) paymentType = "Online"
    else paymentType = "N/A"
  }

  const paymentStatusRaw = order.payment?.status || ""
  let paymentStatus = order.paymentStatus
  if (!paymentStatus) {
    const s = String(paymentStatusRaw || "").toLowerCase()
    if (s === "refunded") paymentStatus = "Refunded"
    else if (s === "paid" || s === "authorized" || s === "captured" || s === "settled") paymentStatus = "Paid"
    else if (s === "failed") paymentStatus = "Failed"
    else paymentStatus = "Pending"
  }

  const customerName = order.customerName || order.userName || user?.name || "N/A"
  const customerPhone = order.customerPhone || order.userNumber || user?.phone || order.deliveryAddress?.phone || "N/A"
  const customerEmail = user?.email || ""

  const restaurantNameResolved =
    order.restaurant ||
    order.restaurantName ||
    restaurant?.restaurantName ||
    ""

  const items = Array.isArray(order.items)
    ? order.items.map((item) => ({
        quantity: item.quantity || 1,
        name: item.name || item.foodName || item.title || "Item",
        price: item.price || 0,
        isVeg: item.isVeg,
      }))
    : []

  const pricing = order.pricing || {}
  const subtotal = Number(pricing.subtotal || 0)
  const deliveryFee = Number(pricing.deliveryFee || 0)
  const platformFee = Number(pricing.platformFee || 0)
  const packagingFee = Number(pricing.packagingFee || 0)
  const taxAmount = Number(pricing.tax || 0)
  const discountAmount = Number(pricing.discount || 0)
  const computedTotal = subtotal + deliveryFee + platformFee + packagingFee + taxAmount - discountAmount
  const totalAmount = Number(
    pricing.total != null ? pricing.total : computedTotal
  )

  return {
    sl: index + 1,
    orderId: order.orderId,
    userName: order.customerName || order.userName || user?.name || 'Unknown',
    userNumber: order.customerPhone || order.userNumber || user?.phone || order.deliveryAddress?.phone || 'N/A',
    restaurantName: order.restaurantName || order.restaurant || restaurant?.restaurantName || 'Unknown Restaurant',
    deliveryBoyName,
    deliveryBoyNumber,
    status: displayStatus,
    statusHistory: statusHistory,
    orderDate: dateStr,
    orderTime: timeStr,
    // Keep original order data for detail view
    originalOrder: {
      ...order,
      orderStatus: displayStatus,
      paymentType,
      paymentStatus,
      deliveryType: order.deliveryType || "Home Delivery",
      customerName,
      customerPhone,
      customerEmail,
      restaurant: restaurantNameResolved,
      items,
      totalItemAmount: subtotal,
      couponDiscount: discountAmount,
      itemDiscount: 0,
      deliveryCharge: deliveryFee,
      vatTax: taxAmount,
      platformFee,
      packagingFee,
      totalAmount,
    }
  }
}

const orderStatuses = [
  "Ordered",
  "Restaurant Accepted",
  "Rejected",
  "Delivery Boy Assigned",
  "Delivery Boy Reached Pickup",
  "Order ID Accepted",
  "Reached Drop",
  "Ordered Delivered"
]

export default function OrderDetectDelivery() {
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    orderId: true,
    userInfo: true,
    restaurantName: true,
    deliveryBoy: true,
    status: true,
    actions: true,
  })

  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch orders from backend
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const params = {
          page: 1,
          limit: 1000, // Fetch all orders for now
        }
        
        const response = await adminAPI.getOrders(params)
        
        if (response.data?.success && response.data?.data?.orders) {
          const transformedOrders = response.data.data.orders.map((order, index) => 
            transformOrder(order, index)
          )
          setOrders(transformedOrders)
        } else {
          debugError("Failed to fetch orders:", response.data)
          setError(response.data?.message || "Failed to fetch orders")
          toast.error("Failed to fetch orders")
          setOrders([])
        }
      } catch (error) {
        debugError("Error fetching orders:", error)
        setError(error.response?.data?.message || "Failed to fetch orders")
        toast.error(error.response?.data?.message || "Failed to fetch orders")
        setOrders([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrders()
  }, [])

  const {
    searchQuery,
    setSearchQuery,
    isFilterOpen,
    setIsFilterOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isViewOrderOpen,
    setIsViewOrderOpen,
    selectedOrder,
    filters,
    setFilters,
    filteredData,
    count,
    activeFiltersCount,
    handleApplyFilters,
    handleResetFilters,
    handleExport,
    handleViewOrder,
    handlePrintOrder,
    toggleColumn,
  } = useGenericTableManagement(
    orders,
    "Order Detect Delivery",
    ["orderId", "userName", "userNumber", "restaurantName", "deliveryBoyName", "status"]
  )

  // Statistics
  const stats = useMemo(() => {
    const total = orders.length
    const ordered = filteredData.filter(o => o.status === "Ordered").length
    const restaurantAccepted = filteredData.filter(o => o.status === "Restaurant Accepted" || o.status === "Accepted").length
    const rejected = filteredData.filter(o => o.status === "Rejected").length
    const deliveryBoyAssigned = filteredData.filter(o => o.status === "Delivery Boy Assigned").length
    const reachedPickup = filteredData.filter(o => o.status === "Delivery Boy Reached Pickup" || o.status === "Reached Pickup").length
    const orderIdAccepted = filteredData.filter(o => o.status === "Order ID Accepted").length
    const reachedDrop = filteredData.filter(o => o.status === "Reached Drop").length
    const delivered = filteredData.filter(o => o.status === "Ordered Delivered").length
    
    return { total, ordered, restaurantAccepted, rejected, deliveryBoyAssigned, reachedPickup, orderIdAccepted, reachedDrop, delivered }
  }, [filteredData, orders.length])

  const uniqueRestaurants = useMemo(() => {
    const names = orders.map(o => o.restaurantName).filter(Boolean)
    return [...new Set(names)].sort()
  }, [orders])

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      orderId: true,
      userInfo: true,
      restaurantName: true,
      deliveryBoy: true,
      status: true,
      actions: true,
    })
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          <p className="text-slate-600 font-medium">Loading orders...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && orders.length === 0) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Error Loading Orders</h3>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <OrdersTopbar 
        title="Order Detect Delivery" 
        count={count} 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onFilterClick={() => setIsFilterOpen(true)}
        activeFiltersCount={activeFiltersCount}
        onExport={handleExport}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Total Orders</p>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Ordered</p>
              <p className="text-2xl font-bold text-blue-600">{stats.ordered}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Restaurant Accepted</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.restaurantAccepted}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Rejected</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Delivery Boy Assigned</p>
              <p className="text-2xl font-bold text-purple-600">{stats.deliveryBoyAssigned}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <Truck className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Delivery Boy Reached Pickup</p>
              <p className="text-2xl font-bold text-red-600">{stats.reachedPickup}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <Package className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Order ID Accepted</p>
              <p className="text-2xl font-bold text-indigo-600">{stats.orderIdAccepted}</p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Reached Drop</p>
              <p className="text-2xl font-bold text-amber-600">{stats.reachedDrop}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg">
              <Truck className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Delivered</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.delivered}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      <FilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        setFilters={setFilters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        restaurants={uniqueRestaurants}
        statuses={orderStatuses}
        hidePaymentStatus={true}
        hideDeliveryType={true}
      />
      <SettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
        resetColumns={resetColumns}
        columnsConfig={{
          si: "Serial Number",
          orderId: "Order ID",
          userInfo: "User Name & Number",
          restaurantName: "Restaurant Name",
          deliveryBoy: "Delivery Boy Name & Number",
          status: "Status",
          actions: "Actions",
        }}
      />
      <ViewOrderDialog
        isOpen={isViewOrderOpen}
        onOpenChange={setIsViewOrderOpen}
        order={selectedOrder?.originalOrder || selectedOrder}
      />
      <OrderDetectDeliveryTable 
        orders={filteredData} 
        visibleColumns={visibleColumns}
        onViewOrder={handleViewOrder}
        onPrintOrder={handlePrintOrder}
      />
    </div>
  )
}


