import mongoose from 'mongoose';
import { logger } from '../../../utils/logger.js';
import { getIO, rooms } from '../../../config/socket.js';
import { Seller } from '../seller/models/seller.model.js';
import { SellerOrder } from '../seller/models/sellerOrder.model.js';
import { SellerTransaction } from '../seller/models/sellerTransaction.model.js';
import { QuickOrder } from '../models/order.model.js';
import { FoodDeliveryPartner } from '../../food/delivery/models/deliveryPartner.model.js';
import { FoodUser } from '../../../core/users/user.model.js';
import {
  pushStatusHistory,
  notifyOwnerSafely,
  notifyOwnersSafely,
  buildDeliverySocketPayload,
  enqueueOrderEvent,
  isStatusAdvance,
} from '../../food/orders/services/order.helpers.js';
import { scorePointsByRoadDistance } from '../../../services/roadDistance.service.js';
import { tryAutoAssign } from '../../food/orders/services/order-dispatch.service.js';
import * as foodTransactionService from '../../food/orders/services/foodTransaction.service.js';
import { ValidationError, NotFoundError } from '../../../core/auth/errors.js';
import { emitQuickCommerceStatusUpdate } from './quickStatusRealtime.service.js';
import { processQuickOrderRefund } from './quickRefund.service.js';
import { restoreQuickOrderStockOnce } from '../utils/stock.helpers.js';
import { isQuickOrderVisibleToSeller } from '../utils/sellerOrderVisibility.helpers.js';
import { resolveSellerReceivable } from '../utils/sellerReceivable.helpers.js';
import { restoreSellerCouponUsageForOrder } from '../utils/sellerCouponUsage.helpers.js';

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
export const updateSellerOrderStatus = async (sellerOrderId, sellerId, nextStatus, reason = '') => {
  const isId = mongoose.Types.ObjectId.isValid(sellerOrderId);
  const sellerOrder = await SellerOrder.findOne({
    sellerId,
    $or: [
      ...(isId ? [{ _id: sellerOrderId }] : []),
      { orderId: sellerOrderId }
    ]
  });
  if (!sellerOrder) throw new NotFoundError('Seller order not found');

  const parentOrder = sellerOrder.parentOrderId
    ? await QuickOrder.findById(sellerOrder.parentOrderId)
    : await QuickOrder.findOne({
        orderType: { $in: ['quick', 'mixed'] },
        orderId: sellerOrder.orderId,
      });

  if (parentOrder && !isQuickOrderVisibleToSeller(parentOrder)) {
    throw new ValidationError('Payment is not completed for this order yet');
  }

  const currentStatus = sellerOrder.status;
  if (currentStatus === nextStatus) return sellerOrder;

  if (nextStatus === 'cancelled' && !String(reason || '').trim()) {
    throw new ValidationError('Cancellation reason is required');
  }

  // 1. Update SellerOrder
  sellerOrder.status = nextStatus;
  sellerOrder.workflowStatus = SELLER_TO_WORKFLOW_MAP[nextStatus] || sellerOrder.workflowStatus;
  if (nextStatus === 'delivered') sellerOrder.deliveredAt = new Date();
  if (nextStatus === 'cancelled' && reason) {
    sellerOrder.cancellationReason = reason;
  }
  await sellerOrder.save();

  // 1b. Earnings credit: create/upsert an "Order Payment" transaction once delivered.
  // This is idempotent (unique by sellerId + orderId + type).
  if (nextStatus === 'delivered') {
    const baseReceivable = resolveSellerReceivable(sellerOrder?.pricing);
    // Legacy SellerOrder rows might have product earnings only (packingFee not stored).
    // At delivery-time we allocate parent order packing fee (100% seller share).
    const packingFeeStored = Number(sellerOrder?.pricing?.packingFee || 0);
    let receivable = baseReceivable;
    if (!(packingFeeStored > 0) && parentOrder) {
      const parentPackingFee = Number(parentOrder?.pricing?.packagingFee || 0);
      const parentSubtotal = Number(parentOrder?.pricing?.subtotal || 0);
      const sellerSubtotal = Number(sellerOrder?.pricing?.subtotal || 0);

      const allocatedPackingFee =
        parentSubtotal > 0
          ? Number(((parentPackingFee * sellerSubtotal) / parentSubtotal).toFixed(2))
          : parentPackingFee;

      receivable = baseReceivable + allocatedPackingFee;
    }

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
  }

  // 2. Sync Parent Order
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
        note: reason ? `Seller cancelled order: ${reason}` : (parentOrder.orderType === 'mixed' 
          ? `Seller updated mixed-order leg to ${nextStatus}`
          : `Seller updated status to ${nextStatus}`),
      });

      // If cancelled -> handle refund and stock restore
      if (nextStatus === 'cancelled') {
        const refundResult = await handleSellerOrderCancellation(parentOrder, reason);
        void emitQuickCommerceStatusUpdate(parentOrder, {
          message: refundResult?.message || 'Order cancelled by the store.',
          sellerId,
          sellerStatus: sellerOrder.status,
          sellerWorkflowStatus: sellerOrder.workflowStatus,
        });
      } else {
        void emitQuickCommerceStatusUpdate(parentOrder, {
          sellerId,
          sellerStatus: sellerOrder.status,
          sellerWorkflowStatus: sellerOrder.workflowStatus,
        });
      }

      await parentOrder.save();

      // Handle Side Effects (Post-Save to avoid race conditions)
      const isAcceptedStatus = ['confirmed', 'preparing', 'packed', 'ready_for_pickup', 'out_for_delivery'].includes(nextStatus);
      const isDispatchUnassigned = !parentOrder.dispatch?.status || parentOrder.dispatch.status === 'unassigned';

      if (isAcceptedStatus && isDispatchUnassigned) {
        logger.info(`[QuickDispatch] Triggering dispatch for order ${parentOrder.orderId} (Status: ${nextStatus})`);
        void triggerQuickOrderDispatch(parentOrder._id, sellerId).catch((err) =>
          logger.error(`[QuickDispatch] Trigger failed: ${err.message}`),
        );
      }

      if (nextStatus === 'ready_for_pickup') {
        const assignedId = parentOrder.dispatch?.deliveryPartnerId;
        if (assignedId) {
          const seller = await Seller.findById(sellerId).select('shopName').lean();
          const io = getIO();
          // Look up gender separately (without populating parentOrder.userId
          // itself — other code below still relies on it being a raw ObjectId,
          // e.g. `ownerId: parentOrder.userId` for notifications) so the
          // female-contact-protection mask in buildDeliverySocketPayload works.
          const customerGenderDoc = parentOrder.userId
            ? await FoodUser.findById(parentOrder.userId).select('gender').lean()
            : null;
          const payload = buildDeliverySocketPayload(
            {
              ...(parentOrder.toObject ? parentOrder.toObject() : parentOrder),
              userId: { _id: parentOrder.userId, gender: customerGenderDoc?.gender },
            },
            seller,
          );
          io.to(rooms.delivery(assignedId)).emit('order_ready', payload);
        }
      }

      // FCM Notification to User
      const isCancelledUpdate = nextStatus === 'cancelled';
      await notifyOwnerSafely(
        { ownerType: 'USER', ownerId: parentOrder.userId },
        {
          title: isCancelledUpdate ? 'Order Cancelled' : `Order Update: ${nextStatus.replace(/_/g, ' ')}`,
          body: isCancelledUpdate
            ? `Your order #${parentOrder.orderId} was cancelled by the store. Any prepaid amount will be refunded to your original payment method.`
            : `Your order #${parentOrder.orderId} from ${sellerOrder.items?.[0]?.name || 'the store'} is now ${nextStatus.replace(/_/g, ' ')}.`,
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

const handleSellerOrderCancellation = async (parentOrder, reason = '') => {
  const refundResult = await processQuickOrderRefund(parentOrder, {
    refundTo: 'gateway',
    cancelledBy: 'seller',
    reason,
  });

  await restoreQuickOrderStockOnce(parentOrder);

  try {
    await restoreSellerCouponUsageForOrder(parentOrder);
  } catch (couponRestoreErr) {
    logger.warn(
      `Quick seller-cancel coupon restore failed for ${parentOrder.orderId}: ${couponRestoreErr?.message || couponRestoreErr}`,
    );
  }

  try {
    await foodTransactionService.updateTransactionStatus(
      parentOrder._id,
      'cancelled_by_restaurant',
      {
        status:
          parentOrder.payment?.status === 'refunded'
            ? 'refunded'
            : String(parentOrder.payment?.status || '').toLowerCase() === 'paid'
              ? 'captured'
              : 'failed',
        note: reason ? `Cancelled by seller: ${reason}` : 'Cancelled by seller',
        recordedByRole: 'SELLER',
      },
    );
  } catch (err) {
    logger.error(`Transaction update failed for Quick Order ${parentOrder.orderId}:`, err);
  }

  return refundResult;
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
      const receivable = resolveSellerReceivable(so?.pricing);

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
  const candidates = onlinePartners
    .map((partner) => {
      const lat = Number(partner.lastLat);
      const lng = Number(partner.lastLng);
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

      return {
        partnerId: partner._id,
        lat,
        lng,
        name: partner.name || "Delivery Partner",
        phone: partner.phone || "",
      };
    })
    .filter((partner) => partner.lat != null && partner.lng != null);

  const scored = await scorePointsByRoadDistance(origin, candidates, { maxKm });
  return scored
    .slice(0, limit)
    .map((partner) => ({
      partnerId: partner.partnerId,
      distanceKm: partner.distanceKm,
      score: partner.distanceKm,
      name: partner.name || "Delivery Partner",
      phone: partner.phone || "",
    }));
};
