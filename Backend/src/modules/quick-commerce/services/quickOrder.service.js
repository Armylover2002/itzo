import mongoose from 'mongoose';
import { logger } from '../../../utils/logger.js';
import { getIO, rooms } from '../../../config/socket.js';
import { Seller } from '../seller/models/seller.model.js';
import { SellerOrder } from '../seller/models/sellerOrder.model.js';
import { SellerTransaction } from '../seller/models/sellerTransaction.model.js';
import { QuickAdminWallet } from '../models/adminWallet.model.js';
import { QuickOrder } from '../models/order.model.js';
import { FoodDeliveryPartner } from '../../food/delivery/models/deliveryPartner.model.js';
import {
  pushStatusHistory,
  notifyOwnerSafely,
  notifyOwnersSafely,
  buildDeliverySocketPayload,
  enqueueOrderEvent,
  isStatusAdvance,
  haversineKm,
} from '../../food/orders/services/order.helpers.js';
import { tryAutoAssign } from '../../food/orders/services/order-dispatch.service.js';
import { initiateRazorpayRefund } from '../../food/orders/helpers/razorpay.helper.js';
import * as foodTransactionService from '../../food/orders/services/foodTransaction.service.js';
import { ValidationError, NotFoundError } from '../../../core/auth/errors.js';
import { emitQuickCommerceStatusUpdate } from './quickStatusRealtime.service.js';

/**
 * Credit the platform wallet for one delivered seller order, exactly once.
 *
 * Delivery can be recorded through two independent paths (the seller marking it, and
 * the rider sync), and both used to `$inc` the same wallet with no dedupe — permanently
 * inflating platform revenue with no ledger row to reconcile against. The credit is
 * claimed with a conditional single-document update, which is atomic in Mongo, so only
 * the first caller through wins.
 *
 * @param {object} sellerOrder  the delivered seller order
 * @param {string} source       label used for logging which path credited
 */
const creditPlatformEarningOnce = async (sellerOrder, source) => {
  const adminProfitRaw =
    Number(sellerOrder?.pricing?.commission || 0) +
    Number(sellerOrder?.pricing?.platformFee || 0);
  const adminProfit = Number.isFinite(adminProfitRaw) ? Math.max(0, adminProfitRaw) : 0;
  if (adminProfit <= 0) return;

  try {
    const claimed = await SellerOrder.findOneAndUpdate(
      {
        _id: sellerOrder._id,
        $or: [
          { platformEarningCreditedAt: null },
          { platformEarningCreditedAt: { $exists: false } },
        ],
      },
      { $set: { platformEarningCreditedAt: new Date() } },
      { new: true },
    );

    // Another path already credited this order.
    if (!claimed) return;

    await QuickAdminWallet.findOneAndUpdate(
      { key: 'quick_platform' },
      { $inc: { balance: adminProfit, totalRevenue: adminProfit } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (err) {
    logger.error(
      `[${source}] Failed to update quick admin wallet for ${sellerOrder.orderId}: ${err?.message || err}`,
    );
  }
};

/**
 * Status mapping from SellerOrder to Parent QuickOrder (FoodOrder)
 */
const SELLER_TO_PARENT_STATUS_MAP = {
  pending: "placed",
  confirmed: "confirmed",
  packed: "preparing",
  ready_for_pickup: "ready_for_pickup",
  out_for_delivery: "picked_up",
  delivered: "delivered",
  cancelled: "cancelled_by_restaurant",
};

/**
 * Workflow status mapping for parent order
 */
const SELLER_TO_WORKFLOW_MAP = {
  pending: "SELLER_PENDING",
  confirmed: "SELLER_ACCEPTED",
  packed: "PICKUP_READY", // Or stay in SELLER_ACCEPTED until ready
  ready_for_pickup: "PICKUP_READY",
  out_for_delivery: "OUT_FOR_DELIVERY",
  delivered: "DELIVERED",
  cancelled: "CANCELLED",
};

/**
 * Main service for Quick Commerce Order lifecycle
 */
export const updateSellerOrderStatus = async (sellerOrderId, sellerId, nextStatus) => {
  const isId = mongoose.Types.ObjectId.isValid(sellerOrderId);
  const sellerOrder = await SellerOrder.findOne({
    sellerId,
    $or: [
      ...(isId ? [{ _id: sellerOrderId }] : []),
      { orderId: sellerOrderId }
    ]
  });
  if (!sellerOrder) throw new NotFoundError('Seller order not found');

  const currentStatus = sellerOrder.status;
  if (currentStatus === nextStatus) return sellerOrder;

  // 1. Update SellerOrder
  sellerOrder.status = nextStatus;
  sellerOrder.workflowStatus = SELLER_TO_WORKFLOW_MAP[nextStatus] || sellerOrder.workflowStatus;
  if (nextStatus === 'delivered') sellerOrder.deliveredAt = new Date();
  await sellerOrder.save();

  // 1b. Earnings credit: create/upsert an "Order Payment" transaction once delivered.
  // This is idempotent (unique by sellerId + orderId + type).
  if (nextStatus === 'delivered') {
    const receivableRaw =
      Number(sellerOrder?.pricing?.receivable) ||
      Math.max(
        0,
        Number(sellerOrder?.pricing?.subtotal || 0) - Number(sellerOrder?.pricing?.commission || 0),
      );
    const receivable = Number.isFinite(receivableRaw) ? Math.max(0, receivableRaw) : 0;

    if (receivable > 0) {
      try {
        await SellerTransaction.findOneAndUpdate(
          { sellerId, type: 'Order Payment', orderId: sellerOrder.orderId },
          {
            $set: {
              amount: receivable,
              status: 'Settled',
              reference: sellerOrder.orderId,
              customer: sellerOrder?.customer?.name || 'Customer',
            },
            $setOnInsert: {
              sellerId,
              type: 'Order Payment',
              orderId: sellerOrder.orderId,
              reason: '',
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
      } catch (err) {
        logger.error(
          `[QuickEarnings] Failed to upsert seller transaction for ${sellerOrder.orderId}: ${err?.message || err}`,
        );
      }
    }

    await creditPlatformEarningOnce(sellerOrder, 'QuickAdminEarnings');
  }

  // 2. Sync Parent Order
  const parentOrder = sellerOrder.parentOrderId
    ? await QuickOrder.findById(sellerOrder.parentOrderId)
    : await QuickOrder.findOne({
        orderType: { $in: ['quick', 'mixed'] },
        orderId: sellerOrder.orderId,
      });
  if (parentOrder) {
    const parentNextStatus = SELLER_TO_PARENT_STATUS_MAP[nextStatus];
    const fromStatus = parentOrder.orderStatus;

    if (parentNextStatus) {
      const fromStatus = parentOrder.orderStatus;
      const shouldUpdateParentStatus = parentOrder.orderType !== 'mixed' || isStatusAdvance(fromStatus, parentNextStatus);

      if (shouldUpdateParentStatus) {
        parentOrder.orderStatus = parentNextStatus;
      }
      parentOrder.workflowStatus =
        SELLER_TO_WORKFLOW_MAP[nextStatus] || parentOrder.workflowStatus;

      pushStatusHistory(parentOrder, {
        byRole: 'SELLER',
        byId: sellerId,
        from: fromStatus,
        to: parentOrder.orderStatus,
        note: parentOrder.orderType === 'mixed' 
          ? `Seller updated mixed-order leg to ${nextStatus}`
          : `Seller updated status to ${nextStatus}`,
      });

      // If cancelled -> handle refund
      if (nextStatus === 'cancelled') {
        await handleSellerOrderCancellation(parentOrder);
      }

      await parentOrder.save();
      
      // Handle Side Effects (Post-Save to avoid race conditions)
      
      // If confirmed or beyond -> trigger dispatch if not already assigned
      const isAcceptedStatus = ['confirmed', 'preparing', 'packed', 'ready_for_pickup', 'out_for_delivery'].includes(nextStatus);
      const isDispatchUnassigned = !parentOrder.dispatch?.status || parentOrder.dispatch.status === 'unassigned';
      
      if (isAcceptedStatus && isDispatchUnassigned) {
        logger.info(`[QuickDispatch] Triggering dispatch for order ${parentOrder.orderId} (Status: ${nextStatus})`);
        void triggerQuickOrderDispatch(parentOrder._id, sellerId).catch(err => 
          logger.error(`[QuickDispatch] Trigger failed: ${err.message}`)
        );
      }

      // If ready_for_pickup -> ping rider
      if (nextStatus === 'ready_for_pickup') {
        const assignedId = parentOrder.dispatch?.deliveryPartnerId;
        if (assignedId) {
          const seller = await Seller.findById(sellerId).select('shopName').lean();
          const io = getIO();
          const payload = buildDeliverySocketPayload(parentOrder, seller);
          io.to(rooms.delivery(assignedId)).emit('order_ready', payload);
        }
      }
      
      // Emit Socket Updates
      void emitQuickCommerceStatusUpdate(parentOrder, {
        sellerId,
        sellerStatus: sellerOrder.status,
        sellerWorkflowStatus: sellerOrder.workflowStatus,
      });

      // FCM Notification to User
      await notifyOwnerSafely(
        { ownerType: 'USER', ownerId: parentOrder.userId },
        {
          title: `Order Update: ${nextStatus.replace(/_/g, ' ')}`,
          body: `Your order #${parentOrder.orderId} from ${sellerOrder.items?.[0]?.name || 'the store'} is now ${nextStatus.replace(/_/g, ' ')}.`,
          data: {
            type: 'order_status_update',
            orderId: parentOrder.orderId,
            orderMongoId: parentOrder._id.toString(),
          }
        }
      );
    }
  }

  return sellerOrder;
};

const handleSellerOrderCancellation = async (parentOrder) => {
  // Refund logic
  if (
    parentOrder.payment?.status === "paid" &&
    parentOrder.payment?.method === "razorpay" &&
    parentOrder.payment?.razorpay?.paymentId &&
    (!parentOrder.payment?.refund || parentOrder.payment?.refund?.status !== "processed")
  ) {
    try {
      const refundResult = await initiateRazorpayRefund(
        parentOrder.payment.razorpay.paymentId,
        parentOrder.pricing?.total || 0
      );

      if (refundResult.success) {
        parentOrder.payment.status = "refunded";
        parentOrder.payment.refund = {
          status: "processed",
          amount: parentOrder.pricing?.total || 0,
          refundId: refundResult.refundId,
          processedAt: new Date()
        };
      } else {
        parentOrder.payment.refund = { status: "failed", amount: parentOrder.pricing?.total || 0 };
      }
    } catch (err) {
      logger.error(`Automated refund failed for Quick Order ${parentOrder.orderId}:`, err);
      parentOrder.payment.refund = { status: "failed", amount: parentOrder.pricing?.total || 0 };
    }
  }

  // Update transaction
  try {
    await foodTransactionService.updateTransactionStatus(
      parentOrder._id, 
      'cancelled_by_restaurant', 
      { note: 'Cancelled by seller' }
    );
  } catch (err) {
    logger.error(`Transaction update failed for Quick Order ${parentOrder.orderId}:`, err);
  }
};

export const syncSellerOrderFromDelivery = async (parentOrderId, deliveryStatus) => {
  const nextSellerStatus = deliveryStatus === 'picked_up' ? 'out_for_delivery' : (deliveryStatus === 'delivered' ? 'delivered' : null);
  if (!nextSellerStatus) return;

  const deliveredStamp = nextSellerStatus === 'delivered' ? new Date() : null;

  const parent = await QuickOrder.findById(parentOrderId).select('_id orderId').lean();
  if (!parent) return;

  // Backward compatibility: older quick seller orders were created without parentOrderId.
  // Sync by parentOrderId (new) OR by orderId (old), and backfill parentOrderId where missing.
  const syncResults = await Promise.all([
    SellerOrder.find({
      $or: [
        { parentOrderId },
        { orderId: parent.orderId, $or: [{ parentOrderId: null }, { parentOrderId: { $exists: false } }] }
      ]
    }),
    SellerOrder.updateMany(
      { parentOrderId },
      {
        $set: {
          status: nextSellerStatus,
          workflowStatus: SELLER_TO_WORKFLOW_MAP[nextSellerStatus],
          ...(deliveredStamp ? { deliveredAt: deliveredStamp } : {}),
        },
      },
    ),
    SellerOrder.updateMany(
      { orderId: parent.orderId, $or: [{ parentOrderId: null }, { parentOrderId: { $exists: false } }] },
      {
        $set: {
          parentOrderId: parent._id,
          status: nextSellerStatus,
          workflowStatus: SELLER_TO_WORKFLOW_MAP[nextSellerStatus],
          ...(deliveredStamp ? { deliveredAt: deliveredStamp } : {}),
        },
      },
    ),
  ]);

  // If delivered -> Ensure earnings are credited for each affected seller leg
  if (nextSellerStatus === 'delivered') {
    const affectedSellerOrders = syncResults[0] || [];
    for (const so of affectedSellerOrders) {
      const receivableRaw =
        Number(so?.pricing?.receivable) ||
        Math.max(
          0,
          Number(so?.pricing?.subtotal || 0) - Number(so?.pricing?.commission || 0),
        );
      const receivable = Number.isFinite(receivableRaw) ? Math.max(0, receivableRaw) : 0;

      if (receivable > 0) {
        try {
          await SellerTransaction.findOneAndUpdate(
            { sellerId: so.sellerId, type: 'Order Payment', orderId: so.orderId },
            {
              $set: {
                amount: receivable,
                status: 'Settled',
                reference: so.orderId,
                customer: so?.customer?.name || 'Customer',
              },
              $setOnInsert: {
                sellerId: so.sellerId,
                type: 'Order Payment',
                orderId: so.orderId,
                reason: '',
              },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );
        } catch (err) {
          logger.error(
            `[QuickEarningsSync] Failed to upsert seller transaction for ${so.orderId}: ${err?.message || err}`,
          );
        }
      }

      await creditPlatformEarningOnce(so, 'QuickAdminEarningsSync');
    }
  }
};

export const triggerQuickOrderDispatch = async (parentOrderId, sellerId) => {
  try {
    logger.info(`[QuickDispatch] Delegating dispatch for order ${parentOrderId} to unified engine`);
    await tryAutoAssign(parentOrderId, { attempt: 1, quickSellerId: sellerId });
  } catch (error) {
    logger.error(`[QuickDispatch] Delegation failed for order ${parentOrderId}: ${error.message}`);
  }
};

export const getSellerLocation = (seller) => {
  if (Array.isArray(seller?.location?.coordinates) && seller.location.coordinates.length === 2) {
    return { lat: Number(seller.location.coordinates[1]), lng: Number(seller.location.coordinates[0]) };
  }
  if (Number.isFinite(Number(seller?.location?.latitude)) && Number.isFinite(Number(seller?.location?.longitude))) {
    return { lat: Number(seller.location.latitude), lng: Number(seller.location.longitude) };
  }
  return null;
};

export const getOrderAddressPoint = (order) => {
  // FoodOrder/QuickOrder schema uses deliveryAddress.location.coordinates [lng, lat]
  if (order?.deliveryAddress?.location?.coordinates?.length === 2) {
    const [lng, lat] = order.deliveryAddress.location.coordinates;
    return { lat, lng };
  }
  // Fallback for address.location.lat/lng
  const lat = Number(order?.address?.location?.lat || order?.location?.lat);
  const lng = Number(order?.address?.location?.lng || order?.location?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  return null;
};

export const listNearbyOnlineDeliveryPartnersByCoords = async (origin, { maxKm = 15, limit = 10 } = {}) => {
  if (!origin?.lat || !origin?.lng) return [];

  const onlinePartners = await FoodDeliveryPartner.find({
    availabilityStatus: "online",
    status: { $in: process.env.NODE_ENV === "production" ? ["approved"] : ["approved", "pending"] },
  })
    .select("_id name phone status lastLat lastLng")
    .lean();
  const STALE_GPS_MS = 10 * 60 * 1000;
  const scored = onlinePartners
    .map((partner) => {
      const lat = Number(partner.lastLat);
      const lng = Number(partner.lastLng);
      // Fallback: if lastLocationAt is missing, assume it's fresh if we have coordinates (or check if coordinates exist)
      const isStale = partner.lastLocationAt && Date.now() - new Date(partner.lastLocationAt).getTime() > STALE_GPS_MS;

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || isStale) {
        return {
          partnerId: partner._id,
          distanceKm: null,
          score: Number.MAX_SAFE_INTEGER,
          name: partner.name || "Delivery Partner",
          phone: partner.phone || "",
        };
      }

      const d = haversineKm(origin.lat, origin.lng, lat, lng);
      return {
        partnerId: partner._id,
        distanceKm: d,
        score: d,
        name: partner.name || "Delivery Partner",
        phone: partner.phone || "",
      };
    })
    .filter((p) => p.distanceKm !== null && p.distanceKm <= maxKm)
    .sort((a, b) => a.score - b.score);

  return scored.slice(0, limit);
};
