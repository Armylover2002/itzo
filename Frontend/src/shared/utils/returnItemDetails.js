const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const normalizeReturnItemRow = (item = {}) => {
  const returnedQty = Math.max(0, money(item.returnedQty ?? item.quantity ?? 0));
  const orderedQty = Math.max(
    returnedQty,
    money(item.orderedQty ?? item.quantity ?? returnedQty),
  );
  const unitPrice = money(item.unitPrice ?? item.price ?? 0);
  const lineSubtotal = money(unitPrice * returnedQty);
  const couponShare = money(item.couponShare);
  const taxShare = money(item.taxShare);
  const discountShare = money(item.discountShare);
  const refundAmount = money(
    item.refundAmount ?? lineSubtotal - couponShare + taxShare,
  );
  const remainingQty = Math.max(
    0,
    money(item.remainingQty ?? orderedQty - returnedQty),
  );
  const variant = String(item.variantId || item.variantName || "").trim();
  const productId = String(item.productId || item.itemId || "").trim();
  const name = String(item.name || productId || "Product").trim();

  return {
    key: `${productId || name}-${variant}-${returnedQty}`,
    name,
    variant,
    productId,
    itemId: String(item.itemId || productId || "").trim(),
    orderedQty,
    returnedQty,
    remainingQty,
    unitPrice,
    lineSubtotal,
    couponShare,
    taxShare,
    discountShare,
    refundAmount,
  };
};

export const formatReturnItemMoney = (value) =>
  `₹${money(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
