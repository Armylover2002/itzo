const ONLINE_METHODS = new Set(['razorpay', 'razorpay_qr', 'online']);

export const isQuickOrderVisibleToSeller = (order) => {
  if (!order) return false;

  const method = String(order?.payment?.method || '').trim().toLowerCase();
  const status = String(order?.payment?.status || '').trim().toLowerCase();

  if (['cash', 'cod'].includes(method)) return true;
  if (status === 'paid' || status === 'refunded') return true;
  if (ONLINE_METHODS.has(method)) return false;

  return true;
};

export const getSellerVisibleQuickOrderPaymentFilter = () => ({
  $or: [
    { 'payment.method': { $in: ['cash', 'cod'] } },
    { 'payment.status': { $in: ['paid', 'refunded'] } },
  ],
});
