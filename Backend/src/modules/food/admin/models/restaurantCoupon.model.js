import mongoose from 'mongoose';

const restaurantCouponSchema = new mongoose.Schema(
    {
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', required: true, index: true },
        restaurantName: { type: String, required: true },
        couponCode: { type: String, required: true, trim: true, uppercase: true, unique: true },
        discountType: { type: String, enum: ['percentage', 'flat-price', 'fixed'], required: true },
        discountValue: { type: Number, required: true, min: 0 },
        customerScope: { type: String, enum: ['all', 'first-time'], default: 'all', index: true },
        minOrderValue: { type: Number, default: 0, min: 0 },
        minOrderAmount: { type: Number, default: 0, min: 0 },
        maxDiscount: { type: Number, default: null, min: 0 },
        startDate: { type: Date },
        endDate: { type: Date },
        expiryDate: { type: Date },
        usageLimit: { type: Number, default: null, min: 0 },
        perUserLimit: { type: Number, default: null, min: 0 },
        usedCount: { type: Number, default: 0, min: 0 },
        isFirstOrderOnly: { type: Boolean, default: false },
        description: { type: String },
        showInCart: { type: Boolean, default: true },
        status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending', index: true }
    },
    { collection: 'food_restaurant_coupons', timestamps: true }
);

export const RestaurantCoupon = mongoose.model('RestaurantCoupon', restaurantCouponSchema, 'food_restaurant_coupons');
