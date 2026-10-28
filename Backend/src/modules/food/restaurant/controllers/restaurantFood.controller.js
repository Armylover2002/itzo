import { sendResponse, sendError } from '../../../../utils/response.js';
import { createRestaurantFood, updateRestaurantFood } from '../services/restaurantFood.service.js';
import { syncHubItemToOutlets } from '../services/hubInventorySync.service.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { invalidateCache } from '../../../../middleware/cache.js';

export const createRestaurantFoodController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const food = await createRestaurantFood(restaurantId, req.body || {});
        await Promise.all([
            invalidateCache('restaurants*'),
            invalidateCache('food_search*'),
            invalidateCache(`restaurant_detail*`),
            invalidateCache('restaurant_menu:*'),
            invalidateCache('restaurant_menus_batch:*'),
        ]).catch(console.error);
        // Fire-and-forget: mirror to any outlets sharing this hub's inventory.
        FoodRestaurant.findById(restaurantId).select('isMainHub').lean().then((r) => {
            if (r?.isMainHub) syncHubItemToOutlets(restaurantId, food).catch(() => {});
        }).catch(() => {});
        return sendResponse(res, 201, 'Food created successfully', { food });
    } catch (error) {
        next(error);
    }
};

export const updateRestaurantFoodController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const food = await updateRestaurantFood(restaurantId, req.params.id, req.body || {});
        if (!food) return sendError(res, 404, 'Food not found');
        await Promise.all([
            invalidateCache('restaurants*'),
            invalidateCache('food_search*'),
            invalidateCache(`restaurant_detail*`),
            invalidateCache('restaurant_menu:*'),
            invalidateCache('restaurant_menus_batch:*'),
        ]).catch(console.error);
        FoodRestaurant.findById(restaurantId).select('isMainHub').lean().then((r) => {
            if (r?.isMainHub) syncHubItemToOutlets(restaurantId, food).catch(() => {});
        }).catch(() => {});
        return sendResponse(res, 200, 'Food updated successfully', { food });
    } catch (error) {
        next(error);
    }
};

