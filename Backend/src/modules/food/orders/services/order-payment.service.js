import mongoose from 'mongoose';
import { FoodOrder } from '../models/order.model.js';
import { FoodTransaction } from '../models/foodTransaction.model.js';
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
} from '../../../../core/auth/errors.js';
import { logger } from '../../../../utils/logger.js';
import {
  createPaymentLink,
  fetchRazorpayPaymentLink,
  isRazorpayConfigured,
  createUpiQrCode,
  fetchQrCodePayments
} from '../helpers/razorpay.helper.js';
import * as foodTransactionService from './foodTransaction.service.js';
import {
  buildOrderIdentityFilter,
  enqueueOrderEvent,
} from './order.helpers.js';

async function syncRazorpayQrPayment(orderDoc) {
  // Phase 2: avoid relying on FoodOrder.payment as the source of truth.
  let tx = await FoodTransaction.findOne({ orderId: orderDoc?._id }).lean();
  if (!tx) {
    tx = await foodTransactionService.createInitialTransaction(orderDoc);
    tx = tx.toObject ? tx.toObject() : tx;
  }
  const payment = tx?.payment || orderDoc?.payment || null;
  if (!payment) return null;
  if (payment.method !== 'razorpay_qr') return payment;
  if (payment.status === 'paid') return payment;

  const qrId = payment?.qr?.qrId;
  const paymentLinkId = payment?.qr?.paymentLinkId;
  if (!qrId && !paymentLinkId) return orderDoc.payment;
  if (!isRazorpayConfigured()) return orderDoc.payment;

  if (qrId) {
    let paymentsResp;
    try {
      paymentsResp = await fetchQrCodePayments(qrId);
    } catch (error) {
      logger.warn(
        `Razorpay QR payments fetch failed for ${qrId}: ${
          error?.message || error
        }`,
      );
      return orderDoc.payment;
    }

    const payments = paymentsResp?.items || [];
    const paidPayment = payments.find((p) =>
      ['captured', 'authorized'].includes(String(p?.status || '').toLowerCase()),
    );

    let newStatus = payment.status || 'pending_qr';
    let qrStatus = payment.qr?.status || 'created';

    if (paidPayment) {
      newStatus = 'paid';
      qrStatus = 'paid';
    } else {
      const expiresAt = payment.qr?.expiresAt;
      if (expiresAt && new Date(expiresAt) < new Date()) {
        newStatus = 'failed';
        qrStatus = 'expired';
      }
    }

    await FoodTransaction.updateOne(
      { orderId: orderDoc?._id },
      {
        $set: {
          'payment.qr.status': qrStatus,
          'payment.status': newStatus,
        },
      }
    );

    const updatedTx = await FoodTransaction.findOne({ orderId: orderDoc?._id }).lean();
    return updatedTx?.payment || payment;
  }

  let link;
  try {
    link = await fetchRazorpayPaymentLink(paymentLinkId);
  } catch (error) {
    logger.warn(
      `Razorpay payment-link fetch failed for ${paymentLinkId}: ${
        error?.message || error
      }`,
    );
    return orderDoc.payment;
  }

  const linkStatus = String(link?.status || '').toLowerCase();
  if (!linkStatus) return orderDoc.payment;

  // Write back to FoodTransaction (ledger) only.
  await FoodTransaction.updateOne(
    { orderId: orderDoc?._id },
    {
      $set: {
        'payment.qr.status': linkStatus,
        'payment.status': ['paid', 'captured', 'authorized'].includes(linkStatus)
          ? 'paid'
          : ['expired', 'cancelled', 'canceled', 'failed'].includes(linkStatus)
            ? 'failed'
            : (payment.status || 'pending_qr'),
      },
    }
  );

  const updatedTx = await FoodTransaction.findOne({ orderId: orderDoc?._id }).lean();
  return updatedTx?.payment || payment;
}

export async function createCollectQr(
  orderId,
  deliveryPartnerId,
  customerInfo = {},
) {
  const query = mongoose.Types.ObjectId.isValid(orderId)
    ? { _id: orderId }
    : { orderId };

  const order = await FoodOrder.findOne(query)
    .populate('userId', 'name email phone')
    .lean();

  if (!order) throw new NotFoundError('Order not found');
  if (
    order.dispatch.deliveryPartnerId?.toString() !== deliveryPartnerId.toString()
  ) {
    throw new ForbiddenError('Not your order');
  }
  let tx = await FoodTransaction.findOne({ orderId: order._id }).lean();
  if (!tx) {
    tx = await foodTransactionService.createInitialTransaction(order);
    tx = tx.toObject ? tx.toObject() : tx;
  }
  const payment = tx?.payment || order.payment || {};
  if (payment.method !== 'cash' && payment.status === 'paid') {
    throw new ValidationError('Order already paid');
  }

  const amountDue = payment.amountDue ?? tx?.pricing?.total ?? order.pricing?.total ?? 0;
  if (amountDue < 1) throw new ValidationError('No amount due');
  if (!isRazorpayConfigured()) {
    throw new ValidationError('QR payment not configured');
  }

  const user = order.userId || {};
  
  // Use Razorpay Dynamic Single-Use UPI QR Code
  const qr = await createUpiQrCode({
    amountPaise: Math.round(amountDue * 100),
    currency: 'INR',
    description: `Order ${order._id.toString()} - COD collect`,
    orderId: order._id.toString(),
    customerName: customerInfo.name || user.name || 'Customer',
  });

  const qrImageUrl = qr.image_url || null;
  const qrId = qr.id || null;
  const qrExpiresAt = qr.close_by ? new Date(qr.close_by * 1000) : null;

  // Phase 2: write QR collection state into FoodTransaction only.
  await FoodTransaction.updateOne(
    { orderId: order._id },
    {
      $set: {
        paymentMethod: 'razorpay_qr',
        'payment.method': 'razorpay_qr',
        'payment.status': 'pending_qr',
        'payment.qr': {
          qrId: qrId,
          imageUrl: qrImageUrl,
          status: qr.status || 'created',
          expiresAt: qrExpiresAt,
        },
      }
    }
  );

  const updatedTx = await FoodTransaction.findOne({ orderId: order._id }).lean();

  if (updatedTx) {
    await foodTransactionService.updateTransactionStatus(
      order._id,
      'cod_collect_qr_created',
      {
        recordedByRole: 'DELIVERY_PARTNER',
        recordedById: deliveryPartnerId,
        note: 'COD collection QR created',
      },
    );
  }

  enqueueOrderEvent('collect_qr_created', {
    orderMongoId: String(orderId),
    orderId: order?.orderId || null,
    deliveryPartnerId,
    qrId: qrId,
    amountDue,
  });

  return {
    imageUrl: qrImageUrl,
    qrId: qrId,
    amount: amountDue,
    expiresAt: qrExpiresAt,
  };
}

export async function getPaymentStatus(orderId, deliveryPartnerId) {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError('Order id required');

  const order = await FoodOrder.findOne(identity).select(
    'dispatch riderEarning platformProfit payment pricing userId orderType restaurantId',
  );
  if (!order) throw new NotFoundError('Order not found');
  if (
    order.dispatch?.deliveryPartnerId?.toString() !== deliveryPartnerId.toString()
  ) {
    throw new ForbiddenError('Not your order');
  }

  let transaction = await FoodTransaction.findOne({ orderId: order._id }).lean();

  // Sync Razorpay QR status if applicable, then re-read fresh data
  if (transaction?.payment?.method === 'razorpay_qr') {
    await syncRazorpayQrPayment(order);
    // Re-fetch the transaction to get updated payment status
    transaction = await FoodTransaction.findOne({ orderId: order._id }).lean();
  }

  const latestHistory =
    (transaction?.history || []).sort((a, b) => (b.at || 0) - (a.at || 0))[0] ||
    null;

  // Fallback to order.payment if transaction is missing or empty
  const effectivePayment = transaction?.payment?.method ? transaction.payment : {
    ...(order.payment?.toObject?.() || order.payment || {}),
    status: order.payment?.status,
  };

  return {
    payment: effectivePayment,
    latestPaymentSnapshot: latestHistory,
    riderEarning: order.riderEarning ?? 0,
    platformProfit: order.platformProfit ?? 0,
    pricingTotal: transaction?.pricing?.total ?? order.pricing?.total ?? 0,
    transactionStatus: transaction?.status ?? null,
  };
}
