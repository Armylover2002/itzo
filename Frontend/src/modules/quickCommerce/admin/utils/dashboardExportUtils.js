const formatCurrencyExcel = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const formatCurrencyPdf = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;

const normalizeAmount = (value, forPdf = false) => {
  if (value === null || value === undefined || value === '' || value === '—') return forPdf ? '-' : '—';
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
  if (!Number.isNaN(numeric)) {
    return forPdf ? formatCurrencyPdf(numeric) : formatCurrencyExcel(numeric);
  }
  return String(value);
};

const formatDate = () => {
  const now = new Date();
  return {
    date: now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    file: now.toISOString().split('T')[0],
  };
};

const calcGrowth = (current, previous) => {
  if (!previous || previous === 0) return current > 0 ? '+100%' : '0%';
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
};

export function buildDashboardExportContext(statsData, { forPdf = false } = {}) {
  const overview = statsData?.overview || {};
  const chartData = statsData?.revenueHistory || [];
  const categoryData = statsData?.categoryData || [];
  const recentOrders = statsData?.recentOrders || [];
  const topProducts = statsData?.topProducts || [];
  const formatMoney = forPdf ? formatCurrencyPdf : formatCurrencyExcel;
  const emptyCell = forPdf ? '-' : '—';

  const currentMonthRevenue = chartData.length >= 1 ? (chartData[chartData.length - 1]?.revenue || 0) : 0;
  const prevMonthRevenue = chartData.length >= 2 ? (chartData[chartData.length - 2]?.revenue || 0) : 0;

  const overviewRows = [
    ['Total Users', overview.totalUsers || 0, overview.usersGrowth || overview.usersTrend || calcGrowth(overview.totalUsers, overview.prevTotalUsers)],
    ['Active Sellers', overview.activeSellers || 0, overview.sellersGrowth || overview.sellersTrend || calcGrowth(overview.activeSellers, overview.prevActiveSellers)],
    ['Total Orders', overview.totalOrders || 0, overview.ordersGrowth || overview.ordersTrend || calcGrowth(overview.totalOrders, overview.prevTotalOrders)],
    ['Total Revenue', formatMoney(overview.totalRevenue), calcGrowth(currentMonthRevenue, prevMonthRevenue)],
    ['GST Collected', formatMoney(overview.gstCollected), emptyCell],
    ['Platform Charges', formatMoney(overview.platformCharges), emptyCell],
  ];

  const revenueRows = chartData.map((row) => [
    row.name,
    forPdf ? formatMoney(row.revenue) : Number(row.revenue || 0),
  ]);
  const categoryRows = categoryData.map((cat) => [cat.name, cat.value ?? 0]);
  const orderRows = recentOrders.map((order) => [
    order.id || emptyCell,
    order.customer || 'Guest',
    order.statusText || order.status || emptyCell,
    normalizeAmount(order.amount, forPdf),
    order.time || emptyCell,
  ]);
  const productRows = topProducts.map((product) => [
    product.name || emptyCell,
    product.cat || emptyCell,
    normalizeAmount(product.rev, forPdf),
    product.trend || emptyCell,
  ]);

  return {
    overview,
    overviewRows,
    revenueRows,
    categoryRows,
    orderRows,
    productRows,
    generated: formatDate(),
  };
}

const formatOverviewRowsForExcel = (overviewRows) => overviewRows.map(([metric, value, trend]) => [
  metric,
  String(value),
  String(trend),
]);

const formatRevenueRowsForExcel = (revenueRows) => revenueRows.map(([month, revenue]) => [
  month,
  formatCurrencyExcel(revenue),
]);

const toStringRows = (rows) => rows.map((row) => row.map((cell) => String(cell ?? '')));

const createStringSheet = (XLSX, rows, colWidths = []) => {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  Object.keys(sheet).forEach((key) => {
    if (key.startsWith('!')) return;
    const cell = sheet[key];
    if (cell?.v !== undefined && cell?.v !== null) {
      cell.v = String(cell.v);
      cell.t = 's';
    }
  });
  if (colWidths.length > 0) {
    sheet['!cols'] = colWidths.map((wch) => ({ wch }));
  }
  return sheet;
};

const appendSheet = (XLSX, workbook, name, rows, colWidths = []) => {
  const sheet = createStringSheet(XLSX, rows, colWidths);
  XLSX.utils.book_append_sheet(workbook, sheet, name);
};

const noDataRow = (columns) => [['No data available', ...Array(Math.max(columns - 1, 0)).fill('')]];

export async function exportDashboardToExcel(statsData) {
  const xlsxModule = await import('xlsx');
  const XLSX = xlsxModule.default || xlsxModule;
  const ctx = buildDashboardExportContext(statsData, { forPdf: false });
  const {
    generated,
    overviewRows,
    revenueRows,
    categoryRows,
    orderRows,
    productRows,
  } = ctx;

  const workbook = XLSX.utils.book_new();
  const reportHeader = [
    ['BLAZE QUICK COMMERCE - DASHBOARD REPORT'],
    [`Generated: ${generated.date} at ${generated.time}`],
    [],
  ];

  appendSheet(XLSX, workbook, 'Overview', [
    ...reportHeader,
    ['OVERVIEW METRICS'],
    ['Metric', 'Value', 'Trend'],
    ...formatOverviewRowsForExcel(overviewRows),
  ], [30, 18, 14]);

  appendSheet(XLSX, workbook, 'Revenue Trends', [
    ...reportHeader,
    ['MONTHLY REVENUE TRENDS'],
    ['Month', 'Revenue'],
    ...(revenueRows.length > 0
      ? formatRevenueRowsForExcel(revenueRows)
      : noDataRow(2)),
  ], [20, 18]);

  appendSheet(XLSX, workbook, 'Categories', [
    ...reportHeader,
    ['TOP CATEGORIES'],
    ['Category', 'Sales Count'],
    ...(categoryRows.length > 0
      ? toStringRows(categoryRows)
      : noDataRow(2)),
  ], [32, 16]);

  appendSheet(XLSX, workbook, 'Recent Orders', [
    ...reportHeader,
    ['RECENT ORDERS'],
    ['Order ID', 'Customer', 'Status', 'Amount', 'Time'],
    ...(orderRows.length > 0
      ? toStringRows(orderRows)
      : noDataRow(5)),
  ], [18, 24, 14, 14, 24]);

  appendSheet(XLSX, workbook, 'Top Products', [
    ...reportHeader,
    ['TOP PRODUCTS'],
    ['Product', 'Category', 'Revenue', 'Trend'],
    ...(productRows.length > 0
      ? toStringRows(productRows)
      : noDataRow(4)),
  ], [30, 22, 14, 14]);

  appendSheet(XLSX, workbook, 'Full Report', [
    ...reportHeader,
    ['OVERVIEW METRICS'],
    ['Metric', 'Value', 'Trend'],
    ...formatOverviewRowsForExcel(overviewRows),
    [],
    ['MONTHLY REVENUE TRENDS'],
    ['Month', 'Revenue'],
    ...(revenueRows.length > 0 ? formatRevenueRowsForExcel(revenueRows) : noDataRow(2)),
    [],
    ['TOP CATEGORIES'],
    ['Category', 'Sales Count'],
    ...(categoryRows.length > 0 ? toStringRows(categoryRows) : noDataRow(2)),
    [],
    ['RECENT ORDERS'],
    ['Order ID', 'Customer', 'Status', 'Amount', 'Time'],
    ...(orderRows.length > 0 ? toStringRows(orderRows) : noDataRow(5)),
    [],
    ['TOP PRODUCTS'],
    ['Product', 'Category', 'Revenue', 'Trend'],
    ...(productRows.length > 0 ? toStringRows(productRows) : noDataRow(4)),
  ], [22, 22, 14, 14, 24]);

  XLSX.writeFile(workbook, `quick-commerce-dashboard-${generated.file}.xlsx`);
}

export async function exportDashboardToPDF(statsData) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const ctx = buildDashboardExportContext(statsData, { forPdf: true });
  const { generated, overviewRows, revenueRows, categoryRows, orderRows, productRows } = ctx;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const primaryColor = [239, 68, 68];

  const addHeader = (title) => {
    doc.setFontSize(18);
    doc.setTextColor(30, 30, 30);
    doc.text('Quick Commerce Dashboard Report', margin, 18);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${generated.date} at ${generated.time}`, margin, 26);

    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.6);
    doc.line(margin, 30, pageWidth - margin, 30);

    doc.setFontSize(13);
    doc.setTextColor(40, 40, 40);
    doc.text(title, margin, 38);
  };

  const tableStyles = {
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: margin, right: margin },
  };

  addHeader('Overview');

  autoTable(doc, {
    startY: 42,
    head: [['Metric', 'Value', 'Trend']],
    body: overviewRows,
    ...tableStyles,
  });

  let startY = doc.lastAutoTable.finalY + 12;

  autoTable(doc, {
    startY,
    head: [['Month', 'Revenue (Rs.)']],
    body: revenueRows,
    ...tableStyles,
  });

  startY = doc.lastAutoTable.finalY + 12;

  if (categoryRows.length > 0) {
    autoTable(doc, {
      startY,
      head: [['Category', 'Sales Count']],
      body: categoryRows,
      ...tableStyles,
    });
    startY = doc.lastAutoTable.finalY + 12;
  }

  if (orderRows.length > 0) {
    if (startY > 240) {
      doc.addPage();
      addHeader('Recent Orders');
      startY = 42;
    } else {
      doc.setFontSize(13);
      doc.setTextColor(40, 40, 40);
      doc.text('Recent Orders', margin, startY - 4);
    }

    autoTable(doc, {
      startY,
      head: [['Order ID', 'Customer', 'Status', 'Amount', 'Time']],
      body: orderRows,
      ...tableStyles,
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 38 },
        4: { cellWidth: 38 },
      },
    });
    startY = doc.lastAutoTable.finalY + 12;
  }

  if (productRows.length > 0) {
    if (startY > 240) {
      doc.addPage();
      addHeader('Top Products');
      startY = 42;
    } else {
      doc.setFontSize(13);
      doc.setTextColor(40, 40, 40);
      doc.text('Top Products', margin, startY - 4);
    }

    autoTable(doc, {
      startY,
      head: [['Product', 'Category', 'Revenue', 'Trend']],
      body: productRows,
      ...tableStyles,
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount}  |  Blaze Quick Commerce`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' },
    );
  }

  doc.save(`quick-commerce-dashboard-${generated.file}.pdf`);
}
