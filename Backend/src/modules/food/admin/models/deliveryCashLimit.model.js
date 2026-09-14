import mongoose from 'mongoose';

const deliveryCashLimitSchema = new mongoose.Schema(
    {
        deliveryCashLimit: { type: Number, default: 0, min: 0 },
        /** Minimum withdrawal amount (legacy field name kept for API compatibility) */
        deliveryWithdrawalLimit: { type: Number, default: 100, min: 0 },
        /** Maximum withdrawal amount; null = unlimited (legacy docs omit this field) */
        deliveryMaxWithdrawalLimit: { type: Number, default: null, min: 0 },
        isActive: { type: Boolean, default: true, index: true }
    },
    { collection: 'food_delivery_cash_limits', timestamps: true }
);

deliveryCashLimitSchema.index({ isActive: 1, createdAt: -1 });

export const FoodDeliveryCashLimit = mongoose.model('FoodDeliveryCashLimit', deliveryCashLimitSchema, 'food_delivery_cash_limits');

