/**
 * Return Admin Controller
 *
 * Handles API endpoints for ECS Admins to manage return requests,
 * review items, trigger refunds, and view history.
 */

import { ReturnRequest } from '../models/returnRequest.model.js';
import { SellerReturn } from '../../seller/models/sellerReturn.model.js';
import { ReturnStatusHistory } from '../models/returnStatusHistory.model.js';
import * as returnService from '../services/return.service.js';
import * as returnRefundService from '../services/returnRefund.service.js';
import * as returnAssignmentService from '../services/returnAssignment.service.js';
import {
  validateAdminApproveReturn,
  validateCancelReturn,
} from '../validators/return.validator.js';
import { sendResponse, sendError } from '../../../../utils/response.js';
import { ACTOR_ROLES } from '../constants/returnStateMachine.js';
import { logger } from '../../../../utils/logger.js';

export const getAdminReturns = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search, orderId } = req.query;

    const query = {};
    if (status) query.status = status;
    if (orderId) query.orderId = { $regex: orderId, $options: 'i' };
    if (search) query.returnId = { $regex: search, $options: 'i' };

    const returnRequests = await ReturnRequest.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('userId', 'name email phone')
      .lean();

    const total = await ReturnRequest.countDocuments(query);

    return sendResponse(res, 200, 'Admin returns fetched successfully', {
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

export const getAdminReturnDetails = async (req, res) => {
  try {
    const { returnRequestId } = req.params;

    const returnRequest = await ReturnRequest.findById(returnRequestId)
      .populate('userId', 'name email phone')
      .lean();

    if (!returnRequest) {
      return sendError(res, 404, 'Return request not found');
    }

    const legs = await SellerReturn.find({ returnRequestId })
      .populate('sellerId', 'shopName name phone')
      .populate('assignment.deliveryPartnerId', 'name phone')
      .lean();

    const history = await ReturnStatusHistory.find({ returnRequestId })
      .sort({ timestamp: -1 })
      .lean();

    return sendResponse(res, 200, 'Return details fetched', {
      returnRequest,
      legs,
      history,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

export const approveReturn = async (req, res) => {
  try {
    const adminId = req.admin.id || req.admin._id;
    const { returnRequestId } = req.params;
    const validatedData = validateAdminApproveReturn(req.body);

    const returnReq = await returnService.adminApproveReturn({
      returnRequestId,
      adminId,
      approvals: validatedData.approvals,
    });
    
    // Automatically attempt dispatch for any legs that moved to PICKUP_PENDING
    const legs = await SellerReturn.find({ returnRequestId, returnStatus: 'pickup_pending' });
    for (const leg of legs) {
      // Fire and forget auto-assign
      returnAssignmentService.tryAutoReassign(leg._id).catch((err) => {
        logger.error(`[AdminReturn] Auto-dispatch failed for leg ${leg._id}: ${err.message}`);
      });
    }

    return sendResponse(res, 200, 'Return approval processed', {
      returnRequest: returnReq,
    });
  } catch (error) {
    logger.error(`[AdminReturn] Approve error: ${error.message}`);
    return sendError(res, error.statusCode || 500, error.message);
  }
};

export const adminCancelReturn = async (req, res) => {
  try {
    const adminId = req.admin.id || req.admin._id;
    const { returnRequestId } = req.params;
    const validatedData = validateCancelReturn(req.body);

    const result = await returnService.cancelReturn({
      returnRequestId,
      actorRole: ACTOR_ROLES.ADMIN,
      actorId: adminId,
      reason: validatedData.reason,
    });

    return sendResponse(res, 200, 'Return cancelled successfully by admin', {
      returnRequest: result,
    });
  } catch (error) {
    return sendError(res, error.statusCode || 500, error.message);
  }
};

export const processRefund = async (req, res) => {
  try {
    const adminId = req.admin.id || req.admin._id;
    const { sellerReturnId } = req.params;

    const result = await returnRefundService.processLegRefund(sellerReturnId, adminId);

    if (result.success) {
      return sendResponse(res, 200, 'Refund processed successfully', result);
    } else {
      return sendError(res, 400, `Refund failed: ${result.error}`);
    }
  } catch (error) {
    logger.error(`[AdminReturn] Refund error: ${error.message}`);
    return sendError(res, error.statusCode || 500, error.message);
  }
};

export const triggerAutoAssign = async (req, res) => {
  try {
    const { sellerReturnId } = req.params;
    
    // reset attempt counter and trigger
    const leg = await SellerReturn.findById(sellerReturnId);
    if (!leg) return sendError(res, 404, 'Leg not found');
    
    if (leg.assignment) leg.assignment.autoReassignAttempts = 0;
    await leg.save();
    
    await returnAssignmentService.tryAutoReassign(sellerReturnId);
    
    return sendResponse(res, 200, 'Auto assignment triggered');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};
