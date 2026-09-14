import { ValidationError } from '../../../core/auth/errors.js';
import { RETURN_STATUSES, buildReturnItemKey } from './return.helpers.js';

export const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const toPaise = (value) => Math.round((Number(value) || 0) * 100);

export const fromPaise = (paise) => roundMoney(paise / 100);

/**
 * Largest-remainder (Hamilton) distribution — totals always match exactly in paise.
 */
export const distributeProRataPaise = (totalAmount, weights = []) => {
  const paiseTotal = Math.max(0, toPaise(totalAmount));
  if (!weights.length || paiseTotal <= 0) {
    return weights.map(() => 0);
  }

  const weightSum = weights.reduce((sum, weight) => sum + Math.max(0, Number(weight) || 0), 0);
  if (weightSum <= 0) {
    return weights.map(() => 0);
  }

  const exact = weights.map((weight) => (Math.max(0, Number(weight) || 0) / weightSum) * paiseTotal);
  const floors = exact.map((value) => Math.floor(value));
  let remainder = paiseTotal - floors.reduce((sum, value) => sum + value, 0);

  const ranked = exact
    .map((value, index) => ({ index, remainder: value - floors[index] }))
    .sort((a, b) => b.remainder - a.remainder);

  for (let i = 0; i < remainder; i += 1) {
    floors[ranked[i % ranked.length].index] += 1;
  }

  return floors.map((value) => value / 100);
};

export const calculateQuickItemsSubtotal = (quickItems = []) =>
  quickItems.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0,
  );

export const resolveOrderCouponTotal = (orderPricing = {}) =>
  roundMoney(Number(orderPricing?.discount || 0));

export const resolveOrderTaxTotal = (orderPricing = {}) =>
  roundMoney(Number(orderPricing?.tax || orderPricing?.gst || 0));

export const resolveCustomerPaidAmount = (order = {}) => {
  const pricingTotal = roundMoney(Number(order?.pricing?.total || 0));
  if (pricingTotal > 0) return pricingTotal;

  const paymentDue = roundMoney(Number(order?.payment?.amountDue || 0));
  if (paymentDue > 0) return paymentDue;

  const pricing = order?.pricing || {};
  return roundMoney(
    Math.max(
      0,
      Number(pricing.subtotal || 0) +
        Number(pricing.deliveryFee || 0) +
        Number(pricing.platformFee || 0) +
        Number(pricing.packagingFee || pricing.packingFee || 0) +
        Number(pricing.tax || pricing.gst || 0) -
        Number(pricing.discount || 0),
    ),
  );
};

export const buildPriorReturnedQuantityMap = (returnDocs = []) => {
  const map = new Map();

  returnDocs.forEach((returnDoc) => {
    const cumulative = Array.isArray(returnDoc?.cumulativeReturnItems)
      ? returnDoc.cumulativeReturnItems
      : [];

    if (cumulative.length) {
      cumulative.forEach((item) => {
        const key = String(item.itemId || item.productId || '').trim();
        if (!key) return;
        map.set(key, (map.get(key) || 0) + Number(item.returnedQty || 0));
      });
      return;
    }

    if (returnDoc?.returnStatus === RETURN_STATUSES.REFUND_COMPLETED) {
      (returnDoc.returnItems || []).forEach((item) => {
        const key = String(item.itemId || item.productId || '').trim();
        if (!key) return;
        const qty = Number(item.returnedQty ?? item.quantity ?? 0);
        map.set(key, (map.get(key) || 0) + qty);
      });
    }
  });

  return map;
};

export const buildPriorCumulativeFinance = (returnDoc = null, order = {}) => {
  const orderCouponTotal = resolveOrderCouponTotal(order?.pricing || {});
  const orderTaxTotal = resolveOrderTaxTotal(order?.pricing || {});
  const orderPaidTotal = resolveCustomerPaidAmount(order);

  const cumulative = Array.isArray(returnDoc?.cumulativeReturnItems)
    ? returnDoc.cumulativeReturnItems
    : [];

  let totalRefundedAmount = 0;
  let totalCouponRefunded = 0;
  let totalTaxRefunded = 0;

  if (cumulative.length) {
    cumulative.forEach((item) => {
      totalRefundedAmount += Number(item.refundAmount || 0);
      totalCouponRefunded += Number(item.couponShare || 0);
      totalTaxRefunded += Number(item.taxShare || 0);
    });
  } else if (returnDoc?.returnStatus === RETURN_STATUSES.REFUND_COMPLETED) {
    (returnDoc.returnItems || []).forEach((item) => {
      totalRefundedAmount += Number(item.refundAmount || 0);
      totalCouponRefunded += Number(item.couponShare || 0);
      totalTaxRefunded += Number(item.taxShare || 0);
    });
  }

  const storedPricing = returnDoc?.pricing || {};
  if (Number(storedPricing.totalCouponRefunded || 0) > totalCouponRefunded) {
    totalCouponRefunded = Number(storedPricing.totalCouponRefunded || 0);
  }
  if (Number(storedPricing.totalTaxRefunded || 0) > totalTaxRefunded) {
    totalTaxRefunded = Number(storedPricing.totalTaxRefunded || 0);
  }
  if (Number(storedPricing.totalRefundedAmount || 0) > totalRefundedAmount) {
    totalRefundedAmount = Number(storedPricing.totalRefundedAmount || 0);
  }

  totalRefundedAmount = roundMoney(totalRefundedAmount);
  totalCouponRefunded = roundMoney(Math.min(totalCouponRefunded, orderCouponTotal));
  totalTaxRefunded = roundMoney(Math.min(totalTaxRefunded, orderTaxTotal));

  return {
    totalRefundedAmount,
    totalCouponRefunded,
    totalTaxRefunded,
    remainingCouponAmount: roundMoney(Math.max(0, orderCouponTotal - totalCouponRefunded)),
    remainingTaxAmount: roundMoney(Math.max(0, orderTaxTotal - totalTaxRefunded)),
    remainingRefundableAmount: roundMoney(Math.max(0, orderPaidTotal - totalRefundedAmount)),
    orderCouponTotal,
    orderTaxTotal,
    orderPaidTotal,
  };
};

const willFullyReturnOrder = (quickItems, priorReturnedMap, requestedItems) => {
  const selectedKeys = new Set();
  requestedItems.forEach((item) => {
    const key = String(item?.itemId || '').trim();
    if (key) selectedKeys.add(key);
  });

  return quickItems.every((item) => {
    const key = buildReturnItemKey(item);
    if (!key) return true;
    const ordered = Number(item.quantity || 0);
    const prior = Number(priorReturnedMap.get(key) || 0);
    const remaining = ordered - prior;
    if (remaining <= 0) return true;
    return selectedKeys.has(key);
  });
};

const resolveRequestedReturnKey = (requested = {}, quickItems = []) => {
  const raw = String(requested?.itemId || requested?.productId || '').trim();
  if (!raw) return '';
  if (quickItems.some((item) => buildReturnItemKey(item) === raw)) return raw;

  const productId = raw.split('::')[0];
  const matches = quickItems.filter((item) => {
    const itemProductId = String(item?.itemId || item?.productId || '').trim().split('::')[0];
    return itemProductId === productId;
  });
  if (matches.length === 1) return buildReturnItemKey(matches[0]);
  if (matches.length > 1) {
    const variant = String(requested?.variantName || requested?.variantId || requested?.variantKey || '').trim();
    const byVariant = matches.find(
      (item) => String(item?.variantName || '').trim() === variant,
    );
    if (byVariant) return buildReturnItemKey(byVariant);
    throw new ValidationError('variantName is required when this product has multiple variants on the order');
  }
  return raw;
};

export const normalizeReturnRequestItems = (requestedItems = [], quickItems = [], priorReturnedMap = new Map()) => {
  const availableMap = new Map();
  quickItems.forEach((item) => {
    const key = buildReturnItemKey(item);
    if (!key) return;
    availableMap.set(key, Number(item.quantity || 0));
  });

  const seen = new Set();
  const normalized = [];

  requestedItems.forEach((requested) => {
    const key = resolveRequestedReturnKey(requested, quickItems);
    if (!key || seen.has(key)) return;
    seen.add(key);

    if (!availableMap.has(key)) {
      throw new ValidationError(`Item ${key} is not eligible for return on this order`);
    }

    const orderedQty = availableMap.get(key);
    const priorReturnedQty = Number(priorReturnedMap.get(key) || 0);
    const remainingQty = Math.max(0, orderedQty - priorReturnedQty);
    if (remainingQty <= 0) {
      throw new ValidationError(`Item ${key} has no remaining returnable quantity`);
    }

    const requestedQty = Number(requested?.quantity ?? requested?.returnedQty ?? remainingQty);
    if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
      throw new ValidationError(`Return quantity for ${key} must be greater than 0`);
    }
    const returnedQty = Math.floor(requestedQty);
    if (returnedQty > remainingQty) {
      throw new ValidationError(
        `Return quantity for ${key} cannot exceed remaining returnable quantity (${remainingQty})`,
      );
    }

    normalized.push({ itemId: key, quantity: returnedQty });
  });

  if (!normalized.length) {
    throw new ValidationError('At least one return item is required');
  }

  return normalized;
};

const applyRefundCapToItems = (items, maxRefundAmount) => {
  const safeMax = roundMoney(Math.max(0, maxRefundAmount));
  const currentTotal = roundMoney(items.reduce((sum, item) => sum + Number(item.refundAmount || 0), 0));
  if (currentTotal <= safeMax) return items;

  const refundWeights = items.map((item) => Number(item.refundAmount || 0));
  const cappedRefunds = distributeProRataPaise(safeMax, refundWeights);

  return items.map((item, index) => ({
    ...item,
    refundAmount: cappedRefunds[index],
  }));
};

export const buildCumulativePricingSnapshot = ({
  order,
  priorFinance,
  currentCycle,
}) => {
  const projectedRefunded = roundMoney(
    Number(priorFinance.totalRefundedAmount || 0) + Number(currentCycle.finalRefundAmount || 0),
  );
  const projectedCoupon = roundMoney(
    Number(priorFinance.totalCouponRefunded || 0) + Number(currentCycle.couponShare || 0),
  );
  const projectedTax = roundMoney(
    Number(priorFinance.totalTaxRefunded || 0) + Number(currentCycle.taxShare || 0),
  );

  return {
    ...currentCycle,
    orderCouponTotal: priorFinance.orderCouponTotal,
    orderTaxTotal: priorFinance.orderTaxTotal,
    orderPaidTotal: priorFinance.orderPaidTotal,
    totalRefundedAmount: projectedRefunded,
    totalCouponRefunded: roundMoney(Math.min(projectedCoupon, priorFinance.orderCouponTotal)),
    totalTaxRefunded: roundMoney(Math.min(projectedTax, priorFinance.orderTaxTotal)),
    remainingCouponAmount: roundMoney(
      Math.max(0, priorFinance.orderCouponTotal - projectedCoupon),
    ),
    remainingTaxAmount: roundMoney(Math.max(0, priorFinance.orderTaxTotal - projectedTax)),
    remainingRefundableAmount: roundMoney(
      Math.max(0, priorFinance.orderPaidTotal - projectedRefunded),
    ),
  };
};

export const buildReturnItemsWithRefundCalculation = ({
  order,
  quickItems,
  requestedItems,
  priorReturnedMap = new Map(),
  existingReturnDoc = null,
}) => {
  const orderPricing = order?.pricing || {};
  const orderItemsSubtotal = calculateQuickItemsSubtotal(quickItems);
  const priorFinance = buildPriorCumulativeFinance(existingReturnDoc, order);

  const availableMap = new Map();
  quickItems.forEach((item) => {
    const key = buildReturnItemKey(item);
    if (!key) return;
    availableMap.set(key, (availableMap.get(key) || 0) + Number(item.quantity || 0));
  });

  const draftItems = [];
  requestedItems.forEach((requested) => {
    const key = String(requested?.itemId || '').trim();
    if (!key) {
      throw new ValidationError('Each return item must include a valid itemId');
    }
    if (!availableMap.has(key)) {
      throw new ValidationError(`Item ${key} is not eligible for return on this order`);
    }

    const orderedQty = availableMap.get(key);
    const priorReturnedQty = Number(priorReturnedMap.get(key) || 0);
    const remainingBefore = orderedQty - priorReturnedQty;
    const requestedQty = Number(requested?.quantity ?? requested?.returnedQty ?? remainingBefore);
    if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
      throw new ValidationError(`Return quantity for ${key} must be greater than 0`);
    }
    const returnedQty = Math.floor(requestedQty);
    if (returnedQty > remainingBefore) {
      throw new ValidationError(
        `Return quantity for ${key} cannot exceed remaining returnable quantity (${remainingBefore})`,
      );
    }

    const orderItem = quickItems.find((item) => buildReturnItemKey(item) === key) || {};
    draftItems.push({
      key,
      orderItem,
      returnedQty,
      orderedQty,
      priorReturnedQty,
      unitPrice: roundMoney(Number(orderItem?.price || 0)),
      itemGross: roundMoney(Number(orderItem?.price || 0) * returnedQty),
      remainingQty: Math.max(0, orderedQty - priorReturnedQty - returnedQty),
    });
  });

  if (!draftItems.length) {
    throw new ValidationError('At least one return item is required');
  }

  const cycleGross = roundMoney(draftItems.reduce((sum, item) => sum + item.itemGross, 0));
  const grossWeights = draftItems.map((item) => item.itemGross);
  const fullyReturning = willFullyReturnOrder(quickItems, priorReturnedMap, requestedItems);

  let cycleCoupon = fullyReturning
    ? priorFinance.remainingCouponAmount
    : roundMoney(
        Math.min(
          priorFinance.remainingCouponAmount,
          orderItemsSubtotal > 0 ? (cycleGross / orderItemsSubtotal) * priorFinance.orderCouponTotal : 0,
        ),
      );

  let cycleTax = fullyReturning
    ? priorFinance.remainingTaxAmount
    : roundMoney(
        Math.min(
          priorFinance.remainingTaxAmount,
          orderItemsSubtotal > 0 ? (cycleGross / orderItemsSubtotal) * priorFinance.orderTaxTotal : 0,
        ),
      );

  const couponShares = distributeProRataPaise(cycleCoupon, grossWeights);
  const taxShares = distributeProRataPaise(cycleTax, grossWeights);

  let normalized = draftItems.map((draft, index) => ({
    itemId: draft.key,
    productId: String(draft.orderItem?.itemId || draft.key),
    variantId: String(draft.orderItem?.variantName || draft.orderItem?.notes || '').trim(),
    name: draft.orderItem?.name || draft.key,
    quantity: draft.returnedQty,
    returnedQty: draft.returnedQty,
    orderedQty: draft.orderedQty,
    remainingQty: draft.remainingQty,
    price: draft.unitPrice,
    unitPrice: draft.unitPrice,
    discountShare: 0,
    couponShare: couponShares[index],
    taxShare: taxShares[index],
    refundAmount: roundMoney(
      Math.max(0, draft.itemGross - couponShares[index] + taxShares[index]),
    ),
  }));

  const uncappedRefundTotal = roundMoney(
    normalized.reduce((sum, item) => sum + Number(item.refundAmount || 0), 0),
  );
  const maxCycleRefund = roundMoney(
    Math.min(uncappedRefundTotal, priorFinance.remainingRefundableAmount),
  );
  if (maxCycleRefund < uncappedRefundTotal) {
    normalized = applyRefundCapToItems(normalized, maxCycleRefund);
  }

  const currentCycle = {
    subtotal: roundMoney(normalized.reduce((sum, item) => sum + item.unitPrice * item.returnedQty, 0)),
    couponShare: roundMoney(normalized.reduce((sum, item) => sum + item.couponShare, 0)),
    taxShare: roundMoney(normalized.reduce((sum, item) => sum + item.taxShare, 0)),
    discountShare: 0,
    deliveryFeeRefunded: 0,
    platformFeeRefunded: 0,
    finalRefundAmount: roundMoney(normalized.reduce((sum, item) => sum + item.refundAmount, 0)),
  };

  const pricing = buildCumulativePricingSnapshot({
    order,
    priorFinance,
    currentCycle,
  });

  return {
    returnItems: normalized,
    pricing,
    returnRefundAmount: pricing.finalRefundAmount,
    priorFinance,
  };
};

export const hasReturnableQuantityRemaining = (quickItems = [], priorReturnedMap = new Map()) => {
  for (const item of quickItems) {
    const key = buildReturnItemKey(item);
    if (!key) continue;
    const ordered = Number(item.quantity || 0);
    const prior = Number(priorReturnedMap.get(key) || 0);
    if (ordered - prior > 0) return true;
  }
  return false;
};

export const appendCumulativeReturnItems = (returnDoc, order = null) => {
  if (!returnDoc) return returnDoc;
  if (!Array.isArray(returnDoc.cumulativeReturnItems)) returnDoc.cumulativeReturnItems = [];

  (returnDoc.returnItems || []).forEach((item) => {
    returnDoc.cumulativeReturnItems.push({
      itemId: String(item.itemId || item.productId || '').trim(),
      productId: String(item.productId || item.itemId || '').trim(),
      variantId: String(item.variantId || '').trim(),
      returnedQty: Number(item.returnedQty ?? item.quantity ?? 0),
      refundAmount: roundMoney(item.refundAmount ?? item.price * (item.returnedQty ?? item.quantity ?? 0)),
      couponShare: roundMoney(item.couponShare || 0),
      taxShare: roundMoney(item.taxShare || 0),
      completedAt: new Date(),
    });
  });

  if (order) {
    const finance = buildPriorCumulativeFinance(returnDoc, order);
    returnDoc.pricing = {
      ...(returnDoc.pricing || {}),
      subtotal: roundMoney(Number(returnDoc.pricing?.subtotal || 0)),
      couponShare: roundMoney(
        (returnDoc.returnItems || []).reduce((sum, row) => sum + Number(row.couponShare || 0), 0),
      ),
      taxShare: roundMoney(
        (returnDoc.returnItems || []).reduce((sum, row) => sum + Number(row.taxShare || 0), 0),
      ),
      finalRefundAmount: roundMoney(Number(returnDoc.returnRefundAmount || 0)),
      orderCouponTotal: finance.orderCouponTotal,
      orderTaxTotal: finance.orderTaxTotal,
      orderPaidTotal: finance.orderPaidTotal,
      totalRefundedAmount: finance.totalRefundedAmount,
      totalCouponRefunded: finance.totalCouponRefunded,
      totalTaxRefunded: finance.totalTaxRefunded,
      remainingCouponAmount: finance.remainingCouponAmount,
      remainingTaxAmount: finance.remainingTaxAmount,
      remainingRefundableAmount: finance.remainingRefundableAmount,
    };
  }

  return returnDoc;
};

export const deriveRemainingQtyByItem = (quickItems = [], priorReturnedMap = new Map()) => {
  const remaining = {};
  quickItems.forEach((item) => {
    const key = buildReturnItemKey(item);
    if (!key) return;
    const ordered = Number(item.quantity || 0);
    const prior = Number(priorReturnedMap.get(key) || 0);
    remaining[key] = Math.max(0, ordered - prior);
  });
  return remaining;
};
