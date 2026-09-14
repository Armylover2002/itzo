import { logger } from '../../../utils/logger.js';
import { sendResponse } from '../../../utils/response.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '../../../core/auth/errors.js';
import {
  cancelQuickCommerceReturnRequest,
  completeQuickCommerceReturnRefund,
  createQuickCommerceReturnRequest,
  getQuickCommerceReturnForAdmin,
  getQuickCommerceReturnStatus,
  listQuickCommerceReturnsForAdmin,
  getReturnPickupOtpForCustomer,
} from '../services/quickReturn.service.js';
import {
  confirmPendingReturnPayout,
  getReturnFinanceReport,
  getSellerFinanceBalanceReport,
  passReturnQualityCheckAndRefund,
} from '../services/quickReturnFinance.service.js';

const mapReturnError = (error) => {
  if (
    error instanceof ValidationError ||
    error instanceof NotFoundError ||
    error instanceof ForbiddenError
  ) {
    return { status: error.statusCode, message: error.message, code: error.code };
  }
  if (Number(error?.code) === 11000) {
    return {
      status: 409,
      message: 'A return request already exists for this order',
      code: 'RETURN_ALREADY_EXISTS',
    };
  }
  const message = String(error?.message || '');
  if (
    error?.code === 'MONGO_NOT_CONNECTED' ||
    /ENOTFOUND|ECONNREFUSED|querySrv/i.test(message)
  ) {
    logger.error(`[ReturnAPI] Mongo connectivity error: ${message}`);
    return {
      status: 503,
      message: 'Database temporarily unavailable. Please retry in a few seconds.',
      code: 'MONGO_UNAVAILABLE',
    };
  }
  return { status: 500, message: message || 'Request failed' };
};

export const createReturnRequestController = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(403).json({ success: false, message: 'Login is required to request a return' });
    }

    const result = await createQuickCommerceReturnRequest({
      orderId: req.params.orderId,
      userId,
      reason: req.body?.reason,
      refundMethod: req.body?.refundMethod,
      items: Array.isArray(req.body?.items) ? req.body.items : [],
      pickupImages: Array.isArray(req.body?.pickupImages) ? req.body.pickupImages : [],
      payoutDetails: req.body?.payoutDetails || {},
    });

    const statusCode = result.alreadyExists ? 200 : 201;
    return sendResponse(
      res,
      statusCode,
      result.message,
      result,
    );
  } catch (error) {
    const mapped = mapReturnError(error);
    logger.error(`createReturnRequest failed: ${mapped.message}`);
    return res.status(mapped.status).json({
      success: false,
      message: mapped.message,
      ...(mapped.code ? { code: mapped.code } : {}),
    });
  }
};

export const getReturnStatusController = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(403).json({ success: false, message: 'Login is required to view return status' });
    }

    const result = await getQuickCommerceReturnStatus({
      orderId: req.params.orderId,
      userId,
    });

    return sendResponse(res, 200, 'Return status fetched successfully', result);
  } catch (error) {
    const mapped = mapReturnError(error);
    logger.error(`getReturnStatus failed: ${mapped.message}`);
    return res.status(mapped.status).json({
      success: false,
      message: mapped.message,
      ...(mapped.code ? { code: mapped.code } : {}),
    });
  }
};

export const cancelReturnRequestController = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(403).json({ success: false, message: 'Login is required to cancel a return' });
    }

    const result = await cancelQuickCommerceReturnRequest({
      orderId: req.params.orderId,
      userId,
      reason: req.body?.reason,
      // @deprecated — accepted for backward compatibility; ignored by service layer.
      returnId: req.body?.returnId,
      sellerId: req.body?.sellerId,
    });

    return sendResponse(res, 200, result.message, result);
  } catch (error) {
    const mapped = mapReturnError(error);
    logger.error(`cancelReturnRequest failed: ${mapped.message}`);
    return res.status(mapped.status).json({
      success: false,
      message: mapped.message,
      ...(mapped.code ? { code: mapped.code } : {}),
    });
  }
};

export const getReturnPickupOtpController = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(403).json({ success: false, message: 'Login is required to view return pickup OTP' });
    }

    const result = await getReturnPickupOtpForCustomer({
      orderId: req.params.orderId,
      userId,
      sellerId: req.query?.sellerId,
    });

    return sendResponse(res, 200, 'Return pickup OTP retrieved', result);
  } catch (error) {
    const mapped = mapReturnError(error);
    logger.error(`getReturnPickupOtp failed: ${mapped.message}`);
    return res.status(mapped.status).json({
      success: false,
      message: mapped.message,
      ...(mapped.code ? { code: mapped.code } : {}),
    });
  }
};

export const listAdminReturnsController = async (req, res) => {
  try {
    const result = await listQuickCommerceReturnsForAdmin({
      page: req.query?.page,
      limit: req.query?.limit,
      status: req.query?.status,
      search: req.query?.search,
      sellerId: req.query?.sellerId,
    });
    return res.json({ success: true, result });
  } catch (error) {
    const mapped = mapReturnError(error);
    return res.status(mapped.status).json({
      success: false,
      message: mapped.message,
      ...(mapped.code ? { code: mapped.code } : {}),
    });
  }
};

export const getAdminReturnByIdController = async (req, res) => {
  try {
    const result = await getQuickCommerceReturnForAdmin(req.params.returnId);
    return res.json({ success: true, result });
  } catch (error) {
    const mapped = mapReturnError(error);
    return res.status(mapped.status).json({
      success: false,
      message: mapped.message,
      ...(mapped.code ? { code: mapped.code } : {}),
    });
  }
};

export const processAdminReturnRefundController = async (req, res) => {
  try {
    const result = await completeQuickCommerceReturnRefund({
      returnId: req.params.returnId,
      actorId: req.user?.userId,
      actorRole: 'ADMIN',
      note: req.body?.note || '',
      payoutReference: req.body?.payoutReference || '',
    });
    return res.json({ success: true, result });
  } catch (error) {
    const mapped = mapReturnError(error);
    return res.status(mapped.status).json({
      success: false,
      message: mapped.message,
      ...(mapped.code ? { code: mapped.code } : {}),
    });
  }
};

export const passReturnQualityCheckController = async (req, res) => {
  try {
    const result = await passReturnQualityCheckAndRefund({
      returnId: req.params.returnId,
      actorId: req.user?.userId,
      actorRole: 'ADMIN',
      notes: req.body?.notes || '',
      force: Boolean(req.body?.force),
    });
    return res.json({ success: true, result });
  } catch (error) {
    const mapped = mapReturnError(error);
    return res.status(mapped.status).json({
      success: false,
      message: mapped.message,
      ...(mapped.code ? { code: mapped.code } : {}),
    });
  }
};

export const confirmReturnPayoutController = async (req, res) => {
  try {
    const result = await confirmPendingReturnPayout({
      returnId: req.params.returnId,
      actorId: req.user?.userId,
      actorRole: 'ADMIN',
      payoutReference: req.body?.payoutReference || '',
      note: req.body?.note || '',
    });
    return res.json({ success: true, result });
  } catch (error) {
    const mapped = mapReturnError(error);
    return res.status(mapped.status).json({
      success: false,
      message: mapped.message,
      ...(mapped.code ? { code: mapped.code } : {}),
    });
  }
};

export const getReturnFinanceReportController = async (_req, res) => {
  try {
    const result = await getReturnFinanceReport();
    return res.json({ success: true, result });
  } catch (error) {
    const mapped = mapReturnError(error);
    return res.status(mapped.status).json({
      success: false,
      message: mapped.message,
      ...(mapped.code ? { code: mapped.code } : {}),
    });
  }
};

export const getSellerFinanceLedgerController = async (req, res) => {
  try {
    const result = await getSellerFinanceBalanceReport(req.params.sellerId);
    return res.json({ success: true, result });
  } catch (error) {
    const mapped = mapReturnError(error);
    return res.status(mapped.status).json({
      success: false,
      message: mapped.message,
      ...(mapped.code ? { code: mapped.code } : {}),
    });
  }
};
