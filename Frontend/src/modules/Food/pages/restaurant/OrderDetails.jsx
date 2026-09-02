import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate, useParams } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import Lenis from "lenis"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { restaurantAPI } from "@food/api"
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
} from "lucide-react"
import ResendNotificationButton from "@food/components/restaurant/ResendNotificationButton"
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


export default function OrderDetails() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const { orderId } = useParams()
  
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
              total,
              paidAmount,
              paymentStatus
            },
            deliveryPartnerId: order.deliveryPartnerId || order.dispatch?.deliveryPartnerId || null,
            dispatchStatus: order.dispatch?.status || null,
            reason: order.cancellationReason || '',
            timeline: [
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
      
      // Small delay to show the toast
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Check if orderData exists
      if (!orderData) {
        throw new Error("Order data not found")
      }
      
      const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const leftMargin = 15
    const rightMargin = 15
    const bottomMargin = 20
    let yPosition = 20

    const ensureSpace = (requiredHeight = 0, resetY = 20) => {
      if (yPosition + requiredHeight > pageHeight - bottomMargin) {
        doc.addPage()
        yPosition = resetY
      }
    }

    // Header - Restaurant Name
    doc.setFontSize(18)
    doc.setFont("helvetica", "bold")
    doc.text(orderData.restaurant, pageWidth / 2, yPosition, { align: "center" })
    yPosition += 7

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(orderData.address, pageWidth / 2, yPosition, { align: "center" })
    yPosition += 15

    // Order Receipt Title
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    doc.text("ORDER RECEIPT", pageWidth / 2, yPosition, { align: "center" })
    yPosition += 10

    // Horizontal line
    doc.setLineWidth(0.5)
    doc.line(leftMargin, yPosition, pageWidth - rightMargin, yPosition)
    yPosition += 10

    // Order Information
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text("Order ID:", leftMargin, yPosition)
    doc.setFont("helvetica", "normal")
    doc.text(orderData.id, 50, yPosition)
    yPosition += 7

    doc.setFont("helvetica", "bold")
    doc.text("Date & Time:", leftMargin, yPosition)
    doc.setFont("helvetica", "normal")
    doc.text(`${orderData.date}, ${orderData.time}`, 50, yPosition)
    yPosition += 7

    doc.setFont("helvetica", "bold")
    doc.text("Status:", leftMargin, yPosition)
    doc.setFont("helvetica", "normal")
    // Set color based on status
    if (orderData.status === "REJECTED" || orderData.status === "CANCELLED") {
      doc.setTextColor(220, 38, 38) // Red
    } else if (orderData.status === "DELIVERED") {
      doc.setTextColor(22, 163, 74) // Green
    }
    doc.text(orderData.status, 50, yPosition)
    doc.setTextColor(0, 0, 0) // Reset to black
    yPosition += 10

    // Customer Details Section
    doc.setLineWidth(0.5)
    ensureSpace(35)
    doc.line(leftMargin, yPosition, pageWidth - rightMargin, yPosition)
    yPosition += 8

    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("CUSTOMER DETAILS", leftMargin, yPosition)
    yPosition += 8

    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text("Name:", leftMargin, yPosition)
    doc.setFont("helvetica", "normal")
    doc.text(orderData.customer.name, 50, yPosition)
    yPosition += 6

    doc.setFont("helvetica", "bold")
    doc.text("Location:", leftMargin, yPosition)
    doc.setFont("helvetica", "normal")
    const locationLines = doc.splitTextToSize(orderData.customer.location || "-", pageWidth - 65)
    doc.text(locationLines, 50, yPosition)
    yPosition += locationLines.length * 5

    doc.setFont("helvetica", "bold")
    doc.text("Distance:", leftMargin, yPosition)
    doc.setFont("helvetica", "normal")
    doc.text(orderData.customer.distance || "-", 50, yPosition)
    yPosition += 10

    // Items Section
    doc.setLineWidth(0.5)
    ensureSpace(20)
    doc.line(leftMargin, yPosition, pageWidth - rightMargin, yPosition)
    yPosition += 8

    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("ITEM DETAILS", 15, yPosition)
    yPosition += 5

    // Items Table
    const itemsTableData = orderData.items.map(item => [
      `${item.quantity}x`,
      item.name,
      item.type || "-",
      formatMoney(item.price)
    ])

    // Use autoTable with the doc instance
    autoTable(doc, {
      startY: yPosition,
      head: [["Qty", "Item Name", "Type", "Price"]],
      body: itemsTableData,
      theme: "grid",
      headStyles: {
        fillColor: [55, 65, 81],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: "bold"
      },
      bodyStyles: {
        fontSize: 9
      },
      margin: { left: leftMargin, right: rightMargin }
    })

    yPosition = doc.lastAutoTable.finalY + 10

    // Bill Details Section
    doc.setLineWidth(0.5)
    ensureSpace(50)
    doc.line(leftMargin, yPosition, pageWidth - rightMargin, yPosition)
    yPosition += 8

    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("BILL DETAILS", 15, yPosition)
    yPosition += 8

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    const billRows = [
      ["Item Subtotal:", formatMoney(orderData.billing.itemSubtotal)],
      ["Taxes:", formatMoney(orderData.billing.taxes)],
    ]
    if (Number(orderData.billing.packagingFee) > 0) {
      billRows.push(["Packaging Fee:", formatMoney(orderData.billing.packagingFee)])
    }
    if (Number(orderData.billing.deliveryFee) > 0) {
      billRows.push(["Delivery Fee:", formatMoney(orderData.billing.deliveryFee)])
    }
    if (Number(orderData.billing.platformFee) > 0) {
      billRows.push(["Platform Fee:", formatMoney(orderData.billing.platformFee)])
    }
    if (Number(orderData.billing.discount) > 0) {
      billRows.push(["Discount:", formatDiscount(orderData.billing.discount)])
    }
    if (Number(orderData.billing.couponDiscount) > 0) {
      billRows.push(["Coupon Discount:", formatDiscount(orderData.billing.couponDiscount)])
    }
    if (Number(orderData.billing.referralDiscount) > 0) {
      billRows.push(["Referral Discount:", formatDiscount(orderData.billing.referralDiscount)])
    }
    billRows.forEach(([label, value]) => {
      doc.text(label, 15, yPosition)
      doc.text(value, pageWidth - rightMargin, yPosition, { align: "right" })
      yPosition += 6
    })

    // Dashed line for total
    doc.setLineDash([2, 2])
    doc.line(leftMargin, yPosition, pageWidth - rightMargin, yPosition)
    yPosition += 6
    doc.setLineDash([]) // Reset to solid line

    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.text("Total Bill:", leftMargin, yPosition)
    doc.text(formatMoney(orderData.billing.total), pageWidth - rightMargin, yPosition, { align: "right" })
    yPosition += 6
    if (Number(orderData.billing.paidAmount) > 0) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      doc.text("Amount Paid:", leftMargin, yPosition)
      doc.text(formatMoney(orderData.billing.paidAmount), pageWidth - rightMargin, yPosition, { align: "right" })
      yPosition += 6
    }

    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.text(`Payment Status: ${orderData.billing.paymentStatus}`, leftMargin, yPosition)
    yPosition += 10

    // Rejection/Cancellation Reason (if exists)
    if (orderData.reason) {
      doc.setLineWidth(0.5)
      ensureSpace(25)
      doc.line(leftMargin, yPosition, pageWidth - rightMargin, yPosition)
      yPosition += 8

      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(220, 38, 38)
      doc.text("REASON:", leftMargin, yPosition)
      yPosition += 6

      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      const reasonLines = doc.splitTextToSize(orderData.reason, pageWidth - (leftMargin + rightMargin))
      doc.text(reasonLines, leftMargin, yPosition)
      yPosition += (reasonLines.length * 5) + 5
      doc.setTextColor(0, 0, 0)
    }

    // Order Timeline
    ensureSpace(40)

    doc.setLineWidth(0.5)
    doc.line(leftMargin, yPosition, pageWidth - rightMargin, yPosition)
    yPosition += 8

    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("ORDER TIMELINE", leftMargin, yPosition)
    yPosition += 8

    orderData.timeline.forEach((event) => {
      ensureSpace(15)
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      
      // Add status indicator
      if (event.status === "completed") {
        doc.setFillColor(22, 163, 74)
      } else if (event.status === "rejected") {
        doc.setFillColor(220, 38, 38)
      } else {
        doc.setFillColor(156, 163, 175)
      }
      doc.circle(18, yPosition - 1, 2, "F")
      
      doc.setTextColor(0, 0, 0)
      doc.text(event.event, 25, yPosition)
      yPosition += 5
      
      doc.setFontSize(8)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(100, 100, 100)
      doc.text(event.timestamp || "-", 25, yPosition)
      yPosition += 8
      doc.setTextColor(0, 0, 0)
    })

    ensureSpace(15)
    // Footer
    yPosition = pageHeight - bottomMargin
    doc.setFontSize(8)
    doc.setFont("helvetica", "italic")
    doc.setTextColor(100, 100, 100)
    doc.text("Thank you for your business!", pageWidth / 2, yPosition, { align: "center" })
    yPosition += 5
    doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: "center" })

    // Save the PDF
    doc.save(`Order_Receipt_${orderData.id}.pdf`)
    
    // Show success message
    setToastMessage("Receipt downloaded successfully!")
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)
    } catch (error) {
      debugError("Error generating PDF:", error)
      debugError("Error details:", error.message, error.stack)
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/restaurant/orders')}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    )
  }

  // No order data
  if (!orderData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-600 mb-6">The order you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/restaurant/orders')}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white  px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
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
      <div className="px-4 py-4 space-y-4">
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

        {/* Bill Details Section */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3">Bill details</h2>
          
          <div className="bg-white  rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600">Item subtotal</span>
              <span className="text-sm text-gray-900">{formatMoney(orderData.billing.itemSubtotal)}</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600">Taxes</span>
              <span className="text-sm text-gray-900">{formatMoney(orderData.billing.taxes)}</span>
            </div>
            {Number(orderData.billing.packagingFee) > 0 && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">Packaging fee</span>
                <span className="text-sm text-gray-900">{formatMoney(orderData.billing.packagingFee)}</span>
              </div>
            )}
            {Number(orderData.billing.deliveryFee) > 0 && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">Delivery fee</span>
                <span className="text-sm text-gray-900">{formatMoney(orderData.billing.deliveryFee)}</span>
              </div>
            )}
            {Number(orderData.billing.platformFee) > 0 && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">Platform fee</span>
                <span className="text-sm text-gray-900">{formatMoney(orderData.billing.platformFee)}</span>
              </div>
            )}
            {Number(orderData.billing.discount) > 0 && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-green-700">Discount</span>
                <span className="text-sm text-green-700">{formatDiscount(orderData.billing.discount)}</span>
              </div>
            )}
            {Number(orderData.billing.couponDiscount) > 0 && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-green-700">Coupon discount</span>
                <span className="text-sm text-green-700">{formatDiscount(orderData.billing.couponDiscount)}</span>
              </div>
            )}
            {Number(orderData.billing.referralDiscount) > 0 && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-green-700">Referral discount</span>
                <span className="text-sm text-green-700">{formatDiscount(orderData.billing.referralDiscount)}</span>
              </div>
            )}
            <div className="my-3"></div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">Total bill</span>
                <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-medium rounded">
                  {orderData.billing.paymentStatus}
                </span>
              </div>
              <span className="text-sm font-semibold text-gray-900">{formatMoney(orderData.billing.total)}</span>
            </div>
            {Number(orderData.billing.paidAmount) > 0 && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-gray-600">Amount paid</span>
                <span className="text-sm font-medium text-gray-900">{formatMoney(orderData.billing.paidAmount)}</span>
              </div>
            )}
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
                      <p className="text-sm text-gray-900">{event.event}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{event.timestamp}</p>
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


