// Export utility functions for zones
export const exportZonesToCSV = (zones, filename = "zones") => {
  const headers = ["SI", "Zone ID", "Name", "Display Name", "Restaurants", "Deliverymen", "Default Status", "Status"]
  const rows = zones.map((zone, index) => [
    index + 1,
    zone.zoneId,
    zone.name,
    zone.displayName,
    zone.restaurants,
    zone.deliverymen,
    zone.isDefault ? "Yes" : "No",
    zone.status ? "Active" : "Inactive"
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

export const exportZonesToExcel = (zones, filename = "zones") => {
  const headers = ["SI", "Zone ID", "Name", "Display Name", "Restaurants", "Deliverymen", "Default Status", "Status"]
  const rows = zones.map((zone, index) => [
    index + 1,
    zone.zoneId,
    zone.name,
    zone.displayName,
    zone.restaurants,
    zone.deliverymen,
    zone.isDefault ? "Yes" : "No",
    zone.status ? "Active" : "Inactive"
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

export const exportZonesToPDF = (zones, filename = "zones") => {
  const headers = ["SI", "Zone ID", "Name", "Display Name", "Restaurants", "Deliverymen", "Default Status", "Status"]
  const rows = zones.map((zone, index) => [
    index + 1,
    zone.zoneId,
    zone.name,
    zone.displayName,
    zone.restaurants,
    zone.deliverymen,
    zone.isDefault ? "Yes" : "No",
    zone.status ? "Active" : "Inactive"
  ])
  
  const printWindow = window.open("", "_blank")
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${filename}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <h1>${filename}</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${row.map(cell => `<td>${cell}</td>`).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(() => window.close(), 100);
          }
        </script>
      </body>
    </html>
  `
  printWindow.document.write(htmlContent)
  printWindow.document.close()
}

export const exportZonesToJSON = (zones, filename = "zones") => {
  const jsonContent = JSON.stringify(zones, null, 2)
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

