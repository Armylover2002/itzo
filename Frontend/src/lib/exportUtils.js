const csvCell = (value) => {
  if (value == null) return "";
  if (value instanceof Date) return `"${value.toISOString()}"`;
  if (typeof value === "object") {
    try {
      return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
    } catch {
      return "";
    }
  }
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const exportToCSV = (data, fileName, headersMap = null) => {
  if (!Array.isArray(data) || data.length === 0) return;

  const first = data.find((row) => row && typeof row === "object") || {};
  const keys = Object.keys(first);
  if (!keys.length) return;
  const headers = headersMap ? keys.map((key) => headersMap[key] || key) : keys;

  const csv = [
    headers.join(","),
    ...data.map((item) =>
      keys.map((key) => csvCell(item?.[key])).join(","),
    ),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${fileName}_${new Date().toISOString().split("T")[0]}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
