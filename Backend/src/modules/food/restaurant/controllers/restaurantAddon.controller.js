import { sendResponse, sendError } from '../../../../utils/response.js';
import { validateAddonCreateDto, validateAddonListQuery, validateAddonUpdateDto } from '../validators/addon.validator.js';
import {
    listRestaurantAddons,
    createRestaurantAddon,
    updateRestaurantAddon,
    deleteRestaurantAddon
} from '../services/restaurantAddon.service.js';

export const listAddonsController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const query = validateAddonListQuery(req.query || {});
        const data = await listRestaurantAddons(restaurantId, query);
        return sendResponse(res, 200, 'Add-ons fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const createAddonController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const body = validateAddonCreateDto(req.body || {});
        const addon = await createRestaurantAddon(restaurantId, body);
        return sendResponse(res, 201, 'Add-on created successfully', { addon });
    } catch (error) {
        next(error);
    }
};

export const updateAddonController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const body = validateAddonUpdateDto(req.body || {});
        const addon = await updateRestaurantAddon(restaurantId, req.params.id, body);
        if (!addon) return sendError(res, 404, 'Add-on not found');
        return sendResponse(res, 200, 'Add-on updated successfully', { addon });
    } catch (error) {
        next(error);
    }
};

export const deleteAddonController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const result = await deleteRestaurantAddon(restaurantId, req.params.id);
        if (!result) return sendError(res, 404, 'Add-on not found');
        return sendResponse(res, 200, 'Add-on deleted successfully', result);
    } catch (error) {
        next(error);
    }
};

