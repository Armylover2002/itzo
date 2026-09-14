import mongoose from 'mongoose';
import { actionPerformerSchema } from '../../../../core/models/actionPerformer.schema.js';

const itemSlotTimingSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant',
            required: true,
            index: true
        },
        name: { type: String, required: true, trim: true },
        startTime: { type: String, required: true, trim: true },
        endTime: { type: String, required: true, trim: true },
        createdBy: { type: actionPerformerSchema, default: null },
        updatedBy: { type: actionPerformerSchema, default: null }
    },
    {
        collection: 'food_item_slot_timings',
        timestamps: true
    }
);

itemSlotTimingSchema.index({ restaurantId: 1, name: 1 }, { unique: true });
itemSlotTimingSchema.index({ restaurantId: 1, createdAt: -1 });

export const ItemSlotTiming = mongoose.model('ItemSlotTiming', itemSlotTimingSchema, 'food_item_slot_timings');
