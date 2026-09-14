// Export utility functions for transaction management

export const exportTransactionsToCSV = (transactions, headers, filename = "transactions") => {
  const csvContent = [
    headers.map(h => `"${h.label}"`).join(","),
    ...transactions.map(row => headers.map(h => {
      const value = row[h.key];
      if (value === null || value === undefined) return '""';
      if (typeof value === 'number') return value;
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(","))
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportTransactionsToExcel = (transactions, headers, filename = "transactions") => {
  // Create HTML table for better Excel compatibility and clear formatting
  const htmlContent = `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #3b82f6; color: white; font-weight: bold; }
          td { white-space: nowrap; }
          tr:nth-child(even) { background-color: #f9fafb; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h.label}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${transactions.map(row => `
              <tr>
                ${headers.map(h => {
                  const value = row[h.key];
                  if (value === null || value === undefined) return '<td></td>';
                  // Escape HTML to prevent issues
                  const escapedValue = String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                  return `<td>${escapedValue}</td>`;
                }).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: "application/vnd.ms-excel" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.xls`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportTransactionsToPDF = async (transactions, headers, filename = "transactions", title = "Transaction Report") => {
  // Instant PDF download using jsPDF + autoTable (no print dialog)
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  })

  const reportDate = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })

  // Title
  doc.setFontSize(16)
  doc.text(title, 14, 16)
  doc.setFontSize(10)
  doc.text(`Generated: ${reportDate}`, 14, 22)

  const head = [headers.map(h => h.label)]
  const body = transactions.map(row =>
    headers.map(h => {
      const v = row[h.key]
      return v === null || v === undefined ? '' : String(v)
    })
  )

  autoTable(doc, {
    head,
    body,
    startY: 28,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 }
  })

  doc.save(`${filename}_${new Date().toISOString().split("T")[0]}.pdf`)
};

export const exportTransactionsToJSON = (transactions, filename = "transactions") => {
  const payload = {
    exportDate: new Date().toISOString(),
    totalRecords: transactions.length,
    rows: transactions,
  };
  const jsonContent = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.json`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};










