import express from 'express';
import { checkPermission } from '../../../../core/auth/auth.middleware.js';
import {
    getDiningCategories, createDiningCategoryController, updateDiningCategoryController, deleteDiningCategoryController, toggleDiningCategoryStatusController,
    getDiningBanners, createDiningBannerController, updateDiningBannerController, deleteDiningBannerController, toggleDiningBannerStatusController,
    getDiningSettingsController, updateDiningSettingsController,
    getDiningRequests, reviewDiningRequestController,
    getDiningRestaurants, setDiningCommissionOverrideController,
    getDiningBookings, getDiningBills, getDiningRevenueStatsController,
} from '../controllers/adminDining.controller.js';

const router = express.Router();

router.get('/categories', checkPermission('food::dining_management::dining_categories', 'view'), getDiningCategories);
router.post('/categories', checkPermission('food::dining_management::dining_categories', 'create'), createDiningCategoryController);
router.patch('/categories/:id', checkPermission('food::dining_management::dining_categories', 'edit'), updateDiningCategoryController);
router.delete('/categories/:id', checkPermission('food::dining_management::dining_categories', 'delete'), deleteDiningCategoryController);
router.patch('/categories/:id/toggle', checkPermission('food::dining_management::dining_categories', 'edit'), toggleDiningCategoryStatusController);

router.get('/banners', checkPermission('food::dining_management::dining_banners', 'view'), getDiningBanners);
router.post('/banners', checkPermission('food::dining_management::dining_banners', 'create'), createDiningBannerController);
router.patch('/banners/:id', checkPermission('food::dining_management::dining_banners', 'edit'), updateDiningBannerController);
router.delete('/banners/:id', checkPermission('food::dining_management::dining_banners', 'delete'), deleteDiningBannerController);
router.patch('/banners/:id/toggle', checkPermission('food::dining_management::dining_banners', 'edit'), toggleDiningBannerStatusController);

router.get('/settings', checkPermission('food::dining_management::dining_settings', 'view'), getDiningSettingsController);
router.patch('/settings', checkPermission('food::dining_management::dining_settings', 'edit'), updateDiningSettingsController);

router.get('/requests', checkPermission('food::dining_management::dining_requests', 'view'), getDiningRequests);
router.patch('/requests/:id/review', checkPermission('food::dining_management::dining_requests', 'edit'), reviewDiningRequestController);

router.get('/restaurants', checkPermission('food::dining_management::dining_restaurants', 'view'), getDiningRestaurants);
router.patch('/restaurants/:id/commission', checkPermission('food::dining_management::dining_restaurants', 'edit'), setDiningCommissionOverrideController);

router.get('/bookings', checkPermission('food::dining_management::dining_bookings', 'view'), getDiningBookings);
router.get('/bills', checkPermission('food::dining_management::dining_bills', 'view'), getDiningBills);
router.get('/revenue', checkPermission('food::dining_management::dining_bills', 'view'), getDiningRevenueStatsController);

export default router;
