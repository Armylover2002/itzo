/**
 * Return Management System Routes
 *
 * All API routes for returns, properly namespaced and secured with RBAC.
 */

import { Router } from 'express';

// Middleware
import { authMiddleware, requireRoles, deliveryPartnerAuthMiddleware } from '../../../../middleware/auth.js';
import { uploadMiddleware } from '../../../../middleware/upload.js'; // Assuming standard upload middleware
import { rateLimiter } from '../../../../middleware/rateLimit.js';

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
  rateLimiter(5, 60), // Max 5 requests per minute
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
  rateLimiter(3, 60), // Max 3 resends per minute
  returnUserController.requestPickupOtpResend
);

router.use('/user', userRouter);


// ─── ADMIN ROUTES (ECS) ─────────────────────────────────────────────────────
const adminRouter = Router();
adminRouter.use(authMiddleware, requireRoles('ADMIN', 'EMPLOYEE'));

// Get all returns
adminRouter.get('/', returnAdminController.getAdminReturns);

// Get details
adminRouter.get('/:returnRequestId', returnAdminController.getAdminReturnDetails);

// Approve/Reject items
adminRouter.post('/:returnRequestId/approve', returnAdminController.approveReturn);

// Cancel return
adminRouter.post('/:returnRequestId/cancel', returnAdminController.adminCancelReturn);

// Process refund
adminRouter.post('/legs/:sellerReturnId/refund', returnAdminController.processRefund);

// Manually trigger auto-assign
adminRouter.post('/legs/:sellerReturnId/auto-assign', returnAdminController.triggerAutoAssign);

router.use('/admin', adminRouter);


// ─── DELIVERY PARTNER ROUTES (Rider App) ────────────────────────────────────
const deliveryRouter = Router();
deliveryRouter.use(deliveryPartnerAuthMiddleware);

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

router.use('/delivery', deliveryRouter);

export default router;
