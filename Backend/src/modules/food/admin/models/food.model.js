import mongoose from 'mongoose';
import { actionPerformerSchema } from '../../../../core/models/actionPerformer.schema.js';

const foodVariantSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        price: { type: Number, required: true, min: 0 },
        otherPrice: { type: Number, min: 0, default: 0 },
        unit: { type: String, trim: true, default: 'piece' }
    },
    { _id: true }
);

const foodSchema = new mongoose.Schema(
    {
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', required: true, index: true },
        categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodCategory', index: true },
        categoryName: { type: String, trim: true, default: '' },
        name: { type: String, required: true, trim: true, index: true },
        description: { type: String, trim: true, default: '' },
        price: { type: Number, required: true, min: 0 },
        otherPrice: { type: Number, min: 0, default: 0 },
        variants: { type: [foodVariantSchema], default: [] },
        image: { type: String, trim: true, default: '' },
        images: { type: [String], default: [] },
        foodType: { type: String, enum: ['Veg', 'Non-Veg'], default: 'Non-Veg' },
        isAvailable: { type: Boolean, default: true, index: true },
        itemSlotTimingId: { type: mongoose.Schema.Types.ObjectId, ref: 'ItemSlotTiming', default: null, index: true },
        preparationTime: { type: String, trim: true, default: '' },
        discountType: { type: String, enum: ['Percent', 'Amount'], default: 'Percent' },
        discountAmount: { type: Number, min: 0, default: 0 },
        discount: { type: String, trim: true, default: '' },
        isRecommended: { type: Boolean, default: false },
        tags: { type: [String], default: [] },
        nutrition: { type: [String], default: [] },
        allergies: { type: [String], default: [] },
        availabilityTimeStart: { type: String, trim: true, default: '' },
        availabilityTimeEnd: { type: String, trim: true, default: '' },
        originalPrice: { type: Number, min: 0, default: 0 },
        approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved', index: true },
        rejectionReason: { type: String, trim: true, default: '' },
        requestedAt: { type: Date },
        approvedAt: { type: Date },
        rejectedAt: { type: Date },
        approvedBy: { type: actionPerformerSchema, default: null },
        rejectedBy: { type: actionPerformerSchema, default: null }
    },
    {
        collection: 'food_items',
        timestamps: true
    }
);

foodSchema.index({ restaurantId: 1, createdAt: -1 });
foodSchema.index({ approvalStatus: 1, createdAt: -1 });
foodSchema.index({ approvalStatus: 1, requestedAt: -1 });
foodSchema.index({ restaurantId: 1, approvalStatus: 1, createdAt: -1 });

export const FoodItem = mongoose.model('FoodItem', foodSchema, 'food_items');
