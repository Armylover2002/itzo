import * as subscriptionService from '../../admin/services/subscriptionPlan.service.js';
import * as userSubscriptionService from '../services/subscription.service.js';
import * as walletService from '../services/wallet.service.js';
import { validatePurchaseSubscriptionDto, validateVerifyPurchaseDto } from '../validators/subscription.validator.js';
import { sendResponse } from '../../../../utils/response.js';

export async function getPlansController(req, res, next) {
    try {
        const { userType } = req.query;
        const plans = await subscriptionService.listPlans({ userType, isActive: 'true' });
        return sendResponse(res, 200, 'Subscription plans fetched', plans);
    } catch (err) {
        next(err);
    }
}

export async function createTopupOrderController(req, res, next) {
    try {
        const { userId, role: userType } = req.user;
        const { amount } = req.body;

        const data = await walletService.createTopupOrder(userId, userType, amount);

        return sendResponse(res, 200, 'Topup order created', data.razorpay);
    } catch (err) {
        next(err);
    }
}

export async function initiatePurchaseController(req, res, next) {
    try {
        const { role: userType, userId } = req.user; // Assuming auth middleware provides this
        const dto = validatePurchaseSubscriptionDto(req.body);
        const data = await userSubscriptionService.initiatePurchase(userId, userType, dto);
        return sendResponse(res, 200, 'Subscription initiated', data);
    } catch (err) {
        next(err);
    }
}

export async function verifyPurchaseController(req, res, next) {
    try {
        const { role: userType, userId } = req.user;
        const dto = validateVerifyPurchaseDto(req.body);
        const result = await userSubscriptionService.verifyPurchase(userId, userType, dto);
        return sendResponse(res, 200, 'Subscription verified', result);
    } catch (err) {
        next(err);
    }
}

export async function getMySubscriptionController(req, res, next) {
    try {
        const { role: userType, userId } = req.user;
        const sub = await userSubscriptionService.getActiveSubscription(userId, userType);
        return sendResponse(res, 200, 'Active subscription fetched', sub);
    } catch (err) {
        next(err);
    }
}

export async function verifyTopupController(req, res, next) {
    try {
        const { userId, role: userType } = req.user;
        const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

        if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
            return res.status(400).json({ success: false, message: 'Missing payment details' });
        }

        // Verify signature
        const { fetchRazorpayPayment, verifyPaymentSignature } = await import('../../orders/helpers/razorpay.helper.js');
        const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        const fetchedPayment = await fetchRazorpayPayment(razorpayPaymentId);
        const fetchedOrderId = String(fetchedPayment?.order_id || '').trim();
        const fetchedStatus = String(fetchedPayment?.status || '').toLowerCase();
        if (fetchedOrderId !== String(razorpayOrderId).trim()) {
            return res.status(400).json({ success: false, message: 'Payment order mismatch' });
        }
        if (fetchedStatus !== 'captured') {
            return res.status(400).json({ success: false, message: 'Payment not captured' });
        }

        // Credit wallet
        await walletService.verifyTopup({
            payment: fetchedPayment,
            order: { id: razorpayOrderId },
            notes: {
                ownerId: String(userId),
                ownerType: userType
            }
        });

        return sendResponse(res, 200, 'Payment verified and wallet credited', { verified: true });
    } catch (err) {
        next(err);
    }
}
export async function getSubscriptionEligibilityController(req, res, next) {
    try {
        const { role: userType, userId } = req.user;
        const eligibility = await walletService.ensureDailyPassEligibility(userId, userType);
        return sendResponse(res, 200, 'Subscription eligibility fetched', eligibility);
    } catch (err) {
        next(err);
    }
}
export async function getWalletLedgerController(req, res, next) {
    try {
        const { role: userType, userId } = req.user;
        const { limit, skip } = req.query;
        const data = await walletService.getWalletLedger(userId, userType, { 
            limit: parseInt(limit) || 20, 
            skip: parseInt(skip) || 0 
        });
        return sendResponse(res, 200, 'Wallet ledger fetched', data);
    } catch (err) {
        next(err);
    }
}

export async function cancelAutoRenewController(req, res, next) {
    try {
        const { role: userType, userId } = req.user;
        const result = await userSubscriptionService.cancelAutoRenew(userId, userType);
        return sendResponse(res, 200, 'Subscription auto-renewal cancelled successfully', result);
    } catch (err) {
        next(err);
    }
}
