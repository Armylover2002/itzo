const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

// Export utility functions for join requests
export const exportJoinRequestsToCSV = (requests, filename = "join_requests") => {
  const headers = ["SI", "Name", "Email", "Phone", "Zone", "Vehicle Type", "Status"]
  const rows = requests.map((request) => [
    request.sl,
    request.name,
    request.email,
    request.phone,
    request.zone,
    request.vehicleType,
    request.status
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

export const exportJoinRequestsToExcel = (requests, filename = "join_requests") => {
  const headers = ["SI", "Name", "Email", "Phone", "Zone", "Vehicle Type", "Status"]
  const rows = requests.map((request) => [
    request.sl,
    request.name,
    request.email,
    request.phone,
    request.zone,
    request.vehicleType,
    request.status
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

export const exportJoinRequestsToPDF = (requests, filename = "join_requests") => {
  if (!requests || requests.length === 0) {
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
        doc.text('Join Requests Report', 14, 15)
        
        // Add export info
        doc.setFontSize(10)
        const exportDate = new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        doc.text(`Exported on: ${exportDate} | Total Records: ${requests.length}`, 14, 22)

        // Prepare table data
        const tableData = requests.map((request) => [
          request.sl || 'N/A',
          request.name || 'N/A',
          request.email || 'N/A',
          request.phone || 'N/A',
          request.zone || 'N/A',
          request.vehicleType || 'N/A',
          request.status || 'N/A'
        ])

        // Add table using autoTable
        autoTable(doc, {
          head: [["SI", "Name", "Email", "Phone", "Zone", "Vehicle Type", "Status"]],
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
            1: { cellWidth: 40 }, // Name
            2: { cellWidth: 50 }, // Email
            3: { cellWidth: 35 }, // Phone
            4: { cellWidth: 45 }, // Zone
            5: { cellWidth: 35 }, // Vehicle Type
            6: { cellWidth: 30 }, // Status
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

export const exportJoinRequestsToJSON = (requests, filename = "join_requests") => {
  const jsonContent = JSON.stringify(requests, null, 2)
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


