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
} from '../helpers/razorpay.helper.js';
import * as foodTransactionService from './foodTransaction.service.js';
import {
  buildOrderIdentityFilter,
  enqueueOrderEvent,
} from './order.helpers.js';

async function syncRazorpayQrPayment(orderDoc) {
  // Phase 2: avoid relying on FoodOrder.payment as the source of truth.
  const tx = await FoodTransaction.findOne({ orderId: orderDoc?._id }).lean();
  const payment = tx?.payment || orderDoc?.payment || null;
  if (!payment) return null;
  if (payment.method !== 'razorpay_qr') return payment;
  if (payment.status === 'paid') return payment;

  const paymentLinkId = payment?.qr?.paymentLinkId;
  if (!paymentLinkId || !isRazorpayConfigured()) return orderDoc.payment;

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
    },
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
  const tx = await FoodTransaction.findOne({ orderId: order._id }).lean();
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
  const link = await createPaymentLink({
    amountPaise: Math.round(amountDue * 100),
    currency: 'INR',
    description: `Order ${order._id.toString()} - COD collect`,
    orderId: order._id.toString(),
    customerName: customerInfo.name || user.name || 'Customer',
    customerEmail: customerInfo.email || user.email || 'customer@example.com',
    customerPhone: customerInfo.phone || user.phone,
  });

  // Phase 2: write QR collection state into FoodTransaction only.
  await FoodTransaction.updateOne(
    { orderId: order._id },
    {
      $set: {
        paymentMethod: 'razorpay_qr',
        'payment.method': 'razorpay_qr',
        'payment.status': 'pending_qr',
        'payment.qr': {
          paymentLinkId: link.id,
          shortUrl: link.short_url,
          imageUrl: link.short_url,
          status: link.status || 'created',
          expiresAt: link.expire_by ? new Date(link.expire_by * 1000) : null,
        },
      },
    },
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
    paymentLinkId: link.id,
    shortUrl: link.short_url,
    amountDue,
  });

  return {
    shortUrl:
      link?.short_url ?? link?.shortUrl ?? link?.short_url_path ?? null,
    imageUrl:
      link?.short_url ??
      link?.image_url ??
      link?.imageUrl ??
      link?.image ??
      null,
    amount: amountDue,
    expiresAt: link?.expire_by
      ? new Date(link.expire_by * 1000)
      : link?.expiresAt
        ? new Date(link.expiresAt)
        : null,
  };
}

export async function getPaymentStatus(orderId, deliveryPartnerId) {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError('Order id required');

  const order = await FoodOrder.findOne(identity).select(
    'dispatch riderEarning platformProfit',
  );
  if (!order) throw new NotFoundError('Order not found');
  if (
    order.dispatch?.deliveryPartnerId?.toString() !== deliveryPartnerId.toString()
  ) {
    throw new ForbiddenError('Not your order');
  }

  const transaction = await FoodTransaction.findOne({ orderId: order._id }).lean();
  if (transaction?.payment?.method === 'razorpay_qr') {
    await syncRazorpayQrPayment(order);
  }
  const latestHistory =
    (transaction?.history || []).sort((a, b) => (b.at || 0) - (a.at || 0))[0] ||
    null;

  return {
    payment: transaction?.payment || {},
    latestPaymentSnapshot: latestHistory,
    riderEarning: order.riderEarning ?? 0,
    platformProfit: order.platformProfit ?? 0,
    pricingTotal: transaction?.pricing?.total ?? 0,
    transactionStatus: transaction?.status ?? null,
  };
}
