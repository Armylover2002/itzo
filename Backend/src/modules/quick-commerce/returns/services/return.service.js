/**
 * Return Management System — Core Service
 *
 * Handles creation, validation, status progression, and history tracking
 * for Quick Commerce return requests. Integrates with the state machine.
 */

import mongoose from 'mongoose';
import { ReturnRequest } from '../models/returnRequest.model.js';
import { SellerReturn } from '../../seller/models/sellerReturn.model.js';
import { ReturnStatusHistory } from '../models/returnStatusHistory.model.js';
import { QuickOrder } from '../../models/order.model.js';
import { QuickProduct } from '../../models/product.model.js';
import { getSettingsSync } from '../../../common/utils/settingsCache.js';
import {
  MASTER_STATUS,
  LEG_STATUS,
  assertTransition,
  deriveMasterStatus,
  DEFAULT_RETURN_SETTINGS,
  ACTOR_ROLES,
} from '../constants/returnStateMachine.js';
import { buildOrderIdentityFilter } from '../../../food/orders/services/order.helpers.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { logger } from '../../../../utils/logger.js';
import * as returnNotificationService from './returnNotification.service.js';
import { emitReturnStatusUpdate } from './returnSocket.service.js';

// ─── Utilities ──────────────────────────────────────────────────────────────

function generateReturnId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 7; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return `RET-${s}`;
}

export async function addHistoryEntry({
  returnRequestId,
  sellerReturnId = null,
  fromStatus,
  toStatus,
  actorRole,
  actorId = null,
  actorName = '',
  note = '',
  metadata = {},
}) {
  await ReturnStatusHistory.create({
    returnRequestId,
    sellerReturnId,
    fromStatus,
    toStatus,
    actor: {
      role: actorRole,
      id: actorId,
      name: actorName,
    },
    note,
    metadata,
  });
}

// ─── Public Methods ─────────────────────────────────────────────────────────

/**
 * Creates a new return request, splitting it into seller-specific legs.
 */
export async function createReturnRequest({
  userId,
  orderId, // string or mongoId
  items,   // Array of { productId, quantity, reason }
  reason,
  notes = '',
  images = [],
}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Fetch & Validate Order
    const identity = buildOrderIdentityFilter(orderId);
    if (!identity) throw new ValidationError('Invalid order ID provided.');

    const order = await QuickOrder.findOne({
      ...identity,
      userId,
      orderType: 'quick',
    }).session(session);

    if (!order) throw new NotFoundError('Order not found or does not belong to you.');
    if (order.status !== 'delivered') throw new ValidationError('Only delivered orders can be returned.');

    // 2. Validate Return Window
    const settings = getSettingsSync();
    const returnWindowDays = settings.quickReturnWindowDays || DEFAULT_RETURN_SETTINGS.returnWindowDays;
    const deliveredAt = order.statusHistory?.find((h) => h.to === 'delivered')?.at || order.updatedAt;
    
    if (deliveredAt) {
      const daysSinceDelivery = (Date.now() - new Date(deliveredAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDelivery > returnWindowDays) {
        throw new ValidationError(`Return window of ${returnWindowDays} days has expired.`);
      }
    }

    // 3. Process and Validate Items
    const processedItems = [];
    const groupedBySeller = new Map();

    for (const reqItem of items) {
      // Find in order
      const orderItem = order.items.find(
        (i) => i.productId.toString() === reqItem.productId.toString()
      );
      if (!orderItem) throw new ValidationError(`Product ${reqItem.productId} not found in this order.`);
      if (reqItem.quantity > orderItem.quantity) {
        throw new ValidationError(`Cannot return more than ordered quantity for product ${reqItem.productId}.`);
      }

      // Check product returnability
      const product = await QuickProduct.findById(reqItem.productId).lean().session(session);
      if (!product || product.returnable === false) {
        throw new ValidationError(`Product ${orderItem.name} is not eligible for return.`);
      }

      // Check for existing active return requests for this product in this order
      const existingReturns = await ReturnRequest.find({
        orderMongoId: order._id,
        status: { $nin: Array.from(MASTER_STATUS.TERMINAL || ['CANCELLED', 'EXPIRED', 'REJECTED']) }, // Only check active/completed ones
        'items.productId': reqItem.productId,
      }).session(session);

      const alreadyReturnedQty = existingReturns.reduce((sum, req) => {
        // Only count if not rejected/cancelled
        if (req.status === MASTER_STATUS.CANCELLED || req.status === MASTER_STATUS.EXPIRED || req.status === MASTER_STATUS.REJECTED) return sum;
        const item = req.items.find((i) => i.productId.toString() === reqItem.productId.toString());
        return sum + (item ? item.quantity : 0);
      }, 0);

      if (alreadyReturnedQty + reqItem.quantity > orderItem.quantity) {
        throw new ValidationError(`Return quantity exceeds available purchased quantity for ${orderItem.name}.`);
      }

      const sellerId = orderItem.sourceId?.toString();
      if (!sellerId) throw new ValidationError(`Missing seller context for product ${orderItem.name}.`);

      const returnItemDef = {
        productId: reqItem.productId,
        sellerId,
        name: orderItem.name,
        image: orderItem.image || '',
        price: orderItem.price,
        quantity: reqItem.quantity,
        orderedQuantity: orderItem.quantity,
        reason: reqItem.reason || reason,
      };

      processedItems.push(returnItemDef);

      if (!groupedBySeller.has(sellerId)) {
        groupedBySeller.set(sellerId, {
          sellerId,
          items: [],
          subtotal: 0,
        });
      }
      const sellerGroup = groupedBySeller.get(sellerId);
      sellerGroup.items.push(returnItemDef);
      sellerGroup.subtotal += returnItemDef.price * returnItemDef.quantity;
    }

    // 4. Create Master Return Request
    const returnReq = await ReturnRequest.create(
      [
        {
          returnId: generateReturnId(),
          orderId: order.orderId,
          orderMongoId: order._id,
          userId,
          items: processedItems,
          reason,
          notes,
          images,
          status: MASTER_STATUS.RETURN_REQUESTED,
          returnWindowDays,
        },
      ],
      { session }
    );

    const returnRequest = returnReq[0];

    // 5. Create Seller Legs
    const sellerLegIds = [];
    for (const [sellerId, group] of groupedBySeller.entries()) {
      const leg = await SellerReturn.create(
        [
          {
            sellerId,
            orderId: order.orderId,
            returnRequestId: returnRequest._id,
            userId,
            customer: {
              name: order.deliveryAddress?.contactPersonName || 'Customer',
              phone: order.deliveryAddress?.contactPersonNumber || '',
            },
            returnStatus: LEG_STATUS.RETURN_REQUESTED,
            returnReason: reason,
            returnItems: group.items.map((i) => ({
              name: i.name,
              quantity: i.quantity,
              price: i.price,
            })),
            pricing: {
              subtotal: group.subtotal,
            },
            itemApprovals: group.items.map((i) => ({
              productId: i.productId,
              status: 'pending',
              approvedQty: 0,
            })),
          },
        ],
        { session }
      );
      sellerLegIds.push(leg[0]._id);

      // Add leg history
      await addHistoryEntry({
        returnRequestId: returnRequest._id,
        sellerReturnId: leg[0]._id,
        fromStatus: 'none',
        toStatus: LEG_STATUS.RETURN_REQUESTED,
        actorRole: ACTOR_ROLES.USER,
        actorId: userId,
      });
    }

    // Link legs to master
    returnRequest.sellerLegIds = sellerLegIds;
    await returnRequest.save({ session });

    // Master history
    await addHistoryEntry({
      returnRequestId: returnRequest._id,
      fromStatus: 'none',
      toStatus: MASTER_STATUS.RETURN_REQUESTED,
      actorRole: ACTOR_ROLES.USER,
      actorId: userId,
    });

    await session.commitTransaction();
    
    // Asynchronously notify (fire-and-forget for now)
    returnNotificationService.notifyReturnCreated(returnRequest).catch(err => logger.error('Notify error', err));

    return returnRequest;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Derives and synchronizes the master status based on seller leg statuses.
 * Must be called after ANY leg status update.
 */
export async function syncMasterStatus(returnRequestId, session = null) {
  const returnReq = await ReturnRequest.findById(returnRequestId).session(session);
  if (!returnReq) return null;

  const legs = await SellerReturn.find({ returnRequestId }).session(session);
  const newMasterStatus = deriveMasterStatus(legs);

  if (newMasterStatus !== returnReq.status) {
    const oldStatus = returnReq.status;
    returnReq.status = newMasterStatus;

    if (newMasterStatus === MASTER_STATUS.UNDER_ADMIN_REVIEW && !returnReq.reviewStartedAt) {
      returnReq.reviewStartedAt = new Date();
    } else if (newMasterStatus === MASTER_STATUS.COMPLETED || newMasterStatus === MASTER_STATUS.PARTIALLY_COMPLETED) {
      if (!returnReq.completedAt) returnReq.completedAt = new Date();
    } else if (newMasterStatus === MASTER_STATUS.CANCELLED && !returnReq.cancelledAt) {
      returnReq.cancelledAt = new Date();
    }

    await returnReq.save({ session });

    await addHistoryEntry({
      returnRequestId,
      fromStatus: oldStatus,
      toStatus: newMasterStatus,
      actorRole: ACTOR_ROLES.SYSTEM,
      note: 'Auto-derived from leg statuses',
    });

    emitReturnStatusUpdate(returnReq.userId, returnReq._id, newMasterStatus);
  }

  return returnReq;
}

/**
 * Updates a specific seller leg's status safely.
 */
export async function updateLegStatus({
  sellerReturnId,
  nextStatus,
  actorRole,
  actorId,
  actorName = '',
  note = '',
  metadata = {},
}) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const leg = await SellerReturn.findById(sellerReturnId).session(session);
    if (!leg) throw new NotFoundError('Seller return leg not found.');

    assertTransition('leg', leg.returnStatus, nextStatus);

    const oldStatus = leg.returnStatus;
    leg.returnStatus = nextStatus;

    // Phase timestamps mapping
    const tsMap = {
      [LEG_STATUS.PICKUP_EN_ROUTE]: 'pickupEnRouteAt',
      [LEG_STATUS.PICKUP_REACHED]: 'pickupReachedAt',
      [LEG_STATUS.PICKUP_OTP_PENDING]: 'pickupOtpVerifiedAt', // We might set this after verification
      [LEG_STATUS.PICKED_UP]: 'pickedUpAt',
      [LEG_STATUS.RETURN_EN_ROUTE]: 'returnEnRouteAt',
      [LEG_STATUS.RETURN_REACHED_SELLER]: 'returnReachedSellerAt',
      [LEG_STATUS.SELLER_OTP_PENDING]: 'sellerOtpVerifiedAt',
      [LEG_STATUS.RETURN_COMPLETED]: 'returnCompletedAt',
      [LEG_STATUS.RETURNED]: 'returnCompletedAt', // Backward compat
      [LEG_STATUS.CANCELLED]: 'cancelledAt',
      [LEG_STATUS.FAILED_PICKUP]: 'failedAt',
      [LEG_STATUS.FAILED_RETURN]: 'failedAt',
    };

    if (tsMap[nextStatus] && !leg[tsMap[nextStatus]]) {
      leg[tsMap[nextStatus]] = new Date();
    }

    if (nextStatus === LEG_STATUS.FAILED_PICKUP || nextStatus === LEG_STATUS.FAILED_RETURN) {
      leg.failureReason = note || 'Failed during delivery/pickup';
    }

    await leg.save({ session });

    await addHistoryEntry({
      returnRequestId: leg.returnRequestId,
      sellerReturnId: leg._id,
      fromStatus: oldStatus,
      toStatus: nextStatus,
      actorRole,
      actorId,
      actorName,
      note,
      metadata,
    });

    // Sync Master Status
    await syncMasterStatus(leg.returnRequestId, session);

    await session.commitTransaction();
    
    // Notifications after commit
    if (nextStatus === LEG_STATUS.PICKUP_EN_ROUTE) {
      returnNotificationService.notifyPickupAssigned(leg).catch(err => logger.error(err));
    } else if (nextStatus === LEG_STATUS.PICKUP_REACHED) {
      returnNotificationService.notifyRiderArrivedAtUser(leg).catch(err => logger.error(err));
    } else if (nextStatus === LEG_STATUS.PICKED_UP) {
      returnNotificationService.notifyPickedUp(leg).catch(err => logger.error(err));
    } else if (nextStatus === LEG_STATUS.RETURN_REACHED_SELLER) {
      returnNotificationService.notifyRiderArrivedAtSeller(leg).catch(err => logger.error(err));
    } else if (nextStatus === LEG_STATUS.RETURN_COMPLETED) {
      returnNotificationService.notifyReturnCompleted(leg).catch(err => logger.error(err));
    }
    
    // Emit socket event for specific leg status change
    emitReturnStatusUpdate(leg.userId, leg.returnRequestId, nextStatus);

    return leg;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Admin approves/rejects specific items and triggers the leg status change.
 */
export async function adminApproveReturn({
  returnRequestId,
  adminId,
  approvals, // Array of { productId, status ('approved'|'rejected'), approvedQty, note }
}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const returnReq = await ReturnRequest.findById(returnRequestId).session(session);
    if (!returnReq) throw new NotFoundError('Return request not found.');

    assertTransition('master', returnReq.status, MASTER_STATUS.APPROVED); // Check if we can move forward

    let someApproved = false;
    let someRejected = false;

    // Apply to master items (for easy UI display)
    for (const app of approvals) {
      const item = returnReq.items.find((i) => i.productId.toString() === app.productId.toString());
      if (item) {
        item.approval = {
          status: app.status,
          approvedQty: app.approvedQty,
          decidedBy: adminId,
          decidedAt: new Date(),
          note: app.note || '',
        };
        if (app.status === 'approved') someApproved = true;
        if (app.status === 'rejected') someRejected = true;
      }
    }
    
    returnReq.reviewCompletedAt = new Date();
    await returnReq.save({ session });

    // Apply to seller legs
    const legs = await SellerReturn.find({ returnRequestId }).session(session);
    
    for (const leg of legs) {
      let legHasApproved = false;
      let legHasRejected = false;
      
      // Update item approvals inside the leg
      for (const itemApproval of leg.itemApprovals) {
        const app = approvals.find((a) => a.productId.toString() === itemApproval.productId.toString());
        if (app) {
          itemApproval.status = app.status;
          itemApproval.approvedQty = app.approvedQty;
          itemApproval.decidedBy = adminId;
          itemApproval.decidedAt = new Date();
        }
        if (itemApproval.status === 'approved') legHasApproved = true;
        if (itemApproval.status === 'rejected') legHasRejected = true;
      }
      
      const oldStatus = leg.returnStatus;
      let nextStatus = oldStatus;
      
      if (legHasApproved && legHasRejected) {
        nextStatus = LEG_STATUS.PARTIALLY_APPROVED;
      } else if (legHasApproved) {
        nextStatus = LEG_STATUS.RETURN_APPROVED;
      } else if (legHasRejected) {
        nextStatus = LEG_STATUS.RETURN_REJECTED;
      }
      
      if (nextStatus !== oldStatus) {
        assertTransition('leg', oldStatus, nextStatus);
        leg.returnStatus = nextStatus;
        await leg.save({ session });
        
        await addHistoryEntry({
          returnRequestId: leg.returnRequestId,
          sellerReturnId: leg._id,
          fromStatus: oldStatus,
          toStatus: nextStatus,
          actorRole: ACTOR_ROLES.ADMIN,
          actorId: adminId,
          note: 'Admin reviewed items',
        });
      }
    }

    // Sync master
    await syncMasterStatus(returnRequestId, session);

    await session.commitTransaction();
    
    // Send notifications
    const isApproved = returnReq.status === MASTER_STATUS.APPROVED || returnReq.status === MASTER_STATUS.PARTIALLY_APPROVED;
    const isPartial = returnReq.status === MASTER_STATUS.PARTIALLY_APPROVED;
    returnNotificationService.notifyReturnReviewed(returnReq, isApproved, isPartial).catch(err => logger.error(err));
    
    return returnReq;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Cancels a return request (can be done by user or admin before pickup).
 */
export async function cancelReturn({
  returnRequestId,
  actorRole,
  actorId,
  reason = '',
}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const returnReq = await ReturnRequest.findById(returnRequestId).session(session);
    if (!returnReq) throw new NotFoundError('Return request not found.');

    assertTransition('master', returnReq.status, MASTER_STATUS.CANCELLED);

    const legs = await SellerReturn.find({ returnRequestId }).session(session);
    
    // Check if cancellation is allowed for all legs
    for (const leg of legs) {
      if (leg.returnStatus !== LEG_STATUS.CANCELLED && leg.returnStatus !== LEG_STATUS.RETURN_REJECTED) {
         assertTransition('leg', leg.returnStatus, LEG_STATUS.CANCELLED);
      }
    }

    // Cancel active legs
    for (const leg of legs) {
      if (leg.returnStatus !== LEG_STATUS.CANCELLED && leg.returnStatus !== LEG_STATUS.RETURN_REJECTED) {
        const oldStatus = leg.returnStatus;
        leg.returnStatus = LEG_STATUS.CANCELLED;
        leg.cancelledAt = new Date();
        await leg.save({ session });
        
        await addHistoryEntry({
          returnRequestId: leg.returnRequestId,
          sellerReturnId: leg._id,
          fromStatus: oldStatus,
          toStatus: LEG_STATUS.CANCELLED,
          actorRole,
          actorId,
          note: reason || 'Cancelled by user/admin',
        });
        
        // Also if leg was assigned to a rider, we'd need to trigger rider un-assignment here, 
        // but we'll do that via an event emitter or service call later.
      }
    }
    
    returnReq.cancelledBy = { role: actorRole, id: actorId };
    returnReq.cancellationReason = reason;
    await returnReq.save({ session });

    await syncMasterStatus(returnRequestId, session);

    await session.commitTransaction();
    return returnReq;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

