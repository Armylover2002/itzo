import mongoose from 'mongoose';

const restaurantCouponUsageSchema = new mongoose.Schema(
    {
        couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'RestaurantCoupon', index: true, required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', index: true, required: true },
        count: { type: Number, default: 0, min: 0 },
        lastUsedAt: { type: Date, default: null },
    },
    { collection: 'food_restaurant_coupon_usages', timestamps: true },
);

restaurantCouponUsageSchema.index({ couponId: 1, userId: 1 }, { unique: true });

export const RestaurantCouponUsage = mongoose.model(
    'RestaurantCouponUsage',
    restaurantCouponUsageSchema,
    'food_restaurant_coupon_usages',
);
