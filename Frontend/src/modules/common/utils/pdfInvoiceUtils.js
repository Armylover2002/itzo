import { getCachedSettings, loadBusinessSettings } from "./businessSettings"
import { adminAPI, restaurantAPI } from "@food/api"

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatMoney = (value) => `${toNumber(value).toFixed(2)}`

const formatDisplayText = (value, fallback = "N/A") => {
  if (value === null || value === undefined) return fallback
  const normalized = String(value).trim()
  return normalized || fallback
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
    console.error('Error converting image to data URL:', err)
    return null
  }
}

// Convert numbers to words (e.g. 187.95 -> One Hundred Eighty Seven Rupees And Ninety Five Paisa Only)
const numberToWords = (num) => {
  if (num === 0) return "Zero Rupees Only";
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const inWords = (n) => {
    if ((n = n.toString()).length > 9) return 'overflow';
    let str = '';
    const numArr = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!numArr) return '';
    str += (numArr[1] != 0) ? (a[Number(numArr[1])] || b[numArr[1][0]] + ' ' + a[numArr[1][1]]) + 'Crore ' : '';
    str += (numArr[2] != 0) ? (a[Number(numArr[2])] || b[numArr[2][0]] + ' ' + a[numArr[2][1]]) + 'Lakh ' : '';
    str += (numArr[3] != 0) ? (a[Number(numArr[3])] || b[numArr[3][0]] + ' ' + a[numArr[3][1]]) + 'Thousand ' : '';
    str += (numArr[4] != 0) ? (a[Number(numArr[4])] || b[numArr[4][0]] + ' ' + a[numArr[4][1]]) + 'Hundred ' : '';
    str += (numArr[5] != 0) ? ((str != '') ? 'And ' : '') + (a[Number(numArr[5])] || b[numArr[5][0]] + ' ' + a[numArr[5][1]]) : '';
    return str;
  }
  
  const parts = num.toString().split(".");
  const rupees = parseInt(parts[0], 10);
  const paise = parts[1] ? parseInt(parts[1].padEnd(2, '0').substring(0, 2), 10) : 0;
  
  let res = inWords(rupees) + "Rupees ";
  if (paise > 0) {
    res += "And " + inWords(paise) + "Paisa ";
  }
  return res + "Only";
}

export const generateOrderInvoicePDF = async (order, itzoLogoUrl) => {
  try {
    const { default: jsPDF } = await import("jspdf")
    const { default: autoTable } = await import("jspdf-autotable")

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 14

    const orderId = order.orderId || order.id || "N/A"
    const orderDate = order.createdAt ? new Date(order.createdAt).toISOString().split("T")[0] : (order.date || new Date().toISOString().split("T")[0])
    
    const settings = getCachedSettings() || await loadBusinessSettings()
    const companyName = settings?.companyName || "Itzo" // Replacing eternal with Itzo
    const companyFullName = settings?.legalName || "ITZO LIMITED"
    const companyPan = settings?.panNumber || "N/A"
    const companyCin = settings?.cinNumber || "N/A"
    const companyGstin = settings?.gstin || "N/A"
    const companyFssai = settings?.fssai || "N/A"
    
    const logoDataUrl = await imageUrlToDataUrl(itzoLogoUrl)

    const isQuick = order.orderType === 'quick' || String(order.orderId || order._id).startsWith('QC');
    const entityTypeLabel = isQuick ? "Seller" : "Restaurant";

    // Dynamic Restaurant Details
    let fetchedRestaurant = null;
    
    let actualRestId = null;
    if (order.restaurantId && typeof order.restaurantId === 'string') {
        actualRestId = order.restaurantId;
    } else if (order.restaurantId && typeof order.restaurantId === 'object') {
        actualRestId = order.restaurantId._id || order.restaurantId.id;
        fetchedRestaurant = order.restaurantId; // fallback if fetch fails
    } else if (order.restaurant?._id) {
        actualRestId = order.restaurant._id;
    }

    if (actualRestId) {
        try {
            // First try admin API to get full details including GSTIN and FSSAI
            const res = await adminAPI.getRestaurantById(actualRestId);
            if (res?.data?.data?.restaurant) {
                fetchedRestaurant = res.data.data.restaurant;
            }
        } catch (e1) {
            try {
                // Fallback to public/restaurant API if not an admin
                const res = await restaurantAPI.getRestaurantById(actualRestId);
                if (res?.data?.data?.restaurant) {
                    fetchedRestaurant = res.data.data.restaurant;
                }
            } catch (e2) {
                console.error("Failed to fetch restaurant details for invoice");
            }
        }
    }

    const legalEntityName = formatDisplayText(companyFullName || order.restaurantDetails?.legalEntityName || fetchedRestaurant?.legalEntityName || order.pickupSources?.[0]?.legalEntityName || order.restaurant)
    const restaurantName = formatDisplayText(order.restaurant || fetchedRestaurant?.name || order.pickupSources?.[0]?.name)
    const restaurantAddress = formatDisplayText(
      settings?.address ||
      fetchedRestaurant?.location?.formattedAddress ||
      fetchedRestaurant?.address ||
      order.restaurantAddress || 
      order.restaurantDetails?.address || 
      order.restaurantLocation?.address || 
      order.pickupSources?.[0]?.address
    )
    const restaurantGstin = formatDisplayText(
      fetchedRestaurant?.gstNumber ||
      fetchedRestaurant?.gstin ||
      order.restaurantDetails?.gstin || 
      order.restaurant?.gstin || 
      order.pickupSources?.[0]?.gstin || 
      order.pickupSources?.[0]?.gstNumber ||
      settings?.gstin
    )
    const restaurantFssai = formatDisplayText(
      fetchedRestaurant?.fssaiNumber ||
      fetchedRestaurant?.fssai ||
      order.restaurantDetails?.fssai || 
      order.restaurant?.fssai || 
      order.pickupSources?.[0]?.fssai || 
      order.pickupSources?.[0]?.fssaiNumber ||
      settings?.fssai
    )

    // Dynamic Customer Details
    const customerName = formatDisplayText(order.userName || order.customerName)
    let rawAddress = order.address || order.customerAddress || order.deliveryAddress;
    let deliveryAddress = "Not available";
    let stateName = "N/A";
    if (typeof rawAddress === 'object') {
        deliveryAddress = [rawAddress.street, rawAddress.additionalDetails, rawAddress.city, rawAddress.state, rawAddress.zipCode].filter(Boolean).join(", ");
        stateName = rawAddress.state || "N/A";
    } else if (typeof rawAddress === 'string') {
        deliveryAddress = rawAddress;
    }

    // Calculations for Page 1 (Restaurant Invoice)
    const items = Array.isArray(order.items) ? order.items : []
    const discountAmount = toNumber(order.couponDiscount ?? order.itemDiscount ?? order.discountAmount ?? order.pricing?.discount)
    // Distribute discount proportionally across items for the PDF breakdown
    let totalGross = 0;
    items.forEach(item => totalGross += toNumber(item.quantity || 1) * toNumber(item.price))
    
    // Determine if CGST should be shown based on Gujarat state
    const isUserGujarat = stateName.toLowerCase().includes('gujrat') || stateName.toLowerCase().includes('gujarat');
    const restState = formatDisplayText(fetchedRestaurant?.location?.state || fetchedRestaurant?.state || order.restaurantLocation?.state || settings?.state || "N/A");
    const isRestGujarat = restState.toLowerCase().includes('gujrat') || restState.toLowerCase().includes('gujarat');
    const shouldShowCgst = !(isUserGujarat && isRestGujarat);

    // We assume standard GST is 5% for restaurant services
    const gstRate = order.restaurantDetails?.gstRate ? toNumber(order.restaurantDetails.gstRate) : 5;
    const cgstRate = shouldShowCgst ? gstRate / 2 : 0;
    const sgstRate = shouldShowCgst ? gstRate / 2 : gstRate;
    
    let totalItemsNet = 0;
    let totalItemsCgst = 0;
    let totalItemsSgst = 0;
    let totalItemsTotal = 0;

    const tableBody = items.map((item) => {
      const qty = toNumber(item.quantity || 1)
      const title = `${qty} x ${item.name || item.itemName || "Item"}`
      const unitPrice = toNumber(item.price)
      const grossValue = qty * unitPrice
      const itemDiscount = totalGross > 0 ? (grossValue / totalGross) * discountAmount : 0
      
      // Calculate taxes backward if item.price is inclusive, or forward if exclusive.
      // Most restaurant aggregators treat price as inclusive of tax in the menu. Let's assume inclusive for simplicity, 
      // or we just calculate tax based on net value if exclusive.
      // Reference invoice shows: Net Value = Gross - Discount. Tax is calculated on Net Value. Total = Net + Tax.
      // But wait, the reference image: Gross 299, Discount 140, Net 159. CGST 2.5% = 3.975. SGST 2.5% = 3.975. Total = 166.95
      const netValue = grossValue - itemDiscount
      const cgstVal = netValue * (cgstRate / 100)
      const sgstVal = netValue * (sgstRate / 100)
      const totalVal = netValue + cgstVal + sgstVal
      
      totalItemsNet += netValue;
      totalItemsCgst += cgstVal;
      totalItemsSgst += sgstVal;
      totalItemsTotal += totalVal;
      
      const row = [title, formatMoney(grossValue), formatMoney(itemDiscount), formatMoney(netValue)];
      if (shouldShowCgst) {
        row.push(`${cgstRate}%`, formatMoney(cgstVal));
      }
      row.push(`${sgstRate}%`, formatMoney(sgstVal), formatMoney(totalVal));
      return row;
    })
    
    // Packaging Charge
    const packagingCharge = toNumber(order.packagingFee ?? order.restaurantPackagingCharge ?? 0)
    const packCgst = packagingCharge * (cgstRate / 100)
    const packSgst = packagingCharge * (sgstRate / 100)
    const packTotal = packagingCharge + packCgst + packSgst

    // Final Totals
    const grandNet = totalItemsNet + packagingCharge
    const grandCgst = totalItemsCgst + packCgst
    const grandSgst = totalItemsSgst + packSgst
    const grandTotal = totalItemsTotal + packTotal

    // -------------------------------------------------------------------------
    // PAGE 1: RESTAURANT INVOICE
    // -------------------------------------------------------------------------
    const renderHeader = (doc, title1, title2) => {
      if (logoDataUrl) {
        try {
          const logoFormat = logoDataUrl.includes("image/jpeg") ? "JPEG" : "PNG"
          doc.addImage(logoDataUrl, logoFormat, margin, margin, 32, 10, undefined, "FAST")
        } catch {
          doc.setFontSize(22)
          doc.setFont("helvetica", "bold")
          doc.text(companyName, margin, margin + 8)
        }
      } else {
        doc.setFontSize(22)
        doc.setFont("helvetica", "bold")
        doc.text(companyName, margin, margin + 8)
      }
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.text(title1, pageWidth / 2, margin + 4, { align: "center" })
      doc.text(title2, pageWidth / 2, margin + 10, { align: "center" })
      doc.setDrawColor(0)
      doc.setLineWidth(0.5)
      doc.line(margin, margin + 16, pageWidth - margin, margin + 16)
    }

    renderHeader(doc, "Tax Invoice", "ORIGINAL FOR RECIPIENT")

    let currentY = margin + 22
    
    // Restaurant Details
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text("Tax Invoice on behalf of -", margin, currentY)
    currentY += 6
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.text(`Legal Entity Name: ${legalEntityName}`, margin, currentY); currentY += 5
    doc.text(`${entityTypeLabel} Name: ${restaurantName}`, margin, currentY); currentY += 5
    const restAddressLines = doc.splitTextToSize(`${entityTypeLabel} Address: ${restaurantAddress}`, pageWidth - margin * 2);
    doc.text(restAddressLines, margin, currentY); currentY += restAddressLines.length * 5;
    doc.text(`${entityTypeLabel} GSTIN: ${restaurantGstin}`, margin, currentY); currentY += 5
    doc.text(`${entityTypeLabel} FSSAI: ${restaurantFssai}`, margin, currentY); currentY += 5
    doc.text(`Invoice No.: ${orderId}`, margin, currentY); currentY += 5
    doc.text(`Invoice Date: ${orderDate}`, margin, currentY); currentY += 8

    // Customer Details
    doc.setFont("helvetica", "bold")
    doc.text(`Customer Name: ${customerName}`, margin, currentY); currentY += 5
    doc.setFont("helvetica", "normal")
    const delAddressLines = doc.splitTextToSize(`Delivery Address: ${deliveryAddress}`, pageWidth - margin * 2);
    doc.text(delAddressLines, margin, currentY); currentY += delAddressLines.length * 5;
    doc.text(`State name and Place of Supply: ${stateName}`, margin, currentY); currentY += 8

    // Service Details
    const hsnCode = order.restaurantDetails?.hsnCode || "996331"
    doc.setFont("helvetica", "bold")
    doc.text(`HSN Code: ${hsnCode}`, margin, currentY); currentY += 5
    doc.setFont("helvetica", "normal")
    doc.text(`Service Description: ${order.restaurantDetails?.serviceDescription || (isQuick ? "Retail Service" : "Restaurant Service")}`, margin, currentY); currentY += 8

    // Table
    const tableHead = shouldShowCgst 
      ? [["Particulars", "Gross value", "Discount", "Net value", "CGST\n(Rate)", "CGST\n(INR)", "SGST\n(Rate)", "SGST\n(INR)", "Total"]]
      : [["Particulars", "Gross value", "Discount", "Net value", "SGST\n(Rate)", "SGST\n(INR)", "Total"]];

    const totalRow = ["Item(s) Total", formatMoney(totalGross), formatMoney(discountAmount), formatMoney(totalItemsNet)];
    if (shouldShowCgst) totalRow.push("", formatMoney(totalItemsCgst));
    totalRow.push("", formatMoney(totalItemsSgst), formatMoney(totalItemsTotal));

    const packRow = [`${entityTypeLabel} Packaging Charge`, formatMoney(packagingCharge), "0.00", formatMoney(packagingCharge)];
    if (shouldShowCgst) packRow.push(`${cgstRate}%`, formatMoney(packCgst));
    packRow.push(`${sgstRate}%`, formatMoney(packSgst), formatMoney(packTotal));

    const grandRow = ["Total Value", "", "", formatMoney(grandNet)];
    if (shouldShowCgst) grandRow.push("", formatMoney(grandCgst));
    grandRow.push("", formatMoney(grandSgst), formatMoney(grandTotal));

    autoTable(doc, {
      startY: currentY,
      head: tableHead,
      body: [
        ...tableBody,
        totalRow,
        packRow,
        grandRow
      ],
      theme: "grid",
      headStyles: { fillColor: 255, textColor: 0, fontStyle: "bold", lineWidth: 0.2, lineColor: 0, halign: 'center' },
      bodyStyles: { textColor: 0, lineWidth: 0.2, lineColor: 0 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' }
      },
      didParseCell: function (data) {
        if (data.row.index >= tableBody.length) {
          data.cell.styles.fontStyle = 'bold';
        }
      }
    })

    currentY = doc.lastAutoTable.finalY + 8
    
    doc.setFont("helvetica", "bold")
    doc.text(`Amount (in words): ${numberToWords(grandTotal)}`, margin, currentY); currentY += 8
    doc.setFont("helvetica", "normal")
    doc.text(`Amount of INR ${formatMoney(grandTotal)} settled digitally against Order ID ${orderId} dated ${orderDate}.`, margin, currentY); currentY += 8
    doc.text(`Supply attracts reverse charge : ${order.restaurantDetails?.reverseCharge ? "Yes" : "No"}`, margin, currentY); currentY += 16

    // Signatory
    const footerY = pageHeight - 40
    doc.setFont("helvetica", "bold")
    doc.text(`For ${companyFullName}`, margin, footerY)
    
    // Dummy Signature
    doc.setTextColor(0, 0, 150)
    doc.setFont("times", "italic")
    doc.setFontSize(22)
    doc.text(companyName, pageWidth - margin - 45, footerY + 14, { angle: -5 })
    doc.setTextColor(0)

    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text("Authorized Signatory", pageWidth - margin - 40, footerY + 20)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text(`PAN: ${companyPan}`, margin, footerY + 6)
    doc.text(`CIN: ${companyCin}`, margin, footerY + 10)
    doc.text(`GSTIN: ${companyGstin}`, margin, footerY + 14)
    doc.text(`FSSAI: ${companyFssai}`, margin, footerY + 18)

    // -------------------------------------------------------------------------
    // PAGE 2: PLATFORM FEE INVOICE
    // -------------------------------------------------------------------------
    const platformFee = toNumber(order.platformFee ?? order.pricing?.platformFee ?? 0)
    const deliveryCharge = toNumber(order.deliveryCharge ?? order.deliveryFee ?? order.pricing?.deliveryFee ?? 0)
    const totalPlatformServices = platformFee;
    
    if (platformFee > 0) {
      doc.addPage()
      renderHeader(doc, "Tax Invoice", "ORIGINAL FOR RECIPIENT")
      currentY = margin + 22
      
      // Box 1
      doc.setDrawColor(0)
      doc.setFillColor(230, 230, 230)
      doc.rect(margin, currentY, pageWidth - margin * 2, 6, 'FD')
      doc.setFont("helvetica", "bold")
      doc.text(`${companyFullName}`, margin + 2, currentY + 4)
      currentY += 10
      
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      
      let box1LeftY = currentY;
      let box1RightY = currentY;

      const addressLines = doc.splitTextToSize(`Address: ${settings?.address || "N/A"}`, (pageWidth / 2) - margin - 5);
      doc.text(addressLines, margin, box1LeftY); 
      box1LeftY += addressLines.length * 4;
      doc.text(`State: ${settings?.state || "N/A"}`, margin, box1LeftY); box1LeftY += 4;
      doc.text(`Email ID: ${settings?.email || "support@itzo.com"}`, margin, box1LeftY); box1LeftY += 4;
      doc.text(`Invoice No: PF-${orderId}`, margin, box1LeftY); box1LeftY += 4;

      doc.text(`PAN: ${companyPan}`, pageWidth / 2, box1RightY); box1RightY += 4;
      doc.text(`CIN: ${companyCin}`, pageWidth / 2, box1RightY); box1RightY += 4;
      doc.text(`GSTIN: ${companyGstin}`, pageWidth / 2, box1RightY); box1RightY += 4;
      doc.text(`Invoice Date: ${orderDate}`, pageWidth / 2, box1RightY); box1RightY += 4;

      currentY = Math.max(box1LeftY, box1RightY) + 4;
      
      // Box 2
      doc.setFillColor(230, 230, 230)
      doc.rect(margin, currentY, pageWidth - margin * 2, 6, 'FD')
      doc.setFont("helvetica", "bold")
      doc.text("Customer Details", margin + 2, currentY + 4)
      currentY += 10
      
      doc.setFontSize(8)
      doc.setFont("helvetica", "normal")
      
      let box2LeftY = currentY;
      let box2RightY = currentY;

      doc.text(`Name: ${customerName}`, margin, box2LeftY); box2LeftY += 4;
      const deliveryAddressLinesPF = doc.splitTextToSize(`Delivery Address: ${deliveryAddress}`, (pageWidth / 2) - margin - 5);
      doc.text(deliveryAddressLinesPF, margin, box2LeftY); 
      box2LeftY += deliveryAddressLinesPF.length * 4;

      doc.text(`GSTIN: ${order.customerGstin || order.userGstin || "UNREGISTERED"}`, pageWidth / 2, box2RightY); box2RightY += 4;
      doc.text(`Place of Supply: ${stateName}`, pageWidth / 2, box2RightY); box2RightY += 4;

      currentY = Math.max(box2LeftY, box2RightY) + 4;
      
      // Box 3
      doc.setFillColor(230, 230, 230)
      doc.rect(margin, currentY, pageWidth - margin * 2, 6, 'FD')
      doc.setFont("helvetica", "bold")
      doc.text("Service Details", margin + 2, currentY + 4)
      currentY += 10
      
      doc.setFont("helvetica", "normal")
      doc.text(`HSN Code: ${settings?.platformHsnCode || "999799"}`, margin, currentY)
      doc.text(`Supply Description: ${settings?.platformSupplyDescription || "Other Services N.E.C"}`, pageWidth / 2, currentY); currentY += 6

      // Platform Fee Taxes (assuming 18% GST -> 9% CGST, 9% SGST)
      const platGstRate = settings?.platformGstRate ? toNumber(settings.platformGstRate) : 18;
      const platCgstRate = shouldShowCgst ? platGstRate / 2 : 0;
      const platSgstRate = shouldShowCgst ? platGstRate / 2 : platGstRate;
      
      // Assuming platform fee is inclusive of tax
      const platNet = totalPlatformServices / (1 + (platGstRate/100));
      const platCgst = platNet * (platCgstRate/100);
      const platSgst = platNet * (platSgstRate/100);
      
      const platHead = shouldShowCgst 
        ? [["Sr.No", "Particulars", "Taxable Amount", "CGST", "SGST", "Total"]]
        : [["Sr.No", "Particulars", "Taxable Amount", "SGST", "Total"]];
        
      const platRow1 = ["1", "Platform fee", formatMoney(platNet)];
      if (shouldShowCgst) platRow1.push(formatMoney(platCgst));
      platRow1.push(formatMoney(platSgst), formatMoney(totalPlatformServices));

      const platTotalRow = ["Total", "", formatMoney(platNet)];
      if (shouldShowCgst) platTotalRow.push(formatMoney(platCgst));
      platTotalRow.push(formatMoney(platSgst), formatMoney(totalPlatformServices));

      autoTable(doc, {
        startY: currentY,
        head: platHead,
        body: [
          platRow1,
          platTotalRow
        ],
        theme: "grid",
        headStyles: { fillColor: 255, textColor: 0, fontStyle: "bold", lineWidth: 0.2, lineColor: 0, halign: 'center' },
        bodyStyles: { textColor: 0, lineWidth: 0.2, lineColor: 0, halign: 'center' },
        styles: { fontSize: 8, cellPadding: 2 },
        didParseCell: function (data) {
          if (data.row.index === 1) {
            data.cell.styles.fontStyle = 'bold';
          }
        }
      })
      
      currentY = doc.lastAutoTable.finalY + 8
      
      doc.setFont("helvetica", "normal")
      doc.text(`Amount of INR ${formatMoney(totalPlatformServices)} settled through digital mode/payment received against Order id (${orderId}) dated (${orderDate})`, margin, currentY); currentY += 4
      doc.text(`Tax is ${settings?.platformReverseCharge ? "" : "not "}payable on reverse charge basis`, margin, currentY);
      
      // Signatory
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.text(`For ${companyFullName}`, pageWidth - margin - 80, pageHeight - 50)
      
      // Dummy Signature
      doc.setTextColor(0, 0, 150)
      doc.setFont("times", "italic")
      doc.setFontSize(22)
      doc.text(companyName, pageWidth - margin - 75, pageHeight - 36, { angle: -5 })
      doc.setTextColor(0)

      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.text("Authorized Signatory", pageWidth - margin - 80, pageHeight - 30)
      
      doc.setFontSize(7)
      doc.setFont("helvetica", "normal")
      doc.text("Communication Address: As per platform policies", margin, pageHeight - 15, { align: "left" })
      doc.text("Please refer to platform terms and conditions which are incorporated in this invoice by reference.", margin, pageHeight - 10, { align: "left" })
    }

    // -------------------------------------------------------------------------
    // PAGE 3: DELIVERY FEE INVOICE
    // -------------------------------------------------------------------------
    if (deliveryCharge > 0) {
      doc.addPage()
      renderHeader(doc, "Tax Invoice", "ORIGINAL FOR RECIPIENT")
      currentY = margin + 22
      
      const driverName = formatDisplayText(order.dispatch?.deliveryPartner?.name || order.dispatch?.partner?.name || order.deliveryPartnerName || order.driver?.name || "Delivery Partner")
      const driverState = formatDisplayText(order.dispatch?.deliveryPartner?.address?.state || order.dispatch?.partner?.address?.state || order.driver?.address?.state || stateName)
      
      // Box 1
      doc.setDrawColor(0)
      doc.setFillColor(230, 230, 230)
      doc.rect(margin, currentY, pageWidth - margin * 2, 6, 'FD')
      doc.setFont("helvetica", "bold")
      doc.text("Tax Invoice on behalf of -", margin + 2, currentY + 4)
      currentY += 10
      
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      
      let box1LeftY = currentY;
      
      doc.text(`Delivery Partner / Vendor Name: ${driverName}`, margin, box1LeftY); box1LeftY += 4;
      doc.text(`Delivery Partner / Vendor State: ${driverState}`, margin, box1LeftY); box1LeftY += 4;
      doc.text(`Invoice No. : ${orderId}`, margin, box1LeftY); box1LeftY += 4;
      doc.text(`Invoice Date : ${orderDate}`, margin, box1LeftY); box1LeftY += 4;

      currentY = box1LeftY + 4;
      
      // Box 2
      doc.text(`Customer Name : ${customerName}`, margin, currentY); currentY += 4;
      const deliveryAddressLinesPF = doc.splitTextToSize(`Delivery Address : ${deliveryAddress}`, pageWidth - margin * 2);
      doc.text(deliveryAddressLinesPF, margin, currentY); 
      currentY += deliveryAddressLinesPF.length * 4;
      doc.text(`State name and Place of Supply: ${stateName}`, margin, currentY); currentY += 8;

      doc.text(`HSN Code : 996813`, margin, currentY)
      doc.text(`Service Description : Local delivery service`, margin, currentY + 4); currentY += 10

      // Delivery Fee Taxes (assuming 18% GST -> 9% CGST, 9% SGST)
      const delGstRate = 18;
      const isDriverGujarat = driverState.toLowerCase().includes('gujrat') || driverState.toLowerCase().includes('gujarat');
      const shouldShowDelCgst = !(isUserGujarat && isDriverGujarat);

      const delCgstRate = shouldShowDelCgst ? delGstRate / 2 : 0;
      const delSgstRate = shouldShowDelCgst ? delGstRate / 2 : delGstRate;
      
      // Assuming delivery fee is inclusive of tax
      const delNet = deliveryCharge / (1 + (delGstRate/100));
      const delCgst = delNet * (delCgstRate/100);
      const delSgst = delNet * (delSgstRate/100);
      
      const delHead = shouldShowDelCgst 
        ? [["Particulars", "Gross value", "Discount", "Net value", "CGST\n(Rate)", "CGST\n(INR)", "SGST\n(Rate)", "SGST\n(INR)", "Total"]]
        : [["Particulars", "Gross value", "Discount", "Net value", "SGST\n(Rate)", "SGST\n(INR)", "Total"]];
        
      const delRow1 = ["Fee for delivery services", formatMoney(deliveryCharge), "0.00", formatMoney(delNet)];
      if (shouldShowDelCgst) delRow1.push(`${delCgstRate}%`, formatMoney(delCgst));
      delRow1.push(`${delSgstRate}%`, formatMoney(delSgst), formatMoney(deliveryCharge));

      const delTotalRow = ["Total Value", formatMoney(deliveryCharge), "0.00", formatMoney(delNet)];
      if (shouldShowDelCgst) delTotalRow.push("", formatMoney(delCgst));
      delTotalRow.push("", formatMoney(delSgst), formatMoney(deliveryCharge));

      autoTable(doc, {
        startY: currentY,
        head: delHead,
        body: [
          delRow1,
          delTotalRow
        ],
        theme: "grid",
        headStyles: { fillColor: 255, textColor: 0, fontStyle: "bold", lineWidth: 0.2, lineColor: 0, halign: 'center' },
        bodyStyles: { textColor: 0, lineWidth: 0.2, lineColor: 0, halign: 'right' },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { halign: 'left', cellWidth: 'auto' } },
        didParseCell: function (data) {
          if (data.row.index === 1) {
            data.cell.styles.fontStyle = 'bold';
          }
        }
      })
      
      currentY = doc.lastAutoTable.finalY + 8
      
      doc.setFont("helvetica", "bold")
      doc.text(`Amount (in words): ${numberToWords(deliveryCharge)}`, margin, currentY); currentY += 8
      
      doc.setFont("helvetica", "normal")
      doc.text(`Amount of INR ${formatMoney(deliveryCharge)} settled through digital mode/payment received against Order Id: ${orderId} dated ${orderDate}.`, margin, currentY); currentY += 8
      doc.text(`Supply attracts reverse charge : No`, margin, currentY); currentY += 16
      
      // Signatory
      const footerY3 = pageHeight - 40
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.text(`For ${companyFullName}`, margin, footerY3)
      
      // Dummy Signature
      doc.setTextColor(0, 0, 150)
      doc.setFont("times", "italic")
      doc.setFontSize(22)
      doc.text(companyName, pageWidth - margin - 45, footerY3 + 14, { angle: -5 })
      doc.setTextColor(0)

      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.text("Authorised Signatory", pageWidth - margin - 40, footerY3 + 20)
      
      doc.setFontSize(8)
      doc.setFont("helvetica", "normal")
      doc.text(`${companyName} PAN: ${companyPan}`, margin, footerY3 + 6)
      doc.text(`${companyName} CIN: ${companyCin}`, margin, footerY3 + 10)
      doc.text(`${companyName} GST : ${companyGstin}`, margin, footerY3 + 14)
      doc.text(`${companyName} FSSAI : ${companyFssai}`, margin, footerY3 + 18)
    }

    const filename = `Invoice_${orderId}_${new Date().toISOString().split("T")[0]}.pdf`
    doc.save(filename)
    return true;
  } catch (error) {
    console.error("Error generating PDF invoice:", error)
    throw error
  }
}
