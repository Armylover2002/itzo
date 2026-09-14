import { sendResponse } from '../../../../utils/response.js';
import {
    getRestaurantMenu,
    updateRestaurantMenu,
    getPublicApprovedRestaurantMenu,
    getPublicMenusBatch,
} from '../services/restaurantMenu.service.js';

export const getMenuController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const menu = await getRestaurantMenu(restaurantId);
        return sendResponse(res, 200, 'Menu fetched successfully', { menu });
    } catch (error) {
        next(error);
    }
};

export const updateMenuController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const menu = await updateRestaurantMenu(restaurantId, req.body || {});
        return sendResponse(res, 200, 'Menu updated successfully', { menu });
    } catch (error) {
        next(error);
    }
};

export const getPublicRestaurantMenuController = async (req, res, next) => {
    try {
        const menu = await getPublicApprovedRestaurantMenu(req.params.id);
        if (!menu) {
            return res.status(404).json({ success: false, message: 'Restaurant not found' });
        }
        return sendResponse(res, 200, 'Menu fetched successfully', { menu });
    } catch (error) {
        next(error);
    }
};

export const getPublicMenusBatchController = async (req, res, next) => {
    try {
        const rawIds = String(req.query.ids || '').trim();
        const restaurantIds = rawIds
            ? rawIds.split(',').map((id) => id.trim()).filter(Boolean)
            : Array.isArray(req.query.ids) ? req.query.ids : [];

        const menus = await getPublicMenusBatch(restaurantIds);
        return sendResponse(res, 200, 'Menus fetched successfully', { menus });
    } catch (error) {
        next(error);
    }
};

