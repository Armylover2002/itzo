import { sendResponse } from '../../../../utils/response.js';
import { getPublicApprovedRestaurantAddons } from '../services/publicAddons.service.js';

export const getPublicRestaurantAddonsController = async (req, res, next) => {
    try {
        const addons = await getPublicApprovedRestaurantAddons(req.params.id);
        if (!addons) {
            return res.status(404).json({ success: false, message: 'Restaurant not found' });
        }
        return sendResponse(res, 200, 'Add-ons fetched successfully', { addons });
    } catch (error) {
        next(error);
    }
};

