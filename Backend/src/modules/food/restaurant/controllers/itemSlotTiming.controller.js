import {
    createRestaurantItemSlotTiming,
    deleteRestaurantItemSlotTiming,
    getRestaurantItemSlotTimingById,
    listRestaurantItemSlotTimings,
    updateRestaurantItemSlotTiming
} from '../services/itemSlotTiming.service.js';
import { sendError, sendResponse } from '../../../../utils/response.js';

export const listItemSlotTimingsController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const data = await listRestaurantItemSlotTimings(restaurantId);
        return sendResponse(res, 200, 'Item slot timings fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getItemSlotTimingByIdController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const slot = await getRestaurantItemSlotTimingById(restaurantId, req.params.id);
        if (!slot) return sendError(res, 404, 'Item slot timing not found');
        return sendResponse(res, 200, 'Item slot timing fetched successfully', { slot });
    } catch (error) {
        next(error);
    }
};

export const createItemSlotTimingController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const slot = await createRestaurantItemSlotTiming(restaurantId, req.body || {}, req);
        return sendResponse(res, 201, 'Item slot timing created successfully', { slot });
    } catch (error) {
        next(error);
    }
};

export const updateItemSlotTimingController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const slot = await updateRestaurantItemSlotTiming(restaurantId, req.params.id, req.body || {}, req);
        if (!slot) return sendError(res, 404, 'Item slot timing not found');
        return sendResponse(res, 200, 'Item slot timing updated successfully', { slot });
    } catch (error) {
        next(error);
    }
};

export const deleteItemSlotTimingController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const result = await deleteRestaurantItemSlotTiming(restaurantId, req.params.id);
        if (!result) return sendError(res, 404, 'Item slot timing not found');
        return sendResponse(res, 200, 'Item slot timing deleted successfully', result);
    } catch (error) {
        next(error);
    }
};
