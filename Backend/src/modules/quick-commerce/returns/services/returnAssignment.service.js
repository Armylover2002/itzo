/**
 * Return Assignment Service
 *
 * Handles assigning delivery partners (riders) to return pickups,
 * auto-reassignment on timeout, and related events.
 */

import mongoose from 'mongoose';
import { SellerReturn } from '../../seller/models/sellerReturn.model.js';
import { ReturnRequest } from '../models/returnRequest.model.js';
import { QuickOrder } from '../../models/order.model.js';
import { FoodDeliveryPartner } from '../../../food/delivery/models/deliveryPartner.model.js';
import { listNearbyOnlineDeliveryPartners } from '../../../food/orders/services/order-dispatch.service.js';
import { updateLegStatus, syncMasterStatus, addHistoryEntry } from './return.service.js';
import {
  LEG_STATUS,
  ACTOR_ROLES,
  DEFAULT_RETURN_SETTINGS,
} from '../constants/returnStateMachine.js';
import { getSettingsSync } from '../../../common/utils/settingsCache.js';
import { logger } from '../../../../utils/logger.js';
import { emitReturnAssignmentSocket } from './returnSocket.service.js';

export async function tryAssignReturnLeg(sellerReturnId, options = {}) {
  const { attempt = 1 } = options;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const leg = await SellerReturn.findById(sellerReturnId).session(session);
    if (!leg) throw new Error('Return leg not found');

    const assignableStatuses = [
      LEG_STATUS.PICKUP_PENDING,
      LEG_STATUS.RETURN_APPROVED,
      LEG_STATUS.PARTIALLY_APPROVED,
      LEG_STATUS.FAILED_PICKUP,
    ];
    if (!assignableStatuses.includes(leg.returnStatus)) {
      throw new Error(`Cannot assign: status is ${leg.returnStatus}`);
    }

    const order = await QuickOrder.findOne({ orderId: leg.orderId }).lean();
    if (!order) throw new Error('Original order not found');

    // For returns, the "source" is the user's location (pickup point)
    // We'll use the delivery address from the original order.
    // If not available, we fall back to the seller's location just to not fail.
    let searchSource = {
      _id: leg.sellerId,
      location: order.deliveryAddress?.location || { coordinates: [] }
    };

    const { partners } = await listNearbyOnlineDeliveryPartners(searchSource, {
      maxKm: attempt * 5 + 5, // Expand radius on each attempt
      limit: 10,
      sourceType: 'quick',
    });

    // Filter out partners that previously rejected or timed out on this assignment
    const historyPartnerIds = leg.assignment?.history?.map(h => h.partnerId?.toString()) || [];
    const availablePartners = partners.filter(p => !historyPartnerIds.includes(p.partnerId.toString()));

    if (availablePartners.length === 0) {
      logger.warn(`[ReturnDispatch] No riders found for leg ${leg._id} on attempt ${attempt}`);
      await session.abortTransaction();
      return { success: false, message: 'No eligible riders found' };
    }

    // Pick the closest available partner
    const selectedPartner = availablePartners[0];

    // Transition to PICKUP_PENDING first if not already there
    const oldStatus = leg.returnStatus;
    if (leg.returnStatus !== LEG_STATUS.PICKUP_PENDING) {
      leg.returnStatus = LEG_STATUS.PICKUP_PENDING;
      await leg.save({ session });
      await addHistoryEntry({
        returnRequestId: leg.returnRequestId,
        sellerReturnId: leg._id,
        fromStatus: oldStatus,
        toStatus: LEG_STATUS.PICKUP_PENDING,
        actorRole: ACTOR_ROLES.SYSTEM,
        note: 'Transitioned to pickup pending for assignment',
      });
    }

    if (!leg.assignment) leg.assignment = {};
    leg.assignment.deliveryPartnerId = selectedPartner.partnerId;
    leg.assignment.assignedAt = new Date();
    leg.assignment.status = 'assigned';
    leg.assignment.history = leg.assignment.history || [];
    leg.assignment.history.push({
      partnerId: selectedPartner.partnerId,
      action: 'assigned',
      at: new Date(),
    });

    leg.returnStatus = LEG_STATUS.RETURN_PICKUP_ASSIGNED;
    await leg.save({ session });

    await addHistoryEntry({
      returnRequestId: leg.returnRequestId,
      sellerReturnId: leg._id,
      fromStatus: LEG_STATUS.PICKUP_PENDING,
      toStatus: LEG_STATUS.RETURN_PICKUP_ASSIGNED,
      actorRole: ACTOR_ROLES.SYSTEM,
      note: `Auto-assigned delivery partner ${selectedPartner.partnerId}`,
    });

    await syncMasterStatus(leg.returnRequestId, session);

    await session.commitTransaction();

    logger.info(`[ReturnDispatch] Assigned leg ${leg._id} to partner ${selectedPartner.partnerId}`);
    
    emitReturnAssignmentSocket(selectedPartner.partnerId, leg);

    return { success: true, partnerId: selectedPartner.partnerId };
  } catch (error) {
    await session.abortTransaction();
    logger.error(`[ReturnDispatch] Error assigning leg ${sellerReturnId}: ${error.message}`);
    throw error;
  } finally {
    session.endSession();
  }
}

export async function acceptReturnAssignment(sellerReturnId, partnerId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const leg = await SellerReturn.findById(sellerReturnId).session(session);
    if (!leg) throw new Error('Return leg not found');

    if (leg.assignment?.deliveryPartnerId?.toString() !== partnerId.toString()) {
      throw new Error('Not assigned to this partner');
    }
    if (leg.assignment.status !== 'assigned') {
      throw new Error(`Assignment is no longer valid (status: ${leg.assignment.status})`);
    }

    leg.assignment.status = 'accepted';
    leg.assignment.acceptedAt = new Date();
    leg.assignment.history.push({
      partnerId,
      action: 'accepted',
      at: new Date(),
    });

    await leg.save({ session });
    await session.commitTransaction();

    // Move to en-route via core service for history tracking
    await updateLegStatus({
      sellerReturnId: leg._id,
      nextStatus: LEG_STATUS.PICKUP_EN_ROUTE,
      actorRole: ACTOR_ROLES.DELIVERY_PARTNER,
      actorId: partnerId,
      note: 'Rider accepted pickup assignment',
    });

    return leg;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function rejectReturnAssignment(sellerReturnId, partnerId, reason = '') {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const leg = await SellerReturn.findById(sellerReturnId).session(session);
    if (!leg) throw new Error('Return leg not found');

    if (leg.assignment?.deliveryPartnerId?.toString() !== partnerId.toString()) {
      throw new Error('Not assigned to this partner');
    }

    leg.assignment.status = 'rejected';
    leg.assignment.history.push({
      partnerId,
      action: 'rejected',
      at: new Date(),
      reason,
    });
    
    // Reset partner so someone else can be assigned
    leg.assignment.deliveryPartnerId = null;

    // Reset status back to pending
    leg.returnStatus = LEG_STATUS.PICKUP_PENDING;
    await leg.save({ session });
    await session.commitTransaction();
    
    // We don't necessarily want to push a full history entry for rider rejection unless we want to,
    // but we can try to reassign.
    tryAutoReassign(leg._id);

    return leg;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function handleAssignmentTimeout(sellerReturnId) {
  const leg = await SellerReturn.findById(sellerReturnId);
  if (!leg || leg.assignment?.status !== 'assigned') return;

  leg.assignment.status = 'timeout';
  leg.assignment.history.push({
    partnerId: leg.assignment.deliveryPartnerId,
    action: 'timeout',
    at: new Date(),
  });
  leg.assignment.deliveryPartnerId = null;
  leg.returnStatus = LEG_STATUS.PICKUP_PENDING;
  await leg.save();

  tryAutoReassign(leg._id);
}

export async function tryAutoReassign(sellerReturnId) {
  const settings = getSettingsSync();
  const maxAttempts = settings.quickReturnMaxAutoReassign || DEFAULT_RETURN_SETTINGS.maxAutoReassignAttempts;

  const leg = await SellerReturn.findById(sellerReturnId);
  if (!leg) return;

  const attempts = leg.assignment?.autoReassignAttempts || 0;
  if (attempts >= maxAttempts) {
    logger.warn(`[ReturnDispatch] Max auto-reassign attempts reached for leg ${leg._id}`);
    return;
  }

  leg.assignment.autoReassignAttempts = attempts + 1;
  await leg.save();

  await tryAssignReturnLeg(leg._id, { attempt: attempts + 1 });
}

/**
 * Cron Job function to check and reassign stale return assignments based on ECS settings.
 * Should be called periodically (e.g., every 1-2 minutes).
 */
export async function checkStaleReturnAssignments() {
  const settings = getSettingsSync();
  const acceptanceTimeoutSec = settings.quickReturnAcceptanceTimeoutSec || 300; // 5 mins
  const movementTimeoutSec = settings.quickReturnMovementTimeoutSec || 900; // 15 mins

  try {
    // 1. Check Acceptance Timeout (status: return_pickup_assigned)
    const acceptanceThreshold = new Date(Date.now() - acceptanceTimeoutSec * 1000);
    const staleAssigned = await SellerReturn.find({
      returnStatus: LEG_STATUS.RETURN_PICKUP_ASSIGNED,
      'assignment.assignedAt': { $lt: acceptanceThreshold },
      'assignment.status': 'assigned'
    });

    for (const leg of staleAssigned) {
      logger.warn(`[ReturnDispatch] Auto-reassigning leg ${leg._id} due to acceptance timeout`);
      await handleAssignmentTimeout(leg._id);
    }

    // 2. Check Movement Timeout (status: pickup_en_route)
    // If a rider accepted it but hasn't reached the pickup in X minutes
    const movementThreshold = new Date(Date.now() - movementTimeoutSec * 1000);
    const staleEnRoute = await SellerReturn.find({
      returnStatus: LEG_STATUS.PICKUP_EN_ROUTE,
      pickupEnRouteAt: { $lt: movementThreshold }
    });

    for (const leg of staleEnRoute) {
      logger.warn(`[ReturnDispatch] Auto-reassigning leg ${leg._id} due to movement timeout`);
      // We push a 'timeout' action for movement timeout
      leg.assignment.history.push({
        partnerId: leg.assignment.deliveryPartnerId,
        action: 'timeout',
        reason: 'Movement timeout exceeded',
        at: new Date(),
      });
      leg.assignment.deliveryPartnerId = null;
      leg.assignment.status = 'timeout';
      leg.returnStatus = LEG_STATUS.PICKUP_PENDING;
      await leg.save();

      await tryAutoReassign(leg._id);
    }
  } catch (error) {
    logger.error(`[ReturnDispatch] Error checking stale return assignments: ${error.message}`);
  }
}

/**
 * Manually assign a delivery partner to a return leg (admin action).
 * This bypasses the geo-based auto-assignment and lets admin pick any approved partner.
 */
export async function manualAssignReturnLeg(sellerReturnId, deliveryPartnerId, adminId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const leg = await SellerReturn.findById(sellerReturnId).session(session);
    if (!leg) throw new Error('Return leg not found');

    const assignableStatuses = [
      LEG_STATUS.RETURN_APPROVED,
      LEG_STATUS.PARTIALLY_APPROVED,
      LEG_STATUS.PICKUP_PENDING,
      LEG_STATUS.FAILED_PICKUP,
      LEG_STATUS.RETURN_PICKUP_ASSIGNED, // Allow reassignment
    ];
    if (!assignableStatuses.includes(leg.returnStatus)) {
      throw new Error(`Cannot assign: current status '${leg.returnStatus}' does not allow assignment.`);
    }

    // Validate delivery partner exists and is approved
    const partner = await FoodDeliveryPartner.findById(deliveryPartnerId)
      .select('name phone status isDeleted')
      .lean();
    if (!partner) throw new Error('Delivery partner not found');
    if (partner.status !== 'approved') throw new Error('Delivery partner is not approved');
    if (partner.isDeleted) throw new Error('Delivery partner account is deleted');

    const oldStatus = leg.returnStatus;

    // If currently assigned to someone else, record the reassignment
    if (leg.assignment?.deliveryPartnerId && leg.assignment.deliveryPartnerId.toString() !== deliveryPartnerId) {
      leg.assignment.history = leg.assignment.history || [];
      leg.assignment.history.push({
        partnerId: leg.assignment.deliveryPartnerId,
        action: 'reassigned',
        at: new Date(),
        reason: 'Admin manual reassignment',
      });
    }

    // Transition to PICKUP_PENDING first if not already there
    if (leg.returnStatus !== LEG_STATUS.PICKUP_PENDING) {
      leg.returnStatus = LEG_STATUS.PICKUP_PENDING;
      await leg.save({ session });
      await addHistoryEntry({
        returnRequestId: leg.returnRequestId,
        sellerReturnId: leg._id,
        fromStatus: oldStatus,
        toStatus: LEG_STATUS.PICKUP_PENDING,
        actorRole: ACTOR_ROLES.ADMIN,
        actorId: adminId,
        note: 'Admin initiated manual assignment',
      });
    }

    // Set assignment
    if (!leg.assignment) leg.assignment = {};
    leg.assignment.deliveryPartnerId = deliveryPartnerId;
    leg.assignment.assignedAt = new Date();
    leg.assignment.status = 'assigned';
    leg.assignment.history = leg.assignment.history || [];
    leg.assignment.history.push({
      partnerId: deliveryPartnerId,
      action: 'assigned',
      at: new Date(),
      reason: 'Manual assignment by admin',
    });

    // Transition to RETURN_PICKUP_ASSIGNED
    leg.returnStatus = LEG_STATUS.RETURN_PICKUP_ASSIGNED;
    await leg.save({ session });

    await addHistoryEntry({
      returnRequestId: leg.returnRequestId,
      sellerReturnId: leg._id,
      fromStatus: LEG_STATUS.PICKUP_PENDING,
      toStatus: LEG_STATUS.RETURN_PICKUP_ASSIGNED,
      actorRole: ACTOR_ROLES.ADMIN,
      actorId: adminId,
      note: `Admin manually assigned delivery partner ${partner.name} (${partner.phone})`,
    });

    await syncMasterStatus(leg.returnRequestId, session);

    await session.commitTransaction();

    logger.info(`[ReturnDispatch] Admin ${adminId} manually assigned leg ${leg._id} to partner ${deliveryPartnerId}`);

    // Notify the assigned rider
    emitReturnAssignmentSocket(deliveryPartnerId, leg);

    return leg;
  } catch (error) {
    await session.abortTransaction();
    logger.error(`[ReturnDispatch] Manual assign error for leg ${sellerReturnId}: ${error.message}`);
    throw error;
  } finally {
    session.endSession();
  }
}
