// Export utility functions for restaurants
export const exportRestaurantsToExcel = (restaurants, filename = "restaurants") => {
  const headers = [
    "SI",
    "Restaurant ID",
    "Restaurant Name",
    "Owner Name",
    "Owner Phone",
    "Zone",
    "Cuisine",
    "Status",
    "Rating"
  ]
  
  const rows = restaurants.map((restaurant, index) => [
    index + 1,
    restaurant.originalData?.restaurantId || restaurant.originalData?._id || restaurant._id || restaurant.id || "N/A",
    restaurant.name || "N/A",
    restaurant.ownerName || "N/A",
    restaurant.ownerPhone || "N/A",
    restaurant.zone || "N/A",
    restaurant.cuisine || "N/A",
    restaurant.status ? "Active" : "Inactive",
    restaurant.rating || 0
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

export const exportRestaurantsToPDF = async (restaurants, filename = "restaurants") => {
  if (!restaurants || restaurants.length === 0) {
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
    doc.text(`Exported on: ${exportDate} | Total Records: ${restaurants.length}`, 148, 22, { align: 'center' })
    
    const headers = [["SI", "Restaurant ID", "Restaurant Name", "Owner Name", "Owner Phone", "Zone", "Cuisine", "Status", "Rating"]]
    const tableData = restaurants.map((restaurant, index) => [
      index + 1,
      restaurant.originalData?.restaurantId || restaurant.originalData?._id || restaurant._id || restaurant.id || "N/A",
      restaurant.name || "N/A",
      restaurant.ownerName || "N/A",
      restaurant.ownerPhone || "N/A",
      restaurant.zone || "N/A",
      restaurant.cuisine || "N/A",
      restaurant.status ? "Active" : "Inactive",
      restaurant.rating || 0
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
      margin: { top: 28, left: 10, right: 10 },
    })

    const fileTimestamp = new Date().toISOString().split("T")[0]
    doc.save(`${filename}_${fileTimestamp}.pdf`)
  } catch (error) {
    console.error("Error loading PDF library:", error)
    alert("Failed to load PDF library. Please try again.")
  }
}

export const exportRestaurantsToCSV = (restaurants, filename = "restaurants") => {
  if (!restaurants || restaurants.length === 0) {
    alert("No data to export")
    return
  }
  const headers = ["SI", "Restaurant ID", "Restaurant Name", "Owner Name", "Owner Phone", "Zone", "Cuisine", "Status", "Rating"]
  const rows = restaurants.map((restaurant, index) => [
    index + 1,
    restaurant.originalData?.restaurantId || restaurant.originalData?._id || restaurant._id || restaurant.id || "N/A",
    restaurant.name || "N/A",
    restaurant.ownerName || "N/A",
    restaurant.ownerPhone || "N/A",
    restaurant.zone || "N/A",
    restaurant.cuisine || "N/A",
    restaurant.status ? "Active" : "Inactive",
    restaurant.rating || 0
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

export const exportRestaurantsToJSON = (restaurants, filename = "restaurants") => {
  if (!restaurants || restaurants.length === 0) {
    alert("No data to export")
    return
  }
  const jsonContent = JSON.stringify(restaurants, null, 2)
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

