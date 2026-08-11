import * as subscriptionService from '../../admin/services/subscriptionPlan.service.js';
import * as userSubscriptionService from '../services/subscription.service.js';
import * as walletService from '../services/wallet.service.js';
import { validatePurchaseSubscriptionDto, validateVerifyPurchaseDto } from '../validators/subscription.validator.js';
import { sendResponse } from '../../../../utils/response.js';

import http from 'http';

function reportDebug(event, data) {
    const payload = JSON.stringify({
        sessionId: 'topup-500-crash',
        runId: 'pre',
        timestamp: new Date().toISOString(),
        event,
        data
    });
    const req = http.request('http://127.0.0.1:7778/event', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    });
    req.on('error', () => {});
    req.write(payload);
    req.end();
}

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
        
        // #region debug-point trace-controller
        reportDebug('controller-reached', { userId, userType, amount, body: req.body, user: req.user });
        // #endregion

        const data = await walletService.createTopupOrder(userId, userType, amount);
        
        // #region debug-point trace-controller-success
        reportDebug('service-success', { data });
        // #endregion

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

        // Step 1: Verify Razorpay signature
        const { verifyPaymentSignature, fetchRazorpayPayment } = await import('../../orders/helpers/razorpay.helper.js');
        const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        // Step 2: Fetch actual payment from Razorpay to verify status and amount
        let rzPayment;
        try {
            rzPayment = await fetchRazorpayPayment(razorpayPaymentId);
        } catch (fetchErr) {
            return res.status(400).json({ success: false, message: 'Unable to verify payment with Razorpay. Please contact support.' });
        }

        // Step 3: Verify payment is actually captured (not failed/cancelled/refunded)
        if (rzPayment.status !== 'captured') {
            return res.status(400).json({
                success: false,
                message: `Payment is not completed (status: ${rzPayment.status}). Wallet not credited.`
            });
        }

        // Step 4: Verify the order_id matches to prevent cross-order attacks
        if (rzPayment.order_id && rzPayment.order_id !== razorpayOrderId) {
            return res.status(400).json({ success: false, message: 'Payment order mismatch' });
        }

        // Step 5: Use verified amount from Razorpay (paise → rupees), NOT from req.body
        const verifiedAmountRupees = Math.round(rzPayment.amount) / 100;

        // Credit wallet with verified amount
        await walletService.verifyTopup({
            payment: { id: razorpayPaymentId },
            order: { id: razorpayOrderId },
            notes: {
                ownerId: String(userId),
                ownerType: userType,
                amount: String(verifiedAmountRupees)
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
