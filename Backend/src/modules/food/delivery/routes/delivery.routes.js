import express from 'express';
import { upload } from '../../../../middleware/upload.js';
import { authMiddleware } from '../../../../core/auth/auth.middleware.js';
import { requireRoles } from '../../../../core/roles/role.middleware.js';
import * as orderController from '../../orders/controllers/order.controller.js';
import { registerDeliveryPartnerController, updateDeliveryPartnerProfileController, updateDeliveryPartnerBankDetailsController, listSupportTicketsController, createSupportTicketController, getSupportTicketByIdController, updateDeliveryPartnerDetailsController, updateDeliveryPartnerProfilePhotoBase64Controller, updateAvailabilityController, getDeliveryPartnerVehiclesController, setDeliveryPartnerActiveVehicleController, getDriverMapContextController, getWalletController, createWithdrawalRequestController, createCashDepositOrderController, verifyCashDepositPaymentController, getEarningsController, getTripHistoryController, getPocketDetailsController, getEmergencyHelpController, getCashLimitController, getDeliveryReferralStatsController, getActiveEarningAddonsController, deleteDeliveryPartnerAccountController, validateDocumentsController, getSignupVehicleCatalogController } from '../controllers/delivery.controller.js';
import { getDepositPaymentSettingsPublicController } from '../../admin/controllers/admin.controller.js';

const router = express.Router();

const dynamicUpload = [
    upload.any(),
    (req, res, next) => {
        if (Array.isArray(req.files)) {
            const filesObj = {};
            req.files.forEach(f => {
                if (!filesObj[f.fieldname]) filesObj[f.fieldname] = [];
                filesObj[f.fieldname].push(f);
            });
            req.files = filesObj;
        }
        next();
    }
];

router.post('/validate-documents', authMiddleware, validateDocumentsController);

// Make an unauthenticated version for signup step 1
router.post('/validate-documents-public', validateDocumentsController);

// Public vehicle catalog for delivery partner signup (active + food-supported)
router.get('/signup/vehicles', getSignupVehicleCatalogController);

router.post('/register', dynamicUpload, registerDeliveryPartnerController);

router.patch('/profile', authMiddleware, requireRoles('DELIVERY_PARTNER'), dynamicUpload, updateDeliveryPartnerProfileController);
router.delete('/profile', authMiddleware, requireRoles('DELIVERY_PARTNER'), deleteDeliveryPartnerAccountController);

// JSON-only profile updates (no files) – safe for web updates like vehicle number.
router.patch('/profile/details', authMiddleware, requireRoles('DELIVERY_PARTNER'), updateDeliveryPartnerDetailsController);

// Base64 profile photo update – designed for Flutter in-app WebView camera handler.
router.post('/profile/photo-base64', authMiddleware, requireRoles('DELIVERY_PARTNER'), updateDeliveryPartnerProfilePhotoBase64Controller);

router.patch('/profile/bank-details', authMiddleware, requireRoles('DELIVERY_PARTNER'), dynamicUpload, updateDeliveryPartnerBankDetailsController);

router.patch('/availability', authMiddleware, requireRoles('DELIVERY_PARTNER'), updateAvailabilityController);

router.get('/vehicles', authMiddleware, requireRoles('DELIVERY_PARTNER'), getDeliveryPartnerVehiclesController);
router.patch('/vehicles/active', authMiddleware, requireRoles('DELIVERY_PARTNER'), setDeliveryPartnerActiveVehicleController);
router.get('/map/context', authMiddleware, requireRoles('DELIVERY_PARTNER'), getDriverMapContextController);

router.get('/support-tickets', authMiddleware, requireRoles('DELIVERY_PARTNER'), listSupportTicketsController);
router.post('/support-tickets', authMiddleware, requireRoles('DELIVERY_PARTNER'), createSupportTicketController);
router.get('/support-tickets/:id', authMiddleware, requireRoles('DELIVERY_PARTNER'), getSupportTicketByIdController);

// ----- Orders -----
router.get('/orders/current', authMiddleware, requireRoles('DELIVERY_PARTNER'), orderController.getCurrentTripDeliveryController);
router.get('/orders/available', authMiddleware, requireRoles('DELIVERY_PARTNER'), orderController.listOrdersAvailableDeliveryController);
router.get('/orders/:orderId', authMiddleware, requireRoles('DELIVERY_PARTNER'), orderController.getOrderByIdDeliveryController);
router.patch('/orders/:orderId/accept', authMiddleware, requireRoles('DELIVERY_PARTNER'), orderController.acceptOrderDeliveryController);
router.patch('/orders/:orderId/reject', authMiddleware, requireRoles('DELIVERY_PARTNER'), orderController.rejectOrderDeliveryController);
router.patch('/orders/:orderId/reached-pickup', authMiddleware, requireRoles('DELIVERY_PARTNER'), orderController.confirmReachedPickupDeliveryController);
router.patch('/orders/:orderId/confirm-pickup', authMiddleware, requireRoles('DELIVERY_PARTNER'), orderController.confirmPickupDeliveryController);
router.patch('/orders/:orderId/reached-drop', authMiddleware, requireRoles('DELIVERY_PARTNER'), orderController.confirmReachedDropDeliveryController);
router.post('/orders/:orderId/verify-drop-otp', authMiddleware, requireRoles('DELIVERY_PARTNER'), orderController.verifyDropOtpDeliveryController);
router.patch('/orders/:orderId/complete', authMiddleware, requireRoles('DELIVERY_PARTNER'), orderController.completeDeliveryController);
router.patch('/orders/:orderId/status', authMiddleware, requireRoles('DELIVERY_PARTNER'), orderController.updateOrderStatusDeliveryController);
router.post('/orders/:orderId/collect/qr', authMiddleware, requireRoles('DELIVERY_PARTNER'), orderController.createCollectQrController);
router.get('/orders/:orderId/payment-status', authMiddleware, requireRoles('DELIVERY_PARTNER'), orderController.getPaymentStatusController);

// ----- Earnings / Settings -----
router.get('/earning-addons/active', authMiddleware, requireRoles('DELIVERY_PARTNER'), getActiveEarningAddonsController);
router.post('/reverify', authMiddleware, requireRoles('DELIVERY_PARTNER'), (req, res) => res.json({ success: true, message: 'Submitted' })); // Stub

// Pocket / requests page – wallet, earnings, and admin-set delivery settings
router.get('/wallet', authMiddleware, requireRoles('DELIVERY_PARTNER'), getWalletController);
router.post('/wallet/withdraw', authMiddleware, requireRoles('DELIVERY_PARTNER'), createWithdrawalRequestController);
router.post('/wallet/deposit/order', authMiddleware, requireRoles('DELIVERY_PARTNER'), createCashDepositOrderController);
router.post('/wallet/deposit/verify', authMiddleware, requireRoles('DELIVERY_PARTNER'), verifyCashDepositPaymentController);
router.get('/wallet/deposit/settings', authMiddleware, requireRoles('DELIVERY_PARTNER'), getDepositPaymentSettingsPublicController);
router.get('/earnings', authMiddleware, requireRoles('DELIVERY_PARTNER'), getEarningsController);
router.get('/trip-history', authMiddleware, requireRoles('DELIVERY_PARTNER'), getTripHistoryController);
router.get('/pocket-details', authMiddleware, requireRoles('DELIVERY_PARTNER'), getPocketDetailsController);
router.get('/emergency-help', authMiddleware, requireRoles('DELIVERY_PARTNER'), getEmergencyHelpController);
router.get('/cash-limit', authMiddleware, requireRoles('DELIVERY_PARTNER'), getCashLimitController);
router.get('/referrals/stats', authMiddleware, requireRoles('DELIVERY_PARTNER'), getDeliveryReferralStatsController);

export default router;

