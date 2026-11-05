import mongoose from 'mongoose';

const referralSettingsSchema = new mongoose.Schema(
    {
        user: {
            referrerReward: { type: Number, min: 0, default: 0 },
            refereeReward: { type: Number, min: 0, default: 0 },
            limit: { type: Number, min: 0, default: 0 },
            /** Shown to that role in its Refer & Earn screen (set by admin). */
            description: { type: String, trim: true, maxlength: 500, default: '' },
        },
        delivery: {
            referrerReward: { type: Number, min: 0, default: 0 },
            refereeReward: { type: Number, min: 0, default: 0 },
            limit: { type: Number, min: 0, default: 0 },
            /** Shown to that role in its Refer & Earn screen (set by admin). */
            description: { type: String, trim: true, maxlength: 500, default: '' },
        },
        restaurant: {
            referrerReward: { type: Number, min: 0, default: 0 },
            refereeReward: { type: Number, min: 0, default: 0 },
            limit: { type: Number, min: 0, default: 0 },
            /** Shown to that role in its Refer & Earn screen (set by admin). */
            description: { type: String, trim: true, maxlength: 500, default: '' },
        },
        isActive: { type: Boolean, default: true, index: true }
    },
    { collection: 'food_referral_settings', timestamps: true }
);

referralSettingsSchema.index({ isActive: 1, createdAt: -1 });

export const FoodReferralSettings = mongoose.model('FoodReferralSettings', referralSettingsSchema, 'food_referral_settings');

