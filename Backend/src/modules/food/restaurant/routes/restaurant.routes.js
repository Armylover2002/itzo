import express from 'express';
import { upload } from '../../../../middleware/upload.js';
import {
    registerRestaurantController,
    saveOnboardingStepController,
    getOnboardingDraftController,
    listApprovedRestaurantsController,
    listUnder250RestaurantsController,
    getApprovedRestaurantController,
    listPublicOffersController,
    getCurrentRestaurantController,
    updateRestaurantProfileController,
    updateRestaurantAcceptingOrdersController,
    uploadRestaurantProfileImageController,
    uploadRestaurantMenuImageController,
    uploadRestaurantCoverImagesController,
    uploadRestaurantMenuImagesController,
    getRestaurantComplaintsController,
    deleteRestaurantAccountController,
    getRestaurantReferralStatsController,
    getRestaurantReferralDetailsController,
    checkSubscriptionEligibilityController
} from '../controllers/restaurant.controller.js';
import {
    createRestaurantSupportTicketController,
    listRestaurantSupportTicketsController
} from '../controllers/supportTicket.controller.js';
import {
    createWithdrawalRequestController,
    listMyWithdrawalsController,
    cancelMyWithdrawalController
} from '../controllers/withdrawal.controller.js';
import {
    listCategoriesController,
    createCategoryController,
    updateCategoryController,
    deleteCategoryController,
    getCategoryStatusController
} from '../controllers/restaurantCategory.controller.js';
import { getMenuController, updateMenuController, getPublicRestaurantMenuController, getPublicMenusBatchController } from '../controllers/restaurantMenu.controller.js';
import { getPublicRestaurantAddonsController } from '../controllers/publicAddons.controller.js';
import * as feedbackExperienceController from '../../admin/controllers/feedbackExperience.controller.js';
import {
    getOutletTimingsByRestaurantIdController,
    getCurrentRestaurantOutletTimingsController,
    upsertCurrentRestaurantOutletTimingsController
} from '../controllers/outletTimings.controller.js';
import {
    createRestaurantFoodController,
    updateRestaurantFoodController
} from '../controllers/restaurantFood.controller.js';
import {
    createItemSlotTimingController,
    deleteItemSlotTimingController,
    getItemSlotTimingByIdController,
    listItemSlotTimingsController,
    updateItemSlotTimingController
} from '../controllers/itemSlotTiming.controller.js';
import {
    listAddonsController,
    createAddonController,
    updateAddonController,
    deleteAddonController
} from '../controllers/restaurantAddon.controller.js';
import * as orderController from '../../orders/controllers/order.controller.js';
import { authMiddleware, optionalAuthMiddleware, requireRestaurantRegistrationToken } from '../../../../core/auth/auth.middleware.js';
import { sendError } from '../../../../utils/response.js';
import { getRestaurantFinanceController, getRestaurantSubscriptionWalletController } from '../controllers/restaurantFinance.controller.js';
import { createTopupOrderController, verifyTopupController } from '../../subscriptions/controllers/subscription.controller.js';
import { FoodRestaurant } from '../models/restaurant.model.js';

import {
    listRestaurantCouponsController,
    createRestaurantCouponController,
    updateRestaurantCouponController,
    deleteRestaurantCouponController
} from '../controllers/restaurantCoupon.controller.js';
import {
    listRestaurantAdvertisementsController,
    getRestaurantAdvertisementController,
    createRestaurantAdvertisementController,
    updateRestaurantAdvertisementController,
    deleteRestaurantAdvertisementController,
    pauseRestaurantAdvertisementController
} from '../controllers/advertisement.controller.js';

import { cacheResponse, invalidateCache } from '../../../../middleware/cache.js';
import { invalidateCategoryCaches } from '../../shared/categoryCache.js';
import { updateLiveLocationController, toggleLiveTrackingController } from '../controllers/vendorLocation.controller.js';
import { vendorLocationRateLimiter } from '../../../../middleware/rateLimit.js';

const router = express.Router();

const requireRestaurant = (req, res, next) => {
    if (req.user?.role !== 'RESTAURANT') {
        return sendError(res, 403, 'Restaurant access required');
    }
    next();
};

const handleAdvertisementUpload = (req, res, next) => {
    upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }])(req, res, (err) => {
        if (!err) return next();
        if (err?.code === 'LIMIT_FILE_SIZE') {
            return sendError(res, 400, 'File size too large. Maximum 5MB allowed per file.');
        }
        if (err?.code === 'LIMIT_UNEXPECTED_FILE') {
            return sendError(res, 400, 'Unexpected file field. Use image or video uploads only.');
        }
        return sendError(res, 400, err.message || 'Failed to upload advertisement files');
    });
};

/**
 * Privileged restaurant APIs: approved outlets, or previously-approved outlets
 * awaiting re-verification. First-time pending accounts are limited to /current.
 */
const requireApprovedRestaurant = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        if (!restaurantId) {
            return sendError(res, 403, 'Restaurant access required');
        }

        const restaurant = await FoodRestaurant.findById(restaurantId)
            .select('status isActive isDeleted accountStatus wasEverApproved')
            .lean();

        if (!restaurant || restaurant.isDeleted === true || restaurant.accountStatus === 'deleted') {
            return sendError(res, 403, 'Restaurant account is deleted/deactivated');
        }

        const status = String(restaurant.status || '').toLowerCase();
        const isApproved = status === 'approved' && restaurant.isActive !== false;
        const isReverificationPending =
            status === 'pending' &&
            restaurant.wasEverApproved === true &&
            restaurant.isActive !== false;

        if (!isApproved && !isReverificationPending) {
            return sendError(res, 403, 'Approved restaurant access required');
        }

        next();
    } catch (error) {
        next(error);
    }
};

const uploadFields = upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'panImage', maxCount: 1 },
    { name: 'gstImage', maxCount: 1 },
    { name: 'fssaiImage', maxCount: 1 },
    { name: 'menuImages', maxCount: 10 }
]);

router.post('/register', requireRestaurantRegistrationToken, uploadFields, registerRestaurantController);
router.post('/onboarding/step/:step', requireRestaurantRegistrationToken, uploadFields, saveOnboardingStepController);
router.get('/onboarding/draft', requireRestaurantRegistrationToken, getOnboardingDraftController);

// Public: approved restaurants list (for user app)
router.get('/menus/batch', cacheResponse(300, 'restaurant_menus_batch'), getPublicMenusBatchController);
// Skip Redis cache when lat/lng present — distanceInKm is request-specific and goes stale
// after outlet address updates if the geo-keyed list response is cached.
router.get('/restaurants', (req, res, next) => {
    if (req.query?.lat != null && req.query?.lng != null) return next();
    return cacheResponse(300, 'restaurants')(req, res, next);
}, listApprovedRestaurantsController);
router.get('/restaurants/under-250', (req, res, next) => {
    if (req.query?.lat != null && req.query?.lng != null) return next();
    return cacheResponse(300, 'restaurants_under_250')(req, res, next);
}, listUnder250RestaurantsController);
router.get('/restaurants/:id', cacheResponse(600, 'restaurant_detail'), getApprovedRestaurantController);
router.get('/restaurants/:id/menu', cacheResponse(600, 'restaurant_menu'), getPublicRestaurantMenuController);
router.get('/restaurants/:id/outlet-timings', cacheResponse(600, 'restaurant_timings'), getOutletTimingsByRestaurantIdController);
router.get('/offers', optionalAuthMiddleware, listPublicOffersController);
// Public: categories list (zone-aware; returns zone categories + global)
router.get('/categories/public', cacheResponse(600, 'categories'), listCategoriesController);

// Restaurant dashboard/profile (Bearer token + RESTAURANT role)
// /current stays open for first-time pending status polling; privileged routes need approval.
router.get('/current', authMiddleware, requireRestaurant, getCurrentRestaurantController);

// Street Food Vendor specific endpoints
router.put('/live-location', authMiddleware, requireRestaurant, vendorLocationRateLimiter, async (req, res, next) => {
    await invalidateCache('restaurants:*');
    await invalidateCache('restaurant_detail:*');
    next();
}, updateLiveLocationController);

router.put('/live-tracking-status', authMiddleware, requireRestaurant, async (req, res, next) => {
    await invalidateCache('restaurants:*');
    await invalidateCache('restaurant_detail:*');
    next();
}, toggleLiveTrackingController);
router.patch('/profile', authMiddleware, requireRestaurant, requireApprovedRestaurant, async (req, res, next) => {
    // Invalidate caches when profile is updated
    await invalidateCache('restaurants:*');
    await invalidateCache('restaurant_detail:*');
    next();
}, updateRestaurantProfileController);
router.patch('/availability', authMiddleware, requireRestaurant, requireApprovedRestaurant, async (req, res, next) => {
    await invalidateCache('restaurants:*');
    await invalidateCache('restaurant_detail:*');
    next();
}, updateRestaurantAcceptingOrdersController);
router.get('/outlet-timings', authMiddleware, requireRestaurant, requireApprovedRestaurant, getCurrentRestaurantOutletTimingsController);
router.put('/outlet-timings', authMiddleware, requireRestaurant, requireApprovedRestaurant, async (req, res, next) => {
    await invalidateCache('restaurants:*');
    await invalidateCache('restaurant_detail:*');
    await invalidateCache('restaurant_timings:*');
    next();
}, upsertCurrentRestaurantOutletTimingsController);
router.get('/finance', authMiddleware, requireRestaurant, requireApprovedRestaurant, getRestaurantFinanceController);

router.get('/subscription-eligibility', authMiddleware, requireRestaurant, requireApprovedRestaurant, checkSubscriptionEligibilityController);
router.get('/subscription-wallet', authMiddleware, requireRestaurant, requireApprovedRestaurant, getRestaurantSubscriptionWalletController);
router.post('/subscription-topup', authMiddleware, requireRestaurant, requireApprovedRestaurant, createTopupOrderController);
router.post('/verify-topup', authMiddleware, requireRestaurant, requireApprovedRestaurant, verifyTopupController);
router.post('/withdraw', authMiddleware, requireRestaurant, requireApprovedRestaurant, createWithdrawalRequestController);
router.get('/withdrawals', authMiddleware, requireRestaurant, requireApprovedRestaurant, listMyWithdrawalsController);
router.post('/withdrawals/:id/cancel', authMiddleware, requireRestaurant, requireApprovedRestaurant, cancelMyWithdrawalController);
router.post(
    '/profile/profile-image',
    authMiddleware,
    requireRestaurant,
    requireApprovedRestaurant,
    upload.single('file'),
    async (req, res, next) => {
        await invalidateCache('restaurants:*');
        await invalidateCache('restaurant_detail:*');
        next();
    },
    uploadRestaurantProfileImageController
);
router.post(
    '/profile/menu-image',
    authMiddleware,
    requireRestaurant,
    requireApprovedRestaurant,
    upload.single('file'),
    async (req, res, next) => {
        await invalidateCache('restaurant_menu:*');
    await invalidateCache('restaurant_menus_batch:*');
        await invalidateCache('restaurant_menus_batch:*');
        next();
    },
    uploadRestaurantMenuImageController
);
router.post(
    '/profile/cover-images',
    authMiddleware,
    requireRestaurant,
    requireApprovedRestaurant,
    upload.array('files', 20),
    async (req, res, next) => {
        await invalidateCache('restaurant_detail:*');
        next();
    },
    uploadRestaurantCoverImagesController
);
router.post(
    '/profile/menu-images',
    authMiddleware,
    requireRestaurant,
    requireApprovedRestaurant,
    upload.array('files', 20),
    async (req, res, next) => {
        await invalidateCache('restaurant_menu:*');
    await invalidateCache('restaurant_menus_batch:*');
        await invalidateCache('restaurant_menus_batch:*');
        next();
    },
    uploadRestaurantMenuImagesController
);

const invalidateCategoryCacheMiddleware = async (req, res, next) => {
    await invalidateCategoryCaches();
    next();
};

// Categories (restaurant dashboard). Read-only for item creation, CRUD for Menu Categories page.
router.get('/categories', authMiddleware, requireRestaurant, requireApprovedRestaurant, listCategoriesController);
router.get('/categories/:id/status', authMiddleware, requireRestaurant, requireApprovedRestaurant, getCategoryStatusController);
router.post('/categories', authMiddleware, requireRestaurant, requireApprovedRestaurant, invalidateCategoryCacheMiddleware, createCategoryController);
router.patch('/categories/:id', authMiddleware, requireRestaurant, requireApprovedRestaurant, invalidateCategoryCacheMiddleware, updateCategoryController);
router.delete('/categories/:id', authMiddleware, requireRestaurant, requireApprovedRestaurant, invalidateCategoryCacheMiddleware, deleteCategoryController);

// Item slot timings (restaurant dashboard)
router.get('/item-slot-timings', authMiddleware, requireRestaurant, requireApprovedRestaurant, listItemSlotTimingsController);
router.get('/item-slot-timings/:id', authMiddleware, requireRestaurant, requireApprovedRestaurant, getItemSlotTimingByIdController);
router.post('/item-slot-timings', authMiddleware, requireRestaurant, requireApprovedRestaurant, async (req, res, next) => {
    await invalidateCache('restaurant_menu:*');
    await invalidateCache('restaurant_menus_batch:*');
    next();
}, createItemSlotTimingController);
router.patch('/item-slot-timings/:id', authMiddleware, requireRestaurant, requireApprovedRestaurant, async (req, res, next) => {
    await invalidateCache('restaurant_menu:*');
    await invalidateCache('restaurant_menus_batch:*');
    next();
}, updateItemSlotTimingController);
router.delete('/item-slot-timings/:id', authMiddleware, requireRestaurant, requireApprovedRestaurant, async (req, res, next) => {
    await invalidateCache('restaurant_menu:*');
    await invalidateCache('restaurant_menus_batch:*');
    next();
}, deleteItemSlotTimingController);

// Menu (restaurant dashboard) - only fields needed by UI
router.get('/menu', authMiddleware, requireRestaurant, requireApprovedRestaurant, getMenuController);
router.patch('/menu', authMiddleware, requireRestaurant, requireApprovedRestaurant, async (req, res, next) => {
    await invalidateCache('restaurant_menu:*');
    await invalidateCache('restaurant_menus_batch:*');
    next();
}, updateMenuController);

// Feedback (restaurant dashboard)
router.post('/feedback-experience', authMiddleware, requireRestaurant, requireApprovedRestaurant, feedbackExperienceController.createFeedbackExperience);

// Public: restaurant add-ons (user app)
router.get('/restaurants/:id/addons', cacheResponse(600, 'restaurant_addons'), getPublicRestaurantAddonsController);

// Foods (restaurant creates/updates items -> stored in food_items collection)
// The public category list only keeps categories that still have an orderable item, so
// item changes have to drop the category cache alongside the menu caches.
router.post('/foods', authMiddleware, requireRestaurant, requireApprovedRestaurant, invalidateCategoryCacheMiddleware, createRestaurantFoodController);
router.patch('/foods/:id', authMiddleware, requireRestaurant, requireApprovedRestaurant, invalidateCategoryCacheMiddleware, updateRestaurantFoodController);

// Add-ons (restaurant dashboard) - approval handled by admin
router.get('/addons', authMiddleware, requireRestaurant, requireApprovedRestaurant, listAddonsController);
router.post('/addons', authMiddleware, requireRestaurant, requireApprovedRestaurant, createAddonController);
router.patch('/addons/:id', authMiddleware, requireRestaurant, requireApprovedRestaurant, updateAddonController);
router.delete('/addons/:id', authMiddleware, requireRestaurant, requireApprovedRestaurant, deleteAddonController);

// Orders (restaurant dashboard)
router.get('/orders', authMiddleware, requireRestaurant, requireApprovedRestaurant, orderController.listOrdersRestaurantController);
router.get('/orders/:orderId', authMiddleware, requireRestaurant, requireApprovedRestaurant, orderController.getOrderByIdRestaurantController);
router.patch('/orders/:orderId/status', authMiddleware, requireRestaurant, requireApprovedRestaurant, orderController.updateOrderStatusRestaurantController);
router.post('/orders/:orderId/resend-notification', authMiddleware, requireRestaurant, requireApprovedRestaurant, orderController.resendDeliveryNotificationRestaurantController);

// Complaints (restaurant dashboard)
router.get('/complaints', authMiddleware, requireRestaurant, requireApprovedRestaurant, getRestaurantComplaintsController);

// Referrals
router.get('/referral-stats', authMiddleware, requireRestaurant, requireApprovedRestaurant, getRestaurantReferralStatsController);
router.get('/referral-details', authMiddleware, requireRestaurant, requireApprovedRestaurant, getRestaurantReferralDetailsController);
router.post('/support/tickets', authMiddleware, requireRestaurant, createRestaurantSupportTicketController);
router.get('/support/tickets', authMiddleware, requireRestaurant, listRestaurantSupportTicketsController);

router.delete('/delete-account', authMiddleware, requireRestaurant, deleteRestaurantAccountController);

// Coupons (restaurant dashboard)
router.get('/coupons', authMiddleware, requireRestaurant, requireApprovedRestaurant, listRestaurantCouponsController);
router.post('/coupons', authMiddleware, requireRestaurant, requireApprovedRestaurant, createRestaurantCouponController);
router.put('/coupons/:id', authMiddleware, requireRestaurant, requireApprovedRestaurant, updateRestaurantCouponController);
router.delete('/coupons/:id', authMiddleware, requireRestaurant, requireApprovedRestaurant, deleteRestaurantCouponController);

// Advertisements (restaurant dashboard)
router.get('/advertisements', authMiddleware, requireRestaurant, requireApprovedRestaurant, listRestaurantAdvertisementsController);
router.get('/advertisements/:id', authMiddleware, requireRestaurant, requireApprovedRestaurant, getRestaurantAdvertisementController);
router.post(
    '/advertisements',
    authMiddleware,
    requireRestaurant,
    requireApprovedRestaurant,
    handleAdvertisementUpload,
    createRestaurantAdvertisementController
);
router.put(
    '/advertisements/:id',
    authMiddleware,
    requireRestaurant,
    requireApprovedRestaurant,
    handleAdvertisementUpload,
    updateRestaurantAdvertisementController
);
router.patch('/advertisements/:id/pause', authMiddleware, requireRestaurant, requireApprovedRestaurant, pauseRestaurantAdvertisementController);
router.delete('/advertisements/:id', authMiddleware, requireRestaurant, requireApprovedRestaurant, deleteRestaurantAdvertisementController);

export default router;

