import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate, useParams } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import Lenis from "lenis"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { generateOrderInvoice } from "../../utils/printOrderInvoice"
import { restaurantAPI } from "@food/api"
import { RESTAURANT_COMMISSION_ENABLED } from "@food/constants/commission"
import {
  ArrowLeft,
  Printer,
  Copy,
  User,
  MapPin,
  CheckCircle,
  XCircle,
  Loader2,
  Volume2,
  Lock,
  Unlock,
  Star,
  Phone,
  X,
} from "lucide-react"
import ResendNotificationButton from "@food/components/restaurant/ResendNotificationButton"
import { getCancellationDisplayLabel } from "@food/utils/cancellationDisplay"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const toNumber = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const firstNumber = (...values) => {
  for (const value of values) {
    const num = toNumber(value)
    if (num !== null) return num
  }
  return null
}

const firstText = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

const formatMoney = (value) => `₹${Number(value || 0).toFixed(2)}`
const formatDiscount = (value) => `-₹${Math.abs(Number(value || 0)).toFixed(2)}`


export default function OrderDetails({ orderId: propOrderId, isSidebar = false, onClose }) {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const params = useParams()
  const orderId = propOrderId || params.orderId
  
  // State for order data
  const [orderData, setOrderData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Toast state
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

  // Fetch order data from API
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await restaurantAPI.getOrderById(orderId)
        
        if (response.data?.success && response.data.data?.order) {
          const order = response.data.data.order
          const orderStatusRaw = String(order.status || order.orderStatus || "").toLowerCase()
          const pricing = order.pricing || {}
          const computedSubtotal = Array.isArray(order.items)
            ? order.items.reduce((sum, item) => {
                const price = Number(item?.price || 0)
                const qty = Number(item?.quantity || 1)
                return sum + (Number.isFinite(price) ? price : 0) * (Number.isFinite(qty) ? qty : 1)
              }, 0)
            : 0

          const itemSubtotal =
            firstNumber(
              pricing.subtotal,
              pricing.itemsTotal,
              pricing.itemSubtotal,
              order.itemSubtotal,
              order.subtotal
            ) ?? computedSubtotal

          const taxes =
            firstNumber(
              pricing.tax,
              pricing.gst,
              order.tax,
              order.gst
            ) ?? 0

          const packagingFee = firstNumber(pricing.packagingFee, order.packagingFee) ?? 0
          const deliveryFee = firstNumber(pricing.deliveryFee, order.deliveryFee) ?? 0
          const platformFee = firstNumber(pricing.platformFee, order.platformFee) ?? 0
          const discount = firstNumber(pricing.discount, order.discount) ?? 0
          const couponDiscount = firstNumber(pricing.couponDiscount, order.couponDiscount) ?? 0
          const referralDiscount = firstNumber(pricing.referralDiscount, order.referralDiscount) ?? 0
          const restaurantCommission = firstNumber(pricing.restaurantCommission, order.restaurantCommission) ?? 0
          const quickRestaurantShare = firstNumber(pricing.quickRestaurantShare, order.quickRestaurantShare) ?? 0

          const total =
            firstNumber(
              pricing.total,
              order.payment?.amountDue,
              order.totalAmount,
              order.total,
              order.amount
            ) ??
            Math.max(
              0,
              itemSubtotal +
                taxes +
                packagingFee +
                deliveryFee +
                platformFee -
                discount
            )
          const paidAmount = firstNumber(order.payment?.amountDue, order.payment?.amount, total) ?? total

          const addressParts = [
            order.address?.street,
            order.address?.area,
            order.address?.city,
            order.address?.state,
            order.address?.pincode
          ].filter(Boolean)

          const fullAddress =
            order.address?.formattedAddress ||
            order.address?.address ||
            order.deliveryAddress?.formattedAddress ||
            order.deliveryAddress?.address ||
            [
              order.deliveryAddress?.street,
              order.deliveryAddress?.city,
              order.deliveryAddress?.state,
              order.deliveryAddress?.zipCode
            ].filter(Boolean).join(", ") ||
            (addressParts.length > 0 ? addressParts.join(", ") : "") ||
            "Address not available"

          const customerName = firstText(
            order.userId?.name,
            order.customerName,
            order.customer?.name,
            order.customerInfo?.name,
            order.deliveryAddress?.name,
            order.deliveryAddress?.fullName,
            order.address?.name
          ) || "Customer"

          const restaurantName = firstText(
            order.restaurantName,
            order.restaurant?.restaurantName,
            order.restaurant?.name,
            order.restaurantId?.restaurantName,
            order.restaurantId?.name,
            order.outletName
          ) || "Restaurant"

          const rawPaymentStatus = String(
            order.payment?.status || order.paymentStatus || ""
          ).toLowerCase()
          const paymentMethod = String(order.payment?.method || "").toLowerCase()

          let paymentStatus = "PENDING"
          if (["completed", "paid", "captured", "success", "succeeded"].includes(rawPaymentStatus)) {
            paymentStatus = "PAID"
          } else if (["failed", "declined"].includes(rawPaymentStatus)) {
            paymentStatus = "FAILED"
          } else if (["refunded", "refund"].includes(rawPaymentStatus)) {
            paymentStatus = "REFUNDED"
          } else if (paymentMethod === "cash") {
            paymentStatus = orderStatusRaw === "delivered" ? "PAID" : "COD"
          }
          
          const statusLower = orderStatusRaw
          const reached = {
            confirmed: order.tracking?.confirmed?.status || ["confirmed", "preparing", "ready", "ready_for_pickup", "picked_up", "out_for_delivery", "delivered"].includes(statusLower),
            preparing: order.tracking?.preparing?.status || ["preparing", "ready", "ready_for_pickup", "picked_up", "out_for_delivery", "delivered"].includes(statusLower),
            ready: order.tracking?.ready?.status || ["ready", "ready_for_pickup", "picked_up", "out_for_delivery", "delivered"].includes(statusLower),
            outForDelivery: order.tracking?.outForDelivery?.status || ["picked_up", "out_for_delivery", "delivered"].includes(statusLower),
            delivered: order.tracking?.delivered?.status || statusLower === "delivered"
          }

          // Transform API order data to match component structure
          const transformedOrder = {
            id: order.orderId || order._id,
            status: orderStatusRaw.toUpperCase() || 'PENDING',
            date: new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
            time: new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            restaurant: restaurantName,
            address: fullAddress,
            customer: {
              name: customerName,
              orderCount: order.userId?.orderCount || 1,
              location: fullAddress,
              distance: order.deliveryDistance ? `${order.deliveryDistance} km` : ''
            },
            items: order.items?.map(item => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              type: item.isVeg ? 'Veg' : 'Non-Veg'
            })) || [],
            billing: {
              itemSubtotal,
              taxes,
              packagingFee,
              deliveryFee,
              platformFee,
              discount,
              couponDiscount,
              referralDiscount,
              restaurantCommission,
              quickRestaurantShare,
              total,
              paidAmount,
              paymentStatus
            },
            deliveryPartnerId: order.deliveryPartnerId || order.dispatch?.deliveryPartnerId || null,
            deliveryPartner: (order.dispatch?.deliveryPartnerId && typeof order.dispatch.deliveryPartnerId === 'object') ? {
              id: order.dispatch.deliveryPartnerId._id,
              name: order.dispatch.deliveryPartnerId.name || "Delivery Partner",
              phone: order.dispatch.deliveryPartnerId.phone || "",
              rating: order.dispatch.deliveryPartnerId.rating || 0,
              totalRatings: order.dispatch.deliveryPartnerId.totalRatings || 0,
            } : (order.deliveryPartnerId && typeof order.deliveryPartnerId === 'object') ? {
              id: order.deliveryPartnerId._id,
              name: order.deliveryPartnerId.name || "Delivery Partner",
              phone: order.deliveryPartnerId.phone || "",
              rating: order.deliveryPartnerId.rating || 0,
              totalRatings: order.deliveryPartnerId.totalRatings || 0,
            } : null,
            dispatchStatus: order.dispatch?.status || null,
            reason: order.cancellationReason || '',
            note: order.note || '',
            restaurantNote: order.restaurantNote || '',
            originalOrder: order,
            timeline: order.statusHistory?.length > 0
              ? order.statusHistory.map(entry => {
                  const toStatus = String(entry.to || entry.status || entry.state || "");
                  const backendLabel = toStatus === "created" || toStatus === "placed" ? "Pending" 
                    : toStatus === "scheduled" ? "Scheduled"
                    : toStatus === "confirmed" ? "Accepted"
                    : toStatus === "preparing" || toStatus === "ready_for_pickup" ? "Processing"
                    : toStatus === "picked_up" ? "Food On The Way"
                    : toStatus === "delivered" ? "Delivered"
                    : toStatus.includes("cancel")
                      ? (getCancellationDisplayLabel({
                          orderStatus: toStatus,
                          cancellationReason: entry.note || order.cancellationReason,
                          cancelledBy: order.cancelledBy,
                        }) || "Cancelled")
                    : entry.to;
                  
                  return {
                    event: backendLabel,
                    timestamp: entry.at ? new Date(entry.at).toLocaleString('en-GB') : '',
                    status: toStatus.includes("cancel") || toStatus.includes("reject") ? 'rejected' : 'completed',
                    byRole: entry.byRole || entry.role || "",
                    note: entry.note || entry.reason || "",
                    from: entry.from || "",
                    to: entry.to || ""
                  }
                })
              : [
              { event: 'Order placed', timestamp: new Date(order.createdAt).toLocaleString('en-GB'), status: 'completed' },
              ...(reached.confirmed ? [{ event: 'Order confirmed', timestamp: order.tracking?.confirmed?.timestamp ? new Date(order.tracking.confirmed.timestamp).toLocaleString('en-GB') : '', status: 'completed' }] : []),
              ...(reached.preparing ? [{ event: 'Preparing', timestamp: order.tracking?.preparing?.timestamp ? new Date(order.tracking.preparing.timestamp).toLocaleString('en-GB') : '', status: 'completed' }] : []),
              ...(reached.ready ? [{ event: 'Ready for pickup', timestamp: order.tracking?.ready?.timestamp ? new Date(order.tracking.ready.timestamp).toLocaleString('en-GB') : '', status: 'completed' }] : []),
              ...(reached.outForDelivery ? [{ event: 'Out for delivery', timestamp: order.tracking?.outForDelivery?.timestamp ? new Date(order.tracking.outForDelivery.timestamp).toLocaleString('en-GB') : '', status: 'completed' }] : []),
              ...(reached.delivered ? [{ event: 'Delivered', timestamp: order.tracking?.delivered?.timestamp ? new Date(order.tracking.delivered.timestamp).toLocaleString('en-GB') : '', status: 'completed' }] : []),
              ...(statusLower === 'cancelled' ? [{ event: 'Cancelled', timestamp: order.cancelledAt ? new Date(order.cancelledAt).toLocaleString('en-GB') : '', status: 'rejected', reason: order.cancellationReason }] : [])
            ]
          }
          
          setOrderData(transformedOrder)
        } else {
          throw new Error('Order not found')
        }
      } catch (err) {
        debugError('Error fetching order:', err)
        setError(err.response?.data?.message || err.message || 'Failed to fetch order')
        setOrderData(null)
      } finally {
        setLoading(false)
      }
    }

    if (orderId) {
      fetchOrder()
    }
  }, [orderId])

  // Lenis smooth scrolling
  useEffect(() => {
    if (isSidebar) return;

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
  }, [isSidebar])

  const handleCopyOrderId = () => {
    if (!orderData?.id) return
    navigator.clipboard.writeText(orderData.id)
    setToastMessage("Order ID copied to clipboard")
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)
  }

  const handlePrintReceipt = async () => {
    try {
      setIsGeneratingPDF(true)
      setToastMessage("Generating receipt...")
      setShowToast(true)
      
      await new Promise(resolve => setTimeout(resolve, 300))
      
      if (!orderData) {
        throw new Error("Order data not found")
      }
      
      await generateOrderInvoice(orderData.originalOrder)
      
      setToastMessage("Receipt downloaded successfully!")
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2000)
    } catch (error) {
      console.error("Error generating PDF:", error)
      setToastMessage(`Failed: ${error.message || "Unknown error"}`)
      setShowToast(true)  
      setTimeout(() => setShowToast(false), 3000)
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "REJECTED":
      case "CANCELLED":
        return "bg-red-700 text-white"
      case "DELIVERED":
        return "bg-[#0D315B] text-white"
      default:
        return "bg-gray-600 text-white"
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className={`${isSidebar ? 'h-full min-h-[400px]' : 'min-h-screen'} bg-gray-100 flex items-center justify-center`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !orderData) {
    return (
      <div className={`${isSidebar ? 'h-full min-h-[400px]' : 'min-h-screen'} bg-gray-100 flex items-center justify-center`}>
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          {!isSidebar && (
            <button
              onClick={() => navigate('/restaurant/orders')}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Back to Orders
            </button>
          )}
        </div>
      </div>
    )
  }

  // No order data
  if (!orderData) {
    return (
      <div className={`${isSidebar ? 'h-full min-h-[400px]' : 'min-h-screen'} bg-gray-100 flex items-center justify-center`}>
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-600 mb-6">The order you're looking for doesn't exist.</p>
          {!isSidebar && (
            <button
              onClick={() => navigate('/restaurant/orders')}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Back to Orders
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`${isSidebar ? 'h-full flex flex-col overflow-hidden' : 'min-h-screen'} bg-gray-100`}>
      {/* Header */}
      <div className={`bg-white px-4 py-3 ${isSidebar ? 'shrink-0 border-b border-gray-200' : 'sticky top-0 z-50'}`}>
        <div className="flex items-center gap-3">
          {isSidebar ? (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6 text-gray-900" />
            </button>
          ) : (
            <button
              onClick={goBack}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-6 h-6 text-gray-900" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900">Order details</h1>
            <p className="text-xs text-gray-600 truncate">
              ID: {orderData.id}, {orderData.restaurant?.substring(0, 20) || 'Restaurant'}...
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintReceipt}
              disabled={isGeneratingPDF}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
              aria-label="Print"
            >
              {isGeneratingPDF ? (
                <svg className="animate-spin h-5 w-5 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <Printer className="w-5 h-5 text-gray-900" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`px-4 py-4 space-y-4 ${isSidebar ? 'flex-1 overflow-y-auto scrollbar-hide' : ''}`}>
        {/* Order Summary Card */}
        <div className="bg-white rounded-lg p-4">
          {/* Status and Order ID Row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex flex-col items-end gap-1">
              <span className={`px-2.5 py-1 rounded text-xs font-bold ${getStatusColor(orderData.status)}`}>
                {orderData.status}
              </span>
              <span className="text-xs text-gray-500">{orderData.date}, {orderData.time}</span>
              {/* Resend button for order details */}
              {(orderData.status === "PREPARING" || orderData.status === "READY" || orderData.status === "CONFIRMED") && 
                orderData.dispatchStatus !== "accepted" && (
                <div className="mt-2">
                  <ResendNotificationButton 
                    orderId={orderId} 
                    onSuccess={() => window.location.reload()} 
                  />
                </div>
              )}
            </div>
          </div>

          {/* Order ID */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base font-bold text-gray-900">ID: {orderData.id}</span>
            <button
              onClick={handleCopyOrderId}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              aria-label="Copy order ID"
            >
              <Copy className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Restaurant Info */}
          <p className="text-sm text-gray-900 mb-3">
            {orderData.restaurant}, {orderData.address}
          </p>

          {/* Divider */}
          <div className="border-t border-gray-200 my-3"></div>

          {/* Rejection Reason */}
          {orderData.reason && (
            <p className="text-sm text-red-600">{orderData.reason}</p>
          )}
        </div>

        {/* Customer Details Section */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3">Customer details</h2>
          
          {/* Customer Card */}
          <div className="bg-white rounded-lg p-4 gap-8 flex flex-col mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{orderData.customer.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{orderData.customer.orderCount} order with you</p>
              </div>

              <hr className="border-gray-200 my-3" />
              
            </div>
               <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-gray-600" />
              <div className="flex-1">
                <p className="text-sm text-gray-900">{orderData.customer.location}</p>
              </div>
              <p className="text-sm text-gray-600">{orderData.customer.distance}</p>
            </div>
          </div>

        </div>

        {/* Delivery Partner Details Section */}
        {orderData.deliveryPartner && (
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-3">Delivery Partner details</h2>
            <div className="bg-white rounded-lg p-4 flex flex-col gap-4 mb-3 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-[#0D315B]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">{orderData.deliveryPartner.name}</p>
                  {orderData.deliveryPartner.rating > 0 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-semibold text-gray-700">
                        {orderData.deliveryPartner.rating} ({orderData.deliveryPartner.totalRatings} ratings)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3 flex flex-col gap-2">
                {orderData.deliveryPartner.phone === "Hidden until photo upload" || !orderData.deliveryPartner.phone ? (
                  <div className="flex flex-col gap-2 bg-amber-50/50 border border-amber-200/60 rounded-xl p-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Lock className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-amber-800">Phone Number Hidden</p>
                        <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                          Delivery partner's phone number will be shown once they arrive at your outlet and upload the bill photo.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-green-50/50 border border-green-200/60 rounded-xl p-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Unlock className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-green-800">Phone Number Unlocked</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">{orderData.deliveryPartner.phone}</p>
                      </div>
                    </div>
                    <a
                      href={`tel:${orderData.deliveryPartner.phone}`}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#0D315B] text-white text-xs font-bold rounded-lg shadow-sm hover:bg-[#e04a02] transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Call Rider
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Item Details Section */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3">Item details</h2>
          
          {orderData.items.map((item, index) => (
            <div key={index} className="bg-white rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center mt-0.5">
                  <div className={`w-3 h-3 rounded-full border ${String(item.type).toLowerCase().includes("non") ? "border-red-600" : "border-green-600"} flex items-center justify-center`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${String(item.type).toLowerCase().includes("non") ? "bg-red-600" : "bg-green-600"}`}></div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {item.quantity} x {item.name}
                    </p>
                    <p className="text-sm font-semibold text-gray-900">{formatMoney(item.price)}</p>
                  </div>
                  {item.type && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>Quantity</span>
                      <span>{item.type}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {(orderData.restaurantNote || orderData.note) && (
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-3">Order instructions</h2>
            <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm space-y-3">
              {orderData.restaurantNote && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Restaurant note</p>
                  <p className="text-sm text-gray-900">{orderData.restaurantNote}</p>
                </div>
              )}
              {orderData.note && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Delivery note</p>
                  <p className="text-sm text-gray-900">{orderData.note}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bill Details Section */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3">Bill details</h2>
          
          <div className="bg-white  rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600">Item subtotal</span>
              <span className="text-sm text-gray-900">{formatMoney(orderData.billing.itemSubtotal)}</span>
            </div>
            {Number(orderData.billing.packagingFee) > 0 && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">Packaging fee</span>
                <span className="text-sm text-gray-900">{formatMoney(orderData.billing.packagingFee)}</span>
              </div>
            )}
            {(Number(orderData.billing.quickRestaurantShare) > 0 || orderData.originalOrder?.type === 'quick' || orderData.originalOrder?.deliveryMode === 'quick') && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">
                  Quick Order Share
                  <span className="text-xs font-medium text-gray-400 ml-1">
                    ({Number(orderData.originalOrder?.pricing?.quickSharePcts?.restaurant || 0).toFixed(1)}%)
                  </span>
                </span>
                <span className="text-sm text-gray-900">{formatMoney(orderData.billing.quickRestaurantShare)}</span>
              </div>
            )}
            {RESTAURANT_COMMISSION_ENABLED && Number(orderData.billing.restaurantCommission) > 0 && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-red-700">Commission Paid</span>
                <span className="text-sm text-red-700">{formatDiscount(orderData.billing.restaurantCommission)}</span>
              </div>
            )}
            {Number(orderData.billing.discount) > 0 && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-green-700">Discount</span>
                <span className="text-sm text-green-700">{formatDiscount(orderData.billing.discount)}</span>
              </div>
            )}
            <div className="my-3 border-t border-gray-100"></div>
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">Order Total</span>
                <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-medium rounded">
                  {orderData.billing.paymentStatus}
                </span>
              </div>
              <span className="text-sm font-semibold text-gray-900">{formatMoney(
                Math.max(0, (Number(orderData.billing.itemSubtotal) || 0) + 
                (Number(orderData.billing.packagingFee) || 0) +
                (Number(orderData.billing.quickRestaurantShare) || 0))
              )}</span>
            </div>
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-green-700">Restaurant Earning</span>
              </div>
              <span className="text-sm font-bold text-green-700">{formatMoney(
                Math.max(0, (Number(orderData.billing.itemSubtotal) || 0) + 
                (Number(orderData.billing.packagingFee) || 0) + 
                (Number(orderData.billing.quickRestaurantShare) || 0) - 
                (Number(orderData.billing.restaurantCommission) || 0))
              )}</span>
            </div>
          </div>
        </div>

        {/* Order Timeline Section */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3">Order timeline</h2>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="relative">
              {/* Timeline Line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300"></div>
              
              {/* Timeline Events */}
              <div className="space-y-4">
                {orderData.timeline.map((event, index) => (
                  <div key={index} className="relative flex items-start gap-3">
                    {/* Icon */}
                    <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${
                      event.status === "completed" 
                        ? "bg-gray-900" 
                        : event.status === "rejected"
                        ? "bg-red-600"
                        : "bg-gray-400"
                    }`}>
                      {event.status === "completed" ? (
                        <CheckCircle className="w-4 h-4 text-white" />
                      ) : (
                        <XCircle className="w-4 h-4 text-white" />
                      )}
                    </div>
                    
                    {/* Event Details */}
                    <div className="flex-1 pt-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{event.event}</p>
                          {(event.byRole || event.note) && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {event.byRole ? `${event.byRole}${event.note ? " • " : ""}` : ""}
                              {event.note || ""}
                            </p>
                          )}
                          {(event.from && event.to && event.from !== event.to) && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              From <span className="font-medium text-gray-700">{event.from}</span>{" "}
                              to <span className="font-medium text-gray-700">{event.to}</span>
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 whitespace-nowrap">{event.timestamp}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 max-w-sm"
          >
            {isGeneratingPDF ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span className="text-sm font-medium">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


