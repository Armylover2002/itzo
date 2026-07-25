import express from 'express';
import { AuthError } from '../../../../core/auth/errors.js';
import * as adminController from '../controllers/admin.controller.js';
import roleRoutes from './role.routes.js';
import { getCustomerContactsAdminController } from '../../user/controllers/userContact.controller.js';
import * as foodApprovalController from '../controllers/foodApproval.controller.js';
import * as addonsApprovalController from '../controllers/addonsApproval.controller.js';
import * as subscriptionPlanController from '../controllers/subscriptionPlan.controller.js';

import * as feedbackExperienceController from '../controllers/feedbackExperience.controller.js';
import * as notificationBroadcastController from '../controllers/notificationBroadcast.controller.js';
import * as diningAdminController from '../../dining/controllers/diningAdmin.controller.js';
import * as orderController from '../../orders/controllers/order.controller.js';
import { getAdminPageController, upsertAdminPageController } from '../controllers/pageContent.controller.js';
import * as employeeController from '../controllers/employee.controller.js';
import { upload } from '../../../../middleware/upload.js';
import { checkPermission } from '../../../../core/auth/auth.middleware.js';

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
router.get('/notifications/broadcast', notificationBroadcastController.getBroadcastNotificationsController);
router.delete('/notifications/broadcast/:id', checkPermission('food::system_settings::broadcast', 'delete'), notificationBroadcastController.deleteBroadcastNotificationController);

// ----- Customers -----
router.get('/customers', adminController.getCustomers);
router.get('/customers/recovery-requests', checkPermission('food::customer_management::customers', 'view'), adminController.getRecoveryRequests);
router.get('/customers/:id', adminController.getCustomerById);
router.get('/customers/:id/contacts', checkPermission('food::customer_management::customers', 'view'), getCustomerContactsAdminController);
router.post('/customers/:id/approve-recovery', checkPermission('food::customer_management::customers', 'edit'), adminController.approveRecoveryRequest);
router.patch('/customers/:id/status', checkPermission('food::customer_management::customers', 'edit'), adminController.updateCustomerStatus);
router.patch('/customers/:id/cod-access', checkPermission('food::customer_management::customers', 'edit'), adminController.updateCustomerCodAccess);
router.patch('/customers/cod-access/bulk', checkPermission('food::customer_management::customers', 'edit'), adminController.bulkUpdateCustomersCodAccess);

// ----- Safety / Emergency Reports -----
router.get('/safety-emergency-reports', adminController.getSafetyEmergencyReports);
router.put('/safety-emergency-reports/:id/status', checkPermission('food::help_support::safety_reports', 'edit'), adminController.updateSafetyEmergencyStatus);
router.put('/safety-emergency-reports/:id/priority', checkPermission('food::help_support::safety_reports', 'edit'), adminController.updateSafetyEmergencyPriority);
router.delete('/safety-emergency-reports/:id', checkPermission('food::help_support::safety_reports', 'delete'), adminController.deleteSafetyEmergencyReport);

// ----- Support Tickets (users) -----
router.get('/support-tickets', adminController.getSupportTicketsController);
router.patch('/support-tickets/:id', checkPermission('food::customer_management::support_tickets', 'edit'), adminController.updateSupportTicketController);
router.get('/global-search', adminController.globalSearch);
router.get('/restaurants/complaints', adminController.getRestaurantComplaints);
router.patch('/restaurants/complaints/:id', checkPermission('food::restaurant_management::restaurants::complaints', 'edit'), adminController.updateRestaurantComplaint);

// ----- Restaurants -----
router.get('/restaurants', adminController.getRestaurants);
router.get('/dashboard-stats', adminController.getDashboardStats);
router.get('/reports/restaurants', adminController.getRestaurantReport);
router.get('/reports/transactions', adminController.getTransactionReport);
router.get('/reports/tax', adminController.getTaxReport);
router.get('/reports/tax/:id', adminController.getTaxReportDetail);
router.get('/restaurants/pending', checkPermission('food::restaurant_management::restaurants::joining_request', 'view'), adminController.getPendingRestaurants);
router.get('/restaurants/reviews', adminController.getRestaurantReviews);
router.get('/restaurants/:id', adminController.getRestaurantById);
router.get('/restaurants/:id/analytics', adminController.getRestaurantAnalytics);
router.get('/restaurants/:id/menu', adminController.getRestaurantMenuById);
router.post('/restaurants', checkPermission('food::restaurant_management::restaurants::list', 'create'), adminController.createRestaurant);
router.patch('/restaurants/:id', checkPermission('food::restaurant_management::restaurants::list', 'edit'), adminController.updateRestaurantById);
router.patch('/restaurants/:id/status', checkPermission('food::restaurant_management::restaurants::list', 'edit'), adminController.updateRestaurantStatus);
router.patch('/restaurants/:id/location', checkPermission('food::restaurant_management::restaurants::list', 'edit'), adminController.updateRestaurantLocation);
router.patch('/restaurants/:id/menu', checkPermission('food::restaurant_management::restaurants::list', 'edit'), adminController.updateRestaurantMenuById);
router.patch('/restaurants/:id/approve', checkPermission('food::restaurant_management::restaurants::joining_request', 'edit'), adminController.approveRestaurant);
router.patch('/restaurants/:id/reject', checkPermission('food::restaurant_management::restaurants::joining_request', 'edit'), adminController.rejectRestaurant);

// ----- Categories -----
router.get('/categories', adminController.getCategories);
router.post('/categories', checkPermission('food::food_management::categories::list', 'create'), adminController.createCategory);
router.patch('/categories/:id', checkPermission('food::food_management::categories::list', 'edit'), adminController.updateCategory);
router.delete('/categories/:id', checkPermission('food::food_management::categories::list', 'delete'), adminController.deleteCategory);
router.patch('/categories/:id/toggle', checkPermission('food::food_management::categories::list', 'edit'), adminController.toggleCategoryStatus);
router.patch('/categories/:id/approve', checkPermission('food::food_management::categories::list', 'edit'), adminController.approveCategory);
router.patch('/categories/:id/reject', checkPermission('food::food_management::categories::list', 'edit'), adminController.rejectCategory);
router.patch('/categories/:id/make-global', checkPermission('food::food_management::categories::list', 'edit'), adminController.makeCategoryGlobal);

// ----- Restaurant Add-ons Approval -----
router.get('/addons', addonsApprovalController.getRestaurantAddons);
router.patch('/addons/:id', checkPermission('food::food_management::foods::addons', 'edit'), addonsApprovalController.updateRestaurantAddon);
router.patch('/addons/:id/approve', checkPermission('food::food_management::foods::addons', 'edit'), addonsApprovalController.approveRestaurantAddon);
router.patch('/addons/:id/reject', checkPermission('food::food_management::foods::addons', 'edit'), addonsApprovalController.rejectRestaurantAddon);

// ----- Foods -----
router.get('/foods', adminController.getFoods);
router.post('/foods', checkPermission('food::food_management::foods::list', 'create'), adminController.createFood);
router.patch('/foods/:id', checkPermission('food::food_management::foods::list', 'edit'), adminController.updateFood);
router.delete('/foods/:id', checkPermission('food::food_management::foods::list', 'delete'), adminController.deleteFood);
// Food approval queue (pending items created by restaurants)
router.get('/foods/pending-approvals', checkPermission('food::food_management::food_approval', 'view'), foodApprovalController.getPendingFoodApprovals);
router.patch('/foods/:id/approve', checkPermission('food::food_management::food_approval', 'edit'), foodApprovalController.approveFoodItemController);
router.patch('/foods/:id/reject', checkPermission('food::food_management::food_approval', 'edit'), foodApprovalController.rejectFoodItemController);

// ----- Offers & Coupons -----
router.get('/offers', adminController.getAllOffers);
router.post('/offers', checkPermission('food::promotions_management::coupons', 'create'), adminController.createAdminOffer);
router.patch('/offers/:id/cart-visibility', checkPermission('food::promotions_management::coupons', 'edit'), adminController.updateAdminOfferCartVisibility);
router.delete('/offers/:id', checkPermission('food::promotions_management::coupons', 'delete'), adminController.deleteAdminOffer);

// ----- Feedback Experience (Admin) -----
router.get('/feedback-experiences', feedbackExperienceController.getFeedbackExperiences);
router.delete('/feedback-experiences/:id', checkPermission('food::report_management::customer_report::feedback_experience', 'delete'), feedbackExperienceController.deleteFeedbackExperience);

// ----- Fee Settings -----
router.get('/fee-settings', checkPermission('food::deliveryman_management::fee_settings', 'view'), adminController.getFeeSettings);
router.put('/fee-settings', checkPermission('food::deliveryman_management::fee_settings', 'edit'), adminController.createOrUpdateFeeSettings);

// ----- Referral Settings -----
router.get('/referral-settings', adminController.getReferralSettings);
router.put('/referral-settings', checkPermission('food::referral_rewards::referral_settings', 'edit'), adminController.createOrUpdateReferralSettings);

// ----- Subscription Plans -----
router.get('/subscription-plans', checkPermission('food::subscription_management::plans', 'view'), subscriptionPlanController.listPlansController);
router.post('/subscription-plans', checkPermission('food::subscription_management::plans', 'create'), subscriptionPlanController.createPlanController);
router.patch('/subscription-plans/:id', checkPermission('food::subscription_management::plans', 'edit'), subscriptionPlanController.updatePlanController);
router.delete('/subscription-plans/:id', checkPermission('food::subscription_management::plans', 'delete'), subscriptionPlanController.deletePlanController);

// ----- Subscription Business Analytics & History -----
router.get('/subscription/overview', subscriptionPlanController.getSubscriptionOverviewController);
router.get('/subscription/history', subscriptionPlanController.getSubscriptionHistoryController);
router.get('/subscription/analytics', subscriptionPlanController.getSubscriptionAnalyticsController);


// ----- Delivery Cash Pay Requests -----
router.get('/delivery-cash-pay-requests', checkPermission('food::deliveryman_management::settlement', 'view'), adminController.getCashPayRequests);

// ----- Delivery Cash Limit -----
router.get('/delivery-cash-limit', checkPermission('food::deliveryman_management::cash_limit', 'view'), adminController.getDeliveryCashLimit);
router.patch('/delivery-cash-limit', checkPermission('food::deliveryman_management::cash_limit', 'edit'), adminController.updateDeliveryCashLimit);
router.patch('/delivery-cash-deposit/:id/status', checkPermission('food::deliveryman_management::cash_limit', 'edit'), adminController.updateDeliveryCashDepositStatus);

// ----- Delivery Emergency Help -----
router.get('/delivery-emergency-help', adminController.getEmergencyHelp);
router.put('/delivery-emergency-help', checkPermission('food::deliveryman_management::emergency_help', 'edit'), adminController.createOrUpdateEmergencyHelp);

// ----- Withdrawals (admin) -----
router.get('/withdrawals', checkPermission('food::transaction_management::restaurant_withdraws', 'view'), adminController.getWithdrawals);
router.patch('/withdrawals/:id', checkPermission('food::transaction_management::restaurant_withdraws', 'edit'), adminController.updateWithdrawalStatus);
router.get('/delivery/withdrawals', checkPermission('food::deliveryman_management::withdrawal', 'view'), adminController.getDeliveryWithdrawals);
router.patch('/delivery/withdrawals/:id', checkPermission('food::deliveryman_management::withdrawal', 'edit'), adminController.updateDeliveryWithdrawalStatus);
router.get('/delivery/cash-limit-settlements', checkPermission('food::deliveryman_management::settlement', 'view'), adminController.getCashLimitSettlements);


// ----- Delivery partners & general -----
router.get('/delivery/join-requests', checkPermission('food::deliveryman_management::deliveryman::join_request', 'view'), adminController.getDeliveryJoinRequests);
router.get('/delivery/wallets', checkPermission('food::deliveryman_management::wallet', 'view'), adminController.getDeliveryWallets);
router.patch('/delivery/wallets', checkPermission('food::deliveryman_management::wallet', 'edit'), adminController.updateDeliveryBoyWallet);
router.get('/delivery/bonus-transactions', adminController.getDeliveryPartnerBonusTransactions);
router.get('/delivery/earnings', adminController.getDeliveryEarnings);
router.post('/delivery/bonus', checkPermission('food::deliveryman_management::deliveryman::bonus', 'create'), adminController.addDeliveryPartnerBonus);
router.get('/delivery/commission-rules', checkPermission('food::deliveryman_management::commission', 'view'), adminController.getDeliveryCommissionRules);
router.post('/delivery/commission-rules', checkPermission('food::deliveryman_management::commission', 'create'), adminController.createDeliveryCommissionRule);
router.patch('/delivery/commission-rules/:id', checkPermission('food::deliveryman_management::commission', 'edit'), adminController.updateDeliveryCommissionRule);
router.delete('/delivery/commission-rules/:id', checkPermission('food::deliveryman_management::commission', 'delete'), adminController.deleteDeliveryCommissionRule);
router.patch('/delivery/commission-rules/:id/status', checkPermission('food::deliveryman_management::commission', 'edit'), adminController.toggleDeliveryCommissionRuleStatus);
router.get('/delivery/reviews', adminController.getDeliverymanReviews);
router.get('/contact-messages', adminController.getContactMessages);
router.get('/delivery/earning-addons', adminController.getEarningAddons);
router.post('/delivery/earning-addons', checkPermission('food::deliveryman_management::deliveryman::earning_addon', 'create'), adminController.createEarningAddon);
router.patch('/delivery/earning-addons/:id', checkPermission('food::deliveryman_management::deliveryman::earning_addon', 'edit'), adminController.updateEarningAddon);
router.delete('/delivery/earning-addons/:id', checkPermission('food::deliveryman_management::deliveryman::earning_addon', 'delete'), adminController.deleteEarningAddon);
router.patch('/delivery/earning-addons/:id/status', checkPermission('food::deliveryman_management::deliveryman::earning_addon', 'edit'), adminController.toggleEarningAddonStatus);
router.get('/delivery/earning-addon-history', adminController.getEarningAddonHistory);
router.post('/delivery/earning-addon-history/:id/credit', checkPermission('food::deliveryman_management::deliveryman::earning_addon_history', 'create'), adminController.creditEarningToWallet);
router.post('/delivery/earning-addon-history/:id/cancel', checkPermission('food::deliveryman_management::deliveryman::earning_addon_history', 'edit'), adminController.cancelEarningAddonHistory);
router.post('/delivery/earning-addon-completions/check', checkPermission('food::deliveryman_management::deliveryman::earning_addon_history', 'edit'), adminController.checkEarningAddonCompletions);
router.get('/delivery/support-tickets/stats', adminController.getSupportTicketStats);
router.get('/delivery/support-tickets', adminController.getSupportTickets);
router.patch('/delivery/support-tickets/:id', checkPermission('food::deliveryman_management::support_tickets', 'edit'), adminController.updateSupportTicket);
router.get('/delivery/partners', adminController.getDeliveryPartners);
router.get('/delivery/:id', adminController.getDeliveryPartnerById);
router.patch('/delivery/:id/approve', checkPermission('food::deliveryman_management::deliveryman::join_request', 'edit'), adminController.approveDeliveryPartner);
router.patch('/delivery/:id/reject', checkPermission('food::deliveryman_management::deliveryman::join_request', 'edit'), adminController.rejectDeliveryPartner);
router.patch('/delivery/:id/active-status', checkPermission('food::deliveryman_management::deliveryman::list', 'edit'), adminController.updateDeliveryPartnerActiveStatus);

// ----- Zones -----
router.get('/zones', adminController.getZones);
router.get('/zones/:id', adminController.getZoneById);
router.post('/zones', checkPermission('food::restaurant_management::zone_setup', 'create'), adminController.createZone);
router.patch('/zones/:id', checkPermission('food::restaurant_management::zone_setup', 'edit'), adminController.updateZone);
router.delete('/zones/:id', checkPermission('food::restaurant_management::zone_setup', 'delete'), adminController.deleteZone);

// ----- Dining -----
router.get('/dining/categories', diningAdminController.getDiningCategories);
router.post('/dining/categories', checkPermission('food::dining_management::banners', 'create'), diningAdminController.createDiningCategory);
router.patch('/dining/categories/:id', checkPermission('food::dining_management::banners', 'edit'), diningAdminController.updateDiningCategory);
router.delete('/dining/categories/:id', checkPermission('food::dining_management::banners', 'delete'), diningAdminController.deleteDiningCategory);
router.get('/dining/restaurants', diningAdminController.getDiningRestaurants);
router.patch('/dining/restaurants/:restaurantId', checkPermission('food::dining_management::list', 'edit'), diningAdminController.updateDiningRestaurant);

// ----- Orders -----
router.get('/orders', orderController.listOrdersAdminController);
router.get('/orders/:orderId', orderController.getOrderByIdAdminController);
router.post('/orders/:orderId/refund', checkPermission('food::order_management::orders::refunded', 'create'), adminController.processRefund);
router.delete('/orders/:orderId', checkPermission('food::order_management::orders::cancelled', 'delete'), orderController.deleteOrderAdminController);

// ----- CMS Pages (About + legal) -----
router.get('/pages-social-media/:key', getAdminPageController);
router.put('/pages-social-media/:key', checkPermission('food::pages_social_media::[key]', 'edit'), upsertAdminPageController);

router.get('/sidebar-badges', adminController.getSidebarBadges);
router.get('/notifications/fssai-expired', adminController.getExpiredFssaiNotifications);

// ----- RBAC Roles -----
router.use('/roles', roleRoutes);

// ----- Employees -----
router.get('/employees', checkPermission('food::staff_management::list', 'view'), employeeController.getEmployees);
router.post('/employees', checkPermission('food::staff_management::list', 'create'), upload.single('employeeImage'), employeeController.createEmployee);
router.patch('/employees/:id', checkPermission('food::staff_management::list', 'edit'), upload.single('employeeImage'), employeeController.updateEmployee);
router.patch('/employees/:id/status', checkPermission('food::staff_management::list', 'edit'), employeeController.toggleEmployeeStatus);
router.delete('/employees/:id', checkPermission('food::staff_management::list', 'delete'), employeeController.deleteEmployee);
// ----- Careers / Job Openings -----
import jobRoutes from './job.route.js';
import jobApplicationRoutes from './jobApplication.route.js';
router.use('/careers/jobs', jobRoutes);
router.use('/careers/applications', jobApplicationRoutes);

export default router;
