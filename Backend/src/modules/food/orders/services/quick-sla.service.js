/**
 * Food Quick SLA compensation (wallet credit of Quick Charge by default).
 * Idempotent via order.sla.compensatedAt + wallet category.
 *
 * refund mode: wallet credit with refund semantics in ledger metadata
 * (gateway auto-refund deferred; customer always receives compensation).
 */
import { FoodOrder } from '../models/order.model.js';
import { creditWallet } from '../../../../core/payments/wallet.service.js';
import { normalizeQuickDeliverySettings } from '../utils/quickDeliveryConstants.js';
import { FoodFeeSettings } from '../../admin/models/feeSettings.model.js';
import { logger } from '../../../../utils/logger.js';
import { evaluateQuickSlaBreach } from './quick-eta.service.js';
import { getIO, rooms } from '../../../../config/socket.js';
import { notifyOwnerSafely } from './order.helpers.js';

function resolveDeliveredAt(order) {
  const deliveredEntry = [...(order.statusHistory || [])]
    .reverse()
    .find((h) => String(h?.to || '') === 'delivered');
  if (deliveredEntry?.at) return new Date(deliveredEntry.at);

  if (order.deliveryState?.deliveredAt) {
    return new Date(order.deliveryState.deliveredAt);
  }
  if (order.deliveredAt) return new Date(order.deliveredAt);
  return new Date(order.updatedAt || Date.now());
}

export async function processQuickSlaCompensation(orderMongoId) {
  if (!orderMongoId) return { success: false, reason: 'missing_id' };

  const order = await FoodOrder.findById(orderMongoId);
  if (!order) return { success: false, reason: 'not_found' };
  if (String(order.deliveryMode || '') !== 'quick') {
    return { success: false, reason: 'not_quick', alreadyHandled: true };
  }
  if (order.sla?.compensatedAt) {
    return { success: true, alreadyHandled: true, reason: 'already_compensated' };
  }

  const at = resolveDeliveredAt(order);
  const evalResult = evaluateQuickSlaBreach(order, at);
  if (!evalResult.applicable || !evalResult.breached) {
    if (!order.sla) order.sla = {};
    order.sla.breached = false;
    order.sla.slaClock = evalResult.slaClock || order.etaPromise?.slaClock || 'placed';
    await order.save();
    return { success: true, breached: false };
  }

  const feeDoc = await FoodFeeSettings.findOne({ isActive: { $ne: false } })
    .sort({ createdAt: -1 })
    .lean();
  const settings = normalizeQuickDeliverySettings(feeDoc?.quickDelivery);
  const charge = Math.max(0, Number(order.pricing?.quickDeliveryFee || 0));
  const pct = Number(settings.slaCompensationPct) || 0;
  const amount = Math.round(((charge * pct) / 100) * 100) / 100;
  const mode = settings.slaCompensationMode || 'wallet';

  order.sla = {
    ...(order.sla?.toObject?.() || order.sla || {}),
    breached: true,
    delayMinutes: evalResult.delayMinutes,
    compensationAmount: amount,
    compensationMode: mode,
    /** Frozen SLA clock — always 'placed' (matches etaPromise.slaClock). */
    slaClock: evalResult.slaClock || order.etaPromise?.slaClock || 'placed',
  };

  if (amount <= 0) {
    order.sla.compensatedAt = new Date();
    order.sla.compensationStatus = 'waived';
    await order.save();
    return { success: true, breached: true, amount: 0 };
  }

  try {
    await creditWallet({
      entityType: 'user',
      entityId: order.userId,
      amount,
      description: `Quick Delivery SLA credit for order ${order.orderId}`,
      // Must match Transaction.category enum — keep SLA semantics in metadata
      category: 'adjustment',
      orderId: order._id,
      metadata: {
        source: 'quick_sla_compensation',
        orderId: order.orderId,
        quickDeliveryFee: charge,
        delayMinutes: evalResult.delayMinutes,
        requestedMode: mode,
        // refund mode still credits wallet so customer is made whole immediately
        settledAs: 'wallet',
      },
    });
    order.sla.compensationStatus = mode === 'refund' ? 'credited_as_wallet' : 'credited';
    order.sla.compensatedAt = new Date();
    await order.save();

    const notifyPayload = {
      orderMongoId: String(order._id),
      orderId: String(order.orderId || ''),
      type: 'quick_sla_compensation',
      amount,
      delayMinutes: evalResult.delayMinutes,
      compensationStatus: order.sla.compensationStatus,
    };

    try {
      const io = getIO();
      if (io && order.userId) {
        io.to(rooms.user(order.userId)).emit('quick_sla_compensation', notifyPayload);
        io.to(rooms.user(order.userId)).emit('order_status_update', {
          ...notifyPayload,
          deliveryMode: 'quick',
          sla: order.sla,
        });
      }
    } catch (sockErr) {
      logger.warn(`[QuickSLA] Socket notify failed: ${sockErr.message}`);
    }

    await notifyOwnerSafely(
      { ownerType: 'USER', ownerId: order.userId },
      {
        title: 'Quick Delivery SLA credit',
        body: `₹${amount} credited to your wallet for late Quick Delivery on order ${order.orderId}.`,
        data: {
          type: 'quick_sla_compensation',
          orderId: String(order._id),
          orderMongoId: String(order._id),
          amount: String(amount),
          link: `/user/orders/${order._id}`,
        },
      },
    );

    logger.info(`[QuickSLA] Credited ₹${amount} to user ${order.userId} for ${order.orderId}`);
    return { success: true, breached: true, amount, mode: 'wallet' };
  } catch (err) {
    logger.error(`[QuickSLA] Credit failed: ${err.message}`);
    throw err;
  }
}
