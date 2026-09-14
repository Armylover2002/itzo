import { sendResponse, sendError } from '../../../../utils/response.js';
import {
    listDiningCategoriesPublic,
    listDiningBannersPublic,
    listDiningRestaurantsPublic,
    getDiningRestaurantDetail,
    getDiningAvailability,
} from '../services/diningPublic.service.js';
import { ValidationError } from '../../../../core/auth/errors.js';

export async function getCategories(req, res, next) {
    try {
        const categories = await listDiningCategoriesPublic();
        return sendResponse(res, 200, 'Dining categories fetched', { categories });
    } catch (err) { next(err); }
}

export async function getBanners(req, res, next) {
    try {
        const banners = await listDiningBannersPublic();
        return sendResponse(res, 200, 'Dining banners fetched', { banners });
    } catch (err) { next(err); }
}

export async function getRestaurants(req, res, next) {
    try {
        const restaurants = await listDiningRestaurantsPublic({ zoneId: req.query.zoneId });
        return sendResponse(res, 200, 'Dining restaurants fetched', { restaurants });
    } catch (err) { next(err); }
}

export async function getRestaurantDetail(req, res, next) {
    try {
        const detail = await getDiningRestaurantDetail(req.params.restaurantId);
        return sendResponse(res, 200, 'Dining restaurant detail fetched', detail);
    } catch (err) {
        if (err instanceof ValidationError) return sendError(res, err.statusCode || 400, err.message);
        next(err);
    }
}

export async function getAvailability(req, res, next) {
    try {
        const availability = await getDiningAvailability(req.params.restaurantId, req.query.date);
        return sendResponse(res, 200, 'Dining availability fetched', availability);
    } catch (err) {
        if (err instanceof ValidationError) return sendError(res, err.statusCode || 400, err.message);
        next(err);
    }
}
