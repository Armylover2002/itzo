import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import {
  ArrowLeft,
  ShoppingBag,
  Phone,
  Copy,
  Download,
  User,
  CreditCard,
  Calendar,
  MapPin,
  RotateCcw,
  FileText,
} from "lucide-react"
import { orderAPI, restaurantAPI } from "@food/api"
import { useCart } from "@food/context/CartContext"
import { toast } from "sonner"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { getCompanyNameAsync } from "@common/utils/businessSettings"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const buildPickupPointAddress = (point) => {
  const address = [
    point?.address,
    point?.formattedAddress,
    point?.location?.address,
    point?.location?.formattedAddress,
  ]
    .map((value) => String(value || "").trim())
    .find(Boolean)

  if (address) return address

  const coords = point?.location?.coordinates
  if (Array.isArray(coords) && coords.length >= 2) {
    const lng = Number(coords[0])
    const lat = Number(coords[1])
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    }
  }

  return ""
}


export default function UserOrderDetails() {
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()
  const { replaceCart } = useCart()
  const { orderId } = useParams()
  const [order, setOrder] = useState(null)
  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        setLoading(true)
        // Fetch using the ID from params (which will now be the MongoDB _id)
        const response = await orderAPI.getOrderDetails(orderId)

        let orderData = null
        if (response?.data?.success && response.data.data?.order) {
          orderData = response.data.data.order
        } else if (response?.data?.order && typeof response.data.order === 'object') {
          orderData = response.data.order
        } else {
          toast.error("Order not found")
          navigate("/user/orders")
          return
        }

        setOrder(orderData)

        // If restaurantId is just a string (not populated), fetch restaurant details separately
        const restaurantId = orderData.restaurantId
        if (restaurantId && typeof restaurantId === 'string' && !orderData.restaurant) {
          try {
            const restaurantResponse = await restaurantAPI.getRestaurantById(restaurantId)
            if (restaurantResponse?.data?.success && restaurantResponse.data.data?.restaurant) {
              setRestaurant(restaurantResponse.data.data.restaurant)
            } else if (restaurantResponse?.data?.restaurant) {
              setRestaurant(restaurantResponse.data.restaurant)
            }
          } catch (restaurantError) {
            debugWarn("Failed to fetch restaurant details:", restaurantError)
            // Don't show error toast, just log it - order details can still be shown
          }
        }
      } catch (error) {
        debugError("Error fetching order details:", error)
        toast.error(
          error?.response?.data?.message || "Failed to load order details"
        )
        navigate("/user/orders")
      } finally {
        setLoading(false)
      }
    }

    fetchOrderDetails()
  }, [orderId, navigate])

  const handleCopyOrderId = async () => {
    if (!order) return
    const id = order.orderId || order._id || orderId
    try {
      await navigator.clipboard.writeText(String(id))
      toast.success("Order ID copied")
    } catch {
      toast.error("Failed to copy Order ID")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600 text-sm">Loading order details...</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-gray-700 text-sm font-medium">Order not found</p>
          <button
            onClick={() => navigate("/user/orders")}
            className="px-4 py-2 rounded-lg bg-[#FE5502] text-white text-sm font-semibold"
          >
            Back to Orders
          </button>
        </div>
      </div>
    )
  }

  const orderIdDisplay = order.orderId || order._id || orderId
  // Use fetched restaurant data if available, otherwise use order.restaurantId, order.restaurant, order.seller, or order.sellerId
  const restaurantObj = restaurant || order.restaurantId || order.restaurant || order.seller || order.sellerId || {}
  const restaurantName =
    order.restaurantName || restaurantObj.name || restaurantObj.shopName || "Store"

  // Build restaurant address (try restaurant fields first, then fall back)
  const restaurantLocation = (() => {
    const loc = restaurantObj.location || {}

    // Priority 1: direct address on restaurant object
    if (restaurantObj.address) return restaurantObj.address

    // Priority 2: formattedAddress from location
    if (loc.formattedAddress) return loc.formattedAddress

    // Priority 3: generic address / street-style fields
    if (loc.address) return loc.address

    if (loc.street || loc.city) {
      const parts = [
        loc.street,
        loc.area,
        loc.city,
        loc.state,
        loc.zipCode || loc.pincode || loc.postalCode,
      ].filter(Boolean)
      if (parts.length) return parts.join(", ")
    }

    // Priority 4: addressLine1 / addressLine2 style
    if (loc.addressLine1) {
      const parts = [
        loc.addressLine1,
        loc.addressLine2,
        loc.city,
        loc.state,
      ].filter(Boolean)
      if (parts.length) return parts.join(", ")
    }

    // Priority 5: order-level restaurantAddress if present
    if (order.restaurantAddress) return order.restaurantAddress

    // Don't fallback to user delivery address - show empty or "Address not available"
    return "Address not available"
  })()

  const items = Array.isArray(order.items) ? order.items : []
  const pricing = order.pricing || {}
  const sendsCutlery = order.sendCutlery !== false

  const userObj = order.userId || order.user || {}
  const userName = order.userName || userObj.name || userObj.firstName || ""
  const userPhone = order.userPhone || userObj.phone?.number || userObj.phone || userObj.phoneNumber || order.deliveryAddress?.phone || order.address?.phone || ""
  const paymentMethod = order.payment?.method || "Online"
  const paymentDate = order.createdAt
    ? new Date(order.createdAt).toLocaleString("en-IN", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
    : ""

  const deliveryAddress = order.deliveryAddress || order.address || {}
  const addressText =
    deliveryAddress.formattedAddress ||
    deliveryAddress.address ||
    [deliveryAddress.street, deliveryAddress.city, deliveryAddress.state, deliveryAddress.zipCode]
      .filter(Boolean)
      .join(", ")

  const savings =
    (pricing.discount || 0) +
    (pricing.originalItemTotal || 0) -
    (pricing.subtotal || 0)

  // Restaurant phone (multiple fallbacks) - use fetched restaurant data first
  const restaurantPhone =
    restaurantObj.primaryContactNumber ||
    restaurantObj.phone ||
    restaurantObj.contactNumber ||
    order.restaurantPhone ||
    ""

  const pickupSources = (() => {
    const rawPickupPoints = Array.isArray(order.pickupPoints) ? order.pickupPoints : []
    const normalized = rawPickupPoints
      .map((point, index) => {
        const pickupType = point?.pickupType === "quick" ? "quick" : "food"
        return {
          id: point?.legId || `${pickupType}:${point?.sourceId || index}`,
          label: pickupType === "quick" ? "Store" : "Restaurant",
          pickupType,
          name: String(
            point?.sourceName ||
              (pickupType === "quick" ? "Seller Store" : restaurantName || "Restaurant"),
          ).trim(),
          address:
            buildPickupPointAddress(point) ||
            restaurantLocation ||
            "Address not available",
          phone:
            pickupType === "food"
              ? restaurantPhone
              : String(point?.phone || point?.contactPhone || "").trim(),
        }
      })
      .filter((source) => source.name || source.address)

    if (normalized.length > 0) return normalized

    return [
      {
        id: "food:primary",
        label: "Restaurant",
        pickupType: "food",
        name: restaurantName,
        address: restaurantLocation,
        phone: restaurantPhone,
      },
    ]
  })()

  const handleCallRestaurant = () => {
    if (!restaurantPhone) {
      toast.error("Restaurant phone number not available")
      return
    }
    window.location.href = `tel:${restaurantPhone}`
  }

  const handleCallPickupSource = (phone) => {
    if (!phone) {
      toast.error("Phone number not available")
      return
    }
    window.location.href = `tel:${phone}`
  }

  const handleDownloadSummary = async () => {
    try {
      const companyName = await getCompanyNameAsync()
      // Create new PDF document
      const doc = new jsPDF()

      // Title
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(`${companyName} Order: Summary and Receipt`, 105, 20, { align: 'center' })

      // Order details section
      let yPos = 35
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')

      // Order ID
      doc.setFont('helvetica', 'bold')
      doc.text('Order ID:', 20, yPos)
      doc.setFont('helvetica', 'normal')
      doc.text(orderIdDisplay, 60, yPos)
      yPos += 7

      // Order Time
      doc.setFont('helvetica', 'bold')
      doc.text('Order Time:', 20, yPos)
      doc.setFont('helvetica', 'normal')
      const orderTimeLines = doc.splitTextToSize(paymentDate || 'N/A', 130)
      doc.text(orderTimeLines, 60, yPos)
      yPos += orderTimeLines.length * 7

      // Customer Name
      doc.setFont('helvetica', 'bold')
      doc.text('Customer Name:', 20, yPos)
      doc.setFont('helvetica', 'normal')
      doc.text(userName || 'Customer', 60, yPos)
      yPos += 7

      // Delivery Address
      doc.setFont('helvetica', 'bold')
      doc.text('Delivery Address:', 20, yPos)
      doc.setFont('helvetica', 'normal')
      const addressLines = doc.splitTextToSize(addressText || 'N/A', 130)
      doc.text(addressLines, 60, yPos)
      yPos += addressLines.length * 7

      // Restaurant Name
      doc.setFont('helvetica', 'bold')
      doc.text('Restaurant Name:', 20, yPos)
      doc.setFont('helvetica', 'normal')
      doc.text(restaurantName, 60, yPos)
      yPos += 7

      // Restaurant Address
      doc.setFont('helvetica', 'bold')
      doc.text('Restaurant Address:', 20, yPos)
      doc.setFont('helvetica', 'normal')
      const restaurantAddressLines = doc.splitTextToSize(restaurantLocation || 'N/A', 130)
      doc.text(restaurantAddressLines, 60, yPos)
      yPos += restaurantAddressLines.length * 7 + 5

      // Items table
      const tableData = items.map(item => [
        item.variantName ? `${item.name || 'Item'} (${item.variantName})` : (item.name || 'Item'),
        String(item.quantity || item.qty || 1),
        `?${Number(item.price || 0).toFixed(2)}`,
        `?${Number((item.price || 0) * (item.quantity || item.qty || 1)).toFixed(2)}`
      ])

      autoTable(doc, {
        startY: yPos,
        head: [['Item', 'Quantity', 'Unit Price', 'Total Price']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', fontSize: 10 },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 30, halign: 'center' },
          2: { cellWidth: 35, halign: 'right' },
          3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
        }
      })

      // Get final Y position after table (autoTable adds lastAutoTable property)
      const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY : yPos + (tableData.length * 8) + 20

      // Total
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Total:', 145, finalY + 10, { align: 'right' })
      doc.text(`?${Number(pricing.total || 0).toFixed(2)}`, 195, finalY + 10, { align: 'right' })

      // Save PDF instantly
      const fileName = `Order_Summary_${orderIdDisplay}_${Date.now()}.pdf`
      doc.save(fileName)

      toast.success("Summary downloaded successfully!")
    } catch (error) {
      debugError("Error generating PDF:", error)
      toast.error("Failed to download summary")
    }
  }

  const handleReorder = (currentOrder) => {
    const restaurantTarget =
      restaurantObj.slug ||
      restaurantObj._id ||
      restaurantObj.restaurantId ||
      (typeof currentOrder?.restaurantId === "string" ? currentOrder.restaurantId : currentOrder?.restaurantId?._id)

    if (!restaurantTarget || !items.length) {
      toast.error("Order items or restaurant information not available")
      return
    }

    const reorderItems = items
      .map((item, index) => {
        const itemId = item.id || item.itemId || item._id
        if (!itemId) return null

        return {
          id: itemId,
          name: item.name || item.foodName || "Item",
          price: Number(item.price) || 0,
          image: item.image || "",
          restaurant: restaurantName,
          restaurantId: restaurantObj._id || restaurantObj.restaurantId || currentOrder?.restaurantId,
          description: item.description || "",
          isVeg: item.isVeg !== false,
          quantity: Math.max(1, Number(item.quantity || item.qty) || 1),
          reorderIndex: index,
        }
      })
      .filter(Boolean)

    if (!reorderItems.length) {
      toast.error("No reorderable items found in this order")
      return
    }

    replaceCart(reorderItems)
    toast.success("Items added to cart")
    navigate(`/food/user/restaurants/${restaurantTarget}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans relative">
      {/* Header */}
      <div className="bg-white p-4 flex items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/food/user')}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700 cursor-pointer" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">Order Details</h1>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="p-4 space-y-4">
        {/* Status Card */}
        <div className="bg-white p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <div className="bg-gray-100 p-2 rounded-lg">
            <ShoppingBag className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">
              {order.status === "delivered"
                ? "Order was delivered"
                : order.status === "scheduled"
                ? `Scheduled for ${new Date(order.scheduledAt).toLocaleString("en-US", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "Order status: " + (order.status || "Processing")}
            </h2>
          </div>
        </div>

        {/* Pickup Info Card */}
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              {order?.orderType === "mixed" ? "Pickup Details" : "Restaurant Details"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {order?.orderType === "mixed"
                ? "Both your restaurant and store sources are listed below."
                : "Pickup source for this order."}
            </p>
          </div>

          <div className="space-y-3 mb-4">
            {pickupSources.map((source, index) => {
              const isQuick = source.pickupType === "quick"
              const badgeClasses = isQuick
                ? "bg-orange-50 text-orange-700 border-orange-200"
                : "bg-red-50 text-red-700 border-red-200"

              return (
                <div
                  key={source.id || `${source.pickupType}-${index}`}
                  className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <img
                        src={
                          (Array.isArray(items) && items[0]?.image) ||
                          restaurantObj.profileImage?.url ||
                          restaurantObj.profileImage ||
                          order.restaurantImage ||
                          "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80"
                        }
                        alt={source.name}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                      <div className="min-w-0">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${badgeClasses}`}>
                          {pickupSources.length > 1 ? `${source.label} ${index + 1}` : source.label}
                        </span>
                        <h3 className="mt-2 font-semibold text-gray-800">{source.name}</h3>
                        <p className="text-xs text-gray-500 mt-1">{source.address}</p>
                      </div>
                    </div>

                    {source.phone ? (
                      <button
                        type="button"
                        onClick={() => handleCallPickupSource(source.phone)}
                        className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-[#FE5502] hover:bg-red-50 shrink-0"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">
              Order ID: #{orderIdDisplay}
            </span>
            <button type="button" onClick={handleCopyOrderId}>
              <Copy className="w-3 h-3 text-gray-400 cursor-pointer" />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${sendsCutlery
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
                }`}
            >
              {sendsCutlery ? "Send cutlery" : "Don't send cutlery"}
            </span>
          </div>

          <div className="border-t border-dashed border-gray-200 my-3" />

          {/* Items */}
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-start mt-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 border ${item.isVeg ? "border-green-600" : "border-red-600"
                    } flex items-center justify-center p-[1px]`}
                >
                  <div
                    className={`w-full h-full rounded-full ${item.isVeg ? "bg-green-600" : "bg-red-600"
                      }`}
                  />
                </div>
                <span className="text-sm text-gray-700 font-medium">
                  {item.quantity || item.qty || 1} x {item.name}{item.variantName ? ` (${item.variantName})` : ""}
                </span>
              </div>
              <span className="text-sm text-gray-800 font-medium">
                ₹{(item.price || 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Bill Summary Card */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 flex justify-between items-center border-b border-gray-100">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-800">Bill Summary</h3>
            </div>
            <button
              type="button"
              onClick={handleDownloadSummary}
              className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center text-[#FE5502] hover:bg-red-100"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Item total</span>
              <div>
                {pricing.originalItemTotal && (
                  <span className="text-gray-400 line-through mr-1">
                    ₹{Number(pricing.originalItemTotal).toFixed(2)}
                  </span>
                )}
                <span className="text-gray-800">
                  ₹{Number(pricing.subtotal || pricing.total || 0).toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">GST (govt. taxes)</span>
              <span className="text-gray-800">
                ₹{Number(pricing.tax || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 font-medium">Delivery fee</span>
              {pricing.deliveryFee === 0 && (
                <span className="text-[#FE5502] text-[10px] font-bold border border-[#FE5502] px-1 rounded ml-1">
                  FREE
                </span>
              )}
              <span className="text-[#FE5502] font-medium uppercase">
                {pricing.deliveryFee ? `₹${Number(pricing.deliveryFee).toFixed(2)}` : "Free"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Platform fee</span>
              <span className="text-gray-800">
                ₹{Number(pricing.platformFee || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Subscription / other fees</span>
              <span className="text-gray-800">
                ₹{Number(pricing.subscriptionFee || 0).toFixed(2)}
              </span>
            </div>

            <div className="border-t border-gray-100 my-2 pt-2 flex justify-between items-center">
              <span className="font-bold text-gray-800">Paid</span>
              <span className="font-bold text-gray-800">
                ₹{Number(pricing.total || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Savings Banner */}
          {savings > 0 && (
            <div className="relative bg-red-50 p-3 pb-4 mt-2">
              <div className="absolute -top-1.5 left-0 w-full overflow-hidden leading-none">
                <svg
                  className="relative block w-[calc(100%+1.3px)] h-[8px]"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 1200 120"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0,0V46.29c47,0,47,69.5,94,69.5s47-69.5,94-69.5,47,69.5,94,69.5,47-69.5,94-69.5,47,69.5,94,69.5,47-69.5,94-69.5,47,69.5,94,69.5,47-69.5,94-69.5,47,69.5,94,69.5V0Z"
                    fill="#ffffff"
                    className="fill-white"
                  />
                </svg>
              </div>

              <div className="flex items-center justify-center gap-2 pt-1 text-[#FE5502] font-bold text-sm">
                <span>??</span>
                <span>
                  You saved ₹{Number(savings).toFixed(2)} on this order!
                </span>
              </div>
            </div>
          )}
        </div>

        {/* User & Delivery Details */}
        <div className="bg-white p-4 rounded-xl shadow-sm space-y-5">
          {/* User */}
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 text-sm">
                {userName || "Customer"}
              </h4>
              <p className="text-gray-500 text-xs">{userPhone}</p>
            </div>
          </div>

          {/* Payment */}
          <div className="flex gap-3">
            <div className="mt-0.5">
              <CreditCard className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 text-sm">
                Payment method
              </h4>
              <p className="text-gray-500 text-xs mt-0.5">
                Paid via: {paymentMethod.toUpperCase()}
              </p>
            </div>
          </div>

          {/* Date */}
          <div className="flex gap-3">
            <div className="mt-0.5">
              <Calendar className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 text-sm">
                Payment date
              </h4>
              <p className="text-gray-500 text-xs mt-0.5">{paymentDate}</p>
            </div>
          </div>

          {/* Address */}
          <div className="flex gap-3">
            <div className="mt-0.5">
              <MapPin className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 text-sm">
                Delivery address
              </h4>
              <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">
                {addressText || "Address not available"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Buttons */}
      <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 p-4 flex gap-3 z-20">
        <button
          type="button"
          onClick={() => handleReorder(order)}
          className="flex-1 bg-[#FE5502] text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-[#C83C00] transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reorder
        </button>
        <button
          type="button"
          onClick={handleDownloadSummary}
          className="flex-1 bg-white border border-[#FE5502] text-[#FE5502] py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Invoice
        </button>
      </div>

      {/* Restaurant Complaint Button - Below Order Details */}
      {order && (
        <div className="p-4 pb-24">
          <button
            type="button"
            onClick={() => {
              // Use MongoDB _id (ObjectId) for the API call - backend complaint controller expects ObjectId
              // Priority: order._id (MongoDB ObjectId) > orderId from route params
              const orderMongoId = order._id || orderId

              if (!orderMongoId) {
                debugError("Order ID not available:", {
                  order: order ? { _id: order._id, orderId: order.orderId } : null,
                  routeOrderId: orderId
                })
                toast.error("Order ID not available. Please refresh the page.")
                return
              }

              // Convert to string if it's an ObjectId object
              const orderIdString = typeof orderMongoId === 'object' && orderMongoId.toString
                ? orderMongoId.toString()
                : String(orderMongoId)

              debugLog("Navigating to complaint page with orderId:", orderIdString)
              navigate(`/user/complaints/submit/${encodeURIComponent(orderIdString)}`)
            }}
            className="w-full bg-red-50 border border-red-200 text-red-700 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Restaurant Complaint
          </button>
        </div>
      )}
    </div>
  )
}



