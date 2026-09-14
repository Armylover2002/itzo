import { getQuickOrderMoneyBreakdown } from './orderMoneyBreakdown';

export const downloadCsv = (rows, filename) => {
  if (!rows?.length) return false;

  const csv = rows
    .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
};

export const formatInr = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;

export const formatOrderDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getTransactionBreakdown = (order) => getQuickOrderMoneyBreakdown(order);

export const buildTransactionCsvRows = (orders = []) => {
  const headers = [
    'Order ID',
    'Order Date',
    'Customer',
    'Seller',
    'Delivery Boy',
    'User Paid (Net)',
    'User Paid (Gross)',
    'Refunded',
    'Subtotal',
    'Delivery Fee',
    'Tax/GST',
    'GST Refunded',
    'Platform Fee',
    'Packing Fee (Seller)',
    'Return Pickup Fee',
    'Discount',
    'Commission',
    'Seller Earned',
    'Delivery Rider',
    'Return Rider',
    'Rider Earned (Total)',
    'Admin Earned',
    'Status',
  ];

  const rows = orders.map((order) => {
    const breakdown = getTransactionBreakdown(order);
    const status = order.status === 'delivered' ? 'Completed' : (order.status || 'N/A');

    return [
      order.orderId || order.orderNumber || order._id || order.id || '',
      formatOrderDate(order.createdAt),
      order.customer?.name || 'Guest',
      order.storeName || order.seller?.shopName || order.seller?.name || 'Unknown',
      order.dispatch?.rider?.name || order.rider?.name || 'N/A',
      formatInr(breakdown.userPaid),
      formatInr(breakdown.userPaidGross),
      formatInr(breakdown.refundedAmount),
      formatInr(breakdown.subtotal),
      formatInr(breakdown.deliveryFee),
      formatInr(breakdown.tax),
      formatInr(breakdown.refundedTaxShare),
      formatInr(breakdown.platformFee),
      formatInr(breakdown.packingFee),
      formatInr(breakdown.returnPickupFee),
      formatInr(breakdown.adminDiscount || breakdown.discount),
      formatInr(breakdown.commission),
      formatInr(breakdown.sellerEarned),
      formatInr(breakdown.deliveryRiderEarning),
      formatInr(breakdown.returnRiderEarning),
      formatInr(breakdown.riderEarned),
      formatInr(breakdown.adminEarned),
      status,
    ];
  });

  return [headers, ...rows];
};

export const buildCustomerCsvRows = (customers = []) => {
  const headers = [
    'Name',
    'Email',
    'Phone',
    'Total Orders',
    'Total Spend',
    'Status',
    'Joined Date',
    'Last Order Date',
  ];

  const rows = customers.map((customer) => [
    customer.name || 'N/A',
    customer.email || 'N/A',
    customer.phone ? `\t${customer.phone}` : 'N/A',
    String(customer.totalOrders ?? 0),
    formatInr(customer.totalSpent),
    customer.status || 'N/A',
    customer.joinedDate ? formatOrderDate(customer.joinedDate) : 'N/A',
    customer.lastOrderDate ? formatOrderDate(customer.lastOrderDate) : 'Never',
  ]);

  return [headers, ...rows];
};
