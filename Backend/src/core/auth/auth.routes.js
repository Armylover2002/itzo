import express from 'express';
import {
    requestUserOtpController,
    verifyUserOtpController,
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
import {
    authRateLimiter,
    otpRequestRateLimiter,
    otpVerifyRateLimiter
} from '../../middleware/rateLimit.js';

const router = express.Router();

// router.use(authRateLimiter); // Removed global application to avoid rate-limiting /me or /refresh-token too strictly

// OTP routes carry two limiters: a per-IP ceiling and a per-phone one. The per-phone
// limit is what protects SMS spend, since an attacker can rotate IPs freely.
const otpRequestGuards = [authRateLimiter, otpRequestRateLimiter];
const otpVerifyGuards = [authRateLimiter, otpVerifyRateLimiter];

// User OTP login
router.post('/user/request-otp', otpRequestGuards, requestUserOtpController);
router.post('/user/verify-otp', otpVerifyGuards, verifyUserOtpController);

// Restaurant OTP login
router.post('/restaurant/request-otp', otpRequestGuards, requestRestaurantOtpController);
router.post('/restaurant/verify-otp', otpVerifyGuards, verifyRestaurantOtpController);

// Delivery partner OTP login
router.post('/delivery/request-otp', otpRequestGuards, requestDeliveryOtpController);
router.post('/delivery/verify-otp', otpVerifyGuards, verifyDeliveryOtpController);





// Admin login
router.post('/admin/login', [authRateLimiter, otpVerifyRateLimiter], adminLoginController);
// Public read used to populate the login form; the auth limiter would lock out the
// login page itself, so only the global API limiter applies here.
router.get('/admin/roles', getPublicRolesController);

// Admin forgot password (no auth required)
router.post('/admin/forgot-password/request-otp', otpRequestGuards, requestAdminForgotPasswordOtpController);
router.post('/admin/forgot-password/reset', otpVerifyGuards, resetAdminPasswordWithOtpController);

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

