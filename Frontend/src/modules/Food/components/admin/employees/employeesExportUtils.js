const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

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

const assertRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    alert("No data to export")
    return false
  }
  return true
}

const formatCell = (value) => {
  if (value == null) return ""
  if (Array.isArray(value)) return value.join(", ")
  return String(value)
}

export const exportEmployeesToCSV = (employees, headers, filename = "employees") => {
  if (!assertRows(employees)) return

  const csvContent = [
    headers.map((h) => `"${String(h.label).replace(/"/g, '""')}"`).join(","),
    ...employees.map((row) =>
      headers
        .map((h) => {
          const value = formatCell(row[h.key])
          if (typeof row[h.key] === "number") return row[h.key]
          return `"${value.replace(/"/g, '""')}"`
        })
        .join(","),
    ),
  ].join("\n")

  downloadBlob(
    new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }),
    datedFilename(filename, "csv"),
  )
}

export const exportEmployeesToExcel = (employees, headers, filename = "employees") => {
  if (!assertRows(employees)) return

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
            <tr>${headers.map((h) => `<th>${escapeHtml(h.label)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${employees
              .map(
                (row) => `
              <tr>
                ${headers
                  .map((h) => `<td>${escapeHtml(formatCell(row[h.key]))}</td>`)
                  .join("")}
              </tr>`,
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

export const exportEmployeesToPDF = async (
  employees,
  headers,
  filename = "employees",
  title = "Employee Report",
) => {
  if (!assertRows(employees)) return

  try {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ])

    const doc = new jsPDF({
      orientation: headers.length > 5 ? "landscape" : "portrait",
      unit: "mm",
      format: "a4",
    })
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFontSize(16)
    doc.text(String(title), pageWidth / 2, 15, { align: "center" })
    doc.setFontSize(10)
    doc.text(
      `Generated: ${new Date().toLocaleString("en-IN")} | Records: ${employees.length}`,
      pageWidth / 2,
      22,
      { align: "center" },
    )

    autoTable(doc, {
      head: [headers.map((h) => h.label)],
      body: employees.map((row) => headers.map((h) => formatCell(row[h.key]))),
      startY: 28,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 10, right: 10 },
    })

    doc.save(datedFilename(filename, "pdf"))
  } catch (error) {
    console.error("Employee PDF export failed:", error)
    alert("Failed to export PDF. Please try again.")
  }
}

export const exportEmployeesToJSON = (employees, filename = "employees") => {
  if (!assertRows(employees)) return
  const payload = {
    exportDate: new Date().toISOString(),
    totalRecords: employees.length,
    employees,
  }
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }),
    datedFilename(filename, "json"),
  )
}
