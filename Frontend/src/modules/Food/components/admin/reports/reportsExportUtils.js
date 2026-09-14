const INR = "\u20B9"

const getHeaderKey = (header) => (typeof header === "string" ? header : header?.key)
const getHeaderLabel = (header) => (typeof header === "string" ? header : header?.label || header?.key || "")

const cellValue = (item, header) => {
  const key = getHeaderKey(header)
  const value = key != null ? item?.[key] : ""
  if (value == null) return ""
  if (typeof value === "object") {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return value
}

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const downloadBlob = (blob, filename) => {
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const datedFilename = (filename, ext) =>
  `${filename}_${new Date().toISOString().split("T")[0]}.${ext}`

const assertRows = (data) => {
  if (!Array.isArray(data) || data.length === 0) {
    alert("No data to export")
    return false
  }
  return true
}

const money = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return `${INR}0.00`
  return `${INR}${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** Generic CSV export for admin reports */
export const exportReportsToCSV = (data, headers, filename = "report") => {
  if (!assertRows(data)) return

  const rows = data.map((item) =>
    headers.map((header) => {
      const value = cellValue(item, header)
      return `"${String(value).replace(/"/g, '""')}"`
    }),
  )

  const headerRow = headers.map((h) => `"${getHeaderLabel(h).replace(/"/g, '""')}"`).join(",")
  const csvContent = [headerRow, ...rows.map((row) => row.join(","))].join("\n")
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
  downloadBlob(blob, datedFilename(filename, "csv"))
}

/** Generic Excel (.xls via HTML table) export */
export const exportReportsToExcel = (data, headers, filename = "report") => {
  if (!assertRows(data)) return

  const htmlContent = `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #3b82f6; color: white; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9fafb; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>${headers.map((h) => `<th>${escapeHtml(getHeaderLabel(h))}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${data
              .map(
                (item) => `
              <tr>
                ${headers.map((header) => `<td>${escapeHtml(cellValue(item, header))}</td>`).join("")}
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
  `

  const blob = new Blob([htmlContent], { type: "application/vnd.ms-excel;charset=utf-8" })
  downloadBlob(blob, datedFilename(filename, "xls"))
}

/** Generic PDF export via jsPDF + autoTable (instant download, no print dialog) */
export const exportReportsToPDF = async (data, headers, filename = "report", title = "Report") => {
  if (!assertRows(data)) return

  try {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ])

    const colCount = headers.length
    const orientation = colCount > 6 ? "landscape" : "portrait"
    const doc = new jsPDF({ orientation, unit: "mm", format: "a4" })
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFontSize(16)
    doc.setTextColor(30, 30, 30)
    doc.text(String(title), pageWidth / 2, 15, { align: "center" })

    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    const exportDate = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    doc.text(`Generated: ${exportDate} | Records: ${data.length}`, pageWidth / 2, 22, {
      align: "center",
    })

    autoTable(doc, {
      head: [headers.map(getHeaderLabel)],
      body: data.map((item) => headers.map((header) => String(cellValue(item, header)))),
      startY: 28,
      styles: { fontSize: colCount > 8 ? 7 : 8, cellPadding: 2 },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 28, left: 10, right: 10 },
    })

    doc.save(datedFilename(filename, "pdf"))
  } catch (error) {
    console.error("PDF export failed:", error)
    alert("Failed to export PDF. Please try again.")
  }
}

export const exportReportsToJSON = (data, filename = "report") => {
  if (!assertRows(data)) return
  const payload = {
    exportDate: new Date().toISOString(),
    totalRecords: data.length,
    rows: data,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  })
  downloadBlob(blob, datedFilename(filename, "json"))
}

const TRANSACTION_HEADERS = [
  "SI",
  "Order ID",
  "Restaurant",
  "Customer Name",
  "Total Item Amount",
  "Coupon Discount",
  "VAT/Tax",
  "Delivery Charge",
  "Platform Fee",
  "Packaging Fee",
  "Order Amount",
  "Order Status",
  "Payment Status",
]

const buildTransactionRow = (transaction, index) => [
  index + 1,
  transaction.orderId ?? "N/A",
  transaction.restaurant ?? "N/A",
  transaction.customerName ?? "N/A",
  money(transaction.totalItemAmount),
  money(transaction.couponDiscount),
  money(transaction.vatTax),
  money(transaction.deliveryCharge),
  money(transaction.platformFee),
  money(transaction.packagingFee),
  money(transaction.orderAmount),
  transaction.orderStatus || "N/A",
  transaction.paymentStatus || transaction.status || "N/A",
]

export const exportTransactionReportToCSV = (transactions, filename = "transaction_report") => {
  if (!assertRows(transactions)) return
  const rows = transactions.map((t, i) => buildTransactionRow(t, i))
  const csvContent = [
    TRANSACTION_HEADERS.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n")
  downloadBlob(
    new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }),
    datedFilename(filename, "csv"),
  )
}

export const exportTransactionReportToExcel = (transactions, filename = "transaction_report") => {
  if (!assertRows(transactions)) return
  const rows = transactions.map((t, i) => buildTransactionRow(t, i))
  const htmlContent = `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #3b82f6; color: white; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9fafb; }
        </style>
      </head>
      <body>
        <table>
          <thead><tr>${TRANSACTION_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
          <tbody>
            ${rows
              .map(
                (row) =>
                  `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
  `
  downloadBlob(
    new Blob([htmlContent], { type: "application/vnd.ms-excel;charset=utf-8" }),
    datedFilename(filename, "xls"),
  )
}

export const exportTransactionReportToPDF = async (
  transactions,
  filename = "transaction_report",
) => {
  if (!assertRows(transactions)) return
  try {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ])
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
    doc.setFontSize(16)
    doc.text("Transaction Report", 14, 15)
    doc.setFontSize(10)
    doc.text(
      `Generated: ${new Date().toLocaleString("en-IN")} | Records: ${transactions.length}`,
      14,
      22,
    )
    autoTable(doc, {
      head: [TRANSACTION_HEADERS],
      body: transactions.map((t, i) => buildTransactionRow(t, i)),
      startY: 28,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 10, right: 10 },
    })
    doc.save(datedFilename(filename, "pdf"))
  } catch (error) {
    console.error("Transaction PDF export failed:", error)
    alert("Failed to export PDF. Please try again.")
  }
}

export const exportTransactionReportToJSON = (transactions, filename = "transaction_report") => {
  if (!assertRows(transactions)) return
  const payload = {
    exportDate: new Date().toISOString(),
    totalRecords: transactions.length,
    transactions: transactions.map((t, i) => ({
      si: i + 1,
      orderId: t.orderId,
      restaurant: t.restaurant,
      customerName: t.customerName,
      totalItemAmount: Number(t.totalItemAmount) || 0,
      couponDiscount: Number(t.couponDiscount) || 0,
      vatTax: Number(t.vatTax) || 0,
      deliveryCharge: Number(t.deliveryCharge) || 0,
      platformFee: Number(t.platformFee) || 0,
      packagingFee: Number(t.packagingFee) || 0,
      orderAmount: Number(t.orderAmount) || 0,
      orderStatus: t.orderStatus || "N/A",
      paymentStatus: t.paymentStatus || t.status || "N/A",
      // Backward compat legacy field
      status: t.status || t.orderStatus || "N/A",
    })),
  }
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }),
    datedFilename(filename, "json"),
  )
}
