/**
 * Return Refund Service
 *
 * Handles refund calculation and gateway integration for returned items.
 * Can be triggered automatically upon completion or manually by admin.
 */

import mongoose from 'mongoose';
import { ReturnRequest } from '../models/returnRequest.model.js';
import { SellerReturn } from '../../seller/models/sellerReturn.model.js';
import { QuickOrder } from '../../models/order.model.js';
import { updateLegStatus } from './return.service.js';
import { initiateRazorpayRefund } from '../../../food/orders/helpers/razorpay.helper.js';
import {
  MASTER_STATUS,
  LEG_STATUS,
  ACTOR_ROLES,
} from '../constants/returnStateMachine.js';
import { logger } from '../../../../utils/logger.js';
import { NotFoundError, ValidationError } from '../../../../core/auth/errors.js';
import * as returnNotificationService from './returnNotification.service.js';

/**
 * Recalculates the estimated refund amount based on approved quantities
 * across all legs of the return request.
 */
export async function calculateRefundAmount(returnRequestId) {
  const returnReq = await ReturnRequest.findById(returnRequestId);
  if (!returnReq) return 0;

  let totalAmount = 0;

  // We only refund items that were 'approved' by the admin and actually reached the 'returned'/'refund_pending' state.
  // Actually, standard e-commerce refunds the "approved" quantity that was physically returned.
  // The system updates the 'approvedQty' during admin review or pickup verification.
  const legs = await SellerReturn.find({ returnRequestId });
  
  for (const leg of legs) {
    if (leg.returnStatus === LEG_STATUS.CANCELLED || leg.returnStatus === LEG_STATUS.RETURN_REJECTED) {
      continue;
    }
    
    // Sum up the price * approvedQty for this leg
    let legAmount = 0;
    for (const itemApproval of leg.itemApprovals) {
      if (itemApproval.status === 'approved' && itemApproval.approvedQty > 0) {
        // Find price from original return request items
        const masterItem = returnReq.items.find(i => i.productId.toString() === itemApproval.productId.toString());
        if (masterItem) {
          legAmount += (masterItem.price * itemApproval.approvedQty);
        }
      }
    }
    leg.returnRefundAmount = legAmount;
    await leg.save();
    
    totalAmount += legAmount;
  }
  
  returnReq.refund.estimatedAmount = totalAmount;
  await returnReq.save();
  return totalAmount;
}

/**
 * Processes a refund for a specific seller leg.
 */
export async function processLegRefund(sellerReturnId, actorId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const leg = await SellerReturn.findById(sellerReturnId).session(session);
    if (!leg) throw new NotFoundError('Seller return leg not found');

    if (leg.returnStatus !== LEG_STATUS.REFUND_PENDING) {
      throw new ValidationError(`Cannot refund leg in status ${leg.returnStatus}`);
    }

    const returnReq = await ReturnRequest.findById(leg.returnRequestId).session(session);
    const order = await QuickOrder.findOne({ orderId: leg.orderId }).lean();
    if (!order) throw new NotFoundError('Original order not found');

    const refundAmount = leg.returnRefundAmount || 0;
    if (refundAmount <= 0) {
      // Nothing to refund, just mark completed
      await updateLegStatus({
        sellerReturnId: leg._id,
        nextStatus: LEG_STATUS.REFUND_COMPLETED,
        actorRole: ACTOR_ROLES.SYSTEM,
        actorId,
        note: 'Refund amount was zero',
      });
      await session.commitTransaction();
      return { success: true, amount: 0 };
    }

    // Check payment method
    const paymentMethod = order.paymentMethod;
    if (paymentMethod === 'cash') {
      // Cash orders can't be refunded to gateway. Usually refunded to wallet.
      // Assuming manual or wallet refund for now.
      await updateLegStatus({
        sellerReturnId: leg._id,
        nextStatus: LEG_STATUS.REFUND_COMPLETED,
        actorRole: ACTOR_ROLES.SYSTEM,
        actorId,
        note: 'Cash order - refunded to wallet or handled manually',
      });
      await session.commitTransaction();
      return { success: true, amount: refundAmount, method: 'wallet_or_manual' };
    }

    // Gateway refund
    const paymentId = order.paymentId;
    if (!paymentId) {
      throw new ValidationError('Original payment ID missing for gateway refund');
    }

    const gatewayResult = await initiateRazorpayRefund(paymentId, refundAmount);

    if (gatewayResult.success) {
      await updateLegStatus({
        sellerReturnId: leg._id,
        nextStatus: LEG_STATUS.REFUND_COMPLETED,
        actorRole: ACTOR_ROLES.SYSTEM,
        actorId,
        note: `Gateway refund successful (ID: ${gatewayResult.refundId})`,
        metadata: { refundId: gatewayResult.refundId },
      });
      
      // Update master refund info
      returnReq.refund.actualAmount = (returnReq.refund.actualAmount || 0) + refundAmount;
      returnReq.refund.status = 'processing';
      returnReq.refund.razorpayRefundId = returnReq.refund.razorpayRefundId 
        ? `${returnReq.refund.razorpayRefundId},${gatewayResult.refundId}`
        : gatewayResult.refundId;
      await returnReq.save({ session });

      await session.commitTransaction();
      
      returnNotificationService.notifyRefundProcessed(returnReq, refundAmount).catch(err => logger.error(err));
      
      return { success: true, amount: refundAmount, refundId: gatewayResult.refundId };
    } else {
      await updateLegStatus({
        sellerReturnId: leg._id,
        nextStatus: LEG_STATUS.REFUND_FAILED,
        actorRole: ACTOR_ROLES.SYSTEM,
        actorId,
        note: `Gateway refund failed: ${gatewayResult.error}`,
      });
      await session.commitTransaction();
      return { success: false, error: gatewayResult.error };
    }
  } catch (error) {
    await session.abortTransaction();
    logger.error(`[ReturnRefund] Error processing refund for leg ${sellerReturnId}: ${error.message}`);
    throw error;
  } finally {
    session.endSession();
  }
}
