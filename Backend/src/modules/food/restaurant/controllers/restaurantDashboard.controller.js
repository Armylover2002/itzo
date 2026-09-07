import { sendResponse, sendError } from '../../../../utils/response.js';
import { getRestaurantDashboardStats } from '../services/restaurantDashboard.service.js';

export const getRestaurantDashboardStatsController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        if (!restaurantId) {
            return sendError(res, 401, 'Restaurant authentication required');
        }

        const data = await getRestaurantDashboardStats(restaurantId, req.query || {});
        return sendResponse(res, 200, 'Dashboard stats fetched successfully', data);
    } catch (error) {
        next(error);
    }
};
