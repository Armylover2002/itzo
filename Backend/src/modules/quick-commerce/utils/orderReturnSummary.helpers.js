import mongoose from 'mongoose';
import { SellerReturn } from '../seller/models/sellerReturn.model.js';
import {
  REFUND_STATUSES,
  RETURN_STATUSES,
  resolveReturnLifecycleLabel,
  formatRefundStatusLabel,
  resolveReturnPickupCharge,
  serializeReturnTimelineSteps,
  serializeReturnTimeline,
  normalizeReturnItemForResponse,
} from './return.helpers.js';

const num = (value) => Number(value || 0);
const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const RETURN_STATUS_LABELS = {
  [RETURN_STATUSES.REQUESTED]: 'Return requested',
  [RETURN_STATUSES.APPROVED]: 'Return approved',
  [RETURN_STATUSES.REJECTED]: 'Return rejected',
  [RETURN_STATUSES.PICKUP_ASSIGNED]: 'Return pickup assigned',
  [RETURN_STATUSES.IN_TRANSIT]: 'Return in transit',
  [RETURN_STATUSES.RETURNED]: 'Returned to seller',
  [RETURN_STATUSES.REFUND_COMPLETED]: 'Refund completed',
  [RETURN_STATUSES.CANCELLED]: 'Return cancelled',
};

export const mapReturnStatusLabel = (status) =>
  RETURN_STATUS_LABELS[String(status || '').trim()] ||
  resolveReturnLifecycleLabel({ returnStatus: status }) ||
  String(status || '').replace(/_/g, ' ');

const ACTIVE_RETURN_STATUSES = new Set([
  RETURN_STATUSES.REQUESTED,
  RETURN_STATUSES.APPROVED,
  RETURN_STATUSES.PICKUP_ASSIGNED,
  RETURN_STATUSES.IN_TRANSIT,
  RETURN_STATUSES.RETURNED,
]);

/**
 * Build a compact return/refund money + status summary for order list/detail UIs.
 */
export const buildOrderReturnSummaryFromDocs = (returnDocs = [], order = null) => {
  const docs = (Array.isArray(returnDocs) ? returnDocs : []).filter(Boolean);
  if (!docs.length) {
    return {
      hasReturn: false,
      returnStatus: order?.returnStatus || '',
      returnStatusLabel: '',
      refundStatus: '',
      refundStatusLabel: '',
      isActiveReturn: false,
      isRefundCompleted: false,
      originalPaidTotal: roundMoney(Number(order?.pricing?.total || order?.payment?.amountDue || 0)),
      refundedAmount: 0,
      netAfterReturn: roundMoney(Number(order?.pricing?.total || order?.payment?.amountDue || 0)),
      totalSellerClawed: 0,
      totalReturnPickupFee: 0,
      totalReturnRiderEarning: 0,
      returns: [],
    };
  }

  // Prefer latest non-cancelled return; else latest overall.
  const sorted = [...docs].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.returnRequestedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.returnRequestedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });
  const primary =
    sorted.find((doc) => String(doc.returnStatus || '') !== RETURN_STATUSES.CANCELLED) ||
    sorted[0];

  const originalPaidTotal = roundMoney(
    Number(
      primary?.pricing?.orderPaidTotal ||
        order?.pricing?.total ||
        order?.payment?.amountDue ||
        0,
    ),
  );

  const refundedAmount = roundMoney(
    docs.reduce((sum, doc) => {
      const status = String(doc.refundStatus || '').toLowerCase();
      if (status !== REFUND_STATUSES.COMPLETED && status !== 'completed') return sum;
      return (
        sum +
        Number(
          doc.pricing?.finalRefundAmount ||
            doc.returnRefundAmount ||
            doc.pricing?.totalRefundedAmount ||
            0,
        )
      );
    }, 0),
  );

  const remainingRefundable = roundMoney(
    Number(
      primary?.pricing?.remainingRefundableAmount ??
        Math.max(0, originalPaidTotal - refundedAmount),
    ),
  );

  const returnStatus = String(primary.returnStatus || order?.returnStatus || '');
  const refundStatus = String(primary.refundStatus || '');
  const isRefundCompleted =
    refundStatus === REFUND_STATUSES.COMPLETED ||
    returnStatus === RETURN_STATUSES.REFUND_COMPLETED;
  const isActiveReturn = ACTIVE_RETURN_STATUSES.has(returnStatus);

  const returns = sorted.map((doc) => {
    const pickupCharge = roundMoney(resolveReturnPickupCharge(doc));
    const pickupFeeDebited = roundMoney(Number(doc.finance?.pickupFeeDebited || 0));
    const pickupFeePaidByAdmin = roundMoney(
      pickupFeeDebited > 0
        ? 0
        : Number(doc.finance?.adminPickupFeeCharged || 0) > 0
          ? Number(doc.finance.adminPickupFeeCharged)
          : pickupCharge,
    );
    return {
      returnId: String(doc._id || ''),
      returnStatus: doc.returnStatus || '',
      returnStatusLabel: mapReturnStatusLabel(doc.returnStatus),
      refundStatus: doc.refundStatus || '',
      refundStatusLabel: formatRefundStatusLabel(doc.refundStatus),
      refundMethod: doc.refundMethod || '',
      returnRefundAmount: roundMoney(Number(doc.returnRefundAmount || 0)),
      sellerReceivableClawed: roundMoney(Number(doc.finance?.sellerReceivableClawed || 0)),
      returnPickupFee: pickupFeeDebited,
      returnPickupPaidByAdmin: pickupFeePaidByAdmin,
      returnRiderEarning: pickupCharge,
      returnReason: doc.returnReason || '',
      returnRequestedAt: doc.returnRequestedAt || doc.createdAt || null,
      pricing: {
        subtotal: roundMoney(Number(doc.pricing?.subtotal || 0)),
        couponShare: roundMoney(Number(doc.pricing?.couponShare || 0)),
        taxShare: roundMoney(Number(doc.pricing?.taxShare || 0)),
        pickupFee: pickupFeePaidByAdmin || pickupFeeDebited,
        finalRefundAmount: roundMoney(
          Number(doc.pricing?.finalRefundAmount || doc.returnRefundAmount || 0),
        ),
        orderPaidTotal: roundMoney(Number(doc.pricing?.orderPaidTotal || originalPaidTotal)),
        totalRefundedAmount: roundMoney(Number(doc.pricing?.totalRefundedAmount || 0)),
        remainingRefundableAmount: roundMoney(
          Number(doc.pricing?.remainingRefundableAmount ?? remainingRefundable),
        ),
      },
      returnItems: Array.isArray(doc.returnItems)
        ? doc.returnItems.map(normalizeReturnItemForResponse)
        : [],
      timelineSteps: serializeReturnTimelineSteps(doc),
      timeline: serializeReturnTimeline(doc),
      returnHistory: Array.isArray(doc.returnHistory) ? doc.returnHistory : [],
    };
  });

  const totalSellerClawed = roundMoney(
    returns.reduce((sum, row) => sum + Number(row.sellerReceivableClawed || 0), 0),
  );
  const totalReturnPickupFee = roundMoney(
    returns.reduce((sum, row) => {
      const status = String(row?.refundStatus || '').toLowerCase();
      if (status !== 'completed') return sum;
      return sum + Number(row.returnPickupFee || 0);
    }, 0),
  );
  const totalReturnRiderEarning = roundMoney(
    returns.reduce((sum, row) => {
      const status = String(row?.refundStatus || '').toLowerCase();
      if (status !== 'completed') return sum;
      return sum + Number(row.returnRiderEarning || 0);
    }, 0),
  );
  const totalReturnPickupPaidByAdmin = roundMoney(
    returns.reduce((sum, row) => {
      const status = String(row?.refundStatus || '').toLowerCase();
      if (status !== 'completed') return sum;
      return sum + Number(row.returnPickupPaidByAdmin || 0);
    }, 0),
  );

  return {
    hasReturn: true,
    returnStatus,
    returnStatusLabel: mapReturnStatusLabel(returnStatus),
    refundStatus,
    refundStatusLabel: formatRefundStatusLabel(refundStatus),
    isActiveReturn,
    isRefundCompleted,
    originalPaidTotal,
    refundedAmount,
    remainingRefundableAmount: remainingRefundable,
    netAfterReturn: roundMoney(Math.max(0, originalPaidTotal - refundedAmount)),
    totalSellerClawed,
    totalReturnPickupFee,
    totalReturnPickupPaidByAdmin,
    totalReturnRiderEarning,
    primaryReturnId: String(primary._id || ''),
    returns,
  };
};

export const loadReturnsByOrderIds = async (orderIds = []) => {
  const ids = [...new Set((Array.isArray(orderIds) ? orderIds : []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return new Map();

  const docs = await SellerReturn.find({ orderId: { $in: ids } })
    .sort({ updatedAt: -1 })
    .lean();

  const map = new Map();
  docs.forEach((doc) => {
    const key = String(doc.orderId || '');
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(doc);
  });
  return map;
};

export const attachReturnSummaryToOrder = (order, returnDocs = []) => {
  const summary = buildOrderReturnSummaryFromDocs(returnDocs, order);
  return {
    returnSummary: summary,
    returnStatus: summary.returnStatus || order?.returnStatus || '',
    returnStatusLabel: summary.returnStatusLabel || '',
    hasReturn: summary.hasReturn,
    refundedAmount: summary.refundedAmount,
    originalPaidTotal: summary.originalPaidTotal,
    netAfterReturn: summary.netAfterReturn,
    returns: summary.returns,
  };
};

export const getCompletedReturnRefundTotals = async () => {
  const rows = await SellerReturn.aggregate([
    {
      $match: {
        refundStatus: REFUND_STATUSES.COMPLETED,
      },
    },
    {
      $group: {
        _id: null,
        refundedAmount: {
          $sum: {
            $ifNull: ['$pricing.finalRefundAmount', { $ifNull: ['$returnRefundAmount', 0] }],
          },
        },
        refundedTax: { $sum: { $ifNull: ['$pricing.taxShare', 0] } },
        count: { $sum: 1 },
      },
    },
  ]);
  return {
    refundedAmount: roundMoney(num(rows?.[0]?.refundedAmount)),
    refundedTax: roundMoney(num(rows?.[0]?.refundedTax)),
    count: Number(rows?.[0]?.count || 0),
  };
};

export const syncParentOrderReturnStatus = async (orderId, returnStatus) => {
  if (!orderId || !returnStatus) return;
  const { QuickOrder } = await import('../models/order.model.js');
  await QuickOrder.updateOne(
    { orderId: String(orderId) },
    { $set: { returnStatus: String(returnStatus) } },
  );
};
