import {
    listRestaurantCoupons,
    createRestaurantCoupon,
    updateRestaurantCoupon,
    deleteRestaurantCoupon
} from '../services/restaurantCoupon.service.js';
import { sendResponse } from '../../../../utils/response.js';

export const listRestaurantCouponsController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const coupons = await listRestaurantCoupons(restaurantId);
        return sendResponse(res, 200, 'Coupons fetched successfully', coupons);
    } catch (error) {
        next(error);
    }
};

export const createRestaurantCouponController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const coupon = await createRestaurantCoupon(restaurantId, req.body || {});
        return sendResponse(res, 201, 'Coupon created and pending approval', coupon);
    } catch (error) {
        next(error);
    }
};

export const updateRestaurantCouponController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const couponId = req.params.id;
        const coupon = await updateRestaurantCoupon(restaurantId, couponId, req.body || {});
        return sendResponse(res, 200, 'Coupon updated and pending approval', coupon);
    } catch (error) {
        next(error);
    }
};

export const deleteRestaurantCouponController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const couponId = req.params.id;
        const result = await deleteRestaurantCoupon(restaurantId, couponId);
        return sendResponse(res, 200, 'Coupon deleted successfully', result);
    } catch (error) {
        next(error);
    }
};
