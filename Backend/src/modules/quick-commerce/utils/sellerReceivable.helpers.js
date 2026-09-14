/**
 * Net seller earning for a seller-order pricing snapshot.
 * Signed values are allowed (seller coupon can push earnings negative until later orders credit back).
 * Falls back to subtotal only when receivable is missing/non-numeric (legacy rows).
 */
export const resolveSellerReceivable = (pricing = {}) => {
  const raw = pricing?.receivable;
  if (raw !== null && raw !== undefined && raw !== '') {
    const receivable = Number(raw);
    if (Number.isFinite(receivable)) return receivable;
  }
  const subtotal = Number(pricing?.subtotal || 0);
  return Number.isFinite(subtotal) ? subtotal : 0;
};
