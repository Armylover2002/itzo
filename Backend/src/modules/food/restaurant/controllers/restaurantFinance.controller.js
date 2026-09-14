import { sendResponse, sendError } from '../../../../utils/response.js';
import { getRestaurantFinance, getRestaurantSubscriptionWallet } from '../services/restaurantFinance.service.js';

export const getRestaurantFinanceController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        if (!restaurantId) return sendError(res, 401, 'Restaurant authentication required');

        const data = await getRestaurantFinance(restaurantId, req.query || {});
        return sendResponse(res, 200, 'Finance fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getRestaurantSubscriptionWalletController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        if (!restaurantId) return sendError(res, 401, 'Restaurant authentication required');

        const data = await getRestaurantSubscriptionWallet(restaurantId);
        return sendResponse(res, 200, 'Subscription wallet fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

