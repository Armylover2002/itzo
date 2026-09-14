import { searchUnified, getAdminCategories } from '../services/search.service.js';
import { sendResponse, sendError } from '../../../../utils/response.js';

/**
 * Unified Search for Restaurants, Food Items, and Cuisines
 */
export const searchController = async (req, res, next) => {
    try {
        const { q, lat, lng, radiusKm, categoryId, minRating, maxDeliveryTime, isVeg, page, limit, zoneId } = req.query;
        console.log(`[Search-Debug] q="${q}", catId="${categoryId}", zone="${zoneId}", coords=[${lat}, ${lng}]`);

        const results = await searchUnified({
            q,
            lat,
            lng,
            radiusKm,
            categoryId,
            minRating,
            maxDeliveryTime,
            isVeg,
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
            zoneId
        });

        return sendResponse(res, 200, 'Search results fetched successfully', results.data);
    } catch (error) {
        next(error);
    }
};

/**
 * Fetch List of Admin-only Categories
 */
export const listAdminCategoriesController = async (req, res, next) => {
    try {
        const { zoneId } = req.query;
        const categories = await getAdminCategories({ zoneId });
        
        return sendResponse(res, 200, 'Admin categories fetched successfully', { categories });
    } catch (error) {
        next(error);
    }
};
