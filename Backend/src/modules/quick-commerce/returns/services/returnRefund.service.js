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
import { refundWalletBalance } from '../../../food/user/services/userWallet.service.js';

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
    // Idempotency Lock: Use findOneAndUpdate to atomically acquire lock
    const leg = await SellerReturn.findOneAndUpdate(
      { 
        _id: sellerReturnId, 
        returnStatus: { $in: [LEG_STATUS.REFUND_PENDING, LEG_STATUS.REFUND_FAILED] },
        refundProcessing: { $ne: true } 
      },
      { $set: { refundProcessing: true } },
      { new: true, session }
    );

    if (!leg) {
      throw new ValidationError(`Cannot process refund. Leg is either locked, already processed, or invalid status.`);
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
    const paymentMethod = String(order.payment?.method || order.paymentMethod || 'cash').toLowerCase();
    
    // Automatically intercept any cash, cod, or wallet order and refund to wallet
    if (['cash', 'cod', 'cash_on_delivery', 'wallet'].includes(paymentMethod)) {
      await refundWalletBalance(order.userId, refundAmount, `Refund for Returned Order ${order.orderId}`, { sellerReturnId: leg._id });

      await updateLegStatus({
        sellerReturnId: leg._id,
        nextStatus: LEG_STATUS.REFUND_COMPLETED,
        actorRole: ACTOR_ROLES.SYSTEM,
        actorId,
        note: 'Cash/Wallet order - refunded to user wallet successfully',
      });
      
      // Update master refund info
      returnReq.refund.actualAmount = (returnReq.refund.actualAmount || 0) + refundAmount;
      returnReq.refund.status = 'processed';
      await returnReq.save({ session });

      await SellerReturn.updateOne({ _id: leg._id }, { $set: { refundProcessing: false } }, { session });
      await session.commitTransaction();
      return { success: true, amount: refundAmount, method: 'wallet' };
    }

    // Gateway refund
    const paymentId = order.payment?.razorpay?.paymentId || order.paymentId;
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

      await SellerReturn.updateOne({ _id: leg._id }, { $set: { refundProcessing: false } }, { session });
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
      await SellerReturn.updateOne({ _id: leg._id }, { $set: { refundProcessing: false } }, { session });
      await session.commitTransaction();
      
      // Auto-retry via Notification or Admin Alert could be queued here
      logger.error(`[ReturnRefund] Gateway refund failed for leg ${leg._id}: ${gatewayResult.error}`);
      return { success: false, error: gatewayResult.error };
    }
  } catch (error) {
    await session.abortTransaction();
    logger.error(`[ReturnRefund] Error processing refund for leg ${sellerReturnId}: ${error.message}`);
    // Unlock if it failed before commit
    await SellerReturn.updateOne({ _id: sellerReturnId }, { $set: { refundProcessing: false } }).catch(() => {});
    throw error;
  } finally {
    session.endSession();
  }
}
