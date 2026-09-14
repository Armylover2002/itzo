export const RETURN_STATUS = {
  REQUESTED: 'return_requested',
  APPROVED: 'return_approved',
  REJECTED: 'return_rejected',
  PICKUP_ASSIGNED: 'return_pickup_assigned',
  IN_TRANSIT: 'return_in_transit',
  RETURNED: 'returned',
  REFUND_COMPLETED: 'refund_completed',
  CANCELLED: 'return_cancelled',
};

export const RETURN_DISPATCH_STATUS = {
  UNASSIGNED: 'unassigned',
  ASSIGNED: 'assigned',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const hasActiveReturnOffers = (ret = {}) =>
  Array.isArray(ret?.dispatch?.offeredTo) &&
  ret.dispatch.offeredTo.some((entry) =>
    ['offered', 'assigned'].includes(String(entry?.action || '').toLowerCase()),
  );

export const isReturnRiderAccepted = (ret = {}) => {
  const dispatch = ret?.dispatch || {};
  const dispatchStatus = String(dispatch.status || '').toLowerCase();
  return (
    dispatchStatus === RETURN_DISPATCH_STATUS.ACCEPTED ||
    dispatchStatus === RETURN_DISPATCH_STATUS.COMPLETED ||
    ret?.returnStatus === RETURN_STATUS.IN_TRANSIT ||
    ret?.returnStatus === RETURN_STATUS.RETURNED ||
    Boolean(dispatch.acceptedAt)
  );
};

export const isReturnPickupDispatched = (ret = {}) => {
  const dispatch = ret?.dispatch || {};
  const dispatchStatus = String(dispatch.status || '').toLowerCase();
  return (
    isReturnRiderAccepted(ret) ||
    dispatchStatus === RETURN_DISPATCH_STATUS.ASSIGNED ||
    Boolean(dispatch.deliveryPartnerId) ||
    Boolean(dispatch.assignedAt) ||
    hasActiveReturnOffers(ret)
  );
};

export const isReturnDispatchFailed = (ret = {}) => {
  const dispatchStatus = String(ret?.dispatch?.status || RETURN_DISPATCH_STATUS.UNASSIGNED).toLowerCase();
  const returnStatus = String(ret?.returnStatus || '');

  if (
    dispatchStatus === RETURN_DISPATCH_STATUS.FAILED ||
    dispatchStatus === RETURN_DISPATCH_STATUS.REJECTED ||
    dispatchStatus === RETURN_DISPATCH_STATUS.CANCELLED
  ) {
    return true;
  }

  if (
    [RETURN_DISPATCH_STATUS.ASSIGNED, RETURN_DISPATCH_STATUS.ACCEPTED, RETURN_DISPATCH_STATUS.COMPLETED].includes(
      dispatchStatus,
    )
  ) {
    return false;
  }

  if (
    returnStatus === RETURN_STATUS.IN_TRANSIT ||
    returnStatus === RETURN_STATUS.RETURNED ||
    isReturnRiderAccepted(ret)
  ) {
    return false;
  }

  if (returnStatus !== RETURN_STATUS.PICKUP_ASSIGNED) {
    return false;
  }

  return !isReturnPickupDispatched(ret);
};

export const isReturnWaitingForRider = (ret = {}) => {
  if (isReturnDispatchFailed(ret) || isReturnRiderAccepted(ret)) return false;

  const dispatchStatus = String(ret?.dispatch?.status || '').toLowerCase();
  if (dispatchStatus === RETURN_DISPATCH_STATUS.ASSIGNED) return true;
  if (hasActiveReturnOffers(ret)) return true;

  return (
    ret?.returnStatus === RETURN_STATUS.PICKUP_ASSIGNED &&
    String(ret?.dispatch?.status || RETURN_DISPATCH_STATUS.UNASSIGNED).toLowerCase() ===
      RETURN_DISPATCH_STATUS.UNASSIGNED &&
    isReturnPickupDispatched(ret)
  );
};

export const resolveReturnDispatchUILabel = (ret = {}) => {
  const dispatchStatus = String(ret?.dispatch?.status || RETURN_DISPATCH_STATUS.UNASSIGNED).toLowerCase();

  if (dispatchStatus === RETURN_DISPATCH_STATUS.COMPLETED) return 'Pickup Completed';
  if (isReturnRiderAccepted(ret)) return 'Rider Assigned';
  if (dispatchStatus === RETURN_DISPATCH_STATUS.ASSIGNED) return 'Pickup Assigned';
  if (isReturnDispatchFailed(ret)) return 'Dispatch Failed';
  if (isReturnWaitingForRider(ret)) return 'Waiting for Rider';
  if (ret?.returnStatus === RETURN_STATUS.PICKUP_ASSIGNED) return 'Pickup Assigned';
  return null;
};

export const resolveReturnLifecycleLabel = (returnDoc = {}) => {
  const status = String(returnDoc?.returnStatus || "").trim();
  const refundStatus = String(returnDoc?.refundStatus || "none").trim().toLowerCase();
  const deliveryStatus = String(returnDoc?.deliveryState?.status || "").trim();
  const quality = String(returnDoc?.qualityCheck?.status || "").trim();
  const dispatchStatus = String(returnDoc?.dispatch?.status || "").trim();

  if (status === RETURN_STATUS.REJECTED) return "Rejected";
  if (status === RETURN_STATUS.CANCELLED) return "Cancelled";
  if (refundStatus === "failed") return "Refund Failed";
  if (refundStatus === "completed" || status === RETURN_STATUS.REFUND_COMPLETED) return "Refund Completed";
  if (refundStatus === "processing") return "Refund Processing";
  if (refundStatus === "pending") return "Refund Pending";
  if (quality === "passed" && refundStatus === "none") return "Quality Check Passed";
  if (status === RETURN_STATUS.RETURNED) return "Quality Check";
  if (deliveryStatus === "picked_up" || deliveryStatus === "reached_drop") return "Pickup Completed";
  if (status === RETURN_STATUS.IN_TRANSIT) return "Pickup In Progress";
  if (status === RETURN_STATUS.PICKUP_ASSIGNED) {
    return dispatchStatus === "accepted" ? "Pickup In Progress" : "Pickup Assigned";
  }
  if (status === RETURN_STATUS.APPROVED) return "Approved";
  if (status === RETURN_STATUS.REQUESTED) return "Requested";
  return returnDoc?.lifecycleLabel || mapReturnStatusLabel(status);
};

export const mapReturnStatusLabel = (status) => {
  switch (status) {
    case RETURN_STATUS.REQUESTED:
      return 'Return Requested';
    case RETURN_STATUS.APPROVED:
      return 'Approved';
    case RETURN_STATUS.REJECTED:
      return 'Rejected';
    case RETURN_STATUS.PICKUP_ASSIGNED:
      return 'Pickup Assigned';
    case RETURN_STATUS.IN_TRANSIT:
      return 'Rider Coming';
    case RETURN_STATUS.RETURNED:
      return 'Reached Seller';
    case RETURN_STATUS.REFUND_COMPLETED:
      return 'Refund Completed';
    case RETURN_STATUS.CANCELLED:
      return 'Cancelled';
    default:
      return status || 'Unknown';
  }
};

export const formatRefundStatusLabel = (status) => {
  const normalized = String(status || 'none').trim().toLowerCase();
  if (normalized === 'none') return 'Not started';
  if (normalized === 'pending') return 'Pending';
  if (normalized === 'processing') return 'Processing';
  if (normalized === 'completed') return 'Completed';
  if (normalized === 'failed') return 'Failed';
  return normalized;
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

const normalizeRefundStatus = (value) => String(value || 'none').trim().toLowerCase();

export const isReturnRefundSettled = (returnDoc = {}) => {
  const refundStatus = normalizeRefundStatus(returnDoc?.refundStatus);
  const returnStatus = String(returnDoc?.returnStatus || '').trim();
  return refundStatus === 'completed' || returnStatus === RETURN_STATUS.REFUND_COMPLETED;
};

/**
 * Enforces refund-phase steps from refundStatus / returnStatus (same source as Refund Details card).
 * Pickup-phase steps are left as returned by the backend serializer.
 */
export const applyRefundTimelineGuards = (returnDoc = {}, steps = []) => {
  if (!Array.isArray(steps) || !steps.length) return [];

  const refundStatus = normalizeRefundStatus(returnDoc?.refundStatus);
  const returnStatus = String(returnDoc?.returnStatus || '').trim();

  if (refundStatus === 'completed' || returnStatus === RETURN_STATUS.REFUND_COMPLETED) {
    return steps.map((step) => ({ ...step, status: 'completed' }));
  }

  if (refundStatus === 'pending' || refundStatus === 'processing') {
    return steps.map((step) => {
      if (step.id === 'quality_check') return { ...step, status: 'completed' };
      if (step.id === 'refund_processing') return { ...step, status: 'active' };
      if (step.id === 'refund_completed') return { ...step, status: 'pending' };
      return step;
    });
  }

  if (refundStatus === 'failed') {
    return steps.map((step) => {
      if (step.id === 'quality_check') return { ...step, status: 'completed' };
      if (step.id === 'refund_processing') return { ...step, status: 'rejected' };
      if (step.id === 'refund_completed') return { ...step, status: 'pending' };
      return step;
    });
  }

  return steps;
};

/**
 * @deprecated Customer UI must use backend `timelineSteps`. Kept for admin tooling only.
 */
export const resolveReturnTimelineStepStatuses = (returnDoc = {}) => {
  const status = String(returnDoc?.returnStatus || '').trim();
  const refundStatus = normalizeRefundStatus(returnDoc?.refundStatus);
  const deliveryStatus = String(returnDoc?.deliveryState?.status || '').trim();
  const quality = String(returnDoc?.qualityCheck?.status || '').trim().toLowerCase();

  if (status === RETURN_STATUS.REJECTED || status === RETURN_STATUS.CANCELLED) {
    return RETURN_TIMELINE_STEPS.map(() => 'rejected');
  }

  if (refundStatus === 'completed' || status === RETURN_STATUS.REFUND_COMPLETED) {
    return RETURN_TIMELINE_STEPS.map(() => 'completed');
  }

  if (refundStatus === 'failed') {
    return RETURN_TIMELINE_STEPS.map((_, index) => {
      if (index < 7) return 'completed';
      if (index === 7) return 'rejected';
      return 'pending';
    });
  }

  if (refundStatus === 'processing' || refundStatus === 'pending') {
    return RETURN_TIMELINE_STEPS.map((_, index) => {
      if (index < 7) return 'completed';
      if (index === 7) return 'active';
      return 'pending';
    });
  }

  let activeIndex = 0;
  if (quality === 'passed') activeIndex = 7;
  else if (status === RETURN_STATUS.RETURNED) activeIndex = 6;
  else if (deliveryStatus === 'reached_drop') activeIndex = 5;
  else if (deliveryStatus === 'picked_up') activeIndex = 4;
  else if (status === RETURN_STATUS.IN_TRANSIT) activeIndex = 3;
  else if (status === RETURN_STATUS.PICKUP_ASSIGNED) activeIndex = 2;
  else if (status === RETURN_STATUS.APPROVED) activeIndex = 1;
  else if (status === RETURN_STATUS.REQUESTED) activeIndex = 0;

  return RETURN_TIMELINE_STEPS.map((_, index) => {
    if (index < activeIndex) return 'completed';
    if (index === activeIndex) return 'active';
    return 'pending';
  });
};

export const serializeReturnTimelineSteps = (returnDoc = {}) =>
  RETURN_TIMELINE_STEPS.map((step, index) => ({
    id: step.id,
    label: step.label,
    status: resolveReturnTimelineStepStatuses(returnDoc)[index],
  }));

export const resolveReturnTimelineIndex = (returnDoc = {}) => {
  const statuses = resolveReturnTimelineStepStatuses(returnDoc);
  const activeIdx = statuses.findIndex((s) => s === 'active');
  if (activeIdx >= 0) return activeIdx;
  if (statuses.every((s) => s === 'completed')) return RETURN_TIMELINE_STEPS.length;
  if (statuses.every((s) => s === 'rejected')) return -1;
  return statuses.findIndex((s) => s === 'pending');
};

export const isReturnPickupTrip = (order = {}) =>
  String(order?.tripType || '').trim() === 'return_pickup' ||
  String(order?.documentType || '').trim() === 'seller_return';

export const getDeliveryDocumentId = (order = {}) => {
  if (isReturnPickupTrip(order)) {
    return String(order?.returnId || order?.orderMongoId || order?._id || order?.id || '');
  }
  return String(order?.orderId || order?.orderMongoId || order?._id || order?.id || '');
};
