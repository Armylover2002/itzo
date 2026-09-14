// Export utility functions for advertisements
export const exportAdvertisementsToCSV = (ads, filename = "advertisements") => {
  const headers = ["SI", "Ads ID", "Ads Title", "Restaurant Name", "Restaurant Email", "Ads Type", "Duration"]
  const rows = ads.map((ad, index) => [
    index + 1,
    ad.adsId || ad.sl,
    ad.adsTitle || ad.title || "",
    ad.restaurantName || "",
    ad.restaurantEmail || "",
    ad.adsType || ad.type || "",
    ad.duration || ""
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

export const exportAdvertisementsToExcel = (ads, filename = "advertisements") => {
  const headers = ["SI", "Ads ID", "Ads Title", "Restaurant Name", "Restaurant Email", "Ads Type", "Duration"]
  const rows = ads.map((ad, index) => [
    index + 1,
    ad.adsId || ad.sl,
    ad.adsTitle || ad.title || "",
    ad.restaurantName || "",
    ad.restaurantEmail || "",
    ad.adsType || ad.type || "",
    ad.duration || ""
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

export const exportAdvertisementsToPDF = (ads, filename = "advertisements") => {
  const headers = ["SI", "Ads ID", "Ads Title", "Restaurant Name", "Restaurant Email", "Ads Type", "Duration"]
  const rows = ads.map((ad, index) => [
    index + 1,
    ad.adsId || ad.sl,
    ad.adsTitle || ad.title || "",
    ad.restaurantName || "",
    ad.restaurantEmail || "",
    ad.adsType || ad.type || "",
    ad.duration || ""
  ])
  
  const printWindow = window.open("", "_blank")
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${filename}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>${filename}</h1>
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
  printWindow.document.write(htmlContent)
  printWindow.document.close()
  printWindow.print()
}

export const exportAdvertisementsToJSON = (ads, filename = "advertisements") => {
  const jsonContent = JSON.stringify(ads, null, 2)
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

