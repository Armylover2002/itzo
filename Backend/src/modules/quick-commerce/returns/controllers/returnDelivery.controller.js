/**
 * Return Delivery Controller
 *
 * Handles API endpoints for Delivery Partners to manage their return assignments:
 * accept/reject, mark reached, verify OTPs, and complete handovers.
 */

import { SellerReturn } from '../../seller/models/sellerReturn.model.js';
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
import { emitReturnLegTrackingUpdate } from '../services/returnSocket.service.js';

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
      .populate('returnRequestId', 'images reason notes returnId')
      .sort({ createdAt: -1 })
      .lean();

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
