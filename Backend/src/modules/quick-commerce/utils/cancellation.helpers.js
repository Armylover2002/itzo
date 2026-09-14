export const resolveQuickOrderCancellationReason = (parentOrder, sellerOrder = null) => {
  const fromSeller = String(sellerOrder?.cancellationReason || '').trim();
  if (fromSeller) return fromSeller;

  const fromRefund = String(parentOrder?.payment?.refund?.reason || '').trim();
  if (fromRefund) return fromRefund;

  const history = Array.isArray(parentOrder?.statusHistory) ? parentOrder.statusHistory : [];
  const cancelEntry = [...history]
    .reverse()
    .find((entry) => String(entry?.to || '').toLowerCase().includes('cancel'));

  return String(cancelEntry?.note || '').trim();
};
