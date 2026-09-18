import express from 'express';
import { AuthError } from '../../../../core/auth/errors.js';
import { invalidateCategoryCaches } from '../../shared/categoryCache.js';
import * as adminController from '../controllers/admin.controller.js';
import * as advertisementController from '../controllers/advertisement.controller.js';
import roleRoutes from './role.routes.js';
import { getCustomerContactsAdminController } from '../../user/controllers/userContact.controller.js';
import * as foodApprovalController from '../controllers/foodApproval.controller.js';
import * as addonsApprovalController from '../controllers/addonsApproval.controller.js';
import * as subscriptionPlanController from '../controllers/subscriptionPlan.controller.js';

import * as feedbackExperienceController from '../controllers/feedbackExperience.controller.js';
import * as notificationBroadcastController from '../controllers/notificationBroadcast.controller.js';
import * as notificationChannelController from '../controllers/notificationChannel.controller.js';
import * as orderController from '../../orders/controllers/order.controller.js';
import { getAdminPageController, upsertAdminPageController } from '../controllers/pageContent.controller.js';
import * as employeeController from '../controllers/employee.controller.js';
import { upload } from '../../../../middleware/upload.js';
import { checkPermission } from '../../../../core/auth/auth.middleware.js';
import jobRoutes from './job.route.js';
import jobApplicationRoutes from './jobApplication.route.js';

const router = express.Router();


const requireAdmin = (req, _res, next) => {
    const user = req.user;
    if (!user || (user.role !== 'ADMIN' && user.role !== 'EMPLOYEE')) {
        return next(new AuthError('Admin access required'));
    }
    return next();
};

router.use(requireAdmin);

// ----- Broadcast Notifications -----
router.post('/notifications/broadcast', checkPermission('food::system_settings::broadcast', 'create'), notificationBroadcastController.createBroadcastNotificationController);
router.get('/notifications/broadcast', checkPermission('food::system_settings::broadcast', 'view'), notificationBroadcastController.getBroadcastNotificationsController);
router.delete('/notifications/broadcast/:id', checkPermission('food::system_settings::broadcast', 'delete'), notificationBroadcastController.deleteBroadcastNotificationController);

// ----- Notification Channels -----
router.get('/notifications/channels', checkPermission('food::system_settings::broadcast', 'view'), notificationChannelController.getNotificationChannelsController);
router.patch(
    '/notifications/channels/:role/topics/:topicKey',
    checkPermission('food::system_settings::broadcast', 'edit'),
    notificationChannelController.updateNotificationChannelTopicController
);
router.put(
    '/notifications/channels/:role',
    checkPermission('food::system_settings::broadcast', 'edit'),
    notificationChannelController.updateNotificationChannelsBulkController
);

// ----- Customers -----
router.get('/customers', checkPermission('food::customer_management::customers', 'view'), adminController.getCustomers);
router.get('/customers/:id', checkPermission('food::customer_management::customers', 'view'), adminController.getCustomerById);
router.get('/customers/:id/contacts', checkPermission('food::customer_management::customers', 'view'), getCustomerContactsAdminController);
router.patch('/customers/:id/status', checkPermission('food::customer_management::customers', 'edit'), adminController.updateCustomerStatus);
router.patch('/customers/:id/cod-access', checkPermission('food::customer_management::customers', 'edit'), adminController.updateCustomerCodAccess);
router.patch('/customers/cod-access/bulk', checkPermission('food::customer_management::customers', 'edit'), adminController.bulkUpdateCustomersCodAccess);

// ----- Customer Role Requests -----
router.get('/customer-role-requests', checkPermission('food::customer_management::customers', 'view'), adminController.getCustomerRoleRequests);
router.patch('/customer-role-requests/:id/status', checkPermission('food::customer_management::customers', 'edit'), adminController.updateCustomerRoleRequestStatus);

// ----- Safety / Emergency Reports -----
router.get('/safety-emergency-reports', checkPermission('food::help_support::safety_reports', 'view'), adminController.getSafetyEmergencyReports);
router.put('/safety-emergency-reports/:id/status', checkPermission('food::help_support::safety_reports', 'edit'), adminController.updateSafetyEmergencyStatus);
router.put('/safety-emergency-reports/:id/priority', checkPermission('food::help_support::safety_reports', 'edit'), adminController.updateSafetyEmergencyPriority);
router.delete('/safety-emergency-reports/:id', checkPermission('food::help_support::safety_reports', 'delete'), adminController.deleteSafetyEmergencyReport);

// ----- Support Tickets (users) -----
router.get('/support-tickets', checkPermission('food::customer_management::support_tickets', 'view'), adminController.getSupportTicketsController);
router.patch('/support-tickets/:id', checkPermission('food::customer_management::support_tickets', 'edit'), adminController.updateSupportTicketController);
// Shell helpers used by layout/topbar for all authenticated staff (ADMIN bypasses RBAC; EMPLOYEE must still be active)
router.get('/global-search', adminController.globalSearch);
router.get('/restaurants/complaints', checkPermission('food::restaurant_management::restaurants::complaints', 'view'), adminController.getRestaurantComplaints);
router.patch('/restaurants/complaints/:id', checkPermission('food::restaurant_management::restaurants::complaints', 'edit'), adminController.updateRestaurantComplaint);

// ----- Restaurants -----
router.get('/restaurants', checkPermission('food::restaurant_management::restaurants::list', 'view'), adminController.getRestaurants);
router.get('/dashboard-stats', checkPermission('food::dashboard', 'view'), adminController.getDashboardStats);
router.get('/reports/restaurants', checkPermission('food::report_management::restaurant_report::view', 'view'), adminController.getRestaurantReport);
router.get('/reports/transactions', checkPermission('food::report_management::transactions', 'view'), adminController.getTransactionReport);
router.get('/reports/tax', checkPermission('food::report_management::tax', 'view'), adminController.getTaxReport);
router.get('/reports/tax/:id', checkPermission('food::report_management::tax', 'view'), adminController.getTaxReportDetail);
router.get('/restaurants/pending', checkPermission('food::restaurant_management::restaurants::joining_request', 'view'), adminController.getPendingRestaurants);
router.get('/restaurants/reviews', checkPermission('food::restaurant_management::restaurants::reviews', 'view'), adminController.getRestaurantReviews);
router.get('/restaurants/:id', checkPermission('food::restaurant_management::restaurants::list', 'view'), adminController.getRestaurantById);
router.get('/pos-analytics/search', checkPermission('food::restaurant_management::restaurants::list', 'view'), adminController.searchPosAnalytics);
router.get('/restaurants/:id/analytics', checkPermission('food::restaurant_management::restaurants::list', 'view'), adminController.getRestaurantAnalytics);
router.get('/restaurants/:id/menu', checkPermission('food::restaurant_management::restaurants::list', 'view'), adminController.getRestaurantMenuById);
router.get('/restaurants/:id/categories', checkPermission('food::food_management::foods::list', 'view'), adminController.getRestaurantCategoriesForMenu);
router.get('/restaurants/:id/categories/:categoryId/status', checkPermission('food::food_management::foods::list', 'view'), adminController.getRestaurantCategoryStatusForMenu);
router.get('/restaurants/:id/item-slot-timings', checkPermission('food::food_management::foods::list', 'view'), adminController.getRestaurantItemSlotTimingsForMenu);
router.post('/restaurants', checkPermission('food::restaurant_management::restaurants::list', 'create'), adminController.createRestaurant);
router.patch('/restaurants/:id', checkPermission('food::restaurant_management::restaurants::list', 'edit'), adminController.updateRestaurantById);
router.patch('/restaurants/:id/status', checkPermission('food::restaurant_management::restaurants::list', 'edit'), adminController.updateRestaurantStatus);
router.patch('/restaurants/:id/visibility', checkPermission('food::restaurant_management::restaurants::list', 'edit'), adminController.toggleRestaurantListing);
router.patch('/restaurants/:id/show-without-menu', checkPermission('food::restaurant_management::restaurants::list', 'edit'), adminController.toggleShowWithoutMenu);
router.patch('/restaurants/:id/location', checkPermission('food::restaurant_management::restaurants::list', 'edit'), adminController.updateRestaurantLocation);
router.patch('/restaurants/:id/menu', checkPermission('food::restaurant_management::restaurants::list', 'edit'), adminController.updateRestaurantMenuById);
router.patch('/restaurants/:id/approve', checkPermission('food::restaurant_management::restaurants::joining_request', 'edit'), adminController.approveRestaurant);
router.patch('/restaurants/:id/reject', checkPermission('food::restaurant_management::restaurants::joining_request', 'edit'), adminController.rejectRestaurant);

const invalidateCategoryCacheMiddleware = async (req, res, next) => {
    await invalidateCategoryCaches();
    next();
};

// ----- Categories -----
router.get('/categories', checkPermission('food::food_management::categories::list', 'view'), adminController.getCategories);
router.post('/categories', checkPermission('food::food_management::categories::list', 'create'), invalidateCategoryCacheMiddleware, adminController.createCategory);
router.patch('/categories/:id', checkPermission('food::food_management::categories::list', 'edit'), invalidateCategoryCacheMiddleware, adminController.updateCategory);
router.delete('/categories/:id', checkPermission('food::food_management::categories::list', 'delete'), invalidateCategoryCacheMiddleware, adminController.deleteCategory);
router.patch('/categories/:id/toggle', checkPermission('food::food_management::categories::list', 'edit'), invalidateCategoryCacheMiddleware, adminController.toggleCategoryStatus);
router.patch('/categories/:id/approve', checkPermission('food::food_management::categories::list', 'edit'), invalidateCategoryCacheMiddleware, adminController.approveCategory);
router.patch('/categories/:id/reject', checkPermission('food::food_management::categories::list', 'edit'), invalidateCategoryCacheMiddleware, adminController.rejectCategory);
router.patch('/categories/:id/make-global', checkPermission('food::food_management::categories::list', 'edit'), invalidateCategoryCacheMiddleware, adminController.makeCategoryGlobal);

// ----- Restaurant Add-ons Approval -----
router.get('/addons', checkPermission('food::food_management::foods::addons', 'view'), addonsApprovalController.getRestaurantAddons);
router.patch('/addons/:id', checkPermission('food::food_management::foods::addons', 'edit'), addonsApprovalController.updateRestaurantAddon);
router.patch('/addons/:id/approve', checkPermission('food::food_management::foods::addons', 'edit'), addonsApprovalController.approveRestaurantAddon);
router.patch('/addons/:id/reject', checkPermission('food::food_management::foods::addons', 'edit'), addonsApprovalController.rejectRestaurantAddon);

// ----- Foods -----
router.get('/foods', checkPermission('food::food_management::foods::list', 'view'), adminController.getFoods);
router.get('/foods/pending-approvals', checkPermission('food::food_management::food_approval', 'view'), foodApprovalController.getPendingFoodApprovals);
router.get('/foods/:id', checkPermission('food::food_management::foods::list', 'view'), adminController.getFoodById);
router.post('/foods', checkPermission('food::food_management::foods::list', 'create'), adminController.createFood);
router.patch('/foods/:id', checkPermission('food::food_management::foods::list', 'edit'), adminController.updateFood);
router.delete('/foods/:id', checkPermission('food::food_management::foods::list', 'delete'), adminController.deleteFood);
// Food approval queue (pending items created by restaurants)
router.patch('/foods/:id/approve', checkPermission('food::food_management::food_approval', 'edit'), foodApprovalController.approveFoodItemController);
router.patch('/foods/:id/reject', checkPermission('food::food_management::food_approval', 'edit'), foodApprovalController.rejectFoodItemController);

// ----- Offers & Coupons -----
router.get('/offers', checkPermission('food::promotions_management::coupons', 'view'), adminController.getAllOffers);
router.post('/offers', checkPermission('food::promotions_management::coupons', 'create'), adminController.createAdminOffer);
router.patch('/offers/:id/cart-visibility', checkPermission('food::promotions_management::coupons', 'edit'), adminController.updateAdminOfferCartVisibility);
router.patch('/offers/:id/status', checkPermission('food::promotions_management::coupons', 'edit'), adminController.updateAdminOfferStatus);
router.patch('/offers/:id', checkPermission('food::promotions_management::coupons', 'edit'), adminController.updateAdminOffer);
router.delete('/offers/:id', checkPermission('food::promotions_management::coupons', 'delete'), adminController.deleteAdminOffer);
router.get('/restaurant-coupons', checkPermission('food::promotions_management::coupons', 'view'), adminController.getRestaurantCoupons);
router.patch('/restaurant-coupons/:id/status', checkPermission('food::promotions_management::coupons', 'edit'), adminController.updateRestaurantCouponStatus);

// ----- Advertisements -----
router.get('/advertisements', checkPermission('food::promotions_management::advertisement', 'view'), advertisementController.listAdminAdvertisementsController);
router.post(
    '/advertisements',
    checkPermission('food::promotions_management::advertisement', 'create'),
    upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
    advertisementController.createAdminAdvertisementController
);
router.patch(
    '/advertisements/:id',
    checkPermission('food::promotions_management::advertisement', 'edit'),
    upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
    advertisementController.updateAdminAdvertisementController
);
router.get('/advertisement-requests', checkPermission('food::promotions_management::advertisement', 'view'), advertisementController.listAdminAdvertisementRequestsController);
router.patch(
    '/advertisements/:id/status',
    checkPermission('food::promotions_management::advertisement', 'edit'),
    advertisementController.updateAdminAdvertisementStatusController
);
router.patch('/advertisements/:id/priority', checkPermission('food::promotions_management::advertisement', 'edit'), advertisementController.updateAdminAdvertisementPriorityController);
router.delete('/advertisements/:id', checkPermission('food::promotions_management::advertisement', 'delete'), advertisementController.deleteAdminAdvertisementController);

// ----- Feedback Experience (Admin) -----
router.get('/feedback-experiences', checkPermission('food::report_management::customer_report::feedback_experience', 'view'), feedbackExperienceController.getFeedbackExperiences);
router.delete('/feedback-experiences/:id', checkPermission('food::report_management::customer_report::feedback_experience', 'delete'), feedbackExperienceController.deleteFeedbackExperience);

// ----- Fee Settings -----
router.get('/fee-settings', checkPermission('food::deliveryman_management::fee_settings', 'view'), adminController.getFeeSettings);
router.put('/fee-settings', checkPermission('food::deliveryman_management::fee_settings', 'edit'), adminController.createOrUpdateFeeSettings);

// ----- Referral Settings -----
router.get('/referral-settings', checkPermission('food::referral_rewards::referral_settings', 'view'), adminController.getReferralSettings);
router.put('/referral-settings', checkPermission('food::referral_rewards::referral_settings', 'edit'), adminController.createOrUpdateReferralSettings);

// ----- Subscription Plans -----
router.get('/subscription-plans', checkPermission('food::subscription_management::plans', 'view'), subscriptionPlanController.listPlansController);
router.post('/subscription-plans', checkPermission('food::subscription_management::plans', 'create'), subscriptionPlanController.createPlanController);
router.patch('/subscription-plans/:id', checkPermission('food::subscription_management::plans', 'edit'), subscriptionPlanController.updatePlanController);
router.delete('/subscription-plans/:id', checkPermission('food::subscription_management::plans', 'delete'), subscriptionPlanController.deletePlanController);

// ----- Subscription Business Analytics & History -----
router.get('/subscription/overview', checkPermission('food::subscription_management::plans', 'view'), subscriptionPlanController.getSubscriptionOverviewController);
router.get('/subscription/history', checkPermission('food::subscription_management::plans', 'view'), subscriptionPlanController.getSubscriptionHistoryController);
router.get('/subscription/analytics', checkPermission('food::subscription_management::plans', 'view'), subscriptionPlanController.getSubscriptionAnalyticsController);


// ----- Delivery Cash Limit -----
router.get('/delivery-cash-limit', checkPermission('food::deliveryman_management::cash_limit', 'view'), adminController.getDeliveryCashLimit);
router.patch('/delivery-cash-limit', checkPermission('food::deliveryman_management::cash_limit', 'edit'), adminController.updateDeliveryCashLimit);

// ----- Restaurant Withdrawal Limits (separate from delivery) -----
router.get('/restaurant-withdrawal-limit', checkPermission('food::transaction_management::restaurant_withdraws', 'view'), adminController.getRestaurantWithdrawalLimit);
router.patch('/restaurant-withdrawal-limit', checkPermission('food::transaction_management::restaurant_withdraws', 'edit'), adminController.updateRestaurantWithdrawalLimit);

// ----- Deposit Payment Settings -----
router.get('/deposit-payment-settings', checkPermission('food::deliveryman_management::cash_limit', 'view'), adminController.getDepositPaymentSettings);
router.patch('/deposit-payment-settings', checkPermission('food::deliveryman_management::cash_limit', 'edit'), upload.single('qrCodeImage'), adminController.updateDepositPaymentSettings);

// ----- Delivery Emergency Help -----
router.get('/delivery-emergency-help', checkPermission('food::deliveryman_management::emergency_help', 'view'), adminController.getEmergencyHelp);
router.put('/delivery-emergency-help', checkPermission('food::deliveryman_management::emergency_help', 'edit'), adminController.createOrUpdateEmergencyHelp);

// ----- Withdrawals (admin) -----
router.get('/withdrawals', checkPermission('food::transaction_management::restaurant_withdraws', 'view'), adminController.getWithdrawals);
router.patch('/withdrawals/:id', checkPermission('food::transaction_management::restaurant_withdraws', 'edit'), adminController.updateWithdrawalStatus);
router.get('/delivery/withdrawals', checkPermission('food::deliveryman_management::withdrawal', 'view'), adminController.getDeliveryWithdrawals);
router.patch('/delivery/withdrawals/:id', checkPermission('food::deliveryman_management::withdrawal', 'edit'), adminController.updateDeliveryWithdrawalStatus);
router.get('/delivery/cash-limit-settlements', checkPermission('food::deliveryman_management::settlement', 'view'), adminController.getCashLimitSettlements);


// ----- Delivery partners & general -----
router.get('/delivery/join-requests', checkPermission('food::deliveryman_management::deliveryman::join_request', 'view'), adminController.getDeliveryJoinRequests);
router.get('/delivery/:id/submissions', checkPermission('food::deliveryman_management::deliveryman::join_request', 'view'), adminController.getDeliveryPartnerSubmissions);
router.get('/delivery/wallets', checkPermission('food::deliveryman_management::wallet', 'view'), adminController.getDeliveryWallets);
router.patch('/delivery/wallets', checkPermission('food::deliveryman_management::wallet', 'edit'), adminController.updateDeliveryBoyWallet);
router.get('/delivery/bonus-transactions', checkPermission('food::deliveryman_management::deliveryman::bonus', 'view'), adminController.getDeliveryPartnerBonusTransactions);
router.get('/delivery/earnings', checkPermission('food::deliveryman_management::deliveryman::earnings', 'view'), adminController.getDeliveryEarnings);
router.post('/delivery/bonus', checkPermission('food::deliveryman_management::deliveryman::bonus', 'create'), adminController.addDeliveryPartnerBonus);
router.get('/delivery/reviews', checkPermission('food::deliveryman_management::deliveryman::reviews', 'view'), adminController.getDeliverymanReviews);
router.get('/contact-messages', checkPermission('food::help_support::user_feedback', 'view'), adminController.getContactMessages);
router.get('/delivery/earning-addons', checkPermission('food::deliveryman_management::deliveryman::earning_addon', 'view'), adminController.getEarningAddons);
router.post('/delivery/earning-addons', checkPermission('food::deliveryman_management::deliveryman::earning_addon', 'create'), adminController.createEarningAddon);
router.patch('/delivery/earning-addons/:id', checkPermission('food::deliveryman_management::deliveryman::earning_addon', 'edit'), adminController.updateEarningAddon);
router.delete('/delivery/earning-addons/:id', checkPermission('food::deliveryman_management::deliveryman::earning_addon', 'delete'), adminController.deleteEarningAddon);
router.patch('/delivery/earning-addons/:id/status', checkPermission('food::deliveryman_management::deliveryman::earning_addon', 'edit'), adminController.toggleEarningAddonStatus);
router.get('/delivery/earning-addon-history', checkPermission('food::deliveryman_management::deliveryman::earning_addon_history', 'view'), adminController.getEarningAddonHistory);
router.post('/delivery/earning-addon-history/:id/credit', checkPermission('food::deliveryman_management::deliveryman::earning_addon_history', 'create'), adminController.creditEarningToWallet);
router.post('/delivery/earning-addon-history/:id/cancel', checkPermission('food::deliveryman_management::deliveryman::earning_addon_history', 'edit'), adminController.cancelEarningAddonHistory);
router.post('/delivery/earning-addon-completions/check', checkPermission('food::deliveryman_management::deliveryman::earning_addon_history', 'edit'), adminController.checkEarningAddonCompletions);
router.get('/delivery/support-tickets/stats', checkPermission('food::deliveryman_management::support_tickets', 'view'), adminController.getSupportTicketStats);
router.get('/delivery/support-tickets', checkPermission('food::deliveryman_management::support_tickets', 'view'), adminController.getSupportTickets);
router.patch('/delivery/support-tickets/:id', checkPermission('food::deliveryman_management::support_tickets', 'edit'), adminController.updateSupportTicket);
router.get('/delivery/partners', checkPermission('food::deliveryman_management::deliveryman::list', 'view'), adminController.getDeliveryPartners);
router.post(
    '/delivery/partners',
    checkPermission('food::deliveryman_management::deliveryman::list', 'create'),
    upload.any(),
    (req, res, next) => {
        if (Array.isArray(req.files)) {
            const filesObj = {};
            req.files.forEach((f) => {
                if (!filesObj[f.fieldname]) filesObj[f.fieldname] = [];
                filesObj[f.fieldname].push(f);
            });
            req.files = filesObj;
        }
        next();
    },
    adminController.createDeliveryPartner
);
router.get('/delivery/:id', checkPermission('food::deliveryman_management::deliveryman::list', 'view'), adminController.getDeliveryPartnerById);
router.patch('/delivery/:id/approve', checkPermission('food::deliveryman_management::deliveryman::join_request', 'edit'), adminController.approveDeliveryPartner);
router.patch('/delivery/:id/reject', checkPermission('food::deliveryman_management::deliveryman::join_request', 'edit'), adminController.rejectDeliveryPartner);
router.patch('/delivery/:id/active-status', checkPermission('food::deliveryman_management::deliveryman::list', 'edit'), adminController.updateDeliveryPartnerActiveStatus);

// ----- Zones -----
router.get('/zones', checkPermission('food::restaurant_management::zone_setup', 'view'), adminController.getZones);
router.get('/zones/:id', checkPermission('food::restaurant_management::zone_setup', 'view'), adminController.getZoneById);
router.post('/zones', checkPermission('food::restaurant_management::zone_setup', 'create'), adminController.createZone);
router.patch('/zones/:id', checkPermission('food::restaurant_management::zone_setup', 'edit'), adminController.updateZone);
router.delete('/zones/:id', checkPermission('food::restaurant_management::zone_setup', 'delete'), adminController.deleteZone);
router.get('/zones/:id/restaurants', checkPermission('food::restaurant_management::zone_setup', 'view'), adminController.getRestaurantsInZone);


// ----- Orders -----
router.get('/orders', checkPermission('food::order_management::orders', 'view'), orderController.listOrdersAdminController);
router.get('/orders/:orderId/pos-analytics', checkPermission('food::restaurant_management::restaurants::list', 'view'), adminController.getOrderPosAnalytics);
router.get('/orders/:orderId', checkPermission('food::order_management::orders', 'view'), orderController.getOrderByIdAdminController);
router.patch('/orders/:orderId/status', checkPermission('food::order_management::orders', 'edit'), orderController.updateOrderStatusAdminController);
router.post('/orders/:orderId/refund', checkPermission('food::order_management::orders::refunded', 'create'), adminController.processRefund);
router.delete('/orders/:orderId', checkPermission('food::order_management::orders::cancelled', 'delete'), orderController.deleteOrderAdminController);

// ----- CMS Pages (About + legal) -----
router.get('/pages-social-media/:key', checkPermission('food::pages_social_media::[key]', 'view'), getAdminPageController);
router.put('/pages-social-media/:key', checkPermission('food::pages_social_media::[key]', 'edit'), upsertAdminPageController);

// Shell helpers used by layout for all authenticated staff
router.get('/sidebar-badges', adminController.getSidebarBadges);
router.get('/notifications/fssai-expired', adminController.getExpiredFssaiNotifications);

// ----- Deleted Accounts -----
router.get('/deleted-accounts', checkPermission('food::system_settings::deleted_accounts', 'view'), adminController.getDeletedAccounts);
router.post('/deleted-accounts/:id/reactivate', checkPermission('food::system_settings::deleted_accounts', 'edit'), adminController.reactivateAccount);

// ----- RBAC Roles -----
router.use('/roles', roleRoutes);

// ----- Employees -----
router.get('/employees', checkPermission('food::staff_management::list', 'view'), employeeController.getEmployees);
router.post('/employees', checkPermission('food::staff_management::list', 'create'), upload.single('employeeImage'), employeeController.createEmployee);
router.patch('/employees/:id', checkPermission('food::staff_management::list', 'edit'), upload.single('employeeImage'), employeeController.updateEmployee);
router.patch('/employees/:id/status', checkPermission('food::staff_management::list', 'edit'), employeeController.toggleEmployeeStatus);
router.delete('/employees/:id', checkPermission('food::staff_management::list', 'delete'), employeeController.deleteEmployee);

// ----- Careers (Jobs + Applications) -----
router.use('/careers/jobs', jobRoutes);
router.use('/careers/applications', jobApplicationRoutes);

export default router;
