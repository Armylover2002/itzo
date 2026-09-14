import {
    listRestaurantCategories,
    listPublicCategories,
    createRestaurantCategory,
    updateRestaurantCategory,
    deleteRestaurantCategory,
    getRestaurantCategoryStatus
} from '../services/restaurantCategory.service.js';
import { sendResponse, sendError } from '../../../../utils/response.js';
import { FoodRestaurant } from '../models/restaurant.model.js';

export const listCategoriesController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        // Default to restaurant's zone when caller doesn't pass zoneId.
        // This returns (zone categories + global categories) instead of only global.
        const query = { ...(req.query || {}) };
        if (!restaurantId) {
            // Public endpoint: no auth available. Return approved categories (zone-aware).
            const data = await listPublicCategories(query);
            return sendResponse(res, 200, 'Categories fetched successfully', data);
        }

        if (!query.zoneId) {
            const r = await FoodRestaurant.findById(restaurantId).select('zoneId').lean();
            if (r?.zoneId) {
                query.zoneId = String(r.zoneId);
            }
        }
        const data = await listRestaurantCategories(restaurantId, query);
        return sendResponse(res, 200, 'Categories fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getCategoryStatusController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const category = await getRestaurantCategoryStatus(restaurantId, req.params.id);
        if (!category) return sendError(res, 404, 'Category not found');
        return sendResponse(res, 200, 'Category status fetched successfully', { category });
    } catch (error) {
        next(error);
    }
};

export const createCategoryController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const category = await createRestaurantCategory(restaurantId, req.body || {});
        return sendResponse(res, 201, 'Category created successfully', { category });
    } catch (error) {
        next(error);
    }
};

export const updateCategoryController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const category = await updateRestaurantCategory(restaurantId, req.params.id, req.body || {});
        if (!category) return sendError(res, 404, 'Category not found');
        return sendResponse(res, 200, 'Category updated successfully', { category });
    } catch (error) {
        next(error);
    }
};

export const deleteCategoryController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const result = await deleteRestaurantCategory(restaurantId, req.params.id);
        if (!result) return sendError(res, 404, 'Category not found');
        return sendResponse(res, 200, 'Category deleted successfully', result);
    } catch (error) {
        next(error);
    }
};

