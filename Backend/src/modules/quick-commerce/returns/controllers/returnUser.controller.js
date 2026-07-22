/**
 * Return User Controller
 *
 * Handles API endpoints for end-users to create, view, and cancel returns.
 */

import { ReturnRequest } from '../models/returnRequest.model.js';
import { SellerReturn } from '../../seller/models/sellerReturn.model.js';
import { ReturnStatusHistory } from '../models/returnStatusHistory.model.js';
import { ReturnOtp } from '../models/returnOtp.model.js';
import * as returnService from '../services/return.service.js';
import * as returnOtpService from '../services/returnOtp.service.js';
import {
  validateCreateReturnRequest,
  validateCancelReturn,
} from '../validators/return.validator.js';
import { sendResponse, sendError } from '../../../../utils/response.js';
import { ACTOR_ROLES } from '../constants/returnStateMachine.js';
import { logger } from '../../../../utils/logger.js';
import { uploadImageBuffer } from '../../../../services/cloudinary.service.js';

export const createReturn = async (req, res) => {
  try {
    const userId = req.user.userId;
    const validatedData = validateCreateReturnRequest(req.body);

    const returnRequest = await returnService.createReturnRequest({
      userId,
      orderId: validatedData.orderId,
      items: validatedData.items,
      reason: validatedData.reason,
      notes: validatedData.notes,
      images: validatedData.images,
    });

    return sendResponse(res, 201, 'Return request created successfully', {
      returnRequest,
    });
  } catch (error) {
    logger.error(`[UserReturn] Create error: ${error.message}`);
    return sendError(res, error.statusCode || 500, error.message);
  }
};

export const getUserReturns = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, status } = req.query;

    const query = { userId };
    if (status) query.status = status;

    const returnRequests = await ReturnRequest.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await ReturnRequest.countDocuments(query);

    return sendResponse(res, 200, 'Returns fetched successfully', {
      returns: returnRequests,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

export const getReturnDetails = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { returnRequestId } = req.params;

    const returnRequest = await ReturnRequest.findOne({
      _id: returnRequestId,
      userId,
    }).lean();

    if (!returnRequest) {
      return sendError(res, 404, 'Return request not found');
    }

    const legs = await SellerReturn.find({ returnRequestId }).lean();
    const history = await ReturnStatusHistory.find({ returnRequestId })
      .sort({ timestamp: -1 })
      .lean();

    let pickupOtp = null;
    const activePickupLeg = legs.find(l => ['RETURN_PICKUP_ASSIGNED', 'PICKUP_EN_ROUTE', 'PICKUP_REACHED', 'PICKUP_OTP_PENDING'].includes(l.returnStatus));
    if (activePickupLeg) {
      const otpDoc = await ReturnOtp.findOne({ 
        sellerReturnId: activePickupLeg._id, 
        type: 'pickup', 
        verified: false,
        expiresAt: { $gt: new Date() }
      }).select('+plainOtp').sort({ createdAt: -1 }).lean();
      
      if (otpDoc?.plainOtp) {
        pickupOtp = otpDoc.plainOtp;
      }
    }

    return sendResponse(res, 200, 'Return details fetched', {
      returnRequest,
      legs,
      history,
      pickupOtp,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

export const cancelReturn = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { returnRequestId } = req.params;
    const validatedData = validateCancelReturn(req.body);

    const returnReq = await ReturnRequest.findOne({ _id: returnRequestId, userId });
    if (!returnReq) return sendError(res, 404, 'Return request not found');

    const result = await returnService.cancelReturn({
      returnRequestId,
      actorRole: ACTOR_ROLES.USER,
      actorId: userId,
      reason: validatedData.reason,
    });

    return sendResponse(res, 200, 'Return request cancelled successfully', {
      returnRequest: result,
    });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message);
  }
};

export const requestPickupOtpResend = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sellerReturnId } = req.params;

    const leg = await SellerReturn.findOne({ _id: sellerReturnId, userId }).lean();
    if (!leg) return sendError(res, 404, 'Seller return leg not found');

    const result = await returnOtpService.resendReturnOtp({
      sellerReturnId: leg._id,
      type: 'pickup',
      returnRequestId: leg.returnRequestId,
      recipientRole: ACTOR_ROLES.USER,
      recipientId: userId,
      recipientPhone: req.user.phone || leg.customer?.phone || '',
    });

    if (!result.success) {
      return sendError(res, 400, result.message);
    }

    // In a real scenario, this is where SMS sending would be hooked in
    // await sendReturnSms(phone, `Your return pickup OTP is ${result.plainOtp}`);

    return sendResponse(res, 200, 'Pickup OTP resent successfully', {
      message: result.message,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

export const uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return sendError(res, 400, 'No images provided');
    }

    const uploadedUrls = [];
    for (const file of req.files) {
      const url = await uploadImageBuffer(file.buffer, 'quick-commerce/returns');
      uploadedUrls.push(url);
    }

    return sendResponse(res, 200, 'Images uploaded successfully', {
      images: uploadedUrls,
    });
  } catch (error) {
    logger.error(`[UserReturn] Image upload error: ${error.message}`);
    return sendError(res, 500, 'Failed to upload images');
  }
};
