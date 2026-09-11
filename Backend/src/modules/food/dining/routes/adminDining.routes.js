import express from 'express';
import * as adminDiningController from '../controllers/adminDining.controller.js';
import { checkPermission } from '../../../../core/auth/auth.middleware.js';

// Mounted at /v1/food/admin/dining with authMiddleware + requireRoles('ADMIN','EMPLOYEE')
// already applied in routes/index.js. Permission keys chain as
// food::dining_management::<item>::<action> matching the sidebar config in
// Frontend/src/modules/Food/utils/adminSidebarMenu.js — the role-permission
// generator derives its tree from that file, so no separate registration
// step is needed for these keys to appear in the role editor.
const router = express.Router();

// --- Categories ---
router.get('/categories', checkPermission('food::dining_management::dining_categories', 'view'), adminDiningController.getDiningCategories);
router.post('/categories', checkPermission('food::dining_management::dining_categories', 'create'), adminDiningController.createDiningCategory);
router.patch('/categories/:id', checkPermission('food::dining_management::dining_categories', 'edit'), adminDiningController.updateDiningCategory);
router.delete('/categories/:id', checkPermission('food::dining_management::dining_categories', 'delete'), adminDiningController.deleteDiningCategory);
router.patch('/categories/:id/toggle', checkPermission('food::dining_management::dining_categories', 'edit'), adminDiningController.toggleDiningCategoryStatus);

// --- Banners ---
router.get('/banners', checkPermission('food::dining_management::dining_banners', 'view'), adminDiningController.getDiningBanners);
router.post('/banners', checkPermission('food::dining_management::dining_banners', 'create'), adminDiningController.createDiningBanner);
router.patch('/banners/:id', checkPermission('food::dining_management::dining_banners', 'edit'), adminDiningController.updateDiningBanner);
router.delete('/banners/:id', checkPermission('food::dining_management::dining_banners', 'delete'), adminDiningController.deleteDiningBanner);
router.patch('/banners/:id/toggle', checkPermission('food::dining_management::dining_banners', 'edit'), adminDiningController.toggleDiningBannerStatus);

// --- Global settings (default commission etc.) ---
router.get('/settings', checkPermission('food::dining_management::dining_settings', 'view'), adminDiningController.getDiningSettings);
router.patch('/settings', checkPermission('food::dining_management::dining_settings', 'edit'), adminDiningController.updateDiningSettings);

// --- Requests / restaurants / commission ---
router.get('/requests', checkPermission('food::dining_management::dining_requests', 'view'), adminDiningController.getDiningRequests);
router.patch('/requests/:id/review', checkPermission('food::dining_management::dining_requests', 'edit'), adminDiningController.reviewDiningRequest);
router.get('/restaurants', checkPermission('food::dining_management::dining_restaurants', 'view'), adminDiningController.getDiningRestaurants);
router.patch('/restaurants/:id/commission', checkPermission('food::dining_management::dining_restaurants', 'edit'), adminDiningController.setDiningCommissionOverride);

// --- Bookings / bills / revenue ---
router.get('/bookings', checkPermission('food::dining_management::dining_bookings', 'view'), adminDiningController.getDiningBookings);
router.get('/bills', checkPermission('food::dining_management::dining_bills', 'view'), adminDiningController.getDiningBills);
router.get('/revenue', checkPermission('food::dining_management::dining_bills', 'view'), adminDiningController.getDiningRevenueStats);

export default router;
