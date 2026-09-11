import express from 'express';
import * as publicDiningController from '../controllers/publicDining.controller.js';
import { cacheResponse } from '../../../../middleware/cache.js';

const router = express.Router();

// Content changes rarely (admin-edited) — short cache, same reasoning as other
// public listing endpoints in this codebase.
router.get('/categories', cacheResponse(300, 'dining_categories'), publicDiningController.getCategories);
router.get('/banners', cacheResponse(300, 'dining_banners'), publicDiningController.getBanners);
router.get('/restaurants', cacheResponse(60, 'dining_restaurants'), publicDiningController.getRestaurants);
router.get('/restaurants/:restaurantId', cacheResponse(60, 'dining_restaurant_detail'), publicDiningController.getRestaurantDetail);

// Availability is inherently live (booking counts change constantly) — never cached.
router.get('/restaurants/:restaurantId/availability', publicDiningController.getAvailability);

export default router;
