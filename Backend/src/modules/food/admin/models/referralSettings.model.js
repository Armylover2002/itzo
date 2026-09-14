import mongoose from 'mongoose';

const referralSettingsSchema = new mongoose.Schema(
    {
        user: {
            referrerReward: { type: Number, min: 0, default: 0 },
            refereeReward: { type: Number, min: 0, default: 0 },
            limit: { type: Number, min: 0, default: 0 },
        },
        delivery: {
            referrerReward: { type: Number, min: 0, default: 0 },
            refereeReward: { type: Number, min: 0, default: 0 },
            limit: { type: Number, min: 0, default: 0 },
        },
        restaurant: {
            referrerReward: { type: Number, min: 0, default: 0 },
            refereeReward: { type: Number, min: 0, default: 0 },
            limit: { type: Number, min: 0, default: 0 },
        },
        isActive: { type: Boolean, default: true, index: true }
    },
    { collection: 'food_referral_settings', timestamps: true }
);

referralSettingsSchema.index({ isActive: 1, createdAt: -1 });

export const FoodReferralSettings = mongoose.model('FoodReferralSettings', referralSettingsSchema, 'food_referral_settings');

