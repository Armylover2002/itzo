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
import { findEligiblePartners } from '../../../food/orders/services/order-dispatch.service.js';
import { updateLegStatus } from './return.service.js';
import {
  LEG_STATUS,
  ACTOR_ROLES,
  DEFAULT_RETURN_SETTINGS,
} from '../constants/returnStateMachine.js';
import { getSettingsSync } from '../../../../common/utils/settingsCache.js';
import { logger } from '../../../../utils/logger.js';
import { emitReturnAssignmentSocket } from './returnSocket.service.js';

export async function tryAssignReturnLeg(sellerReturnId, options = {}) {
  const { attempt = 1 } = options;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const leg = await SellerReturn.findById(sellerReturnId).session(session);
    if (!leg) throw new Error('Return leg not found');

    if (leg.returnStatus !== LEG_STATUS.PICKUP_PENDING && leg.returnStatus !== LEG_STATUS.RETURN_APPROVED) {
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

    const { partners } = await findEligiblePartners(searchSource, {
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

    await session.commitTransaction();

    logger.info(`[ReturnDispatch] Assigned leg ${leg._id} to partner ${selectedPartner.partnerId}`);
    
    emitReturnAssignmentSocket(selectedPartner.partnerId, leg._id);

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
