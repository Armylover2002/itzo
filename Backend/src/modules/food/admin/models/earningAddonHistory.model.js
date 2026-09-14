import mongoose from 'mongoose';

const earningAddonHistorySchema = new mongoose.Schema(
    {
        offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodEarningAddon', required: true, index: true },
        deliveryPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodDeliveryPartner', required: true, index: true },

        ordersCompleted: { type: Number, default: 0 },
        ordersRequired: { type: Number, default: 0 },

        earningAmount: { type: Number, default: 0 },
        totalEarning: { type: Number, default: 0 },

        status: { type: String, enum: ['pending', 'credited', 'failed', 'cancelled'], default: 'pending', index: true },
        completedAt: { type: Date, default: Date.now, index: true },

        creditedAt: { type: Date },
        creditedNotes: { type: String, trim: true, default: '' },

        cancelledAt: { type: Date },
        cancelReason: { type: String, trim: true, default: '' }
    },
    { collection: 'food_earning_addon_history', timestamps: true }
);

earningAddonHistorySchema.index({ deliveryPartnerId: 1, completedAt: -1 });
earningAddonHistorySchema.index({ offerId: 1, deliveryPartnerId: 1, status: 1 });

export const FoodEarningAddonHistory = mongoose.model('FoodEarningAddonHistory', earningAddonHistorySchema, 'food_earning_addon_history');

