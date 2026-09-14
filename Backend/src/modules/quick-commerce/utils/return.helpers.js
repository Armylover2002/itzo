import mongoose from 'mongoose';
import crypto from 'crypto';
import {
  isGenericCustomerLabel,
  resolveQuickOrderCustomer,
} from './customer.helpers.js';

export const RETURN_STATUSES = {
  REQUESTED: 'return_requested',
  APPROVED: 'return_approved',
  REJECTED: 'return_rejected',
  PICKUP_ASSIGNED: 'return_pickup_assigned',
  IN_TRANSIT: 'return_in_transit',
  RETURNED: 'returned',
  REFUND_COMPLETED: 'refund_completed',
  CANCELLED: 'return_cancelled',
};

export const TERMINAL_RETURN_STATUSES = new Set([
  RETURN_STATUSES.REJECTED,
  RETURN_STATUSES.REFUND_COMPLETED,
  RETURN_STATUSES.CANCELLED,
]);

export const ACTIVE_RETURN_STATUSES = new Set([
  RETURN_STATUSES.REQUESTED,
  RETURN_STATUSES.APPROVED,
  RETURN_STATUSES.PICKUP_ASSIGNED,
  RETURN_STATUSES.IN_TRANSIT,
  RETURN_STATUSES.RETURNED,
]);

export const REFUND_METHODS = new Set(['wallet', 'upi', 'bank']);

export const REFUND_STATUSES = {
  NONE: 'none',
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const RETURN_HISTORY_ROLES = new Set([
  'USER',
  'SELLER',
  'ADMIN',
  'DELIVERY_PARTNER',
  'SYSTEM',
]);

export const DEFAULT_RETURN_WINDOW_HOURS = 72;

export const generateReturnOtp = () => String(crypto.randomInt(1000, 9999));

/** calculatedPickupCharge → riderEarning → legacy returnDeliveryCommission */
export const resolveReturnPickupCharge = (returnDoc = {}) => {
  const calculated = Number(returnDoc?.calculatedPickupCharge || 0);
  if (calculated > 0) return calculated;
  const rider = Number(returnDoc?.riderEarning || 0);
  if (rider > 0) return rider;
  return Number(returnDoc?.returnDeliveryCommission || 0);
};

export const normalizeRefundMethod = (value) => String(value || '').trim().toLowerCase();

export const formatRefundMethodLabel = (method) => {
  const normalized = normalizeRefundMethod(method);
  if (normalized === 'wallet') return 'Wallet';
  if (normalized === 'bank') return 'Bank';
  if (normalized === 'upi') return 'UPI';
  return method ? String(method) : 'Not selected';
};

export const formatRefundStatusLabel = (status) => {
  const normalized = String(status || REFUND_STATUSES.NONE).trim().toLowerCase();
  if (normalized === 'none') return 'Not started';
  if (normalized === 'pending') return 'Pending';
  if (normalized === 'processing') return 'Processing';
  if (normalized === 'completed') return 'Completed';
  if (normalized === 'failed') return 'Failed';
  return normalized;
};

export const isQuickCommerceOrderType = (orderType) => ['quick', 'mixed'].includes(String(orderType || '').toLowerCase());

export const isDeliveredOrder = (order) => {
  const status = String(order?.orderStatus || '').toLowerCase();
  const workflow = String(order?.workflowStatus || '').toUpperCase();
  return status === 'delivered' || workflow === 'DELIVERED';
};

export const resolveOrderDeliveredAt = (order, sellerOrders = []) => {
  const fromDeliveryState = order?.deliveryState?.deliveredAt;
  if (fromDeliveryState) return new Date(fromDeliveryState);

  const sellerDelivered = (sellerOrders || [])
    .map((leg) => leg?.deliveredAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  if (sellerDelivered) return new Date(sellerDelivered);

  if (isDeliveredOrder(order) && order?.updatedAt) {
    return new Date(order.updatedAt);
  }

  return null;
};

export const isWithinReturnWindow = (deliveredAt, windowHours = DEFAULT_RETURN_WINDOW_HOURS) => {
  if (!deliveredAt) return false;
  const hours = Number(windowHours);
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_RETURN_WINDOW_HOURS;
  const deadline = new Date(deliveredAt).getTime() + safeHours * 60 * 60 * 1000;
  return Date.now() <= deadline;
};

export const computeReturnExpiryAt = (deliveredAt, windowHours = DEFAULT_RETURN_WINDOW_HOURS) => {
  if (!deliveredAt) return null;
  const hours = Number(windowHours);
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_RETURN_WINDOW_HOURS;
  return new Date(new Date(deliveredAt).getTime() + safeHours * 60 * 60 * 1000);
};

export const buildReturnEligibilityMeta = ({
  order,
  sellerOrders = [],
  returnPolicy = {},
  itemEligibility = null,
  now = Date.now(),
}) => {
  const returnsEnabled = returnPolicy?.returnsEnabled !== false;
  const returnWindowHours = Number(returnPolicy?.returnWindowHours) || DEFAULT_RETURN_WINDOW_HOURS;
  const isQc = isQuickCommerceOrderType(order?.orderType);
  const delivered = isDeliveredOrder(order);
  const quickItems = getQuickItemsFromOrder(order);
  const deliveredAt = resolveOrderDeliveredAt(order, sellerOrders);
  const returnExpiryAt = computeReturnExpiryAt(deliveredAt, returnWindowHours);
  const expiryMs = returnExpiryAt ? returnExpiryAt.getTime() : 0;
  const remainingSeconds =
    deliveredAt && returnExpiryAt ? Math.max(0, Math.floor((expiryMs - now) / 1000)) : 0;
  const returnWindowExpired = Boolean(deliveredAt && remainingSeconds <= 0);

  const itemRows =
    itemEligibility && typeof itemEligibility === 'object'
      ? Object.values(itemEligibility).filter(Boolean)
      : [];
  const anyItemCanReturn = itemRows.length
    ? itemRows.some((row) => row.canReturn)
    : null;

  const canReturn = Boolean(
    isQc &&
      delivered &&
      quickItems.length > 0 &&
      deliveredAt &&
      (anyItemCanReturn === null
        ? returnsEnabled && !returnWindowExpired
        : anyItemCanReturn),
  );

  return {
    canReturn,
    returnsEnabled,
    returnWindowHours,
    returnExpiryAt: returnExpiryAt ? returnExpiryAt.toISOString() : null,
    deliveredAt: deliveredAt ? new Date(deliveredAt).toISOString() : null,
    remainingSeconds,
    remainingHours: Math.floor(remainingSeconds / 3600),
    returnWindowExpired: anyItemCanReturn === false ? true : returnWindowExpired,
    ...(itemEligibility && typeof itemEligibility === 'object' ? { itemEligibility } : {}),
  };
};

export const getQuickItemsFromOrder = (order) =>
  (Array.isArray(order?.items) ? order.items : []).filter((item) => String(item?.type || '').toLowerCase() === 'quick');

export const groupQuickItemsBySeller = (quickItems = []) => {
  // @deprecated for current policy — ONE ORDER = ONE SELLER. Kept for backward-compatible reads.
  const buckets = new Map();
  quickItems.forEach((item) => {
    const sellerId = String(item?.sourceId || '').trim();
    if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) return;
    if (!buckets.has(sellerId)) buckets.set(sellerId, []);
    buckets.get(sellerId).push(item);
  });
  return buckets;
};

export const buildReturnItemKey = (item) => {
  const productId = String(item?.itemId || item?.productId || '').trim().split('::')[0];
  // QC order lines persist variant as variantName (notes is a copy). No orderItemId/variantId on schema.
  const variant = String(
    item?.variantName || item?.variantId || item?.variantKey || item?.notes || '',
  ).trim();
  if (!productId) return String(item?.name || '').trim();
  return variant ? `${productId}::${variant}` : productId;
};

export const normalizeReturnItemForResponse = (item = {}) => {
  const returnedQty = Number(item.returnedQty ?? item.quantity ?? 0);
  const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
  const orderedQty = Number(item.orderedQty ?? item.quantity ?? returnedQty);
  return {
    itemId: item.itemId || '',
    productId: item.productId || item.itemId || '',
    variantId: item.variantId || '',
    name: item.name || '',
    quantity: returnedQty,
    returnedQty,
    orderedQty,
    remainingQty: Number(item.remainingQty ?? Math.max(0, orderedQty - returnedQty)),
    price: unitPrice,
    unitPrice,
    discountShare: Number(item.discountShare || 0),
    couponShare: Number(item.couponShare || 0),
    taxShare: Number(item.taxShare || 0),
    refundAmount: Number(
      item.refundAmount ?? roundMoney(unitPrice * returnedQty),
    ),
  };
};

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const normalizeReturnPricingForResponse = (returnDoc = {}) => {
  const pricing = returnDoc?.pricing || {};
  const returnItems = Array.isArray(returnDoc?.returnItems) ? returnDoc.returnItems : [];
  const itemRefundSubtotal = roundMoney(
    returnItems.reduce((sum, item) => sum + Number(item.refundAmount ?? 0), 0),
  );
  const fallbackSubtotal = roundMoney(
    returnItems.reduce(
      (sum, item) => sum + Number(item.unitPrice ?? item.price ?? 0) * Number(item.returnedQty ?? item.quantity ?? 0),
      0,
    ),
  );

  const orderCouponTotal = Number(
    pricing.orderCouponTotal ?? returnDoc?.refundPricing?.orderCouponTotal ?? 0,
  );
  const orderTaxTotal = Number(
    pricing.orderTaxTotal ?? returnDoc?.refundPricing?.orderTaxTotal ?? 0,
  );
  const orderPaidTotal = Number(
    pricing.orderPaidTotal ?? returnDoc?.refundPricing?.orderPaidTotal ?? 0,
  );

  return {
    subtotal: Number(pricing.subtotal ?? fallbackSubtotal),
    couponShare: Number(pricing.couponShare || 0),
    taxShare: Number(pricing.taxShare || 0),
    discountShare: Number(pricing.discountShare || 0),
    deliveryFeeRefunded: Number(pricing.deliveryFeeRefunded || 0),
    platformFeeRefunded: Number(pricing.platformFeeRefunded || 0),
    deliveryFeeRetained: Number(
      pricing.deliveryFeeRetained ??
        Math.max(0, Number(pricing.orderDeliveryFee || 0) - Number(pricing.deliveryFeeRefunded || 0)),
    ),
    platformFeeRetained: Number(
      pricing.platformFeeRetained ??
        Math.max(0, Number(pricing.orderPlatformFee || 0) - Number(pricing.platformFeeRefunded || 0)),
    ),
    orderDeliveryFee: Number(pricing.orderDeliveryFee || 0),
    orderPlatformFee: Number(pricing.orderPlatformFee || 0),
    finalRefundAmount: Number(
      pricing.finalRefundAmount ?? returnDoc?.returnRefundAmount ?? itemRefundSubtotal,
    ),
    pickupFee: resolveReturnPickupCharge(returnDoc),
    orderCouponTotal,
    orderTaxTotal,
    orderPaidTotal,
    totalRefundedAmount: Number(pricing.totalRefundedAmount || 0),
    totalCouponRefunded: Number(pricing.totalCouponRefunded || 0),
    totalTaxRefunded: Number(pricing.totalTaxRefunded || 0),
    remainingCouponAmount: Number(pricing.remainingCouponAmount ?? Math.max(0, orderCouponTotal - Number(pricing.totalCouponRefunded || 0))),
    remainingTaxAmount: Number(pricing.remainingTaxAmount ?? Math.max(0, orderTaxTotal - Number(pricing.totalTaxRefunded || 0))),
    remainingRefundableAmount: Number(
      pricing.remainingRefundableAmount ?? Math.max(0, orderPaidTotal - Number(pricing.totalRefundedAmount || 0)),
    ),
  };
};

export const extractPayoutDetailsFromReturn = (returnDoc) => {
  const history = Array.isArray(returnDoc?.returnHistory) ? returnDoc.returnHistory : [];
  const requestEntry = history.find((entry) => entry?.action === 'RETURN_REQUESTED');
  return requestEntry?.metadata?.payoutDetails || {};
};

export const maskAccountNumber = (accountNumber = '') => {
  const normalized = String(accountNumber || '').replace(/\s/g, '');
  if (!normalized) return '';
  if (normalized.length <= 4) return '****';
  return `${'*'.repeat(Math.min(normalized.length - 4, 8))}${normalized.slice(-4)}`;
};

export const sanitizeRefundAuditMetadata = (metadata = {}) => {
  if (!metadata || typeof metadata !== 'object') return {};
  const next = { ...metadata };
  if (next.payoutDetails && typeof next.payoutDetails === 'object') {
    const payoutDetails = { ...next.payoutDetails };
    const accountNumber = String(payoutDetails.accountNumber || payoutDetails.accountNo || '').trim();
    if (accountNumber) {
      const masked = maskAccountNumber(accountNumber);
      payoutDetails.accountNumber = masked;
      if (payoutDetails.accountNo) payoutDetails.accountNo = masked;
    }
    next.payoutDetails = payoutDetails;
  }
  return next;
};

export const serializePayoutDetailsForDisplay = (returnDoc, { maskSensitive = false } = {}) => {
  const raw = extractPayoutDetailsFromReturn(returnDoc);
  const method = normalizeRefundMethod(returnDoc?.refundMethod);
  if (method === 'wallet') return null;

  const accountNumber = String(raw.accountNumber || raw.accountNo || '').trim();
  const upiId = String(raw.upiId || raw.vpa || '').trim();
  const accountHolderName = String(
    raw.accountHolderName || raw.holderName || raw.name || '',
  ).trim();
  const ifsc = String(raw.ifsc || raw.ifscCode || '').trim().toUpperCase();
  const bankName = String(raw.bankName || raw.bank || '').trim();

  if (!accountHolderName && !accountNumber && !upiId && !ifsc && !bankName) {
    return null;
  }

  return {
    method,
    accountHolderName,
    accountNumber: maskSensitive ? maskAccountNumber(accountNumber) : accountNumber,
    accountNumberMasked: maskAccountNumber(accountNumber),
    ifsc,
    bankName,
    upiId: maskSensitive && upiId.length > 4 ? `${upiId.slice(0, 2)}***${upiId.slice(-2)}` : upiId,
    upiIdMasked: upiId.length > 4 ? `${upiId.slice(0, 2)}***${upiId.slice(-2)}` : upiId,
  };
};

export const serializePickupImageEntriesForResponse = (returnDoc) => {
  const entries = Array.isArray(returnDoc?.pickupImageEntries) ? returnDoc.pickupImageEntries : [];
  if (entries.length) {
    return entries
      .map((entry) => ({
        url: entry?.url || entry?.imageUrl || '',
        uploadedAt: entry?.uploadedAt || entry?.at || null,
        uploadedByRole: entry?.uploadedByRole || 'DELIVERY_PARTNER',
        uploadedById: entry?.uploadedBy ? String(entry.uploadedBy) : null,
        metadata: entry?.metadata || {},
      }))
      .filter((row) => row.url);
  }

  const images = Array.isArray(returnDoc?.pickupImages) ? returnDoc.pickupImages : [];
  return images.map((url, idx) => ({
    url,
    uploadedAt: null,
    uploadedByRole: 'DELIVERY_PARTNER',
    uploadedById: null,
    metadata: { fallbackIndex: idx },
  }));
};

export const resolveReturnLifecycleLabel = (returnDoc = {}) => {
  const status = String(returnDoc?.returnStatus || '').trim();
  const refundStatus = String(returnDoc?.refundStatus || REFUND_STATUSES.NONE).trim().toLowerCase();
  const deliveryStatus = String(returnDoc?.deliveryState?.status || '').trim();
  const quality = String(returnDoc?.qualityCheck?.status || '').trim();
  const dispatchStatus = String(returnDoc?.dispatch?.status || '').trim();

  if (status === RETURN_STATUSES.REJECTED) return 'Rejected';
  if (status === RETURN_STATUSES.CANCELLED) return 'Cancelled';
  if (refundStatus === 'failed') return 'Refund Failed';
  if (refundStatus === 'completed' || status === RETURN_STATUSES.REFUND_COMPLETED) return 'Refund Completed';
  if (refundStatus === 'processing') return 'Refund Processing';
  if (refundStatus === 'pending') return 'Refund Pending';
  if (quality === 'passed' && refundStatus === REFUND_STATUSES.NONE) return 'Quality Check Passed';
  if (status === RETURN_STATUSES.RETURNED) return 'Quality Check';
  if (deliveryStatus === 'picked_up' || deliveryStatus === 'reached_drop') return 'Pickup Completed';
  if (status === RETURN_STATUSES.IN_TRANSIT) return 'Pickup In Progress';
  if (status === RETURN_STATUSES.PICKUP_ASSIGNED) {
    return dispatchStatus === 'accepted' ? 'Pickup In Progress' : 'Pickup Assigned';
  }
  if (status === RETURN_STATUSES.APPROVED) return 'Approved';
  if (status === RETURN_STATUSES.REQUESTED) return 'Requested';
  return status || 'Unknown';
};

export const RETURN_TIMELINE_STEPS = [
  { id: 'return_requested', label: 'Return Requested' },
  { id: 'return_approved', label: 'Approved' },
  { id: 'return_pickup_assigned', label: 'Pickup Assigned' },
  { id: 'return_in_transit', label: 'Rider Coming' },
  { id: 'picked_up', label: 'Picked Up' },
  { id: 'reached_seller', label: 'Reached Seller' },
  { id: 'quality_check', label: 'Quality Check' },
  { id: 'refund_processing', label: 'Refund Processing' },
  { id: 'refund_completed', label: 'Refund Completed' },
];

const normalizeRefundStatusValue = (value) =>
  String(value || REFUND_STATUSES.NONE).trim().toLowerCase();

export const isReturnRefundSettled = (returnDoc = {}) => {
  const refundStatus = normalizeRefundStatusValue(returnDoc?.refundStatus);
  const returnStatus = String(returnDoc?.returnStatus || '').trim();
  return refundStatus === REFUND_STATUSES.COMPLETED || returnStatus === RETURN_STATUSES.REFUND_COMPLETED;
};

/** Refund-phase steps follow refundStatus / returnStatus — same source as Refund Details card. */
export const applyRefundTimelineGuards = (returnDoc = {}, steps = []) => {
  if (!Array.isArray(steps) || !steps.length) return [];

  const refundStatus = normalizeRefundStatusValue(returnDoc?.refundStatus);
  const returnStatus = String(returnDoc?.returnStatus || '').trim();

  if (refundStatus === REFUND_STATUSES.COMPLETED || returnStatus === RETURN_STATUSES.REFUND_COMPLETED) {
    return steps.map((step) => ({ ...step, status: 'completed' }));
  }

  if (refundStatus === REFUND_STATUSES.PENDING || refundStatus === REFUND_STATUSES.PROCESSING) {
    return steps.map((step) => {
      if (step.id === 'quality_check') return { ...step, status: 'completed' };
      if (step.id === 'refund_processing') return { ...step, status: 'active' };
      if (step.id === 'refund_completed') return { ...step, status: 'pending' };
      return step;
    });
  }

  if (refundStatus === REFUND_STATUSES.FAILED) {
    return steps.map((step) => {
      if (step.id === 'quality_check') return { ...step, status: 'completed' };
      if (step.id === 'refund_processing') return { ...step, status: 'rejected' };
      if (step.id === 'refund_completed') return { ...step, status: 'pending' };
      return step;
    });
  }

  return steps;
};

/** Refund steps follow refundStatus — same source of truth as Refund Details card. */
export const resolveReturnTimelineStepStatuses = (returnDoc = {}) => {
  const status = String(returnDoc?.returnStatus || '').trim();
  const refundStatus = normalizeRefundStatusValue(returnDoc?.refundStatus);
  const deliveryStatus = String(returnDoc?.deliveryState?.status || '').trim();
  const quality = String(returnDoc?.qualityCheck?.status || '').trim().toLowerCase();

  if (status === RETURN_STATUSES.REJECTED || status === RETURN_STATUSES.CANCELLED) {
    return RETURN_TIMELINE_STEPS.map(() => 'rejected');
  }

  if (refundStatus === REFUND_STATUSES.COMPLETED || status === RETURN_STATUSES.REFUND_COMPLETED) {
    return RETURN_TIMELINE_STEPS.map(() => 'completed');
  }

  if (refundStatus === REFUND_STATUSES.FAILED) {
    return RETURN_TIMELINE_STEPS.map((_, index) => {
      if (index < 7) return 'completed';
      if (index === 7) return 'rejected';
      return 'pending';
    });
  }

  if (refundStatus === REFUND_STATUSES.PROCESSING || refundStatus === REFUND_STATUSES.PENDING) {
    return RETURN_TIMELINE_STEPS.map((_, index) => {
      if (index < 7) return 'completed';
      if (index === 7) return 'active';
      return 'pending';
    });
  }

  let activeIndex = 0;
  if (quality === 'passed') activeIndex = 7;
  else if (status === RETURN_STATUSES.RETURNED) activeIndex = 6;
  else if (deliveryStatus === 'reached_drop') activeIndex = 5;
  else if (deliveryStatus === 'picked_up') activeIndex = 4;
  else if (status === RETURN_STATUSES.IN_TRANSIT) activeIndex = 3;
  else if (status === RETURN_STATUSES.PICKUP_ASSIGNED) activeIndex = 2;
  else if (status === RETURN_STATUSES.APPROVED) activeIndex = 1;
  else if (status === RETURN_STATUSES.REQUESTED) activeIndex = 0;

  return RETURN_TIMELINE_STEPS.map((_, index) => {
    if (index < activeIndex) return 'completed';
    if (index === activeIndex) return 'active';
    return 'pending';
  });
};

export const serializeReturnTimelineSteps = (returnDoc = {}) => {
  const statuses = resolveReturnTimelineStepStatuses(returnDoc);
  const steps = RETURN_TIMELINE_STEPS.map((step, index) => ({
    id: step.id,
    label: step.label,
    status: statuses[index],
  }));
  return applyRefundTimelineGuards(returnDoc, steps);
};

export const enrichSerializedReturnPricingFromParentOrder = (serialized, parentOrder) => {
  if (!parentOrder?.pricing) return serialized;

  const orderDeliveryFee = Number(parentOrder.pricing.deliveryFee || 0);
  const orderPlatformFee = Number(parentOrder.pricing.platformFee || 0);
  const pricing = serialized.pricing || serialized.refundPricing || {};

  const enrichedPricing = {
    ...pricing,
    orderDeliveryFee,
    orderPlatformFee,
    deliveryFeeRetained: Math.max(
      0,
      orderDeliveryFee - Number(pricing.deliveryFeeRefunded || 0),
    ),
    platformFeeRetained: Math.max(
      0,
      orderPlatformFee - Number(pricing.platformFeeRefunded || 0),
    ),
  };

  return {
    ...serialized,
    pricing: enrichedPricing,
    refundPricing: enrichedPricing,
  };
};

export const enrichSerializedReturnCustomerFromParentOrder = (serialized, parentOrder) => {
  const customer = resolveQuickOrderCustomer(parentOrder);
  const merged = mergeSellerReturnOrderContext(serialized, {
    deliveryAddress: parentOrder?.deliveryAddress,
  });

  return {
    ...merged,
    customer: {
      name: !isGenericCustomerLabel(merged.customer?.name)
        ? merged.customer.name
        : customer.name,
      phone: merged.customer?.phone || customer.phone,
      email: customer.email || '',
    },
  };
};

export const normalizeDispatchForResponse = (dispatch = {}) => ({
  modeAtCreation: dispatch.modeAtCreation || 'auto',
  status: dispatch.status || 'unassigned',
  deliveryPartnerId: dispatch.deliveryPartnerId ? String(dispatch.deliveryPartnerId) : null,
  assignedAt: dispatch.assignedAt || null,
  acceptedAt: dispatch.acceptedAt || null,
  completedAt: dispatch.completedAt || null,
  dispatchingAt: dispatch.dispatchingAt || null,
  offeredTo: Array.isArray(dispatch.offeredTo)
    ? dispatch.offeredTo.map((entry) => ({
        partnerId: entry?.partnerId ? String(entry.partnerId) : null,
        at: entry?.at || null,
        action: entry?.action || 'offered',
      }))
    : [],
});

/** Customer-safe dispatch — no rider ids or offer history. */
export const normalizeCustomerDispatchForResponse = (dispatch = {}) => ({
  status: dispatch.status || 'unassigned',
  assignedAt: dispatch.assignedAt || null,
  acceptedAt: dispatch.acceptedAt || null,
  completedAt: dispatch.completedAt || null,
});

export const serializeCustomerPickupImageEntries = (returnDoc) =>
  serializePickupImageEntriesForResponse(returnDoc).map(({ url, uploadedAt, uploadedByRole }) => ({
    url,
    uploadedAt,
    uploadedByRole,
  }));

export const serializeCustomerRefundAuditLog = (returnDoc) =>
  (Array.isArray(returnDoc?.refundAuditLog) ? returnDoc.refundAuditLog : []).map((entry) => ({
    at: entry?.at || null,
    action: entry?.action || '',
    refundStatus: entry?.refundStatus || '',
    refundMethod: entry?.refundMethod || '',
    amount: Number(entry?.amount || 0),
    refundTransactionId: entry?.refundTransactionId || '',
    refundReference: entry?.refundReference || '',
    note: entry?.note || '',
  }));

export const serializeReturnTimeline = (returnDoc) =>
  (Array.isArray(returnDoc?.returnHistory) ? returnDoc.returnHistory : [])
    .slice()
    .sort((a, b) => new Date(a?.at || 0).getTime() - new Date(b?.at || 0).getTime())
    .map((entry) => ({
      at: entry?.at || null,
      byRole: entry?.byRole || 'SYSTEM',
      byId: entry?.byId ? String(entry.byId) : null,
      action: entry?.action || '',
      fromStatus: entry?.fromStatus || '',
      toStatus: entry?.toStatus || '',
      note: entry?.note || '',
      metadata: entry?.metadata || {},
    }));

export const serializeReturnDocumentBase = (returnDoc) => ({
  id: String(returnDoc?._id || ''),
  returnId: String(returnDoc?._id || ''),
  orderId: returnDoc?.orderId || '',
  sellerId: returnDoc?.sellerId ? String(returnDoc.sellerId) : '',
  returnStatus: returnDoc?.returnStatus || '',
  refundMethod: returnDoc?.refundMethod || '',
  refundMethodLabel: formatRefundMethodLabel(returnDoc?.refundMethod),
  refundStatus: returnDoc?.refundStatus || REFUND_STATUSES.NONE,
  refundStatusLabel: formatRefundStatusLabel(returnDoc?.refundStatus),
  lifecycleLabel: resolveReturnLifecycleLabel(returnDoc),
  returnReason: returnDoc?.returnReason || '',
  returnRejectedReason: returnDoc?.returnRejectedReason || '',
  returnRequestedAt: returnDoc?.returnRequestedAt || returnDoc?.createdAt || null,
  returnItems: Array.isArray(returnDoc?.returnItems)
    ? returnDoc.returnItems.map(normalizeReturnItemForResponse)
    : [],
  returnRefundAmount: Number(returnDoc?.returnRefundAmount || 0),
  calculatedPickupCharge: resolveReturnPickupCharge(returnDoc),
  returnPickupCharge: resolveReturnPickupCharge(returnDoc),
  pickupDistanceKm: Number(returnDoc?.pickupDistanceKm || 0),
  pickupPricingBreakdown: returnDoc?.pickupPricingBreakdown || null,
  returnDeliveryCommission: Number(returnDoc?.returnDeliveryCommission || 0),
  riderEarning: resolveReturnPickupCharge(returnDoc),
  refundPricing: normalizeReturnPricingForResponse(returnDoc),
  payoutDetails: serializePayoutDetailsForDisplay(returnDoc),
  pickupImages: Array.isArray(returnDoc?.pickupImages) ? returnDoc.pickupImages : [],
  pickupImageEntries: serializePickupImageEntriesForResponse(returnDoc),
  dispatch: normalizeDispatchForResponse(returnDoc?.dispatch || {}),
  deliveryState: returnDoc?.deliveryState || {},
  qualityCheck: returnDoc?.qualityCheck || { status: 'pending' },
  qualityCheckStatus: String(returnDoc?.qualityCheck?.status || 'pending'),
  timeline: serializeReturnTimeline(returnDoc),
  timelineSteps: serializeReturnTimelineSteps(returnDoc),
  refundTransactionId: returnDoc?.refundTransactionId || '',
  refundReference: returnDoc?.refundReference || '',
  refundAuditLog: Array.isArray(returnDoc?.refundAuditLog) ? returnDoc.refundAuditLog : [],
  finance: returnDoc?.finance || {},
  updatedAt: returnDoc?.updatedAt || null,
});

/** Lean customer API response — no internal dispatch, finance, or duplicate fields. */
export const serializeReturnForCustomer = (returnDoc) => {
  const pickupCharge = resolveReturnPickupCharge(returnDoc);
  return {
    id: String(returnDoc?._id || ''),
    returnId: String(returnDoc?._id || ''),
    orderId: returnDoc?.orderId || '',
    sellerId: returnDoc?.sellerId ? String(returnDoc.sellerId) : '',
    returnStatus: returnDoc?.returnStatus || '',
    refundMethod: returnDoc?.refundMethod || '',
    refundMethodLabel: formatRefundMethodLabel(returnDoc?.refundMethod),
    refundStatus: returnDoc?.refundStatus || REFUND_STATUSES.NONE,
    refundStatusLabel: formatRefundStatusLabel(returnDoc?.refundStatus),
    lifecycleLabel: resolveReturnLifecycleLabel(returnDoc),
    returnReason: returnDoc?.returnReason || '',
    returnRejectedReason: returnDoc?.returnRejectedReason || '',
    returnRequestedAt: returnDoc?.returnRequestedAt || returnDoc?.createdAt || null,
    returnItems: Array.isArray(returnDoc?.returnItems)
      ? returnDoc.returnItems.map(normalizeReturnItemForResponse)
      : [],
    returnRefundAmount: Number(returnDoc?.returnRefundAmount || 0),
    pickupCharge,
    pickupPricingBreakdown: returnDoc?.pickupPricingBreakdown || null,
    riderEarning: pickupCharge,
    refundPricing: normalizeReturnPricingForResponse(returnDoc),
    payoutDetails: serializePayoutDetailsForDisplay(returnDoc, { maskSensitive: true }),
    pickupImageEntries: serializeCustomerPickupImageEntries(returnDoc),
    dispatch: normalizeCustomerDispatchForResponse(returnDoc?.dispatch || {}),
    qualityCheckStatus: String(returnDoc?.qualityCheck?.status || 'pending'),
    timelineSteps: serializeReturnTimelineSteps(returnDoc),
    refundTransactionId: returnDoc?.refundTransactionId || '',
    refundReference: returnDoc?.refundReference || '',
    refundAuditLog: serializeCustomerRefundAuditLog(returnDoc),
    updatedAt: returnDoc?.updatedAt || null,
  };
};

export const formatReturnDeliveryAddress = (address = {}) => {
  const line = [address?.address, address?.city].filter(Boolean).join(', ');
  return line.trim();
};

export const mergeSellerReturnOrderContext = (serialized, { sellerOrder, deliveryAddress } = {}) => {
  const resolvedAddress =
    sellerOrder?.address?.address || sellerOrder?.address?.city
      ? sellerOrder.address
      : deliveryAddress
        ? {
            address:
              [deliveryAddress?.street, deliveryAddress?.additionalDetails]
                .filter(Boolean)
                .join(', ') ||
              deliveryAddress?.address ||
              '',
            city: deliveryAddress?.city || '',
            location: deliveryAddress?.location?.coordinates
              ? {
                  lat: deliveryAddress.location.coordinates[1],
                  lng: deliveryAddress.location.coordinates[0],
                }
              : undefined,
          }
        : null;

  const snapshotName = String(serialized.customer?.name || '').trim();
  const sellerName = String(sellerOrder?.customer?.name || '').trim();
  const addressName = String(deliveryAddress?.name || '').trim();
  const customerName = !isGenericCustomerLabel(snapshotName)
    ? snapshotName
    : !isGenericCustomerLabel(sellerName)
      ? sellerName
      : !isGenericCustomerLabel(addressName)
        ? addressName
        : snapshotName || 'Customer';

  return {
    ...serialized,
    customer: {
      name: customerName,
      phone:
        serialized.customer?.phone ||
        sellerOrder?.customer?.phone ||
        deliveryAddress?.phone ||
        '',
    },
    address: resolvedAddress,
  };
};

export const serializeReturnForSeller = (returnDoc) => {
  const base = serializeReturnDocumentBase(returnDoc);
  const timeline = (base.timeline || []).map((entry) => {
    if (!entry?.metadata?.payoutDetails) return entry;
    const { payoutDetails, ...restMetadata } = entry.metadata;
    return { ...entry, metadata: restMetadata };
  });

  return {
    ...base,
    timeline,
    refundMethodLabel: formatRefundMethodLabel(returnDoc?.refundMethod),
    refundStatusLabel: formatRefundStatusLabel(returnDoc?.refundStatus),
    customer: returnDoc?.customer || { name: 'Customer', phone: '' },
    sellerOtp: returnDoc?.sellerOtp || '',
    sellerInspectionImages: Array.isArray(returnDoc?.sellerInspectionImages)
      ? returnDoc.sellerInspectionImages
      : [],
    dispatch: normalizeDispatchForResponse(returnDoc?.dispatch || {}),
  };
};

export const serializeReturnForAdmin = (returnDoc) => ({
  ...serializeReturnForSeller(returnDoc),
  customerOtp: returnDoc?.customerOtp || '',
  parentOrderId: returnDoc?.parentOrderId ? String(returnDoc.parentOrderId) : '',
  userId: returnDoc?.userId ? String(returnDoc.userId) : '',
  pricing: normalizeReturnPricingForResponse(returnDoc),
  cumulativeReturnItems: Array.isArray(returnDoc?.cumulativeReturnItems)
    ? returnDoc.cumulativeReturnItems
    : [],
  returnDeliveryCommission: Number(returnDoc?.returnDeliveryCommission || 0),
  calculatedPickupCharge: resolveReturnPickupCharge(returnDoc),
  returnPickupCharge: resolveReturnPickupCharge(returnDoc),
  pickupDistanceKm: Number(returnDoc?.pickupDistanceKm || 0),
  pickupPricingBreakdown: returnDoc?.pickupPricingBreakdown || null,
  riderEarning: resolveReturnPickupCharge(returnDoc),
  pickupFeeZeroWarning: resolveReturnPickupCharge(returnDoc) <= 0,
  pickupPaidBy:
    Number(returnDoc?.finance?.pickupFeeDebited || 0) > 0 ? 'seller' : 'admin',
  adminPickupFeeCharged: Number(
    returnDoc?.finance?.adminPickupFeeCharged ||
      (Number(returnDoc?.finance?.pickupFeeDebited || 0) > 0
        ? 0
        : resolveReturnPickupCharge(returnDoc)),
  ),
  createdAt: returnDoc?.createdAt || null,
});
