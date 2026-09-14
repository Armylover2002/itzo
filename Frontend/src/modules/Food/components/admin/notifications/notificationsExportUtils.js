// Export utility functions for notifications
export const exportNotificationsToCSV = (notifications, filename = "notifications") => {
  const headers = ["SI", "Topic", "Description", "Push Notification", "Mail", "SMS"]
  const rows = notifications.map((notif, index) => [
    index + 1,
    notif.topic,
    notif.description,
    notif.pushNotification,
    notif.mail ? "Yes" : "No",
    notif.sms !== false ? (notif.sms ? "Yes" : "No") : "N/A"
  ])
  
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
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

export const exportNotificationsToExcel = (notifications, filename = "notifications") => {
  const headers = ["SI", "Topic", "Description", "Push Notification", "Mail", "SMS"]
  const rows = notifications.map((notif, index) => [
    index + 1,
    notif.topic,
    notif.description,
    notif.pushNotification,
    notif.mail ? "Yes" : "No",
    notif.sms !== false ? (notif.sms ? "Yes" : "No") : "N/A"
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

export const exportNotificationsToPDF = (notifications, filename = "notifications") => {
  const headers = ["SI", "Topic", "Description", "Push Notification", "Mail", "SMS"]
  
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Notifications Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 10px; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        h1 { text-align: center; }
      </style>
    </head>
    <body>
      <h1>Notifications Report</h1>
      <p>Generated on: ${new Date().toLocaleString()}</p>
      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${notifications.map((notif, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${notif.topic}</td>
              <td>${notif.description}</td>
              <td>${notif.pushNotification}</td>
              <td>${notif.mail ? "Yes" : "No"}</td>
              <td>${notif.sms !== false ? (notif.sms ? "Yes" : "No") : "N/A"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </body>
    </html>
  `
  
  const printWindow = window.open("", "_blank")
  printWindow.document.write(htmlContent)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 250)
}

export const exportNotificationsToJSON = (notifications, filename = "notifications") => {
  const jsonContent = JSON.stringify(notifications, null, 2)
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

