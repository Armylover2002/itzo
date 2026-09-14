import mongoose from 'mongoose';

const couponCodeRegistrySchema = new mongoose.Schema(
    {
        ownerType: {
            type: String,
            enum: ['platform-offer', 'restaurant-coupon'],
            required: true,
            index: true,
        },
        ownerId: { type: String, required: true, trim: true },
        couponCode: { type: String, required: true, trim: true, uppercase: true },
    },
    { collection: 'food_coupon_code_registry', timestamps: true }
);

couponCodeRegistrySchema.index({ couponCode: 1 }, { unique: true });
couponCodeRegistrySchema.index({ ownerType: 1, ownerId: 1 }, { unique: true });

export const CouponCodeRegistry = mongoose.model(
    'CouponCodeRegistry',
    couponCodeRegistrySchema,
    'food_coupon_code_registry'
);
