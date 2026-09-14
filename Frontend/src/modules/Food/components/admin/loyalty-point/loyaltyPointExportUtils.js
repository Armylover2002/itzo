// Export utility functions for loyalty point reports
export const exportLoyaltyPointsToCSV = (transactions, filename = "loyalty_points_report") => {
  const headers = ["SI", "Transaction ID", "Customer", "Credit", "Debit", "Balance", "Transaction Type", "Reference", "Created At"]
  const rows = transactions.map((transaction) => [
    transaction.sl,
    transaction.transactionId,
    transaction.customer,
    transaction.credit,
    transaction.debit,
    transaction.balance,
    transaction.transactionType,
    transaction.reference,
    transaction.createdAt
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

export const exportLoyaltyPointsToExcel = (transactions, filename = "loyalty_points_report") => {
  const headers = ["SI", "Transaction ID", "Customer", "Credit", "Debit", "Balance", "Transaction Type", "Reference", "Created At"]
  const rows = transactions.map((transaction) => [
    transaction.sl,
    transaction.transactionId,
    transaction.customer,
    transaction.credit,
    transaction.debit,
    transaction.balance,
    transaction.transactionType,
    transaction.reference,
    transaction.createdAt
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

export const exportLoyaltyPointsToPDF = (transactions, filename = "loyalty_points_report") => {
  const headers = ["SI", "Transaction ID", "Customer", "Credit", "Debit", "Balance", "Transaction Type", "Reference", "Created At"]
  
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Loyalty Points Report</title>
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
      <h1>Loyalty Points Report</h1>
      <p>Generated on: ${new Date().toLocaleString()}</p>
      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${transactions.map(transaction => `
            <tr>
              <td>${transaction.sl}</td>
              <td>${transaction.transactionId}</td>
              <td>${transaction.customer}</td>
              <td>${transaction.credit}</td>
              <td>${transaction.debit}</td>
              <td>${transaction.balance}</td>
              <td>${transaction.transactionType}</td>
              <td>${transaction.reference}</td>
              <td>${transaction.createdAt}</td>
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

export const exportLoyaltyPointsToJSON = (transactions, filename = "loyalty_points_report") => {
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

