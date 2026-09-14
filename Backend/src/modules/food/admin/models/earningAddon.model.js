import mongoose from 'mongoose';

const earningAddonSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true, index: true },
        description: { type: String, trim: true, default: '' },
        requiredOrders: { type: Number, required: true, min: 1 },
        earningAmount: { type: Number, required: true, min: 0 },
        startDate: { type: Date, required: true, index: true },
        endDate: { type: Date, required: true, index: true },
        maxRedemptions: { type: Number, min: 1, default: null },
        currentRedemptions: { type: Number, default: 0 },
        status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true }
    },
    { collection: 'food_earning_addons', timestamps: true }
);

earningAddonSchema.index({ status: 1, startDate: 1, endDate: 1 });

export const FoodEarningAddon = mongoose.model('FoodEarningAddon', earningAddonSchema, 'food_earning_addons');

