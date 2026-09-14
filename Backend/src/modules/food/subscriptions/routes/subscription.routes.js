import express from 'express';
import * as subscriptionController from '../controllers/subscription.controller.js';
import { authMiddleware } from '../../../../core/auth/auth.middleware.js';
import { requireRoles } from '../../../../core/roles/role.middleware.js';

const router = express.Router();

router.get('/plans', subscriptionController.getPlansController);

// Protected routes for users (Restaurants and Delivery Partners)
router.use(authMiddleware);
router.use(requireRoles('RESTAURANT', 'DELIVERY_PARTNER'));
router.get('/my-subscription', subscriptionController.getMySubscriptionController);
router.post('/purchase', subscriptionController.initiatePurchaseController);
router.post('/verify', subscriptionController.verifyPurchaseController);
router.post('/cancel-auto-renew', subscriptionController.cancelAutoRenewController);

// Wallet Topup & Eligibility
router.post('/wallet/topup', subscriptionController.createTopupOrderController);
router.post('/wallet/verify', subscriptionController.verifyTopupController);
router.get('/wallet/ledger', subscriptionController.getWalletLedgerController);
router.get('/eligibility', subscriptionController.getSubscriptionEligibilityController);

export default router;
