/**
 * Return Management System Routes
 *
 * All API routes for returns, properly namespaced and secured with RBAC.
 */

import { Router } from 'express';

// Middleware
import { authMiddleware } from '../../../../core/auth/auth.middleware.js';
import { requireRoles } from '../../../../core/roles/role.middleware.js';
import { generalApiRateLimiter } from '../../../../middleware/rateLimit.js';
import { upload } from '../../../../middleware/upload.js';

// Controllers
import * as returnUserController from '../controllers/returnUser.controller.js';
import * as returnAdminController from '../controllers/returnAdmin.controller.js';
import * as returnDeliveryController from '../controllers/returnDelivery.controller.js';

const router = Router();

// ─── USER ROUTES (App) ──────────────────────────────────────────────────────
const userRouter = Router();
userRouter.use(authMiddleware, requireRoles('USER'));

// Create return request
userRouter.post(
  '/',
  generalApiRateLimiter,
  returnUserController.createReturn
);

// Get user returns
userRouter.get('/', returnUserController.getUserReturns);

// Get specific return details
userRouter.get('/:returnRequestId', returnUserController.getReturnDetails);

// Cancel return
userRouter.post('/:returnRequestId/cancel', returnUserController.cancelReturn);

// Resend pickup OTP
userRouter.post(
  '/legs/:sellerReturnId/resend-otp',
  generalApiRateLimiter,
  returnUserController.requestPickupOtpResend
);

// Upload return evidence images
userRouter.post(
  '/upload-images',
  upload.array('images', 5), // Max 5 images
  returnUserController.uploadImages
);

router.use('/user', userRouter);


// ─── ADMIN ROUTES (ECS) ─────────────────────────────────────────────────────
const adminRouter = Router();
adminRouter.use(authMiddleware, requireRoles('ADMIN', 'EMPLOYEE'));

// Get all returns
adminRouter.get('/', returnAdminController.getAdminReturns);

// List delivery partners for manual assignment dropdown (MUST be before /:returnRequestId)
adminRouter.get('/delivery-partners', returnAdminController.getDeliveryPartnersList);

// Leg-level operations (static prefix /legs/ - safe from param conflicts)
adminRouter.post('/legs/:sellerReturnId/refund', returnAdminController.processRefund);
adminRouter.post('/legs/:sellerReturnId/auto-assign', returnAdminController.triggerAutoAssign);
adminRouter.post('/legs/:sellerReturnId/manual-assign', returnAdminController.manualAssignDeliveryBoy);

// Dynamic param routes (MUST be after all static paths)
adminRouter.get('/:returnRequestId', returnAdminController.getAdminReturnDetails);
adminRouter.post('/:returnRequestId/approve', returnAdminController.approveReturn);
adminRouter.post('/:returnRequestId/cancel', returnAdminController.adminCancelReturn);

router.use('/admin', adminRouter);


// ─── DELIVERY PARTNER ROUTES (Rider App) ────────────────────────────────────
const deliveryRouter = Router();
deliveryRouter.use(authMiddleware, requireRoles('DELIVERY_PARTNER'));

// Get assigned returns
deliveryRouter.get('/assignments', returnDeliveryController.getAssignedReturns);

// Accept assignment
deliveryRouter.post('/legs/:sellerReturnId/accept', returnDeliveryController.acceptAssignment);

// Reject assignment
deliveryRouter.post('/legs/:sellerReturnId/reject', returnDeliveryController.rejectAssignment);

// Status: Reached User
deliveryRouter.post('/legs/:sellerReturnId/reached-user', returnDeliveryController.markReachedUser);

// Status: Verify Pickup OTP
deliveryRouter.post('/legs/:sellerReturnId/verify-pickup-otp', returnDeliveryController.verifyPickupOtp);

// Status: Heading to Seller
deliveryRouter.post('/legs/:sellerReturnId/heading-to-seller', returnDeliveryController.markHeadingToSeller);

// Status: Reached Seller
deliveryRouter.post('/legs/:sellerReturnId/reached-seller', returnDeliveryController.markReachedSeller);

// Status: Verify Seller OTP (completes the return)
deliveryRouter.post('/legs/:sellerReturnId/verify-seller-otp', returnDeliveryController.verifySellerOtp);

// Status: Failed
deliveryRouter.post('/legs/:sellerReturnId/fail', returnDeliveryController.markFailed);

// Resend OTP (dynamic based on current leg status)
deliveryRouter.post('/legs/:sellerReturnId/resend-otp', returnDeliveryController.resendOtp);

router.use('/delivery', deliveryRouter);

export default router;
