const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const INR = "\u20B9"

const formatAmount = (amount) =>
  `${INR}${(Number(amount) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const getCodAllowedLabel = (customer) =>
  customer?.isCodAllowed !== false ? "Yes" : "No"

const CUSTOMER_HEADERS = [
  "SI",
  "Name",
  "Email",
  "Phone",
  "Total Order",
  "Total Order Amount",
  "Joining Date",
  "COD Allowed",
  "Status",
]

const buildCustomerRow = (customer, index) => [
  customer.sl || index + 1,
  customer.name || "N/A",
  customer.email || "N/A",
  customer.phone || "N/A",
  customer.totalOrder || 0,
  formatAmount(customer.totalOrderAmount),
  customer.joiningDate || "N/A",
  getCodAllowedLabel(customer),
  customer.status ? "Active" : "Inactive",
]

// Export utility functions for customers
export const exportCustomersToCSV = (customers, filename = "customers") => {
  if (!customers || customers.length === 0) {
    alert("No customers to export")
    return
  }

  const headers = CUSTOMER_HEADERS
  const rows = customers.map((customer, index) => buildCustomerRow(customer, index))
  
  // Escape commas and quotes in CSV
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return ""
    const stringValue = String(value)
    if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
      return `"${stringValue.replace(/"/g, '""')}"`
    }
    return stringValue
  }
  
  const csvContent = [
    headers.map(escapeCSV).join(","),
    ...rows.map(row => row.map(escapeCSV).join(","))
  ].join("\n")
  
  // Add BOM for Excel compatibility
  const BOM = "\uFEFF"
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  const timestamp = new Date().toISOString().split("T")[0]
  link.setAttribute("download", `${filename}_${timestamp}.csv`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const exportCustomersToExcel = (customers, filename = "customers") => {
  if (!customers || customers.length === 0) {
    alert("No customers to export")
    return
  }

  const headers = CUSTOMER_HEADERS
  const rows = customers.map((customer, index) =>
    buildCustomerRow(customer, index)
  )
  
  // Create HTML table for better Excel compatibility
  const htmlContent = `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #3b82f6; color: white; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9fafb; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </body>
    </html>
  `
  
  const blob = new Blob([htmlContent], { type: "application/vnd.ms-excel" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  const timestamp = new Date().toISOString().split("T")[0]
  link.setAttribute("download", `${filename}_${timestamp}.xls`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const exportCustomersToPDF = (customers, filename = "customers") => {
  if (!customers || customers.length === 0) {
    alert("No customers to export")
    return
  }

  try {
    // Dynamic import of jsPDF and autoTable
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(({ default: autoTable }) => {
        const doc = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4'
        })

        // Add title
        doc.setFontSize(16)
        doc.text('Customers Report', 14, 15)
        
        // Add export info
        doc.setFontSize(10)
        const exportDate = new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        doc.text(`Exported on: ${exportDate} | Total Records: ${customers.length}`, 14, 22)

        // Prepare table data
        const tableData = customers.map((customer, index) =>
          buildCustomerRow(customer, index)
        )

        // Add table using autoTable
        autoTable(doc, {
          head: [CUSTOMER_HEADERS],
          body: tableData,
          startY: 28,
          styles: {
            fontSize: 7,
            cellPadding: 2,
          },
          headStyles: {
            fillColor: [241, 245, 249],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          columnStyles: {
            0: { cellWidth: 12 }, // SI
            1: { cellWidth: 30 }, // Name
            2: { cellWidth: 40 }, // Email
            3: { cellWidth: 26 }, // Phone
            4: { cellWidth: 20 }, // Total Order
            5: { cellWidth: 28 }, // Total Order Amount
            6: { cellWidth: 28 }, // Joining Date
            7: { cellWidth: 22 }, // COD Allowed
            8: { cellWidth: 22 }, // Status
          },
          margin: { top: 28, left: 14, right: 14 },
        })

        // Save the PDF
        const fileTimestamp = new Date().toISOString().split("T")[0]
        doc.save(`${filename}_${fileTimestamp}.pdf`)
      }).catch((error) => {
        debugError("Error loading jspdf-autotable:", error)
        alert("Failed to load PDF library. Please try again.")
      })
    }).catch((error) => {
      debugError("Error loading jsPDF:", error)
      alert("Failed to load PDF library. Please try again.")
    })
  } catch (error) {
    debugError("PDF export error:", error)
    alert("Failed to export PDF. Please try again.")
  }
}

export const exportCustomersToJSON = (customers, filename = "customers") => {
  if (!customers || customers.length === 0) {
    alert("No customers to export")
    return
  }

  // Format customers data for JSON export
  const formattedData = {
    exportDate: new Date().toISOString(),
    totalRecords: customers.length,
    customers: customers.map(customer => ({
      id: customer.id || customer.sl,
      name: customer.name || "N/A",
      email: customer.email || "N/A",
      phone: customer.phone || "N/A",
      totalOrders: customer.totalOrder || 0,
      totalOrderAmount: customer.totalOrderAmount || 0,
      joiningDate: customer.joiningDate || "N/A",
      isCodAllowed: customer.isCodAllowed !== false,
      codAllowed: getCodAllowedLabel(customer),
      status: customer.status ? "Active" : "Inactive",
      isActive: customer.status
    }))
  }

  const jsonContent = JSON.stringify(formattedData, null, 2)
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  const timestamp = new Date().toISOString().split("T")[0]
  link.setAttribute("download", `${filename}_${timestamp}.json`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
