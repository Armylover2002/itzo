import { useParams, Link } from "react-router-dom"

import { Download, ArrowLeft, FileText, Printer } from "lucide-react"
import { useRef, useState, useEffect } from "react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import ScrollReveal from "@food/components/user/ScrollReveal"
import { Card, CardHeader, CardTitle, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { Badge } from "@food/components/ui/badge"
import { useOrders } from "@food/context/OrdersContext"
import { orderAPI } from "@food/api"
import { useCompanyName } from "@food/hooks/useCompanyName"

export default function OrderInvoice() {
  const companyName = useCompanyName()
  const { orderId } = useParams()
  const { getOrderById } = useOrders()
  const [order, setOrder] = useState(() => getOrderById(orderId))
  const [loading, setLoading] = useState(!order)
  const [error, setError] = useState(null)
  const invoiceRef = useRef(null)

  useEffect(() => {
    if (order) return

    const fetchOrder = async () => {
      try {
        setLoading(true)
        const response = await orderAPI.getOrderDetails(orderId)
        if (response.data?.success && response.data.data?.order) {
          setOrder(response.data.data.order)
        } else {
          setError("Order not found")
        }
      } catch (err) {
        setError("Failed to load invoice details")
      } finally {
        setLoading(false)
      }
    }

    fetchOrder()
  }, [orderId, order])

  if (loading) {
    return (
      <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a] p-4">
        <div className="max-w-4xl mx-auto text-center py-20">
          <div className="w-8 h-8 border-2 border-[#FF0000] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Generating invoice...</p>
        </div>
      </AnimatedPage>
    )
  }

  if (error || !order) {
    return (
      <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a] p-4">
        <div className="max-w-4xl mx-auto text-center py-20">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-4">{error || 'Order Not Found'}</h1>
          <Link to="/user/orders">
            <Button>Back to Orders</Button>
          </Link>
        </div>
      </AnimatedPage>
    )
  }

  const toMoney = (value) => {
    const num = Number(value)
    return Number.isFinite(num) ? num : 0
  }
  const formatMoney = (value) => `₹${toMoney(value).toFixed(2)}`
  const pricing = order.pricing || {}
  const invoiceSubtotal = toMoney(pricing.subtotal ?? order.subtotal)
  const invoiceDeliveryFee = toMoney(pricing.deliveryFee ?? order.deliveryFee)
  const invoicePlatformFee = toMoney(pricing.platformFee ?? order.platformFee)
  const invoiceTax = toMoney(pricing.tax ?? order.tax)
  const invoiceDiscount = toMoney(pricing.discount ?? order.discount)
  const invoicePackaging = toMoney(pricing.packagingFee ?? order.packagingFee)
  const invoiceTotal = toMoney(pricing.total ?? order.total ?? order.totalAmount)
  const orderStatus = String(order.orderStatus || order.status || "placed")
  const paymentMethodLabel = String(
    order.payment?.method || order.paymentMethod?.type || order.paymentMethod || "N/A",
  ).toUpperCase()
  const invoiceId = order.orderId || order.id || orderId
  const orderItems = Array.isArray(order.items) ? order.items : []

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    const printContent = invoiceRef.current.innerHTML

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${invoiceId}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              color: #333;
            }
            .invoice-header {
              border-bottom: 2px solid #FF0000;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .invoice-title {
              font-size: 32px;
              font-weight: bold;
              color: #FF0000;
              margin-bottom: 10px;
            }
            .invoice-details {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin: 30px 0;
            }
            .invoice-items {
              margin: 30px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid #ddd;
            }
            th {
              bg-red-100
              font-weight: bold;
            }
            .total-section {
              margin-top: 30px;
              text-align: right;
            }
            .total-row {
              padding: 10px 0;
              font-size: 18px;
            }
            .grand-total {
              font-size: 24px;
              font-weight: bold;
              color: #FF0000;
              border-top: 2px solid #FF0000;
              padding-top: 10px;
            }
            @media print {
              body { margin: 0; padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  const handleDownloadPDF = () => {
    handlePrint()
  }

  return (
    <AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 via-white to-red-50/20 dark:from-[#0a0a0a] dark:via-[#1a1a1a] dark:to-[#0a0a0a] p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 md:space-y-8">
        <ScrollReveal>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <Link to={`/user/orders/${orderId}`}>
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 sm:h-10 sm:w-10">
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Invoice</h1>
                <p className="text-muted-foreground text-sm sm:text-base">Order {invoiceId}</p>
              </div>
            </div>
            <div className="flex gap-2 no-print">
              <Button
                variant="outline"
                onClick={handlePrint}
                className="flex items-center gap-2 text-xs sm:text-sm h-9 sm:h-10"
              >
                <Printer className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Print</span>
              </Button>
              <Button
                onClick={handleDownloadPDF}
                className="bg-[#FF0000] hover:bg-[#C83C00] flex items-center gap-2 text-xs sm:text-sm h-9 sm:h-10"
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                <span className="hidden sm:inline text-white">Download PDF</span>
                <span className="sm:hidden text-white">PDF</span>
              </Button>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <Card ref={invoiceRef} className="dark:bg-[#1a1a1a] dark:border-gray-800">
            <CardContent className="p-4 sm:p-6 md:p-8 lg:p-10">
              {/* Invoice Header */}
              <div className="invoice-header">
                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-[#FF0000]" />
                  <h2 className="invoice-title text-xl sm:text-2xl md:text-3xl text-[#FF0000] font-bold">INVOICE</h2>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">{companyName}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {order?.orderType === 'quick' || /^QC/i.test(order?.orderId || order?.id) 
                        ? 'Quick Commerce Platform' 
                        : 'Food Delivery Platform'}
                    </p>
                  </div>
                  <Badge className="bg-[#FF0000] text-white text-sm sm:text-base md:text-lg px-3 sm:px-4 py-1.5 sm:py-2 w-fit">
                    {orderStatus.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Invoice Details */}
              <div className="invoice-details grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mt-4 sm:mt-6">
                <div>
                  <h3 className="font-bold mb-2 text-sm sm:text-base">Bill To:</h3>
                  <p className="text-xs sm:text-sm">{order.address?.street || order.deliveryAddress?.street}</p>
                  {(order.address?.additionalDetails || order.deliveryAddress?.additionalDetails) && (
                    <p className="text-xs sm:text-sm">{order.address?.additionalDetails || order.deliveryAddress?.additionalDetails}</p>
                  )}
                  <p className="text-xs sm:text-sm">
                    {order.address?.city || order.deliveryAddress?.city}, {order.address?.state || order.deliveryAddress?.state} {order.address?.zipCode || order.deliveryAddress?.zipCode || order.deliveryAddress?.pincode}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <h3 className="font-bold mb-2 text-sm sm:text-base">Invoice Details:</h3>
                  <p className="text-xs sm:text-sm"><strong>Invoice #:</strong> {invoiceId}</p>
                  <p className="text-xs sm:text-sm"><strong>Date:</strong> {formatDate(order.createdAt)}</p>
                  <p className="text-xs sm:text-sm"><strong>Payment:</strong> {paymentMethodLabel}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="invoice-items mt-4 sm:mt-6">
                <h3 className="font-bold mb-3 sm:mb-4 text-sm sm:text-base">Order Items:</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr>
                        <th className="px-2 sm:px-3 py-2 text-left">Item</th>
                        <th className="px-2 sm:px-3 py-2 text-center hidden sm:table-cell">Quantity</th>
                        <th className="px-2 sm:px-3 py-2 text-right hidden md:table-cell">Unit Price</th>
                        <th className="px-2 sm:px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItems.map((item, idx) => {
                        const unitPrice = toMoney(item.price)
                        const qty = toMoney(item.quantity || 1) || 1
                        return (
                        <tr key={item.id || item._id || idx} className="border-b">
                          <td className="px-2 sm:px-3 py-2 sm:py-3">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <img
                                src={item.image || item.imageUrl || ""}
                                alt={item.name}
                                className="w-8 h-8 sm:w-12 sm:h-12 object-cover rounded flex-shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <span className="font-medium block">{item.name}</span>
                                {item.variantName ? (
                                  <span className="text-xs text-gray-500">{item.variantName}</span>
                                ) : null}
                                <span className="text-muted-foreground sm:hidden text-xs">
                                  Qty: {qty} · {formatMoney(unitPrice)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 sm:px-3 py-2 sm:py-3 text-center hidden sm:table-cell">{qty}</td>
                          <td className="px-2 sm:px-3 py-2 sm:py-3 text-right hidden md:table-cell">{formatMoney(unitPrice)}</td>
                          <td className="px-2 sm:px-3 py-2 sm:py-3 text-right font-medium">{formatMoney(unitPrice * qty)}</td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Section */}
              <div className="total-section mt-4 sm:mt-6">
                <div className="total-row flex justify-between text-xs sm:text-sm sm:text-base py-1 sm:py-2">
                  <span>Subtotal:</span>
                  <span>{formatMoney(invoiceSubtotal)}</span>
                </div>
                <div className="total-row flex justify-between text-xs sm:text-sm sm:text-base py-1 sm:py-2">
                  <span>Delivery Fee:</span>
                  <span>{formatMoney(invoiceDeliveryFee)}</span>
                </div>
                {invoicePlatformFee > 0 && (
                  <div className="total-row flex justify-between text-xs sm:text-sm sm:text-base py-1 sm:py-2">
                    <span>Platform Fee:</span>
                    <span>{formatMoney(invoicePlatformFee)}</span>
                  </div>
                )}
                {invoicePackaging > 0 && (
                  <div className="total-row flex justify-between text-xs sm:text-sm sm:text-base py-1 sm:py-2">
                    <span>Packaging:</span>
                    <span>{formatMoney(invoicePackaging)}</span>
                  </div>
                )}
                <div className="total-row flex justify-between text-xs sm:text-sm sm:text-base py-1 sm:py-2">
                  <span>Tax:</span>
                  <span>{formatMoney(invoiceTax)}</span>
                </div>
                {invoiceDiscount > 0 && (
                  <div className="total-row flex justify-between text-xs sm:text-sm sm:text-base py-1 sm:py-2">
                    <span>Discount:</span>
                    <span>- {formatMoney(invoiceDiscount)}</span>
                  </div>
                )}
                <div className="grand-total flex justify-between text-base sm:text-lg md:text-xl md:text-2xl pt-2 sm:pt-3 mt-2 sm:mt-3 border-t-2 border-[#FF0000]">
                  <span>Total:</span>
                  <span>{formatMoney(invoiceTotal)}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t text-center text-xs sm:text-sm text-muted-foreground">
                <p>Thank you for your order!</p>
                <p className="mt-1 sm:mt-2">For any queries, please contact our support team.</p>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 no-print">
            {orderStatus !== 'scheduled' && (
              <Link to={`/user/orders/${orderId}`} className="flex-1">
                <Button variant="outline" className="w-full text-sm sm:text-base h-10 sm:h-11">
                  Track Order
                </Button>
              </Link>
            )}
            <Link to="/user/orders" className="flex-1">
              <Button variant="outline" className="w-full text-sm sm:text-base h-10 sm:h-11">
                Back to Orders
              </Button>
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </AnimatedPage>
  )
}
