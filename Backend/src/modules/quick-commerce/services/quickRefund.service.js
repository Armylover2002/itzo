import { logger } from '../../../utils/logger.js';
import { refundWalletBalance } from '../../food/user/services/userWallet.service.js';
import { initiateRazorpayRefund } from '../../food/orders/helpers/razorpay.helper.js';

const ONLINE_METHODS = new Set(['razorpay', 'razorpay_qr', 'online']);

const getRefundableAmount = (order) => {
  const total = Number(order?.pricing?.total ?? order?.total ?? 0);
  return Number.isFinite(total) ? Math.max(0, total) : 0;
};

const isPaidPrepaidOrder = (order) => {
  const method = String(order?.payment?.method || '').trim().toLowerCase();
  const status = String(order?.payment?.status || '').trim().toLowerCase();
  if (status !== 'paid') return false;
  return method === 'wallet' || ONLINE_METHODS.has(method);
};

const buildRefundMessage = ({ cancelledBy, refundResult, refundTo }) => {
  if (!refundResult?.processed) {
    if (refundResult?.reason === 'not_prepaid') {
      return 'Order cancelled successfully.';
    }
    return 'Order cancelled. Refund could not be processed automatically — our team will follow up shortly.';
  }

  if (refundResult.method === 'wallet') {
    return 'Order cancelled. Refund has been credited to your wallet.';
  }

  if (cancelledBy === 'seller') {
    return 'Order cancelled by the store. Refund will be returned to your original payment method within 5-7 business days.';
  }

  if (refundTo === 'wallet') {
    return 'Order cancelled. Refund has been credited to your wallet.';
  }

  return 'Order cancelled. Refund will be returned to your original payment method within 5-7 business days.';
};

export const processQuickOrderRefund = async (
  order,
  { refundTo = 'gateway', cancelledBy = 'user', reason = '' } = {},
) => {
  const existingRefund = order?.payment?.refund;
  if (existingRefund?.status === 'processed' || order?.payment?.status === 'refunded') {
    return {
      processed: true,
      alreadyProcessed: true,
      method: existingRefund?.processedMethod || 'gateway',
      message: buildRefundMessage({
        cancelledBy,
        refundTo,
        refundResult: { processed: true, method: existingRefund?.processedMethod || 'gateway' },
      }),
    };
  }

  const amount = getRefundableAmount(order);
  if (!isPaidPrepaidOrder(order) || amount <= 0) {
    return { processed: false, reason: 'not_prepaid', message: buildRefundMessage({ cancelledBy, refundResult: { reason: 'not_prepaid' } }) };
  }

  const paymentMethod = String(order.payment?.method || '').trim().toLowerCase();
  const normalizedRefundTo =
    cancelledBy === 'seller'
      ? 'gateway'
      : refundTo === 'wallet' || refundTo === 'gateway'
        ? refundTo
        : 'gateway';
  const targetMethod = paymentMethod === 'wallet' ? 'wallet' : normalizedRefundTo;
  const processedAt = new Date();

  if (targetMethod === 'wallet') {
    if (!order.userId) {
      logger.warn(`Quick wallet refund skipped for order ${order.orderId}: missing userId`);
      return {
        processed: false,
        reason: 'missing_user',
        message: 'Order cancelled. Wallet refund requires a logged-in account.',
      };
    }

    await refundWalletBalance(order.userId, amount, 'Quick order refund', {
      orderId: String(order.orderId || ''),
      source: 'quick_order_cancel',
      cancelledBy,
    });

    order.payment.status = 'refunded';
    order.payment.refund = {
      status: 'processed',
      amount,
      refundId: `wallet_refund_${Date.now()}`,
      requestedMethod: normalizedRefundTo,
      processedMethod: 'wallet',
      requestedAt: processedAt,
      requestedByUser: cancelledBy === 'user',
      cancelledBy,
      reason,
      processedAt,
    };

    return {
      processed: true,
      method: 'wallet',
      amount,
      message: buildRefundMessage({
        cancelledBy,
        refundTo: normalizedRefundTo,
        refundResult: { processed: true, method: 'wallet' },
      }),
    };
  }

  const paymentId = order.payment?.razorpay?.paymentId;
  if (!paymentId) {
    order.payment.refund = {
      status: 'failed',
      amount,
      requestedMethod: normalizedRefundTo,
      processedMethod: 'gateway',
      cancelledBy,
      reason,
    };
    return {
      processed: false,
      reason: 'missing_payment_id',
      message: 'Order cancelled. Refund could not be processed automatically — our team will follow up shortly.',
    };
  }

  const refundResult = await initiateRazorpayRefund(paymentId, amount);
  if (refundResult.success) {
    order.payment.status = 'refunded';
    order.payment.refund = {
      status: 'processed',
      amount,
      refundId: refundResult.refundId || '',
      requestedMethod: normalizedRefundTo,
      processedMethod: 'gateway',
      requestedAt: processedAt,
      requestedByUser: cancelledBy === 'user',
      cancelledBy,
      reason,
      processedAt,
    };

    return {
      processed: true,
      method: 'gateway',
      amount,
      refundId: refundResult.refundId,
      message: buildRefundMessage({
        cancelledBy,
        refundTo: normalizedRefundTo,
        refundResult: { processed: true, method: 'gateway' },
      }),
    };
  }

  order.payment.refund = {
    status: 'failed',
    amount,
    requestedMethod: normalizedRefundTo,
    processedMethod: 'gateway',
    cancelledBy,
    reason,
  };

  logger.error(`Quick Razorpay refund failed for ${order.orderId}: ${refundResult.error || 'unknown error'}`);

  return {
    processed: false,
    reason: 'razorpay_failed',
    error: refundResult.error,
    message: 'Order cancelled. Refund could not be processed automatically — our team will follow up shortly.',
  };
};

const buildReturnRefundTransactionId = (returnDoc, suffix = '') => {
  const returnId = String(returnDoc?._id || 'return');
  const safeSuffix = String(suffix || 'refund').trim().toLowerCase() || 'refund';
  return `qc_return_${returnId}_${safeSuffix}`;
};

export const processQuickCommerceReturnRefund = async (
  returnDoc,
  order,
  { payoutDetails = {} } = {},
) => {
  if (!returnDoc) {
    return { processed: false, reason: 'missing_return', message: 'Return record is required' };
  }

  if (returnDoc.refundStatus === 'completed' && returnDoc.refundTransactionId) {
    return {
      processed: true,
      alreadyProcessed: true,
      method: returnDoc.refundMethod,
      amount: Number(returnDoc.returnRefundAmount || 0),
      refundTransactionId: returnDoc.refundTransactionId,
      message: 'Refund already completed for this return',
    };
  }

  const amount = Number(returnDoc.returnRefundAmount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { processed: false, reason: 'zero_amount', message: 'Return refund amount must be greater than zero' };
  }

  const method = String(returnDoc.refundMethod || '').trim().toLowerCase();
  const userId = returnDoc.userId || order?.userId;

  if (method === 'wallet') {
    if (!userId) {
      return {
        processed: false,
        reason: 'missing_user',
        message: 'Wallet refund requires a logged-in customer account',
      };
    }

    const refundTransactionId = buildReturnRefundTransactionId(returnDoc, 'wallet');
    const walletResult = await refundWalletBalance(userId, amount, 'Quick Commerce return refund', {
      orderId: String(returnDoc.orderId || order?.orderId || ''),
      returnId: String(returnDoc._id || ''),
      source: 'quick_commerce_return',
      refundMethod: 'wallet',
      refundTransactionId,
      refundReference: returnDoc.refundReference || '',
    });

    return {
      processed: true,
      alreadyProcessed: Boolean(walletResult?.alreadyProcessed),
      method: 'wallet',
      amount,
      refundTransactionId,
      message: walletResult?.alreadyProcessed
        ? 'Return refund was already credited to wallet'
        : 'Return refund credited to wallet',
    };
  }

  if (method === 'upi' || method === 'bank') {
    const refundTransactionId = buildReturnRefundTransactionId(returnDoc, method);
    return {
      processed: false,
      pending: true,
      method,
      amount,
      refundTransactionId,
      payoutDetails,
      message:
        method === 'upi'
          ? 'UPI return refund queued for admin payout'
          : 'Bank return refund queued for admin payout',
    };
  }

  return {
    processed: false,
    reason: 'unsupported_method',
    message: 'Unsupported refund method for return',
  };
};

const mapReturnRefundStatusToPaymentRefund = (refundStatus = '') => {
  const normalized = String(refundStatus || '').trim().toLowerCase();
  if (normalized === 'completed') return 'processed';
  if (normalized === 'pending' || normalized === 'processing') return 'pending';
  if (normalized === 'failed') return 'failed';
  return 'none';
};

const resolveReturnRefundProcessedAt = (returnDoc) => {
  const log = Array.isArray(returnDoc?.refundAuditLog) ? returnDoc.refundAuditLog : [];
  for (let i = log.length - 1; i >= 0; i -= 1) {
    const entry = log[i];
    if (entry?.action === 'REFUND_COMPLETED' || entry?.action === 'REFUND_PAYOUT_CONFIRMED') {
      return entry.at ? new Date(entry.at) : new Date();
    }
  }
  return returnDoc?.updatedAt ? new Date(returnDoc.updatedAt) : new Date();
};

/** Keep parent QuickOrder.payment.refund aligned with SellerReturn (source of truth). */
export const syncParentOrderRefundFromReturn = async (order, returnDoc) => {
  if (!order || !returnDoc) return order;

  const cumulativeAmount = Number(
    returnDoc?.pricing?.totalRefundedAmount || returnDoc.returnRefundAmount || 0,
  );
  const amount = cumulativeAmount > 0 ? cumulativeAmount : Number(returnDoc.returnRefundAmount || 0);
  const refundStatus = String(returnDoc.refundStatus || '').trim().toLowerCase();
  const paymentRefundStatus = mapReturnRefundStatusToPaymentRefund(refundStatus);
  const method = String(returnDoc.refundMethod || '').trim().toLowerCase();
  const refundReference = String(returnDoc.refundReference || '').trim();
  const refundTransactionId = String(returnDoc.refundTransactionId || '').trim();

  if (!order.payment) order.payment = {};

  const refundPayload = {
    status: paymentRefundStatus,
    amount,
    refundId: refundTransactionId || refundReference,
    requestedMethod: method === 'wallet' ? 'wallet' : 'gateway',
    requestedAt: returnDoc.createdAt || new Date(),
    requestedByUser: true,
    reason: refundReference ? `Return refund ref ${refundReference}` : 'Quick Commerce return refund',
  };

  if (method === 'wallet') {
    refundPayload.processedMethod = 'wallet';
  } else if (method === 'upi' || method === 'bank') {
    refundPayload.processedMethod = 'gateway';
  }

  if (paymentRefundStatus === 'processed') {
    refundPayload.processedAt = resolveReturnRefundProcessedAt(returnDoc);
  }

  order.payment.refund = refundPayload;

  const paidTotal = Number(order?.pricing?.total || order?.payment?.amountDue || 0);
  const prevPaymentStatus = String(order.payment.status || '');
  if (paymentRefundStatus === 'processed' && paidTotal > 0 && amount + 0.009 >= paidTotal) {
    order.payment.status = 'refunded';
  } else if (paymentRefundStatus === 'processed' && amount > 0) {
    // Keep paid for partial refunds; refund block carries detail.
    if (!order.payment.status || order.payment.status === 'created') {
      order.payment.status = 'paid';
    }
  }

  // Nested refund/status only. Do not markModified('payment') — that flags
  // locked payment.method / payment.amountDue and aborts QC return finance.
  order.markModified('payment.refund');
  if (String(order.payment.status || '') !== prevPaymentStatus) {
    order.markModified('payment.status');
  }
  await order.save();
  return order;
};
