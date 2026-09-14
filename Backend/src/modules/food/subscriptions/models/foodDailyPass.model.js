import mongoose from 'mongoose';

/**
 * FoodDailyPass - Tracks daily operational pass activations for restaurants and delivery partners.
 * A pass is valid for a single calendar day (IST) until 11:59:59 PM.
 */
const foodDailyPassSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true
        },
        userType: {
            type: String,
            enum: ['RESTAURANT', 'DELIVERY_PARTNER'],
            required: true,
            index: true
        },
        /** Date in IST format: YYYY-MM-DD */
        date: {
            type: String,
            required: true,
            index: true
        },
        /** Amount deducted from subscription wallet for this pass */
        amountDeducted: {
            type: Number,
            required: true,
            min: 0
        },
        /** Expiration time: 11:59:59 PM IST of the same day */
        expiresAt: {
            type: Date,
            required: true,
            index: true
        }
    },
    { 
        collection: 'food_daily_passes', 
        timestamps: { createdAt: true, updatedAt: false } 
    }
);

/** 
 * CRITICAL: Compound unique index to prevent double deduction for the same day.
 */
foodDailyPassSchema.index({ userId: 1, userType: 1, date: 1 }, { unique: true });

export const FoodDailyPass = mongoose.model('FoodDailyPass', foodDailyPassSchema, 'food_daily_passes');
