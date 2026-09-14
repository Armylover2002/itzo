import mongoose from 'mongoose';

const foodOfferUsageSchema = new mongoose.Schema(
    {
        offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodOffer', index: true, required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', index: true, required: true },
        count: { type: Number, default: 0, min: 0 },
        lastUsedAt: { type: Date, default: null }
    },
    { collection: 'food_offer_usages', timestamps: true }
);

foodOfferUsageSchema.index({ offerId: 1, userId: 1 }, { unique: true });

export const FoodOfferUsage = mongoose.model('FoodOfferUsage', foodOfferUsageSchema, 'food_offer_usages');
