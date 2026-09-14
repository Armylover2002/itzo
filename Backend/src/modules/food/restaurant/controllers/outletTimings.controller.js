import { sendResponse } from '../../../../utils/response.js';
import { getOutletTimingsForRestaurant, upsertOutletTimingsForRestaurant } from '../services/outletTimings.service.js';

export const getOutletTimingsByRestaurantIdController = async (req, res, next) => {
    try {
        const data = await getOutletTimingsForRestaurant(req.params.id);
        return sendResponse(res, 200, 'Outlet timings fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getCurrentRestaurantOutletTimingsController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const data = await getOutletTimingsForRestaurant(restaurantId, { includePending: true });
        return sendResponse(res, 200, 'Outlet timings fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const upsertCurrentRestaurantOutletTimingsController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const data = await upsertOutletTimingsForRestaurant(restaurantId, req.body?.outletTimings);
        return sendResponse(res, 200, 'Outlet timings saved successfully', data);
    } catch (error) {
        next(error);
    }
};

