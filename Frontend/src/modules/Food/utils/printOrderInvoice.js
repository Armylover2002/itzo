import { getCachedSettings } from "@common/utils/businessSettings"
import { savePdfDocument } from "@shared/utils/fileDownload"

const debugError = (...args) => console.error(...args)

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatMoney = (value) => `INR ${toNumber(value).toFixed(2)}`
const formatRupee = (value) => {
  const amount = toNumber(value)
  return amount % 1 === 0 ? `₹${amount.toFixed(0)}` : `₹${amount.toFixed(2)}`
}
const formatReceiptDateTime = (value) => {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return new Date().toLocaleString("en-IN")
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
}
const normalizePaymentLabel = (raw, statusRaw = "") => {
  const method = String(raw || "").trim().toLowerCase()
  const status = String(statusRaw || "").trim().toLowerCase()
  if (method.includes("cash") || method === "cod") return "COD"
  if (method.includes("wallet")) return "WALLET"
  if (
    method.includes("razorpay") ||
    method.includes("online") ||
    method.includes("upi") ||
    method.includes("card") ||
    method.includes("netbank")
  ) {
    return status === "paid" || status === "success" ? "ONLINE" : "ONLINE"
  }
  if (!method && (status === "paid" || status === "success")) return "ONLINE"
  return method ? titleCase(method) : "COD"
}
const formatDisplayText = (value, fallback = "N/A") => {
  if (value === null || value === undefined) return fallback
  const normalized = String(value).trim()
  return normalized || fallback
}
const firstText = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

const isMeaningfulPartnerName = (value) => {
  const normalized = String(value || "").trim().toLowerCase()
  if (!normalized) return false
  return !["delivery partner", "not assigned", "n/a", "na", "none"].includes(normalized)
}
const titleCase = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())

const formatOrderAddress = (address) => {
  if (!address || typeof address !== "object") return "Not available"

  const formattedAddress = String(address.formattedAddress || "").trim()
  const rawAddress = String(address.address || "").trim()

  const primaryParts = [
    address.label || address.type,
    address.name,
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

  const orderedParts = []
  const pushPart = (value) => {
    const normalized = String(value || "").trim()
    if (!normalized) return
    const key = normalized.toLowerCase()

    const isContained = orderedParts.some((existingPart) => {
      const existingKey = existingPart.toLowerCase()
      return existingKey === key || existingKey.includes(key) || key.includes(existingKey)
    })
    if (isContained) return

    orderedParts.push(normalized)
  }

  if (formattedAddress) pushPart(formattedAddress)
  if (rawAddress && rawAddress.toLowerCase() !== formattedAddress.toLowerCase()) pushPart(rawAddress)
  primaryParts.forEach(pushPart)

  return orderedParts.join(", ") || "Not available"
}

const isQuickCommerceOrder = (order) => {
  const type = String(order?.orderType || "").toLowerCase()
  if (type === "quick" || type === "mixed") return true
  const id = String(order?.orderId || order?.id || order?._id || "")
  return /^QC/i.test(id)
}

const resolveInvoiceMerchantName = (order, isQuickOrder) => {
  if (isQuickOrder) {
    const pickupName = Array.isArray(order?.pickupSources)
      ? order.pickupSources.find((source) => source?.name)?.name
      : ""
    return formatDisplayText(
      firstText(
        order.storeName,
        order.sellerName,
        order.seller?.shopName,
        order.seller?.name,
        order.restaurantName,
        typeof order.restaurant === "string" ? order.restaurant : "",
        order.restaurantId?.shopName,
        order.restaurantId?.name,
        pickupName,
      ),
      "Store",
    )
  }

  return formatDisplayText(
    firstText(
      order.restaurantName,
      typeof order.restaurant === "string" ? order.restaurant : "",
      order.restaurantId?.restaurantName,
      order.restaurantId?.name,
      order.restaurant?.name,
    ),
    "Restaurant",
  )
}

const resolveInvoiceDeliveryAddress = (order) => {
  const candidates = [
    order.deliveryAddress,
    order.address,
    order.customerAddress,
    order.shippingAddress,
  ].filter((value) => value && typeof value === "object")

  for (const candidate of candidates) {
    const formatted = formatOrderAddress(candidate)
    if (formatted && formatted !== "Not available") return formatted
  }

  return "Not available"
}

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

const imageUrlToDataUrl = async (url) => {
  if (!url) return null
  if (url.startsWith("data:")) return url

  const u = String(url).trim()
  if (!u.startsWith("http") && !u.startsWith("/")) return null

  try {
    const response = await fetch(url, { mode: 'cors', cache: "force-cache" })
    if (!response.ok) return null
    const blob = await response.blob()
    return await blobToDataUrl(blob)
  } catch (err) {
    debugError('Error converting image to data URL:', err)
    return null
  }
}

const formatDateTime = (value) => {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString()
}

const drawReceiptLine = (doc, y, width, margin, style = "solid", thickness = 0.4) => {
  const x1 = margin
  const x2 = width - margin
  if (style === "dashed") {
    doc.setLineDashPattern([1.2, 1.2], 0)
  } else {
    doc.setLineDashPattern([], 0)
  }
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(thickness)
  doc.line(x1, y, x2, y)
  doc.setLineDashPattern([], 0)
}

const wrapReceiptText = (doc, text, maxWidth) =>
  doc.splitTextToSize(formatDisplayText(text, ""), maxWidth).filter(Boolean)

/**
 * Thermal-style customer receipt (matches store/restaurant bill layout).
 */
const buildCustomerReceiptPdfDocument = async (order, settings = {}) => {
  const { default: jsPDF } = await import("jspdf")

  const receiptWidth = 80
  const margin = 4
  const contentWidth = receiptWidth - margin * 2
  const orderId = order.orderId || order.id || order.subscriptionId || "N/A"
  const createdAt = order.createdAt || order.date || new Date()
  const items = Array.isArray(order.items) ? order.items : []

  const isQuickOrder = isQuickCommerceOrder(order)
  const merchantName = resolveInvoiceMerchantName(order, isQuickOrder)
  const tagline = firstText(
    settings?.metaDescription,
    settings?.tagline,
    isQuickOrder ? "Quick delivery essentials" : "Smart Food. Better Living.",
  ).split("\n")[0].slice(0, 72)
  const merchantPhone = firstText(
    order.seller?.phone,
    order.restaurantId?.phone,
    order.pickupSources?.find((source) => source?.phone)?.phone,
    settings?.supportPhone,
    settings?.phone?.number,
  )
  const platformPhone = firstText(settings?.supportPhone, settings?.phone?.number, merchantPhone)
  const deliveryAddress = resolveInvoiceDeliveryAddress(order)

  // Legal & Tax Details — Admin > Global Settings > Legal & Tax Details (Invoice).
  // Printed only when configured; adds nothing to the layout otherwise.
  const legalDetailLines = [
    settings?.legalName ? `${settings.legalName}` : "",
    settings?.gstin ? `GSTIN: ${settings.gstin}` : "",
    settings?.fssai ? `FSSAI: ${settings.fssai}` : "",
    settings?.cinNumber ? `CIN: ${settings.cinNumber}` : "",
  ].filter(Boolean)

  const itemsSubtotal = items.reduce((sum, item) => {
    const qty = toNumber(item?.quantity || 1)
    const unitPrice = toNumber(item?.price)
    return sum + qty * unitPrice
  }, 0)
  const subtotal = itemsSubtotal > 0
    ? itemsSubtotal
    : toNumber(order.totalItemAmount ?? order.subtotal ?? order.pricing?.subtotal ?? order.totalAmount)
  const deliveryFee = toNumber(
    order.deliveryCharge ?? order.deliveryFee ?? order.pricing?.deliveryFee ?? order.delivery?.fee,
  )
  const taxAmount = toNumber(order.vatTax ?? order.taxAmount ?? order.tax ?? order.gst ?? order.pricing?.tax)
  const discountAmount = toNumber(
    order.couponDiscount ?? order.itemDiscount ?? order.discountAmount ?? order.pricing?.discount,
  )
  const platformFee = toNumber(order.platformFee ?? order.pricing?.platformFee)
  const packagingFee = toNumber(order.packagingFee ?? order.pricing?.packagingFee)
  const computedTotal = subtotal + deliveryFee + platformFee + packagingFee + taxAmount - discountAmount
  const customerTotal = toNumber(order.pricing?.total ?? order.totalAmount ?? order.total ?? computedTotal)

  const paymentMethodRaw = firstText(order.paymentType, order.payment?.method, order.paymentMethod)
  const paymentStatusRaw = firstText(order.paymentStatus, order.paymentCollectionStatus, order.payment?.status)
  const paymentLabel = normalizePaymentLabel(paymentMethodRaw, paymentStatusRaw)

  const returnSummary = order.returnSummary || null
  const returnRefundedAmount = toNumber(
    returnSummary?.refundedAmount ?? order.refundedAmount ?? order.payment?.refund?.amount,
  )
  const originalPaidTotal = toNumber(returnSummary?.originalPaidTotal ?? order.originalPaidTotal ?? customerTotal)
  const netAfterReturn = toNumber(
    returnSummary?.netAfterReturn ?? order.netAfterReturn ?? Math.max(0, originalPaidTotal - returnRefundedAmount),
  )
  const hasReturn = Boolean(
    order.hasReturn ||
      returnSummary?.hasReturn ||
      returnRefundedAmount > 0,
  )

  const itemRows = items.length
    ? items.map((item) => {
        const qty = toNumber(item.quantity || 1)
        const unitPrice = toNumber(item.price)
        const lineTotal = qty * unitPrice
        const title = [item.name || item.itemName || item.title || "Item", item.variantName]
          .filter(Boolean)
          .join(" ")
        return { title, qty, unitPrice, lineTotal }
      })
    : [{ title: "Order Total", qty: 1, unitPrice: customerTotal, lineTotal: customerTotal }]

  const summaryRows = [
    ["Item total", formatRupee(subtotal)],
    ["Delivery", deliveryFee > 0 ? formatRupee(deliveryFee) : "FREE"],
  ]
  if (packagingFee > 0) summaryRows.push(["Packaging", formatRupee(packagingFee)])
  if (platformFee > 0) summaryRows.push(["Platform fee", formatRupee(platformFee)])
  if (taxAmount > 0) summaryRows.push(["Taxes (GST)", formatRupee(taxAmount)])
  if (discountAmount > 0) summaryRows.push(["Discount", `- ${formatRupee(discountAmount)}`])
  if (hasReturn) {
    summaryRows.push(["Original paid", formatRupee(originalPaidTotal || customerTotal)])
    if (returnRefundedAmount > 0) summaryRows.push(["Refunded", `- ${formatRupee(returnRefundedAmount)}`])
    summaryRows.push(["Net after return", formatRupee(netAfterReturn)])
  }

  let estimatedHeight = 18
  estimatedHeight += tagline ? 4 : 0
  estimatedHeight += merchantPhone ? 4 : 0
  estimatedHeight += 8
  estimatedHeight += 12
  estimatedHeight += Math.max(1, Math.ceil(String(deliveryAddress || "").length / 36)) * 3.6
  estimatedHeight += 8
  estimatedHeight += 6
  estimatedHeight += itemRows.length * 8
  estimatedHeight += summaryRows.length * 4.5 + 14
  estimatedHeight += platformPhone ? 8 : 0
  estimatedHeight += legalDetailLines.length ? legalDetailLines.length * 3.6 + 6 : 0
  estimatedHeight += 16

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [receiptWidth, Math.max(140, estimatedHeight)],
  })

  doc.setFont("courier", "normal")
  doc.setTextColor(0, 0, 0)

  let y = 8
  const centerText = (text, size = 10, style = "normal") => {
    doc.setFont("courier", style)
    doc.setFontSize(size)
    doc.text(String(text), receiptWidth / 2, y, { align: "center" })
  }

  centerText(merchantName, 13, "bold")
  y += 5
  if (tagline) {
    centerText(tagline, 8, "normal")
    y += 4
  }
  if (merchantPhone) {
    centerText(merchantPhone, 8, "normal")
    y += 4
  }

  y += 2
  drawReceiptLine(doc, y, receiptWidth, margin, "solid", 0.8)
  y += 5

  doc.setFont("courier", "bold")
  doc.setFontSize(8.5)
  doc.text(`Order: ${orderId}`, margin, y)
  y += 4
  doc.setFont("courier", "normal")
  doc.text(`Date: ${formatReceiptDateTime(createdAt)}`, margin, y)
  y += 4
  doc.text(`Payment: ${paymentLabel}`, margin, y)
  y += 4

  drawReceiptLine(doc, y, receiptWidth, margin, "dashed")
  y += 4

  wrapReceiptText(doc, deliveryAddress, contentWidth).forEach((line) => {
    doc.text(line, margin, y)
    y += 3.6
  })

  y += 1
  drawReceiptLine(doc, y, receiptWidth, margin, "dashed")
  y += 5

  doc.setFont("courier", "bold")
  doc.setFontSize(8)
  doc.text("Item", margin, y)
  doc.text("Qty", receiptWidth - margin - 24, y, { align: "right" })
  doc.text("Rate", receiptWidth - margin - 14, y, { align: "right" })
  doc.text("Amt", receiptWidth - margin, y, { align: "right" })
  y += 2
  drawReceiptLine(doc, y, receiptWidth, margin, "solid", 0.35)
  y += 4

  itemRows.forEach((row) => {
    doc.setFont("courier", "bold")
    doc.setFontSize(8)
    const nameLines = wrapReceiptText(doc, row.title, contentWidth - 26)
    nameLines.forEach((line, index) => {
      doc.text(line, margin, y)
      if (index === 0) {
        doc.setFont("courier", "normal")
        doc.text(String(row.qty), receiptWidth - margin - 24, y, { align: "right" })
        doc.text(formatRupee(row.unitPrice), receiptWidth - margin - 14, y, { align: "right" })
        doc.text(formatRupee(row.lineTotal), receiptWidth - margin, y, { align: "right" })
      }
      y += 3.6
    })
    y += 1.2
  })

  drawReceiptLine(doc, y, receiptWidth, margin, "dashed")
  y += 4.5

  summaryRows.forEach(([label, value]) => {
    doc.setFont("courier", "normal")
    doc.setFontSize(8.5)
    doc.text(label, margin, y)
    doc.text(String(value), receiptWidth - margin, y, { align: "right" })
    y += 4.2
  })

  y += 1
  drawReceiptLine(doc, y, receiptWidth, margin, "solid", 0.8)
  y += 5
  doc.setFont("courier", "bold")
  doc.setFontSize(10)
  doc.text("TOTAL", margin, y)
  doc.text(formatRupee(hasReturn ? netAfterReturn : customerTotal), receiptWidth - margin, y, { align: "right" })
  y += 6

  drawReceiptLine(doc, y, receiptWidth, margin, "dashed")
  y += 5

  if (platformPhone) {
    doc.setFont("courier", "normal")
    doc.setFontSize(7.5)
    centerText(`Order directly on WhatsApp: ${platformPhone}`, 7.5, "normal")
    y += 5
  }

  if (legalDetailLines.length) {
    drawReceiptLine(doc, y, receiptWidth, margin, "dashed")
    y += 4
    legalDetailLines.forEach((line) => {
      centerText(line, 7, "normal")
      y += 3.6
    })
    y += 1.4
  }

  centerText("Thank you for ordering with us!", 8, "normal")
  y += 4
  centerText("See you again soon", 7.5, "normal")

  const filename = `Invoice_${orderId}_${new Date().toISOString().split("T")[0]}.pdf`
  return { doc, fileName: filename }
}

const generateCustomerReceiptInvoice = async (order, settings = {}, saveOptions = {}) => {
  const { doc, fileName } = await buildCustomerReceiptPdfDocument(order, settings)
  const saved = await savePdfDocument(doc, fileName, saveOptions)
  if (!saved) throw new Error("Could not save the invoice on this device")
}

/** Build customer invoice PDF for download or native file share. */
export const buildOrderInvoicePdf = async (order, options = {}) => {
  const audience = options.audience === "customer" ? "customer" : "restaurant"
  if (audience !== "customer") {
    throw new Error("Share is only supported for customer invoices")
  }
  const settings = getCachedSettings() || {}
  const { doc, fileName } = await buildCustomerReceiptPdfDocument(order, settings)
  return { blob: doc.output("blob"), fileName }
}

/**
 * @param {object} order
 * @param {{ audience?: "restaurant" | "customer" }} [options]
 *   "restaurant" prints the payout view (commission, restaurant earning).
 *   "customer" prints what the customer actually paid, plus refund status.
 */
export const generateOrderInvoice = async (order, options = {}) => {
  const audience = options.audience === "customer" ? "customer" : "restaurant"
  const isCustomerInvoice = audience === "customer"
  const settings = getCachedSettings() || {}

  if (isCustomerInvoice) {
    try {
      await generateCustomerReceiptInvoice(order, settings, {
        preferShare: options.preferShare,
        preferDownload: options.preferDownload,
      })
      return
    } catch (error) {
      debugError("Error generating customer receipt invoice:", error)
      alert("Failed to download PDF invoice. Please try again.")
      throw error
    }
  }

  try {
    const { default: jsPDF } = await import("jspdf")
    const { default: autoTable } = await import("jspdf-autotable")

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const orderId = order.orderId || order.id || order.subscriptionId || "N/A"
    const orderDate = order.date && order.time
      ? `${order.date}, ${order.time}`
      : (order.date || new Date().toLocaleDateString())

    const companyName = settings?.companyName || "ItzoFood"
    const logoUrl = settings?.userLogo?.url || settings?.logo?.url || undefined
    const logoDataUrl = await imageUrlToDataUrl(logoUrl)

    // Legal & Tax Details — Admin > Global Settings > Legal & Tax Details (Invoice).
    // Printed as one compact line in the header band only when configured.
    const legalDetailLine = [
      settings?.legalName,
      settings?.gstin ? `GSTIN: ${settings.gstin}` : "",
      settings?.fssai ? `FSSAI: ${settings.fssai}` : "",
      settings?.cinNumber ? `CIN: ${settings.cinNumber}` : "",
    ].filter(Boolean).join("   •   ")

    const items = Array.isArray(order.items) ? order.items : []
    const itemsSubtotal = items.reduce((sum, item) => {
      const qty = toNumber(item?.quantity || 1)
      const unitPrice = toNumber(item?.price)
      return sum + (qty * unitPrice)
    }, 0)
    const subtotal = itemsSubtotal > 0
      ? itemsSubtotal
      : toNumber(
        order.totalItemAmount ??
        order.subtotal ??
        order.pricing?.subtotal ??
        order.totalAmount
      )
    const deliveryFee = toNumber(
      order.deliveryCharge ??
      order.deliveryFee ??
      order.pricing?.deliveryFee ??
      order.delivery?.fee
    )
    const taxAmount = toNumber(
      order.vatTax ??
      order.taxAmount ??
      order.tax ??
      order.gst ??
      order.pricing?.tax
    )
    const discountAmount = toNumber(
      order.couponDiscount ??
      order.itemDiscount ??
      order.discountAmount ??
      order.pricing?.discount
    )
    const platformFee = toNumber(
      order.platformFee ??
      order.pricing?.platformFee
    )
    const packagingFee = toNumber(
      order.packagingFee ??
      order.pricing?.packagingFee
    )
    const computedTotal = subtotal + deliveryFee + platformFee + packagingFee + taxAmount - discountAmount
    const totalAmount = toNumber(
      order.pricing?.total ??
      order.totalAmount ??
      computedTotal
    )
    const paymentMethodRaw = firstText(
      order.paymentType,
      order.payment?.method,
      order.paymentMethod,
    )
    const paymentStatusRaw = firstText(
      order.paymentStatus,
      order.paymentCollectionStatus,
      order.payment?.status,
    ).toLowerCase()
    const paymentType = paymentMethodRaw ? titleCase(paymentMethodRaw) : "N/A"
    const paymentStatus = paymentStatusRaw
      ? titleCase(paymentStatusRaw)
      : (paymentMethodRaw.toLowerCase() === "cash" ? "COD" : "Pending")
    const deliveryPartnerName = formatDisplayText(
      firstText(
        order.deliveryPartnerName,
        order.deliveryBoyName,
        isMeaningfulPartnerName(order.deliveryPartner?.name) ? order.deliveryPartner.name : "",
        isMeaningfulPartnerName(order.deliveryPartners?.[0]?.name) ? order.deliveryPartners[0].name : "",
        isMeaningfulPartnerName(order.deliveryPartnerId?.name) ? order.deliveryPartnerId.name : "",
        isMeaningfulPartnerName(order.dispatch?.deliveryPartnerId?.name)
          ? order.dispatch.deliveryPartnerId.name
          : "",
      ),
      "Not assigned",
    )
    const deliveryPartnerPhone = formatDisplayText(
      firstText(
        order.deliveryPartnerPhone,
        order.deliveryBoyNumber,
        order.deliveryPartner?.phone,
        order.deliveryPartners?.[0]?.phone,
        order.deliveryPartnerId?.phone,
        order.dispatch?.deliveryPartnerId?.phone,
      ),
      "Not assigned",
    )
    const orderStatus = formatDisplayText(titleCase(order.orderStatus || order.status))
    const customerName = formatDisplayText(
      firstText(
        order.customerName,
        order.userName,
        order.userId?.name,
        order.userId?.fullName,
        order.customer?.name,
        order.customerInfo?.name,
        order.deliveryAddress?.name,
        order.deliveryAddress?.fullName,
        order.address?.name,
        order.address?.fullName,
        order.sellerOrder?.customer?.name,
      ),
    )
    const customerPhone = formatDisplayText(
      firstText(
        order.customerPhone,
        order.userPhone,
        order.userId?.phone,
        order.customer?.phone,
        order.customerInfo?.phone,
        order.deliveryAddress?.phone,
        order.address?.phone,
      ),
    )
    const isQuickOrder = isQuickCommerceOrder(order)
    const merchantName = resolveInvoiceMerchantName(order, isQuickOrder)
    const merchantCardTitle = isQuickOrder ? "Store" : "Restaurant"
    const deliveryType = formatDisplayText(
      titleCase(
        firstText(order.deliveryType) ||
          (isQuickOrder
            ? "home_delivery"
            : firstText(order.deliveryMode) ||
              (String(order.orderType || "").toLowerCase() === "food" ? "home_delivery" : order.orderType)),
      ) || "Home Delivery",
    )
    const deliveryAddress = resolveInvoiceDeliveryAddress(order)
    const itemCount = items.reduce((sum, item) => sum + toNumber(item?.quantity || 1), 0) || items.length
    const restaurantCommission = toNumber(
      order.restaurantCommission ??
      order.pricing?.restaurantCommission
    )
    const quickRestaurantShare = toNumber(
      order.quickRestaurantShare ??
      order.pricing?.quickRestaurantShare
    )
    // Match order-history bill math: only restaurant-visible lines (food payout view).
    const restaurantOrderTotal = Math.max(
      0,
      subtotal + packagingFee + (!isQuickOrder ? quickRestaurantShare : 0),
    )
    const restaurantEarning = Math.max(0, restaurantOrderTotal - restaurantCommission)

    const quickDeliveryFee = toNumber(order.quickDeliveryFee ?? order.pricing?.quickDeliveryFee)
    // Food "quick delivery" surcharge only — not used on pure QC orders.
    const includeFoodQuickDeliveryFee = !isQuickOrder && quickDeliveryFee > 0
    const customerTotal = toNumber(
      order.pricing?.total ??
      order.totalAmount ??
      order.total ??
      (computedTotal + (includeFoodQuickDeliveryFee ? quickDeliveryFee : 0))
    )
    const headlineTotal = isCustomerInvoice ? customerTotal : restaurantOrderTotal

    const refund = order.payment?.refund || order.refund || {}
    const returnSummary = order.returnSummary || null
    const returnRefundedAmount = toNumber(
      returnSummary?.refundedAmount ?? order.refundedAmount ?? refund.amount,
    )
    const originalPaidTotal = toNumber(
      returnSummary?.originalPaidTotal ??
        order.originalPaidTotal ??
        customerTotal,
    )
    const netAfterReturn = toNumber(
      returnSummary?.netAfterReturn ??
        order.netAfterReturn ??
        Math.max(0, originalPaidTotal - returnRefundedAmount),
    )
    const returnStatusLabel = titleCase(
      firstText(
        order.returnStatusLabel,
        returnSummary?.returnStatusLabel,
        order.returnStatus,
        returnSummary?.returnStatus,
      ),
    )
    const refundStatusRaw = String(
      returnSummary?.refundStatus || refund.status || "",
    ).toLowerCase()
    const refundAmount = returnRefundedAmount || toNumber(refund.amount)
    const hasRefund =
      (refundStatusRaw && refundStatusRaw !== "none") ||
      refundAmount > 0 ||
      Boolean(returnSummary?.hasReturn && returnRefundedAmount > 0)
    const refundStatusLabel = titleCase(refundStatusRaw) || (refundAmount > 0 ? "Completed" : "Pending")
    const refundMethodLabel =
      titleCase(firstText(refund.processedMethod, refund.requestedMethod, returnSummary?.returns?.[0]?.refundMethod)) ||
      "Original payment method"
    const refundDate = formatDateTime(refund.processedAt || refund.requestedAt)

    doc.setFillColor(220, 38, 38)
    doc.rect(0, 0, pageWidth, 46, "F")
    doc.setFillColor(255, 255, 255)
    doc.setGState(new doc.GState({ opacity: 0.08 }))
    doc.circle(pageWidth - 24, 12, 18, "F")
    doc.circle(pageWidth - 6, 36, 22, "F")
    doc.setGState(new doc.GState({ opacity: 1 }))

    if (logoDataUrl) {
      try {
        const logoFormat = logoDataUrl.includes("image/jpeg") ? "JPEG" : "PNG"
        doc.addImage(logoDataUrl, logoFormat, 14, 8, 24, 24, undefined, "FAST")
      } catch {
        // Ignore logo rendering issues and continue with text-only header.
      }
    }

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(17)
    doc.setFont(undefined, "bold")
    doc.text(companyName, logoDataUrl ? 42 : 14, 17)
    doc.setFontSize(10)
    doc.setFont(undefined, "normal")
    doc.text("Order Invoice", logoDataUrl ? 42 : 14, 24)
    doc.setFontSize(8.5)
    doc.text(
      isCustomerInvoice
        ? "Customer bill with payment, refund and delivery details"
        : isQuickOrder
          ? "Store summary report with billing and delivery details"
          : "Restaurant summary report with billing and delivery details",
      logoDataUrl ? 42 : 14,
      30,
    )
    if (legalDetailLine) {
      // Capped to one line at a conservative width so it never reaches into
      // the right-aligned invoice meta column, regardless of how many legal
      // fields the admin has filled in.
      doc.setFontSize(6.5)
      doc.setTextColor(255, 255, 255)
      const [legalLine] = doc.splitTextToSize(legalDetailLine, 100)
      doc.text(legalLine, logoDataUrl ? 42 : 14, 41)
    }

    doc.setFontSize(9)
    doc.text(`Invoice #: ${orderId}`, pageWidth - 14, 14, { align: "right" })
    doc.text(`Date: ${orderDate}`, pageWidth - 14, 20, { align: "right" })
    doc.text(`Status: ${orderStatus}`, pageWidth - 14, 26, { align: "right" })
    doc.text(`Payment: ${paymentStatus}`, pageWidth - 14, 32, { align: "right" })
    if (returnStatusLabel) {
      doc.text(`Return: ${returnStatusLabel}`, pageWidth - 14, 38, { align: "right" })
    }

    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(248, 250, 252)

    const drawInfoCard = (titleText, x, y, width, rows, accentColor = [220, 38, 38]) => {
      const cardPaddingX = 4
      const titleBarHeight = 8
      const contentStartY = y + 14
      const labelX = x + cardPaddingX
      const valueX = x + 18
      const valueWidth = width - 26

      let measuredHeight = contentStartY
      const measuredRows = rows.map((row) => {
        const label = `${row.label}:`
        const valueLines = doc.splitTextToSize(formatDisplayText(row.value), valueWidth)
        const rowHeight = Math.max(5, valueLines.length * 4)
        measuredHeight += rowHeight
        return { label, valueLines, rowHeight }
      })

      const cardHeight = Math.max(39, measuredHeight - y + 4)

      doc.setFillColor(255, 255, 255)
      doc.roundedRect(x, y, width, cardHeight, 3, 3, "FD")
      doc.setFillColor(...accentColor)
      doc.roundedRect(x, y, width, titleBarHeight, 3, 3, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.setFont(undefined, "bold")
      doc.text(titleText, labelX, y + 5.5)
      doc.setTextColor(71, 85, 105)
      doc.setFont(undefined, "normal")
      doc.setFontSize(8.5)

      let currentY = contentStartY
      measuredRows.forEach((row) => {
        doc.setFont(undefined, "bold")
        doc.text(row.label, labelX, currentY)
        doc.setFont(undefined, "normal")
        doc.text(row.valueLines, valueX, currentY)
        currentY += row.rowHeight
      })

      return cardHeight
    }

    const customerCardHeight = drawInfoCard("Customer", 14, 53, 58, [
      { label: "Name", value: customerName },
      { label: "Phone", value: customerPhone },
      { label: "Address", value: deliveryAddress },
    ])
    const restaurantCardHeight = drawInfoCard(merchantCardTitle, 76, 53, 58, [
      { label: "Name", value: merchantName },
      { label: "Delivery", value: deliveryType },
      { label: "Items", value: `${itemCount} item${itemCount === 1 ? "" : "s"}` },
    ], [37, 99, 235])
    const deliveryCardHeight = drawInfoCard("Delivery Partner", 138, 53, 58, [
      { label: "Name", value: deliveryPartnerName },
      { label: "Phone", value: deliveryPartnerPhone },
      { label: "Payment", value: paymentType },
    ], [249, 115, 22])

    const infoCardsBottomY = 53 + Math.max(customerCardHeight, restaurantCardHeight, deliveryCardHeight)

    autoTable(doc, {
      startY: infoCardsBottomY + 8,
      body: [[
        `Order ID: ${orderId}`,
        `Status: ${orderStatus}`,
        `Payment: ${paymentType} / ${paymentStatus}`,
        `${isCustomerInvoice ? "Amount Paid" : "Grand Total"}: ${formatMoney(headlineTotal)}`,
      ]],
      theme: "plain",
      styles: {
        fontSize: 9,
        textColor: [30, 41, 59],
        fillColor: [241, 245, 249],
        cellPadding: { top: 3.5, right: 4, bottom: 3.5, left: 4 },
        lineColor: [226, 232, 240],
        lineWidth: 0.25,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 45 },
        2: { cellWidth: 50 },
        3: { cellWidth: 42, halign: "right", textColor: [220, 38, 38] },
      },
      margin: { left: 14, right: 14 },
    })

    const tableBody = items.length > 0
      ? items.map((item) => {
        const qty = toNumber(item.quantity || 1)
        const title = item.name || item.itemName || item.title || "Item"
        const unitPrice = toNumber(item.price)
        const lineTotal = qty * unitPrice
        return [qty, title, formatMoney(unitPrice), formatMoney(lineTotal)]
      })
      : [[1, "Order Total", formatMoney(totalAmount), formatMoney(totalAmount)]]

    autoTable(doc, {
      startY: (doc.lastAutoTable?.finalY || 110) + 6,
      head: [["Qty", "Item", "Unit Price", "Line Total"]],
      body: tableBody,
      theme: "grid",
      headStyles: {
        fillColor: [220, 38, 38],
        textColor: 255,
        fontSize: 9,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [30, 41, 59],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      styles: {
        cellPadding: 3.2,
        lineColor: [226, 232, 240],
        lineWidth: 0.3,
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 18 },
        1: { cellWidth: 94 },
        2: { halign: "right", cellWidth: 36 },
        3: { halign: "right", cellWidth: 38 },
      },
      margin: { left: 14, right: 14 },
    })

    let summaryStartY = (doc.lastAutoTable?.finalY || 130) + 10
    if (summaryStartY > 195) {
      doc.addPage()
      summaryStartY = 25
    }
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(248, 250, 252)
    const summaryRows = [
        ["Item Total", formatMoney(subtotal)],
    ]
    if (isCustomerInvoice) {
      if (packagingFee > 0) summaryRows.push(["Packaging", formatMoney(packagingFee)])
      summaryRows.push(["Delivery Fee", deliveryFee > 0 ? formatMoney(deliveryFee) : "Free"])
      if (includeFoodQuickDeliveryFee) summaryRows.push(["Quick Delivery", formatMoney(quickDeliveryFee)])
      if (platformFee > 0) summaryRows.push(["Platform Fee", formatMoney(platformFee)])
      summaryRows.push(["GST / Taxes", formatMoney(taxAmount)])
      if (discountAmount > 0) summaryRows.push(["Discount", `- ${formatMoney(discountAmount)}`])
      summaryRows.push(["Amount Paid", formatMoney(customerTotal)])
      if (isQuickOrder && (hasRefund || returnSummary?.hasReturn)) {
        summaryRows.push(["Original Paid", formatMoney(originalPaidTotal || customerTotal)])
        if (refundAmount > 0) summaryRows.push(["Return Refund", `- ${formatMoney(refundAmount)}`])
        summaryRows.push(["Net After Return", formatMoney(netAfterReturn)])
      }
    } else {
      if (packagingFee > 0) summaryRows.push(["Packaging", formatMoney(packagingFee)])
      if (!isQuickOrder && quickRestaurantShare > 0) {
        summaryRows.push(["Quick Delivery Share", formatMoney(quickRestaurantShare)])
      }
      if (restaurantCommission > 0) summaryRows.push(["Commission", `- ${formatMoney(restaurantCommission)}`])
      summaryRows.push(["Order Total", formatMoney(restaurantOrderTotal)])
      summaryRows.push([isQuickOrder ? "Store Earning" : "Restaurant Earning", formatMoney(restaurantEarning)])
    }
    doc.roundedRect(pageWidth - 92, summaryStartY - 5, 78, 8 + summaryRows.length * 7, 2, 2, "FD")
    autoTable(doc, {
      startY: summaryStartY,
      body: summaryRows,
      theme: "plain",
      styles: {
        fontSize: 10,
        textColor: [30, 41, 59],
        cellPadding: 1.8,
      },
      columnStyles: {
        0: { cellWidth: 34, fontStyle: "bold" },
        1: { cellWidth: 40, halign: "right" },
      },
      margin: { left: pageWidth - 88 },
      didParseCell: (hookData) => {
        if (hookData.row.index === summaryRows.length - 1) {
          hookData.cell.styles.fontStyle = "bold"
          hookData.cell.styles.fontSize = 11
          hookData.cell.styles.textColor = [220, 38, 38]
        }
      },
    })

    if (isCustomerInvoice) {
      const paymentLines = [`Paid via ${paymentType} - ${paymentStatus}`]
      if (hasRefund || returnSummary?.hasReturn) {
        if (returnStatusLabel) paymentLines.push(`Return status: ${returnStatusLabel}`)
        paymentLines.push(
          `Refund ${refundStatusLabel}: ${formatMoney(refundAmount || 0)} to ${refundMethodLabel}`,
        )
        if (originalPaidTotal > 0) {
          paymentLines.push(`Original paid ${formatMoney(originalPaidTotal)} · Net ${formatMoney(netAfterReturn)}`)
        }
        paymentLines.push("Note: delivery, platform and packing fees are not refunded")
        if (refundDate) paymentLines.push(`Refund updated on ${refundDate}`)
        if (refund.reason) paymentLines.push(`Reason: ${refund.reason}`)
        if (refund.refundId) paymentLines.push(`Reference: ${refund.refundId}`)
      }

      const boxY = summaryStartY - 5
      const boxHeight = 12 + paymentLines.length * 5
      doc.setDrawColor(226, 232, 240)
      doc.setFillColor(hasRefund ? 254 : 248, hasRefund ? 242 : 250, hasRefund ? 242 : 252)
      doc.roundedRect(14, boxY, 84, boxHeight, 2, 2, "FD")
      doc.setFontSize(9)
      doc.setFont(undefined, "bold")
      doc.setTextColor(hasRefund ? 220 : 30, hasRefund ? 38 : 41, hasRefund ? 38 : 59)
      doc.text(hasRefund || returnSummary?.hasReturn ? "Payment & Return" : "Payment", 18, boxY + 6)
      doc.setFont(undefined, "normal")
      doc.setFontSize(8)
      doc.setTextColor(71, 85, 105)
      let lineY = boxY + 12
      paymentLines.forEach((line) => {
        doc.splitTextToSize(line, 76).forEach((wrapped) => {
          doc.text(wrapped, 18, lineY)
          lineY += 4
        })
        lineY += 1
      })
    }

    const footerY = Math.max((doc.lastAutoTable?.finalY || summaryStartY) + 18, 262)
    doc.setDrawColor(226, 232, 240)
    doc.line(14, footerY - 6, pageWidth - 14, footerY - 6)
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(`Generated on ${new Date().toLocaleString()}`, 14, footerY)
    doc.text(
      isQuickOrder
        ? "Includes customer, store, and delivery partner details."
        : "Includes customer, restaurant, and delivery partner details.",
      pageWidth - 14,
      footerY,
      { align: "right" },
    )

    const filename = `Invoice_${orderId}_${new Date().toISOString().split("T")[0]}.pdf`
    const saved = await savePdfDocument(doc, filename)
    if (!saved) throw new Error("Could not save the invoice on this device")

  } catch (error) {
    debugError("Error generating PDF invoice:", error)
    alert("Failed to download PDF invoice. Please try again.")
    throw error
  }
}
