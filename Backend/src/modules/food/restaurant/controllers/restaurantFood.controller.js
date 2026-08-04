import { sendResponse, sendError } from '../../../../utils/response.js';
import { createRestaurantFood, updateRestaurantFood } from '../services/restaurantFood.service.js';
import { FoodItem } from '../../admin/models/food.model.js';

export const createRestaurantFoodController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const food = await createRestaurantFood(restaurantId, req.body || {});
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
        return sendResponse(res, 200, 'Food updated successfully', { food });
    } catch (error) {
        next(error);
    }
};

export const listPublicDishesController = async (req, res, next) => {
    try {
        const { limit = 800 } = req.query;
        // Fetch approved foods
        const dishes = await FoodItem.find({ approvalStatus: 'approved' })
            .select('name image restaurantId')
            .limit(parseInt(limit))
            .lean();

        return sendResponse(res, 200, 'Dishes fetched successfully', { dishes });
    } catch (error) {
        next(error);
    }
};

