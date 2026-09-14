import express from 'express';
import { cacheResponse } from '../../../../middleware/cache.js';
import {
    getCategories, getBanners, getRestaurants, getRestaurantDetail, getAvailability,
} from '../controllers/publicDining.controller.js';

const router = express.Router();

router.get('/categories', cacheResponse(300, 'dining'), getCategories);
router.get('/banners', cacheResponse(300, 'dining'), getBanners);
router.get('/restaurants', cacheResponse(60, 'dining'), getRestaurants);
router.get('/restaurants/:restaurantId', cacheResponse(60, 'dining'), getRestaurantDetail);
router.get('/restaurants/:restaurantId/availability', getAvailability);

export default router;
