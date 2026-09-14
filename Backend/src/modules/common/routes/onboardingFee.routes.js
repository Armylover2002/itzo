import express from 'express';
import { authMiddleware, checkPermission } from '../../../core/auth/auth.middleware.js';
import { requireRoles } from '../../../core/roles/role.middleware.js';
import {
    getPublicOnboardingFees,
    createOnboardingPaymentOrder,
    getOnboardingFeesConfig,
    updateOnboardingFeeConfig,
    getOnboardingPayments
} from '../controllers/onboardingFee.controller.js';

const router = express.Router();

// Public routes for onboarding/registration steps
router.get('/public', getPublicOnboardingFees);
router.post('/public/create-order', createOnboardingPaymentOrder);

// Admin-only management routes
router.get('/config', authMiddleware, requireRoles('ADMIN', 'EMPLOYEE'), checkPermission('global::onboarding_fees', 'view'), getOnboardingFeesConfig);
router.put('/config/:role', authMiddleware, requireRoles('ADMIN'), checkPermission('global::onboarding_fees', 'edit'), updateOnboardingFeeConfig);
router.get('/payments', authMiddleware, requireRoles('ADMIN', 'EMPLOYEE'), checkPermission('global::onboarding_fees', 'view'), getOnboardingPayments);

export default router;
