import mongoose from 'mongoose';

const restaurantWithdrawalLimitSchema = new mongoose.Schema(
    {
        restaurantMinWithdrawalLimit: { type: Number, default: 1, min: 0 },
        // null = unlimited (legacy / unset)
        restaurantMaxWithdrawalLimit: { type: Number, default: null, min: 0 },
        isActive: { type: Boolean, default: true, index: true }
    },
    { collection: 'food_restaurant_withdrawal_limits', timestamps: true }
);

restaurantWithdrawalLimitSchema.index({ isActive: 1, createdAt: -1 });

export const FoodRestaurantWithdrawalLimit = mongoose.model(
    'FoodRestaurantWithdrawalLimit',
    restaurantWithdrawalLimitSchema,
    'food_restaurant_withdrawal_limits'
);
