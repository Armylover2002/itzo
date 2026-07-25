import express from 'express';
import {
    requestUserOtpController,
    verifyUserOtpController,
    requestAccountRecoveryController,
    adminLoginController,
    refreshTokenController,
    requestRestaurantOtpController,
    verifyRestaurantOtpController,
    requestDeliveryOtpController,
    verifyDeliveryOtpController,

    logoutController,
    logoutAllController,
    getMeController,
    updateAdminProfileController,
    changeAdminPasswordController,
    requestAdminForgotPasswordOtpController,
    resetAdminPasswordWithOtpController,
    getPublicRolesController
} from './auth.controller.js';
import { authMiddleware, requireAdmin } from './auth.middleware.js';
import { authRateLimiter } from '../../middleware/rateLimit.js';

const router = express.Router();

// router.use(authRateLimiter); // Removed global application to avoid rate-limiting /me or /refresh-token too strictly

// User OTP login
router.post('/user/request-otp', authRateLimiter, requestUserOtpController);
router.post('/user/verify-otp', authRateLimiter, verifyUserOtpController);
router.post('/user/request-recovery', authRateLimiter, requestAccountRecoveryController);

// Restaurant OTP login
router.post('/restaurant/request-otp', authRateLimiter, requestRestaurantOtpController);
router.post('/restaurant/verify-otp', authRateLimiter, verifyRestaurantOtpController);

// Delivery partner OTP login
router.post('/delivery/request-otp', authRateLimiter, requestDeliveryOtpController);
router.post('/delivery/verify-otp', authRateLimiter, verifyDeliveryOtpController);





// Admin login
router.post('/admin/login', authRateLimiter, adminLoginController);
router.get('/admin/roles', getPublicRolesController);

// Admin forgot password (no auth required)
router.post('/admin/forgot-password/request-otp', authRateLimiter, requestAdminForgotPasswordOtpController);
router.post('/admin/forgot-password/reset', authRateLimiter, resetAdminPasswordWithOtpController);

// Refresh token
router.post('/refresh-token', refreshTokenController);

// Logout (invalidates refresh token)
router.post('/logout', logoutController);
router.post('/logout-all', logoutAllController);

// Authenticated user profile (requires Bearer token)
router.get('/me', authMiddleware, getMeController);

// Admin-only: profile update & change password (Bearer + ADMIN role)
router.patch('/admin/profile', authMiddleware, requireAdmin, updateAdminProfileController);
router.post('/admin/change-password', authMiddleware, requireAdmin, changeAdminPasswordController);

export default router;

