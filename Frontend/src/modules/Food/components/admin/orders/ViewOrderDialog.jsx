import { Eye, MapPin, Package, User, Phone, Mail, Calendar, Clock, Truck, CreditCard, X, Receipt, CheckCircle2, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@food/components/ui/dialog"
import { formatScheduledAt, parseValidDate } from "@food/utils/scheduleTime"
import { getCancellationDisplayLabel } from "@food/utils/cancellationDisplay"
import { adminAPI } from "@food/api"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const formatHistoryTimestamp = (value) => {
  if (!value) return ""
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d
    .toLocaleString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .toUpperCase()
}

const formatOrderTimestamp = (value) => {
  const formatted = formatScheduledAt(value)
  if (formatted) return formatted
  return formatHistoryTimestamp(value) || "—"
}

const getBackendStatusLabel = (raw, meta = {}) => {
  const s = String(raw || "").toLowerCase().trim()
  if (!s) return "—"
  if (s === "created" || s === "placed") return "Pending"
  if (s === "scheduled") return "Scheduled"
  if (s === "confirmed") return "Accepted"
  if (s === "preparing" || s === "ready_for_pickup") return "Processing"
  if (s === "picked_up") return "Food On The Way"
  if (s === "delivered") return "Delivered"
  if (s.includes("cancel")) {
    return (
      getCancellationDisplayLabel({
        orderStatus: raw,
        cancellationReason: meta.note || meta.cancellationReason || "",
        cancelledBy: meta.byRole
          ? String(meta.byRole).toLowerCase().replace("restaurant", "restaurant").replace("user", "user")
          : undefined,
      }) || "Cancelled"
    )
  }
  return raw
}

const normalizeStatusHistory = (statusHistory) => {
  const list = Array.isArray(statusHistory) ? statusHistory.filter(Boolean) : []
  return list
    .map((entry) => {
      // Backend shape: { at, from, to, byRole, note }
      // Legacy/alt shapes supported: { timestamp, status }
      const at = entry.at || entry.timestamp || entry.time || entry.createdAt
      const to = entry.to ?? entry.status ?? entry.state ?? ""
      const from = entry.from ?? ""
      return {
        at,
        from,
        to,
        byRole: entry.byRole || entry.role || "",
        note: entry.note || entry.reason || "",
        label: getBackendStatusLabel(to, entry),
        timeLabel: formatHistoryTimestamp(at),
      }
    })
    .sort((a, b) => {
      const ta = a.at ? new Date(a.at).getTime() : 0
      const tb = b.at ? new Date(b.at).getTime() : 0
      return ta - tb
    })
}


const getStatusColor = (orderStatus) => {
  const colors = {
    "Delivered": "bg-emerald-100 text-emerald-700",
    "Pending": "bg-blue-100 text-blue-700",
    "Scheduled": "bg-blue-100 text-blue-700",
    "Accepted": "bg-green-100 text-green-700",
    "Processing": "bg-red-100 text-red-700",
    "Food On The Way": "bg-yellow-100 text-yellow-700",
    "Cancelled": "bg-rose-100 text-rose-700",
    "Cancelled by Restaurant": "bg-red-100 text-red-700",
    "Cancelled by User": "bg-red-100 text-red-700",
    "Payment Failed": "bg-red-100 text-red-700",
    "Refunded": "bg-sky-100 text-sky-700",
    "Dine In": "bg-indigo-100 text-indigo-700",
    "Offline Payments": "bg-slate-100 text-slate-700",
  }
  return colors[orderStatus] || "bg-slate-100 text-slate-700"
}

const getPaymentStatusColor = (paymentStatus) => {
  if (paymentStatus === "Paid" || paymentStatus === "Collected") return "text-emerald-600"
  if (paymentStatus === "Not Collected") return "text-amber-600"
  if (paymentStatus === "Unpaid" || paymentStatus === "Failed") return "text-red-600"
  return "text-slate-600"
}

export default function ViewOrderDialog({ isOpen, onOpenChange, order: orderProp }) {
  const [detailOrder, setDetailOrder] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !orderProp) {
      setDetailOrder(null)
      return
    }

    const orderKey =
      orderProp._id ||
      orderProp.orderMongoId ||
      orderProp.orderId ||
      orderProp.id
    if (!orderKey) {
      setDetailOrder(orderProp)
      return
    }

    let cancelled = false
    setDetailLoading(true)
    adminAPI
      .getOrderById(orderKey)
      .then((response) => {
        if (cancelled) return
        const full =
          response?.data?.data?.order ||
          response?.data?.order ||
          null
        setDetailOrder(full ? { ...orderProp, ...full } : orderProp)
      })
      .catch((err) => {
        if (cancelled) return
        debugWarn("Admin order detail fetch failed; using list row", err)
        setDetailOrder(orderProp)
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, orderProp])

  if (!orderProp) return null
  const order = detailOrder || orderProp
  const statusHistory = normalizeStatusHistory(order.statusHistory)

  // Debug: Log order data to check billImageUrl
  if (order.billImageUrl) {
    debugLog('Bill Image URL found:', order.billImageUrl)
  }

  // Format address for display
  const formatAddress = (address) => {
    if (!address || typeof address !== "object") return "N/A"

    const formattedAddress = String(address.formattedAddress || "").trim()
    const rawAddress = String(address.address || "").trim()
    const parts = [
      formattedAddress,
      rawAddress,
      address.label,
      address.street,
      address.additionalDetails,
      address.landmark,
      address.addressLine1,
      address.addressLine2,
      address.area,
      address.city,
      address.state,
      address.zipCode,
      address.postalCode,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean)

    const uniqueParts = []
    parts.forEach((part) => {
      const key = part.toLowerCase()
      const isContained = uniqueParts.some((existingPart) => {
        const existingKey = existingPart.toLowerCase()
        return existingKey === key || existingKey.includes(key) || key.includes(existingKey)
      })
      if (isContained) return
      uniqueParts.push(part)
    })

    return uniqueParts.length > 0 ? uniqueParts.join(", ") : "Address not available"
  }

  // Get coordinates if available
  const getCoordinates = (address) => {
    if (address?.location?.coordinates && Array.isArray(address.location.coordinates) && address.location.coordinates.length === 2) {
      const [lng, lat] = address.location.coordinates
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    }
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-white p-0 overflow-y-auto">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-red-600" />
            Order Details
          </DialogTitle>
          <DialogDescription>
            View complete information about this order
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-6 space-y-6">
          {detailLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading full order history…
            </div>
          )}
          {/* Basic Order Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Order ID
                </p>
                <p className="text-sm font-medium text-slate-900">{order.orderId || order.id || order.subscriptionId}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Order Created
                </p>
                <p className="text-sm font-medium text-slate-900">
                  {formatOrderTimestamp(
                    order.createdAt ||
                      (order.date
                        ? `${order.date}${order.time ? `, ${order.time}` : ""}`
                        : null)
                  )}
                </p>
              </div>
              {parseValidDate(order.scheduledAt) && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Scheduled For
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {formatOrderTimestamp(order.scheduledAt)}
                  </p>
                </div>
              )}
              {parseValidDate(order.activatedAt) && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Activation Time
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {formatOrderTimestamp(order.activatedAt)}
                  </p>
                </div>
              )}
              {order.orderOtp && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wider flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    Handover Code (OTP)
                  </p>
                  <p className="text-lg font-bold text-slate-950 tracking-[0.2em]">{order.orderOtp}</p>
                </div>
              )}
              {order.estimatedDeliveryTime && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Estimated Delivery Time
                  </p>
                  <p className="text-sm font-medium text-slate-900">{order.estimatedDeliveryTime} minutes</p>
                </div>
              )}
              {order.deliveredAt && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Delivered At
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {new Date(order.deliveredAt).toLocaleString('en-GB', { 
                      day: '2-digit', 
                      month: 'short', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }).toUpperCase()}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {order.orderStatus && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Order Status</p>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.orderStatus)}`}>
                    {order.orderStatus}
                  </span>
                  {order.cancellationReason && (
                    <p className="text-xs text-red-600 mt-1">
                      <span className="font-medium">
                        {order.cancelledBy === 'user' ? 'Cancelled by User - ' : 
                         order.cancelledBy === 'restaurant' ? 'Cancelled by Restaurant - ' : 
                         'Cancellation '}Reason:
                      </span> {order.cancellationReason}
                    </p>
                  )}
                  {order.cancelledAt && (
                    <p className="text-xs text-slate-500 mt-1">
                      Cancelled: {new Date(order.cancelledAt).toLocaleString('en-GB', { 
                        day: '2-digit', 
                        month: 'short', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }).toUpperCase()}
                    </p>
                  )}
                </div>
              )}
              {(order.paymentStatus || order.paymentCollectionStatus != null) && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Payment Status
                  </p>
                  <p className={`text-sm font-medium ${getPaymentStatusColor(
                    order.paymentType === 'Cash on Delivery' || order.payment?.method === 'cash' || order.payment?.method === 'cod'
                      ? (order.paymentCollectionStatus ? 'Collected' : (order.status === 'delivered' ? 'Collected' : 'Not Collected'))
                      : order.paymentStatus
                  )}`}>
                    {order.paymentType === 'Cash on Delivery' || order.payment?.method === 'cash' || order.payment?.method === 'cod'
                      ? (order.paymentCollectionStatus ? 'Collected' : (order.status === 'delivered' ? 'Collected' : 'Not Collected'))
                      : order.paymentStatus}
                  </p>
                </div>
              )}
              {order.deliveryType && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    Delivery Type
                  </p>
                  <p className="text-sm font-medium text-slate-900">{order.deliveryType}</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Food Delivery Mode
                </p>
                <p className="text-sm font-medium text-slate-900">
                  {String(order.deliveryMode || "basic").toLowerCase() === "quick" ? "Quick Delivery" : "Basic Delivery"}
                  {order?.etaPromise?.max
                    ? ` · Promise ≤ ${order.etaPromise.max} min`
                    : ""}
                </p>
                {Number(order.quickDeliveryFee || order?.pricing?.quickDeliveryFee || 0) > 0 && (
                  <p className="text-xs text-slate-500">
                    Quick Charge ₹{Number(order.quickDeliveryFee || order?.pricing?.quickDeliveryFee || 0).toFixed(0)}
                  </p>
                )}
                {order?.sla?.breached && (
                  <p className="text-xs font-semibold text-amber-700">
                    SLA breached
                    {Number(order.sla.compensationAmount) > 0
                      ? ` · Comp ₹${Number(order.sla.compensationAmount).toFixed(0)} (${order.sla.compensationStatus || "pending"})`
                      : ""}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Status History */}
          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Status History
            </h3>
            {statusHistory.length === 0 ? (
              <p className="text-sm text-slate-500">No status history available</p>
            ) : (
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200" />
                <div className="space-y-4">
                  {statusHistory.map((entry, idx) => (
                    <div key={`${entry.to}-${entry.at || idx}`} className="relative flex items-start gap-3">
                      <div className="relative z-10 mt-1 h-6 w-6 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-slate-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {entry.label || "Status Updated"}
                            </p>
                            {(entry.byRole || entry.note) && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                {entry.byRole ? `${entry.byRole}${entry.note ? " • " : ""}` : ""}
                                {entry.note || ""}
                              </p>
                            )}
                            {(entry.from && entry.to && entry.from !== entry.to) && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                From <span className="font-medium text-slate-600">{getBackendStatusLabel(entry.from)}</span>{" "}
                                to <span className="font-medium text-slate-600">{getBackendStatusLabel(entry.to)}</span>
                              </p>
                            )}
                          </div>
                          {entry.timeLabel ? (
                            <p className="text-xs text-slate-500 whitespace-nowrap">{entry.timeLabel}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Customer Information */}
          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <User className="w-4 h-4" />
              Customer Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer Name</p>
                <p className="text-sm font-medium text-slate-900">{order.customerName || "N/A"}</p>
              </div>
              {order.customerPhone && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone
                  </p>
                  <p className="text-sm font-medium text-slate-900">{order.customerPhone}</p>
                </div>
              )}
              {order.customerEmail && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </p>
                  <p className="text-sm font-medium text-slate-900">{order.customerEmail}</p>
                </div>
              )}
            </div>
          </div>

          {/* Restaurant Information */}
          {(order.restaurant || order.restaurantId) && (
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Restaurant Information</h3>
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Restaurant Name</p>
                  <p className="text-sm font-medium text-slate-900">
                    {order.restaurant || order.restaurantId?.name || order.restaurantId?.restaurantName || "N/A"}
                  </p>
                </div>
                {(order.restaurantAddress || order.restaurantId?.address || order.restaurantId?.location?.address || order.restaurantId?.location?.formattedAddress) && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Address</p>
                    <p className="text-sm font-medium text-slate-900">
                      {typeof order.restaurantAddress === 'string' && order.restaurantAddress 
                        ? order.restaurantAddress 
                        : (order.restaurantId?.location?.formattedAddress || 
                           order.restaurantId?.location?.address || 
                           (typeof order.restaurantId?.address === 'string' 
                            ? order.restaurantId.address 
                            : formatAddress(order.restaurantId?.address || order.restaurantAddress)))}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Order Items */}
          {order.items && Array.isArray(order.items) && order.items.length > 0 && (
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Order Items ({order.items.length})
              </h3>
              <div className="space-y-3">
                {order.items.map((item, index) => (
                  <div key={index} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 bg-white px-2 py-1 rounded">
                          {item.quantity || 1}x
                        </span>
                        <p className="text-sm font-medium text-slate-900">{item.name || "Unknown Item"}</p>
                        {item.isVeg !== undefined && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${item.isVeg ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {item.isVeg ? 'Veg' : 'Non-Veg'}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-slate-500 mt-1 ml-8">{item.description}</p>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      ₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bill Image (Captured by Delivery Boy) */}
          {(order.billImageUrl || order.billImage || order.deliveryState?.billImageUrl) && (
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-red-600" />
                Bill Image (Captured by Delivery Boy)
              </h3>
              <div className="space-y-3">
                <div className="relative w-full max-w-2xl border-2 border-slate-300 rounded-xl overflow-hidden bg-white shadow-sm">
                  <img
                    src={order.billImageUrl || order.billImage || order.deliveryState?.billImageUrl}
                    alt="Order Bill"
                    className="w-full h-auto object-contain max-h-[500px] mx-auto block"
                    loading="lazy"
                    onError={(e) => {
                      debugError('? Failed to load bill image:', e.target.src)
                      e.target.style.display = 'none';
                      const errorDiv = e.target.parentElement.querySelector('.error-message');
                      if (errorDiv) errorDiv.style.display = 'block';
                    }}
                    onLoad={() => {
                      debugLog('? Bill image loaded successfully')
                    }}
                  />
                  <div className="error-message hidden p-6 text-center text-slate-500 text-sm bg-slate-50">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    Failed to load bill image
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={order.billImageUrl || order.billImage || order.deliveryState?.billImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                  >
                    <Eye className="w-4 h-4" />
                    View Full Size
                  </a>
                  <a
                    href={order.billImageUrl || order.billImage || order.deliveryState?.billImageUrl}
                    download
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <Package className="w-4 h-4" />
                    Download
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Delivery Address */}
          {order.address && (
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Delivery Address
              </h3>
              <div className="space-y-2 p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-900">{formatAddress(order.address)}</p>
                {order.address.label && (
                  <p className="text-xs text-slate-500">
                    <span className="font-medium">Label:</span> {order.address.label}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Delivery Partner Information */}
          {(order.deliveryPartnerName || order.deliveryPartnerPhone) && (
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Delivery Partner
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {order.deliveryPartnerName && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</p>
                    <p className="text-sm font-medium text-slate-900">{order.deliveryPartnerName}</p>
                  </div>
                )}
                {order.deliveryPartnerPhone && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</p>
                    <p className="text-sm font-medium text-slate-900">{order.deliveryPartnerPhone}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pricing Breakdown */}
          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Pricing Breakdown</h3>
            <div className="space-y-2">
              {order.totalItemAmount !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-medium text-slate-900">₹{Number(order.totalItemAmount || 0).toFixed(2)}</span>
                </div>
              )}
              {order.itemDiscount !== undefined && order.itemDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Discount</span>
                  <span className="font-medium text-emerald-600">-₹{Number(order.itemDiscount || 0).toFixed(2)}</span>
                </div>
              )}
              {order.couponDiscount !== undefined && order.couponDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Coupon Discount</span>
                  <span className="font-medium text-emerald-600">-₹{Number(order.couponDiscount || 0).toFixed(2)}</span>
                </div>
              )}
              {order.deliveryCharge !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Delivery Charge</span>
                  <span className="font-medium text-slate-900">
                    {Number(order.deliveryCharge || 0) > 0 ? `₹${Number(order.deliveryCharge || 0).toFixed(2)}` : <span className="text-emerald-600">Free delivery</span>}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Platform Fee</span>
                <span className="font-medium text-slate-900">
                  {order.platformFee !== undefined && Number(order.platformFee || 0) > 0 
                    ? `₹${Number(order.platformFee || 0).toFixed(2)}` 
                    : <span className="text-slate-400">₹0.00</span>}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Packaging Fee</span>
                <span className="font-medium text-slate-900">
                  {order.packagingFee !== undefined && Number(order.packagingFee || 0) > 0 
                    ? `₹${Number(order.packagingFee || 0).toFixed(2)}` 
                    : <span className="text-slate-400">₹0.00</span>}
                </span>
              </div>
              {order.vatTax !== undefined && order.vatTax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Tax (GST)</span>
                  <span className="font-medium text-slate-900">₹{Number(order.vatTax || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-slate-700">Total Amount</span>
                  <span className="text-xl font-bold text-emerald-600">
                    ₹{Number(order.totalAmount || order.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              {(() => {
                const commission = Number(
                  order.pricing?.restaurantCommission ||
                  order.restaurantCommission ||
                  order.commission ||
                  0
                );
                const commissionPct = Number(
                  order.pricing?.restaurantCommissionPercentage ||
                  order.restaurantCommissionPercentage ||
                  0
                );
                const totalAmt = Number(order.totalAmount || order.total || 0);
                const netPayable = Math.max(0, totalAmt - commission);
                if (commission <= 0 && commissionPct <= 0) return null;
                return (
                  <>
                    <div className="pt-2 mt-2 border-t border-dashed border-slate-200 space-y-2">
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-slate-600 flex items-center gap-1">
                          Commission
                          {commissionPct > 0 && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({commissionPct.toFixed(1)}%)
                            </span>
                          )}
                        </span>
                        <span className="font-medium text-amber-600">-₹{commission.toFixed(2)}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 bg-slate-50 -mx-2 px-2 py-2 rounded-md">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-slate-700">Net Payable (After Commission)</span>
                          <span className="text-lg font-bold text-blue-700">
                            ₹{netPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


