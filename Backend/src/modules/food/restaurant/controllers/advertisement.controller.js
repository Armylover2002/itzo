import {
    listRestaurantAdvertisements,
    getRestaurantAdvertisement,
    createRestaurantAdvertisement,
    updateRestaurantAdvertisement,
    deleteRestaurantAdvertisement,
    pauseRestaurantAdvertisement
} from '../services/advertisement.service.js';
import { sendResponse } from '../../../../utils/response.js';
import { invalidateCache } from '../../../../middleware/cache.js';

export const listRestaurantAdvertisementsController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const ads = await listRestaurantAdvertisements(restaurantId);
        return sendResponse(res, 200, 'Advertisements fetched successfully', ads);
    } catch (error) {
        next(error);
    }
};

export const getRestaurantAdvertisementController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const ad = await getRestaurantAdvertisement(restaurantId, req.params.id);
        return sendResponse(res, 200, 'Advertisement fetched successfully', ad);
    } catch (error) {
        next(error);
    }
};

export const createRestaurantAdvertisementController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const ad = await createRestaurantAdvertisement(restaurantId, req.body || {}, req.files || {});
        invalidateCache('landing_advertisements*');
        return sendResponse(res, 201, 'Advertisement created and pending approval', ad);
    } catch (error) {
        next(error);
    }
};

export const updateRestaurantAdvertisementController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const ad = await updateRestaurantAdvertisement(
            restaurantId,
            req.params.id,
            req.body || {},
            req.files || {}
        );
        invalidateCache('landing_advertisements*');
        return sendResponse(res, 200, 'Advertisement updated and pending approval', ad);
    } catch (error) {
        next(error);
    }
};

export const deleteRestaurantAdvertisementController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const result = await deleteRestaurantAdvertisement(restaurantId, req.params.id);
        invalidateCache('landing_advertisements*');
        return sendResponse(res, 200, 'Advertisement deleted successfully', result);
    } catch (error) {
        next(error);
    }
};

export const pauseRestaurantAdvertisementController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const ad = await pauseRestaurantAdvertisement(restaurantId, req.params.id);
        invalidateCache('landing_advertisements*');
        return sendResponse(res, 200, 'Advertisement status updated', ad);
    } catch (error) {
        next(error);
    }
};
