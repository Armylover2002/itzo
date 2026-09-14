const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

// Export utility functions for deliveryman data
export const exportDeliverymenToCSV = (deliverymen, filename = "deliverymen") => {
  const headers = ["SI", "Name", "Contact", "Zone", "Total Orders", "Availability Status"]
  const rows = deliverymen.map((dm) => [
    dm.sl,
    dm.name,
    dm.phone,
    dm.zone,
    dm.totalOrders,
    dm.status
  ])
  
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
  ].join("\n")
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const exportDeliverymenToExcel = (deliverymen, filename = "deliverymen") => {
  const headers = ["SI", "Name", "Phone", "Email", "Zone", "Total Orders", "Status"]
  const rows = deliverymen.map((dm) => [
    dm.sl,
    dm.name,
    dm.phone,
    dm.email,
    dm.zone,
    dm.totalOrders,
    dm.status
  ])
  
  const csvContent = [
    headers.join("\t"),
    ...rows.map(row => row.join("\t"))
  ].join("\n")
  
  const blob = new Blob([csvContent], { type: "application/vnd.ms-excel" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.xls`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const exportDeliverymenToPDF = (deliverymen, filename = "deliverymen") => {
  if (!deliverymen || deliverymen.length === 0) {
    alert("No data to export")
    return
  }

  try {
    // Dynamic import of jsPDF and autoTable for instant download
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(({ default: autoTable }) => {
        const doc = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4'
        })

        // Add title
        doc.setFontSize(16)
        doc.text('Delivery Partners Report', 14, 15)
        
        // Add export info
        doc.setFontSize(10)
        const exportDate = new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        doc.text(`Exported on: ${exportDate} | Total Records: ${deliverymen.length}`, 14, 22)

        // Prepare table data
        const tableData = deliverymen.map((dm) => [
          dm.sl || 'N/A',
          dm.name || 'N/A',
          dm.phone || 'N/A',
          dm.email || 'N/A',
          dm.zone || 'N/A',
          dm.totalOrders || 0,
          dm.status || 'N/A'
        ])

        // Add table using autoTable
        autoTable(doc, {
          head: [["SI", "Name", "Phone", "Email", "Zone", "Total Orders", "Status"]],
          body: tableData,
          startY: 28,
          styles: {
            fontSize: 8,
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
            0: { cellWidth: 15 }, // SI
            1: { cellWidth: 35 }, // Name
            2: { cellWidth: 30 }, // Phone
            3: { cellWidth: 45 }, // Email
            4: { cellWidth: 40 }, // Zone
            5: { cellWidth: 25 }, // Total Orders
            6: { cellWidth: 25 }, // Status
          },
          margin: { top: 28, left: 14, right: 14 },
        })

        // Save the PDF instantly (like Excel)
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

export const exportDeliverymenToJSON = (deliverymen, filename = "deliverymen") => {
  const jsonContent = JSON.stringify(deliverymen, null, 2)
  const blob = new Blob([jsonContent], { type: "application/json" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.json`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Export utilities for reviews
export const exportReviewsToCSV = (reviews, filename = "deliveryman_reviews") => {
  const headers = ["SI", "Deliveryman", "Customer", "Review", "Rating"]
  const rows = reviews.map((review) => [
    review.sl,
    review.deliveryman,
    review.customer,
    review.review,
    review.rating
  ])
  
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))
  ].join("\n")
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const exportReviewsToExcel = (reviews, filename = "deliveryman_reviews") => {
  const headers = ["SI", "Deliveryman", "Customer", "Review", "Rating"]
  const rows = reviews.map((review) => [
    review.sl,
    review.deliveryman,
    review.customer,
    review.review,
    review.rating
  ])
  
  const csvContent = [
    headers.join("\t"),
    ...rows.map(row => row.join("\t"))
  ].join("\n")
  
  const blob = new Blob([csvContent], { type: "application/vnd.ms-excel" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.xls`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const exportReviewsToPDF = async (reviews, filename = "deliveryman_reviews") => {
  if (!reviews || reviews.length === 0) {
    alert("No data to export")
    return
  }

  try {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    })

    doc.setFontSize(16)
    doc.setTextColor(30, 30, 30)
    const title = filename.charAt(0).toUpperCase() + filename.slice(1).replace(/_/g, ' ')
    doc.text(title, 148, 15, { align: 'center' })
    
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    const exportDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    doc.text(`Exported on: ${exportDate} | Total Records: ${reviews.length}`, 148, 22, { align: 'center' })
    
    const headers = [["SI", "Deliveryman", "Customer", "Review", "Rating"]]
    const tableData = reviews.map((review, index) => [
      review.sl || index + 1,
      review.deliveryman || 'N/A',
      review.customer || 'N/A',
      review.review || 'N/A',
      review.rating || 'N/A'
    ])

    autoTable(doc, {
      head: headers,
      body: tableData,
      startY: 28,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        3: { cellWidth: 100 }, // Review text column wider
      },
      margin: { top: 28, left: 10, right: 10 },
    })

    const fileTimestamp = new Date().toISOString().split("T")[0]
    doc.save(`${filename}_${fileTimestamp}.pdf`)
  } catch (error) {
    console.error("Error loading PDF library:", error)
    alert("Failed to load PDF library. Please try again.")
  }
}

export const exportReviewsToJSON = (reviews, filename = "deliveryman_reviews") => {
  const jsonContent = JSON.stringify(reviews, null, 2)
  const blob = new Blob([jsonContent], { type: "application/json" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.json`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Export utilities for bonus transactions
const formatMoneyCell = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return '\u20B90.00'
  return `\u20B9${num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export const exportBonusToCSV = (transactions, filename = "deliveryman_bonus") => {
  const headers = [
    "S.No",
    "Transaction ID",
    "Delivery Partner",
    "Delivery Boy ID",
    "Bonus",
    "Reference",
    "Previous Balance",
    "Updated Balance",
    "Created By",
    "Created At",
  ]
  const rows = transactions.map((transaction) => [
    transaction.sl,
    transaction.transactionId,
    transaction.deliveryPartner || transaction.deliveryman || "",
    transaction.deliveryId || "N/A",
    formatMoneyCell(transaction.amount ?? transaction.bonus),
    transaction.reference || "",
    formatMoneyCell(transaction.previousBalance),
    formatMoneyCell(transaction.updatedBalance),
    transaction.createdBy || "N/A",
    transaction.createdAt || "",
  ])

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","),
    ),
  ].join("\n")

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Helper function to format bonus amount properly (remove superscript and special characters)
const formatBonusForExport = (transaction) => {
  if (transaction.amount !== undefined && transaction.amount !== null && !isNaN(transaction.amount)) {
    return formatMoneyCell(transaction.amount)
  }

  if (transaction.bonus) {
    let cleaned = transaction.bonus
      .toString()
      .replace(/[\u2070-\u207F\u2080-\u208F]/g, "")
      .replace(/[^\d.-]/g, "")
      .trim()

    const numericMatch = cleaned.match(/[\d.]+/)
    if (numericMatch) {
      const amount = parseFloat(numericMatch[0])
      if (!isNaN(amount)) return formatMoneyCell(amount)
    }
  }

  return "₹0.00"
}

export const exportBonusToExcel = (transactions, filename = "deliveryman_bonus") => {
  if (!transactions || transactions.length === 0) {
    alert("No data to export")
    return
  }

  const headers = [
    "S.No",
    "Transaction ID",
    "Delivery Partner",
    "Delivery Boy ID",
    "Bonus",
    "Reference",
    "Previous Balance",
    "Updated Balance",
    "Created By",
    "Created At",
  ]
  const rows = transactions.map((transaction) => [
    transaction.sl || "N/A",
    transaction.transactionId || "N/A",
    transaction.deliveryPartner || transaction.deliveryman || "N/A",
    transaction.deliveryId || "N/A",
    formatBonusForExport(transaction),
    transaction.reference || "N/A",
    formatMoneyCell(transaction.previousBalance),
    formatMoneyCell(transaction.updatedBalance),
    transaction.createdBy || "N/A",
    transaction.createdAt || "N/A",
  ])
  
  // Create HTML table for better Excel compatibility with UTF-8 encoding
  const htmlContent = `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
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
            ${rows.map(row => `<tr>${row.map(cell => `<td>${String(cell).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </body>
    </html>
  `
  
  const blob = new Blob([htmlContent], { type: "application/vnd.ms-excel;charset=utf-8" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.xls`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const exportBonusToPDF = (transactions, filename = "deliveryman_bonus") => {
  if (!transactions || transactions.length === 0) {
    alert("No data to export")
    return
  }

  try {
    // Dynamic import of jsPDF and autoTable for instant download
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(({ default: autoTable }) => {
        const doc = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4'
        })

        // Add title
        doc.setFontSize(16)
        doc.text('Delivery Partner Bonus Transactions Report', 14, 15)
        
        // Add export info
        doc.setFontSize(10)
        const exportDate = new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        doc.text(`Exported on: ${exportDate} | Total Records: ${transactions.length}`, 14, 22)

        // Prepare table data - ensure bonus is properly formatted
        const tableData = transactions.map((transaction) => {
          // ALWAYS use raw amount value - don't rely on formatted bonus string
          let bonusAmount = '₹0.00'
          
          // First priority: Use raw numeric amount from transaction.amount
          if (transaction.amount !== undefined && transaction.amount !== null) {
            const numAmount = typeof transaction.amount === 'string' 
              ? parseFloat(transaction.amount.replace(/[^\d.-]/g, ''))
              : parseFloat(transaction.amount)
            if (!isNaN(numAmount)) {
              bonusAmount = `₹${numAmount.toFixed(2)}`
            }
          } 
          // Second priority: Extract number from bonus string and rebuild
          else if (transaction.bonus) {
            // Extract only numeric part (digits and decimal point)
            const numericPart = String(transaction.bonus).replace(/[^\d.-]/g, '')
            const numAmount = parseFloat(numericPart)
            if (!isNaN(numAmount) && numAmount > 0) {
              bonusAmount = `₹${numAmount.toFixed(2)}`
            }
          }
          
          return [
            transaction.sl || 'N/A',
            transaction.transactionId || 'N/A',
            transaction.deliveryPartner || transaction.deliveryman || 'N/A',
            transaction.deliveryId || 'N/A',
            bonusAmount,
            transaction.reference || 'N/A',
            formatMoneyCell(transaction.previousBalance),
            formatMoneyCell(transaction.updatedBalance),
            transaction.createdBy || 'N/A',
            transaction.createdAt || 'N/A'
          ]
        })

        // Add table using autoTable
        autoTable(doc, {
          head: [["S.No", "Transaction ID", "Delivery Partner", "Delivery Boy ID", "Bonus", "Reference", "Previous Balance", "Updated Balance", "Created By", "Created At"]],
          body: tableData,
          startY: 28,
          styles: {
            fontSize: 6,
            cellPadding: 1.5,
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
            0: { cellWidth: 10 }, // SI
            1: { cellWidth: 35 }, // Transaction ID
            2: { cellWidth: 30 }, // Delivery Partner
            3: { cellWidth: 25 }, // Delivery Boy ID
            4: { cellWidth: 15 }, // Bonus
            5: { cellWidth: 30 }, // Reference
            6: { cellWidth: 20 }, // Previous Balance
            7: { cellWidth: 20 }, // Updated Balance
            8: { cellWidth: 25 }, // Created By
            9: { cellWidth: 30 }, // Created At
          },
          margin: { top: 28, left: 10, right: 10 },
        })

        // Save the PDF instantly
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

export const exportBonusToJSON = (transactions, filename = "deliveryman_bonus") => {
  const jsonContent = JSON.stringify(transactions, null, 2)
  const blob = new Blob([jsonContent], { type: "application/json" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.json`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}


