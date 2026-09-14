/**
 * Mirror Backend quick-commerce billing + Header Category GST.
 * Customer preview must match place-order / cart API charges.
 */

export const matchDeliveryFeeRange = (ranges = [], distanceKm = 0) => {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance < 0) return 0;
  if (!Array.isArray(ranges) || ranges.length === 0) return 0;

  const sorted = [...ranges].sort((a, b) => Number(a.min) - Number(b.min));
  for (let i = 0; i < sorted.length; i += 1) {
    const range = sorted[i] || {};
    const min = Number(range.min);
    const max = Number(range.max);
    if (!Number.isFinite(min) || !Number.isFinite(max)) continue;

    const isLast = i === sorted.length - 1;
    const inRange = isLast
      ? distance >= min && distance <= max
      : distance >= min && distance < max;

    if (inRange) {
      const fee = Number(range.fee || 0);
      return Number.isFinite(fee) && fee > 0 ? fee : 0;
    }
  }
  return 0;
};

export const calculateQuickDeliveryFee = ({
  feeSettings = {},
  distanceKm = 0,
  subtotal = 0,
  couponType = '',
} = {}) => {
  if (String(couponType || '').trim().toLowerCase() === 'free_delivery') {
    return 0;
  }

  let deliveryFee = matchDeliveryFeeRange(feeSettings?.deliveryFeeRanges, distanceKm);
  const freeThreshold = Number(feeSettings?.freeDeliveryThreshold || 0);
  if (
    deliveryFee > 0 &&
    Number.isFinite(freeThreshold) &&
    freeThreshold > 0 &&
    Number(subtotal || 0) >= freeThreshold
  ) {
    return 0;
  }
  return deliveryFee;
};

export const resolveCategoryId = (rawId) => {
  if (!rawId) return '';
  if (typeof rawId === 'object') {
    const nested = rawId._id || rawId.id;
    if (nested) return String(nested).trim();
  }
  const id = String(rawId).trim();
  return id === '[object Object]' ? '' : id;
};

/**
 * Build per-category handling fee + GST maps.
 * GST is authoritative only on type === 'header'; children inherit that rate
 * (mirrors Backend commission.service resolveHeaderFromCategoryMap).
 */
export const buildCategoryRateMaps = (categories = []) => {
  const feeMap = {};
  const gstMap = {};
  const byId = {};

  const flatten = (items = [], list = []) => {
    items.forEach((item) => {
      if (!item) return;
      list.push(item);
      if (Array.isArray(item.children) && item.children.length) {
        flatten(item.children, list);
      }
    });
    return list;
  };

  const all = flatten(Array.isArray(categories) ? categories : []);
  all.forEach((item) => {
    const id = resolveCategoryId(item?._id || item?.id);
    if (!id) return;
    byId[id] = item;
    feeMap[id] = Number(item?.handlingFees || 0);
  });

  const resolveHeaderGst = (startId) => {
    let currentId = resolveCategoryId(startId);
    const visited = new Set();
    let resolvedGst = null;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const node = byId[currentId];
      if (!node) break;
      const type = String(node.type || '').toLowerCase();
      const parentId = resolveCategoryId(node.parentId || node.parent?._id || node.parent);
      const isHeader = type === 'header' || (!type && !parentId);
      if (isHeader) {
        resolvedGst = Number(node.gst || 0);
      }
      currentId = parentId;
    }
    return resolvedGst == null ? 0 : resolvedGst;
  };

  Object.keys(byId).forEach((id) => {
    gstMap[id] = resolveHeaderGst(id);
  });

  return { categoryFeeMap: feeMap, categoryGstMap: gstMap };
};

/**
 * Resolve Header Category rate for a cart/product line
 * (headerId → categoryId → subcategoryId), same order as Backend.
 */
export const resolveInheritedRate = (item, rateMap = {}) => {
  const candidateIds = [item?.headerId, item?.categoryId, item?.subcategoryId];
  for (const rawId of candidateIds) {
    const id = resolveCategoryId(rawId);
    if (id && rateMap[id] != null) {
      return Number(rateMap[id] || 0);
    }
  }
  return 0;
};

/** Line-item GST from Header Category GST % — never from feeSettings.gstRate. */
export const calculateQuickGstAmount = (cartItems = [], categoryGstMap = {}, discountAmount = 0) => {
  const items = Array.isArray(cartItems) ? cartItems : [];
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 0),
    0,
  );
  const safeDiscount = Math.max(0, Math.min(Number(discountAmount || 0), subtotal));

  return Math.round(
    items.reduce((sum, item) => {
      const lineTotal = Number(item?.price || 0) * Number(item?.quantity || 0);
      const taxable =
        subtotal > 0 && safeDiscount > 0
          ? Math.max(0, lineTotal - safeDiscount * (lineTotal / subtotal))
          : lineTotal;
      const gstRate = resolveInheritedRate(item, categoryGstMap);
      return sum + taxable * (gstRate / 100);
    }, 0),
  );
};

export const calculateQuickHandlingFee = (cartItems = [], categoryFeeMap = {}) =>
  (Array.isArray(cartItems) ? cartItems : []).reduce(
    (maxFee, item) => Math.max(maxFee, resolveInheritedRate(item, categoryFeeMap)),
    0,
  );
