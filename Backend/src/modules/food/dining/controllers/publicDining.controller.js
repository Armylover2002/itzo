import * as publicService from '../services/diningPublic.service.js';

export async function getCategories(req, res, next) {
    try {
        const data = await publicService.listDiningCategoriesPublic();
        res.json({ success: true, data });
    } catch (error) { next(error); }
}

export async function getBanners(req, res, next) {
    try {
        const data = await publicService.listDiningBannersPublic();
        res.json({ success: true, data });
    } catch (error) { next(error); }
}

export async function getRestaurants(req, res, next) {
    try {
        const data = await publicService.listDiningRestaurantsPublic(req.query);
        res.json({ success: true, data });
    } catch (error) { next(error); }
}

export async function getRestaurantDetail(req, res, next) {
    try {
        const data = await publicService.getDiningRestaurantDetail(req.params.restaurantId);
        res.json({ success: true, data });
    } catch (error) { next(error); }
}

export async function getAvailability(req, res, next) {
    try {
        const data = await publicService.getDiningAvailability(req.params.restaurantId, req.query.date);
        res.json({ success: true, data });
    } catch (error) { next(error); }
}
