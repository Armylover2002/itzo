/**
 * Return Delivery Controller
 *
 * Handles API endpoints for Delivery Partners to manage their return assignments:
 * accept/reject, mark reached, verify OTPs, and complete handovers.
 */

import { SellerReturn } from '../../seller/models/sellerReturn.model.js';
import { SellerTransaction } from '../../seller/models/sellerTransaction.model.js';
import { QuickOrder } from '../../models/order.model.js';
import * as returnAssignmentService from '../services/returnAssignment.service.js';
import * as returnService from '../services/return.service.js';
import * as returnOtpService from '../services/returnOtp.service.js';
import {
  validateOtpVerify,
  validateRejectAssignment,
  validateFailedLeg,
} from '../validators/return.validator.js';
import { sendResponse, sendError } from '../../../../utils/response.js';
import { LEG_STATUS, ACTOR_ROLES } from '../constants/returnStateMachine.js';
import { logger } from '../../../../utils/logger.js';
import {
  emitReturnStatusUpdate,
  emitReturnLegTrackingUpdate,
  emitReturnPickupOtpToUser,
  emitReturnHandoffOtpToSeller,
} from '../services/returnSocket.service.js';
import { creditWallet } from '../../../../core/payments/wallet.service.js';
export const getAssignedReturns = async (req, res) => {
  try {
    const partnerId = req.user.userId;
    const { status } = req.query;

    let query = { 'assignment.deliveryPartnerId': partnerId };
    
    if (status && status !== 'all' && status !== 'active') {
      query.returnStatus = status;
    } else if (status !== 'all') {
      // Default behavior: active returns
      query.returnStatus = { 
        $in: [
          LEG_STATUS.RETURN_PICKUP_ASSIGNED,
          LEG_STATUS.PICKUP_EN_ROUTE,
          LEG_STATUS.PICKUP_REACHED,
          LEG_STATUS.PICKUP_OTP_PENDING,
          LEG_STATUS.PICKED_UP,
          LEG_STATUS.RETURN_EN_ROUTE,
          LEG_STATUS.RETURN_REACHED_SELLER,
          LEG_STATUS.SELLER_OTP_PENDING
        ]
      };
    }

    // A rider can have multiple assignments, but typically one active at a time
    const returns = await SellerReturn.find(query)
      .populate('userId', 'name phone location')
      .populate('sellerId', 'shopName name phone location address')
      .populate('returnRequestId', 'images reason notes returnId orderMongoId')
      .sort({ createdAt: -1 })
      .lean();

    // Enrich returns with original order details for frontend rendering
    for (const ret of returns) {
      if (ret.returnRequestId && ret.returnRequestId.orderMongoId) {
        const order = await QuickOrder.findById(ret.returnRequestId.orderMongoId)
          .select('deliveryAddress pricing riderEarning')
          .lean();
        if (order && order.deliveryAddress) {
          // Build a human-readable address string from deliveryAddress components
          const da = order.deliveryAddress;
          const addressParts = [da.street, da.city, da.state].filter(Boolean);
          
          ret.pickupAddress = {
            ...da,
            address: addressParts.join(', ') || 'Customer Address',
            formattedAddress: addressParts.join(', ') || 'Customer Address',
          };
          
          // A return pickup earns the same as the original delivery leg.
          if (!ret.returnDeliveryCommission || ret.returnDeliveryCommission === 0) {
            ret.returnDeliveryCommission = order.riderEarning || order.pricing?.deliveryFee || 0;
          }
        }
      }
    }

    return sendResponse(res, 200, 'Assigned returns fetched', { returns });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

export const acceptAssignment = async (req, res) => {
  try {
    const partnerId = req.user.userId;
    const { sellerReturnId } = req.params;

    const leg = await returnAssignmentService.acceptReturnAssignment(sellerReturnId, partnerId);

    // Emit live tracking to admin & user
    emitReturnLegTrackingUpdate(leg, LEG_STATUS.PICKUP_EN_ROUTE);

    // Re-fetch with populated data for the response
    const populated = await SellerReturn.findById(sellerReturnId)
      .populate('userId', 'name phone location deliveryAddresses')
      .populate('sellerId', 'shopName name phone location address')
      .populate('returnRequestId', 'images reason notes returnId orderId deliveryAddress')
      .lean();

    return sendResponse(res, 200, 'Assignment accepted successfully', { leg: populated || leg });
  } catch (error) {
    logger.error(`[DeliveryReturn] Accept error: ${error.message}`);
    return sendError(res, 400, error.message);
  }
};

export const rejectAssignment = async (req, res) => {
  try {
    const partnerId = req.user.userId;
    const { sellerReturnId } = req.params;
    const validatedData = validateRejectAssignment(req.body);

    const leg = await returnAssignmentService.rejectReturnAssignment(
      sellerReturnId,
      partnerId,
      validatedData.reason
    );

    // Emit tracking update
    emitReturnLegTrackingUpdate(leg, LEG_STATUS.PICKUP_PENDING);

    return sendResponse(res, 200, 'Assignment rejected successfully', { leg });
  } catch (error) {
    logger.error(`[DeliveryReturn] Reject error: ${error.message}`);
    return sendError(res, 400, error.message);
  }
};

export const markReachedUser = async (req, res) => {
  try {
    const partnerId = req.user.userId;
    const { sellerReturnId } = req.params;

    // 1. Update status to PICKUP_REACHED
    let leg = await returnService.updateLegStatus({
      sellerReturnId,
      nextStatus: LEG_STATUS.PICKUP_REACHED,
      actorRole: ACTOR_ROLES.DELIVERY_PARTNER,
      actorId: partnerId,
      note: 'Rider reached user location',
    });

    // 2. Automatically generate and send the Pickup OTP
    const otpResult = await returnOtpService.generateReturnOtp({
      returnRequestId: leg.returnRequestId,
      sellerReturnId: leg._id,
      type: 'pickup',
      recipientRole: ACTOR_ROLES.USER,
      recipientId: leg.userId,
      recipientPhone: leg.customer?.phone || '',
    });

    if (otpResult?.plainOtp && leg.userId) {
      emitReturnPickupOtpToUser(leg.userId, otpResult.plainOtp, leg.orderId);
    }

    // 3. Move status to PICKUP_OTP_PENDING
    leg = await returnService.updateLegStatus({
      sellerReturnId,
      nextStatus: LEG_STATUS.PICKUP_OTP_PENDING,
      actorRole: ACTOR_ROLES.DELIVERY_PARTNER,
      actorId: partnerId,
      note: 'Pickup OTP generated',
    });

    // Emit live tracking
    emitReturnLegTrackingUpdate(leg, LEG_STATUS.PICKUP_OTP_PENDING);

    return sendResponse(res, 200, 'Reached user and OTP sent', { leg });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message);
  }
};

export const verifyPickupOtp = async (req, res) => {
  try {
    const partnerId = req.user.userId;
    const { sellerReturnId } = req.params;
    
    // Add custom validation for images here to avoid refactoring validation schemas deeply
    const { otp, pickupProofImages } = req.body;
    
    if (!otp) return sendError(res, 400, 'OTP is required');
    if (!Array.isArray(pickupProofImages) || pickupProofImages.length < 1) {
      return sendError(res, 400, 'At least 1 proof of pickup image is required');
    }
    if (pickupProofImages.length > 5) {
      return sendError(res, 400, 'Maximum 5 proof of pickup images allowed');
    }

    const verifyResult = await returnOtpService.verifyReturnOtp({
      sellerReturnId,
      type: 'pickup',
      submittedOtp: otp,
    });

    if (!verifyResult.success) {
      return sendError(res, 400, verifyResult.message, { attemptsRemaining: verifyResult.attemptsRemaining });
    }
    
    // Save the images directly to the SellerReturn
    await SellerReturn.updateOne(
      { _id: sellerReturnId },
      { $set: { pickupProofImages } }
    );

    const leg = await returnService.updateLegStatus({
      sellerReturnId,
      nextStatus: LEG_STATUS.PICKED_UP,
      actorRole: ACTOR_ROLES.DELIVERY_PARTNER,
      actorId: partnerId,
      note: 'Pickup OTP verified',
    });

    // Emit live tracking
    emitReturnLegTrackingUpdate(leg, LEG_STATUS.PICKED_UP);

    return sendResponse(res, 200, 'OTP verified, items picked up', { leg });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message);
  }
};

export const markHeadingToSeller = async (req, res) => {
  try {
    const partnerId = req.user.userId;
    const { sellerReturnId } = req.params;

    const leg = await returnService.updateLegStatus({
      sellerReturnId,
      nextStatus: LEG_STATUS.RETURN_EN_ROUTE, // Also supports RETURN_IN_TRANSIT via map
      actorRole: ACTOR_ROLES.DELIVERY_PARTNER,
      actorId: partnerId,
      note: 'Rider heading to seller',
    });

    // Emit live tracking
    emitReturnLegTrackingUpdate(leg, LEG_STATUS.RETURN_EN_ROUTE);

    return sendResponse(res, 200, 'Heading to seller', { leg });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message);
  }
};

export const markReachedSeller = async (req, res) => {
  try {
    const partnerId = req.user.userId;
    const { sellerReturnId } = req.params;

    let leg = await returnService.updateLegStatus({
      sellerReturnId,
      nextStatus: LEG_STATUS.RETURN_REACHED_SELLER,
      actorRole: ACTOR_ROLES.DELIVERY_PARTNER,
      actorId: partnerId,
      note: 'Rider reached seller location',
    });

    // Automatically generate and send the Seller Handoff OTP
    const otpResult = await returnOtpService.generateReturnOtp({
      returnRequestId: leg.returnRequestId,
      sellerReturnId: leg._id,
      type: 'seller',
      recipientRole: ACTOR_ROLES.SELLER,
      recipientId: leg.sellerId,
    });

    emitReturnHandoffOtpToSeller(leg.sellerId, otpResult.plainOtp, leg._id);

    leg = await returnService.updateLegStatus({
      sellerReturnId,
      nextStatus: LEG_STATUS.SELLER_OTP_PENDING,
      actorRole: ACTOR_ROLES.DELIVERY_PARTNER,
      actorId: partnerId,
      note: 'Seller handoff OTP generated',
    });

    // Emit live tracking
    emitReturnLegTrackingUpdate(leg, LEG_STATUS.SELLER_OTP_PENDING);

    return sendResponse(res, 200, 'Reached seller and OTP sent', { leg });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message);
  }
};

export const verifySellerOtp = async (req, res) => {
  try {
    const partnerId = req.user.userId;
    const { sellerReturnId } = req.params;

    // Idempotency guard: if leg already completed/refund phase, return success
    // This prevents errors from network retries or double-taps
    const currentLeg = await SellerReturn.findById(sellerReturnId).lean();
    if (!currentLeg) return sendError(res, 404, 'Seller return leg not found');

    const alreadyCompletedStatuses = [
      LEG_STATUS.RETURN_COMPLETED,
      LEG_STATUS.RETURNED,
      LEG_STATUS.REFUND_PENDING,
      LEG_STATUS.REFUND_COMPLETED,
    ];
    if (alreadyCompletedStatuses.includes(currentLeg.returnStatus)) {
      return sendResponse(res, 200, 'Handover already completed', { leg: currentLeg });
    }

    const validatedData = validateOtpVerify(req.body);

    const verifyResult = await returnOtpService.verifyReturnOtp({
      sellerReturnId,
      type: 'seller',
      submittedOtp: validatedData.otp,
    });

    if (!verifyResult.success) {
      return sendError(res, 400, verifyResult.message, { attemptsRemaining: verifyResult.attemptsRemaining });
    }

    const leg = await returnService.updateLegStatus({
      sellerReturnId,
      nextStatus: LEG_STATUS.RETURN_COMPLETED,
      actorRole: ACTOR_ROLES.DELIVERY_PARTNER,
      actorId: partnerId,
      note: 'Seller OTP verified, return completed',
    });
    
    // Automatically calculate refunds after successful return to seller
    await returnService.syncMasterStatus(leg.returnRequestId);

    // Emit live tracking — return completed
    emitReturnLegTrackingUpdate(leg, LEG_STATUS.RETURN_COMPLETED);

    // Ensure returnDeliveryCommission is set (fallback for older returns or missed configs)
    let finalCommission = Number(leg.returnDeliveryCommission || 0);
    if (finalCommission <= 0) {
      const originalOrder = await QuickOrder.findOne({ orderId: leg.orderId }).lean();
      finalCommission = Number(originalOrder?.riderEarning || originalOrder?.pricing?.deliveryFee || 0);

      if (finalCommission > 0) {
        // Since it was 0 in DB, seller wasn't charged during approval. Charge them now.
        await SellerTransaction.create([{
            sellerId: leg.sellerId,
            type: 'Adjustment',
            amount: -Math.abs(finalCommission),
            status: 'Settled',
            orderId: leg.orderId,
            reference: String(leg._id),
            reason: 'Return delivery fee deduction (calculated at handover)',
        }]);
        
        // Update the leg so we don't calculate it again
        await SellerReturn.updateOne({ _id: leg._id }, { $set: { returnDeliveryCommission: finalCommission } });
        leg.returnDeliveryCommission = finalCommission;
      }
    }

    // Pay the delivery partner for the return trip
    if (leg.returnDeliveryCommission > 0) {
      try {
        await creditWallet({
          entityId: partnerId,
          entityType: 'DeliveryPartner',
          amount: leg.returnDeliveryCommission,
          reason: `Earning for completed return trip: ${leg.returnRequestId}`,
          category: 'delivery_earning',
        });
        logger.info(`[ReturnDelivery] Credited ₹${leg.returnDeliveryCommission} to partner ${partnerId} for return leg ${leg._id}`);
      } catch (err) {
        logger.error(`[ReturnDelivery] Failed to credit partner ${partnerId} for return leg ${leg._id}: ${err.message}`);
      }
    }

    return sendResponse(res, 200, 'Handover complete', { leg });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message);
  }
};

export const markFailed = async (req, res) => {
  try {
    const partnerId = req.user.userId;
    const { sellerReturnId } = req.params;
    const validatedData = validateFailedLeg(req.body);

    const leg = await SellerReturn.findById(sellerReturnId);
    if (!leg) return sendError(res, 404, 'Leg not found');
    
    let nextStatus = LEG_STATUS.FAILED_PICKUP;
    if ([LEG_STATUS.PICKED_UP, LEG_STATUS.RETURN_EN_ROUTE, LEG_STATUS.RETURN_IN_TRANSIT, LEG_STATUS.RETURN_REACHED_SELLER, LEG_STATUS.SELLER_OTP_PENDING].includes(leg.returnStatus)) {
        nextStatus = LEG_STATUS.FAILED_RETURN;
    }

    const updatedLeg = await returnService.updateLegStatus({
      sellerReturnId,
      nextStatus,
      actorRole: ACTOR_ROLES.DELIVERY_PARTNER,
      actorId: partnerId,
      note: validatedData.reason,
    });

    // Emit live tracking — failure
    emitReturnLegTrackingUpdate(updatedLeg, nextStatus);

    return sendResponse(res, 200, 'Return leg marked as failed', { leg: updatedLeg });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message);
  }
};

export const resendOtp = async (req, res) => {
  try {
    const partnerId = req.user.userId;
    const { sellerReturnId } = req.params;

    const leg = await SellerReturn.findOne({ _id: sellerReturnId, 'assignment.deliveryPartnerId': partnerId }).lean();
    if (!leg) return sendError(res, 404, 'Leg not found or not assigned to you');

    if (leg.returnStatus === LEG_STATUS.PICKUP_OTP_PENDING) {
      const result = await returnOtpService.resendReturnOtp({
        sellerReturnId: leg._id,
        type: 'pickup',
        returnRequestId: leg.returnRequestId,
        recipientRole: ACTOR_ROLES.USER,
        recipientId: leg.userId,
        recipientPhone: req.user.phone || leg.customer?.phone || '',
      });

      if (!result.success) {
        return sendError(res, 400, result.message, { cooldownRemaining: result.cooldownRemaining });
      }

      emitReturnPickupOtpToUser(leg.userId, result.plainOtp, leg.orderId);
      return sendResponse(res, 200, 'Pickup OTP resent successfully', { cooldownRemaining: 60 });
    }

    if (leg.returnStatus === LEG_STATUS.SELLER_OTP_PENDING) {
      const result = await returnOtpService.resendReturnOtp({
        sellerReturnId: leg._id,
        type: 'seller',
        returnRequestId: leg.returnRequestId,
        recipientRole: ACTOR_ROLES.SELLER,
        recipientId: leg.sellerId,
      });

      if (!result.success) {
        return sendError(res, 400, result.message, { cooldownRemaining: result.cooldownRemaining });
      }

      emitReturnHandoffOtpToSeller(leg.sellerId, result.plainOtp, leg._id);
      return sendResponse(res, 200, 'Seller handoff OTP resent successfully', { cooldownRemaining: 60 });
    }

    return sendError(res, 400, 'Cannot resend OTP at this stage');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};
