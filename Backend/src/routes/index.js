import express from 'express';
import authRoutes from '../core/auth/auth.routes.js';
import deliveryRoutes from '../modules/food/delivery/routes/delivery.routes.js';
import restaurantRoutes from '../modules/food/restaurant/routes/restaurant.routes.js';
import mediaRoutes from '../modules/media/routes/media.routes.js';
import landingRoutes from '../modules/food/landing/routes/landing.routes.js';
import uploadRoutes from '../modules/uploads/routes/upload.routes.js';
import restaurantAdminRoutes from '../modules/food/admin/routes/admin.routes.js';
import userRoutes from '../modules/food/user/routes/user.routes.js';
import orderUserRoutes from '../modules/food/orders/routes/order.routes.user.js';
import paymentRoutes from '../core/payments/payment.routes.js';
import fcmRoutes from '../core/notifications/fcm.routes.js';
import notificationRoutes from '../core/notifications/notification.routes.js';
import { authMiddleware } from '../core/auth/auth.middleware.js';

import { requireRoles } from '../core/roles/role.middleware.js';
import { getQueuesController } from '../controllers/admin.controller.js';
import { getPublicEnvController } from '../modules/food/landing/controllers/publicEnv.controller.js';
import quickCommerceRoutes from '../modules/quick-commerce/routes/quick-commerce.routes.js';
import webhookRoutes from '../core/payments/routes/webhook.routes.js';
import sellerRoutes from '../modules/quick-commerce/seller/routes/seller.routes.js';
import searchRoutes from '../modules/food/search/routes/search.routes.js';
import subscriptionRoutes from '../modules/food/subscriptions/routes/subscription.routes.js';
import publicDiningRoutes from '../modules/food/dining/routes/publicDining.routes.js';
import adminDiningRoutes from '../modules/food/dining/routes/adminDining.routes.js';
import restaurantDiningRoutes from '../modules/food/dining/routes/restaurantDining.routes.js';
import userDiningRoutes from '../modules/food/dining/routes/userDining.routes.js';
import { requireEnabledModule } from '../middleware/moduleAccess.js';


import commonSettingsRoutes from '../modules/common/routes/settings.routes.js';
import commonMapsRoutes from '../modules/common/routes/maps.routes.js';
import { getGlobalSettings as getPublicSettings } from '../modules/common/controllers/settings.controller.js';
import onboardingFeeRoutes from '../modules/common/routes/onboardingFee.routes.js';

const router = express.Router();

router.get('/v1/health', (req, res) => {
    res.status(200).json({ status: 'UP', message: 'Server is healthy' });
});



// Food-prefixed auth routes (preferred)
router.use('/v1/food/auth', authRoutes);

// Backward-compatible auth routes (legacy)
router.use('/v1/auth', authRoutes);
router.use('/v1/food/delivery', requireEnabledModule('food'), deliveryRoutes);
router.use('/v1/food/restaurant/dining', requireEnabledModule('food'), restaurantDiningRoutes);
router.use('/v1/food/restaurant', requireEnabledModule('food'), restaurantRoutes);
router.use('/v1/media', mediaRoutes);
router.use('/v1/food/subscriptions', requireEnabledModule('food'), subscriptionRoutes);
router.use('/v1/food/dining/public', requireEnabledModule('food'), publicDiningRoutes);
// Landing & hero-banners for Food user app (paths start with /food/hero-banners/...)
router.use('/v1/food', requireEnabledModule('food'), landingRoutes);
router.use('/v1/food/search', requireEnabledModule('food'), searchRoutes);
router.use('/v1/uploads', uploadRoutes);

// Mark business-settings/public as truly public (must be before protected admin block)
// Global Settings routes
router.use('/v1/common/settings', commonSettingsRoutes);
router.use('/v1/common/maps', commonMapsRoutes);
router.use('/v1/common/onboarding-fees', onboardingFeeRoutes);

// Backward compatibility for public settings
router.get('/v1/food/admin/business-settings/public', getPublicSettings);

router.use('/v1/food/admin/dining', requireEnabledModule('food'), authMiddleware, requireRoles('ADMIN', 'EMPLOYEE'), adminDiningRoutes);
router.use('/v1/food/admin', requireEnabledModule('food'), authMiddleware, requireRoles('ADMIN', 'EMPLOYEE'), restaurantAdminRoutes);
router.use('/v1/food/user/dining', requireEnabledModule('food'), authMiddleware, requireRoles('USER'), userDiningRoutes);
router.use('/v1/food/user', requireEnabledModule('food'), authMiddleware, requireRoles('USER'), userRoutes);
router.use('/v1/food/notifications', requireEnabledModule('food'), authMiddleware, requireRoles('USER', 'RESTAURANT', 'DELIVERY_PARTNER'), notificationRoutes);
router.use('/v1/food/orders', requireEnabledModule('food'), authMiddleware, requireRoles('USER'), orderUserRoutes);
router.use('/v1/food/payments', requireEnabledModule('food'), authMiddleware, paymentRoutes);
router.use('/v1/payments/webhook', webhookRoutes);
router.use('/v1/fcm-tokens', fcmRoutes);
router.use('/fcm-tokens', fcmRoutes);
router.use('/v1/quick-commerce', requireEnabledModule('quickCommerce'), quickCommerceRoutes);
router.use('/v1/seller', requireEnabledModule('quickCommerce'), sellerRoutes);


// router.get('/v1/env/public', getPublicEnvController);
// router.get('/env/public', getPublicEnvController);

router.get('/v1/admin/queues', authMiddleware, requireRoles('ADMIN'), getQueuesController);

export default router;
