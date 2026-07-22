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
import { SellerTransaction } from '../../seller/models/sellerTransaction.model.js';
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
 * Records a refund deduction in the seller's transaction ledger.
 *
 * This is called ONLY after the customer refund has successfully been
 * processed (wallet credit or Razorpay gateway). The deduction amount
 * equals the full refund amount the customer received, so the seller
 * bears the entire cost — not the admin/platform.
 *
 * Works correctly for:
 *  - Full returns          — entire receivable deducted
 *  - Partial returns       — only approved qty × price deducted
 *  - Multi-item orders     — per-leg amounts already scoped to approved items
 *  - Multi-seller orders   — each leg has its own sellerId, so each seller
 *                            is charged independently
 *  - Multiple refund legs  — one SellerTransaction per leg (idempotent via
 *                            the refundProcessing lock in processLegRefund)
 *
 * @param {object} params
 * @param {mongoose.Types.ObjectId|string} params.sellerId
 * @param {number}  params.refundAmount   The exact amount refunded to the customer
 * @param {string}  params.orderId        Human-readable orderId (e.g. "ORD-123")
 * @param {string}  params.sellerReturnId The SellerReturn leg _id (used as reference for deduplication)
 * @param {object}  [params.session]      Optional Mongoose session for atomicity
 */
async function recordSellerRefundDeduction({ sellerId, refundAmount, orderId, sellerReturnId, session }) {
  if (!sellerId) {
    logger.warn(`[ReturnRefund] No sellerId on leg ${sellerReturnId} — skipping deduction record`);
    return;
  }
  if (!refundAmount || refundAmount <= 0) return;

  try {
    const txnData = {
      sellerId,
      type: 'Refund',
      // Stored as negative so the earnings calculation can simply sum all
      // transactions of type 'Refund' to get the total deductions.
      amount: -Math.abs(refundAmount),
      status: 'Settled',
      orderId: String(orderId || ''),
      // Use the SellerReturn leg _id as the reference so admin/seller
      // can trace exactly which return triggered this deduction.
      reference: String(sellerReturnId),
      reason: 'Refund deduction for returned items',
    };

    if (session) {
      await SellerTransaction.create([txnData], { session });
    } else {
      await SellerTransaction.create(txnData);
    }

    logger.info(`[ReturnRefund] Seller ${sellerId} deducted ₹${refundAmount} for return leg ${sellerReturnId} (order ${orderId})`);
  } catch (err) {
    // Non-fatal — the customer refund already succeeded. Log and alert but
    // do not roll back the customer refund.
    logger.error(`[ReturnRefund] Failed to record seller deduction for leg ${sellerReturnId}: ${err.message}`);
  }
}

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
export async function processLegRefund(sellerReturnId, actorId, requestedMethod = null) {
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
        session,
      });
      await session.commitTransaction();
      return { success: true, amount: 0 };
    }

    // Check payment method
    const paymentMethod = String(order.payment?.method || order.paymentMethod || 'cash').toLowerCase();
    const isOnline = paymentMethod === 'razorpay' || paymentMethod === 'razorpay_qr';
    
    // Automatically intercept any cash, cod, or wallet order and refund to wallet
    // ALSO route online orders to wallet if the admin explicitly requested it
    if (['cash', 'cod', 'cash_on_delivery', 'wallet'].includes(paymentMethod) || (isOnline && requestedMethod === 'wallet')) {
      await refundWalletBalance(order.userId, refundAmount, `Refund for Returned Order ${order.orderId}`, { sellerReturnId: leg._id });

      await updateLegStatus({
        sellerReturnId: leg._id,
        nextStatus: LEG_STATUS.REFUND_COMPLETED,
        actorRole: ACTOR_ROLES.SYSTEM,
        actorId,
        note: 'Cash/Wallet order - refunded to user wallet successfully',
        session,
      });
      
      // Update master refund info
      returnReq.refund.actualAmount = (returnReq.refund.actualAmount || 0) + refundAmount;
      returnReq.refund.status = 'completed';
      await returnReq.save({ session });

      await SellerReturn.updateOne({ _id: leg._id }, { $set: { refundProcessing: false } }, { session });
      await session.commitTransaction();

      // Deduct the full refund amount from seller earnings AFTER the customer
      // refund has committed. Runs outside the transaction so a deduction
      // failure never rolls back the customer's money.
      await recordSellerRefundDeduction({
        sellerId: leg.sellerId,
        refundAmount,
        orderId: leg.orderId,
        sellerReturnId: leg._id,
      });

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
        session,
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

      // Deduct the full refund amount from seller earnings AFTER the gateway
      // refund has committed. Runs outside the transaction so a deduction
      // failure never rolls back the customer's gateway refund.
      await recordSellerRefundDeduction({
        sellerId: leg.sellerId,
        refundAmount,
        orderId: leg.orderId,
        sellerReturnId: leg._id,
      });
      
      returnNotificationService.notifyRefundProcessed(returnReq, refundAmount).catch(err => logger.error(err));
      
      return { success: true, amount: refundAmount, refundId: gatewayResult.refundId };
    } else {
      await updateLegStatus({
        sellerReturnId: leg._id,
        nextStatus: LEG_STATUS.REFUND_FAILED,
        actorRole: ACTOR_ROLES.SYSTEM,
        actorId,
        note: `Gateway refund failed: ${gatewayResult.error}`,
        session,
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
