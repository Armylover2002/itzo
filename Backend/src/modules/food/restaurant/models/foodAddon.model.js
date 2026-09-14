import mongoose from 'mongoose';
import { actionPerformerSchema } from '../../../../core/models/actionPerformer.schema.js';

const addonPayloadSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true, default: '' },
        price: { type: Number, required: true, min: 0 },
        image: { type: String, trim: true, default: '' },
        images: { type: [String], default: [] },
        foodType: { type: String, enum: ['Veg', 'Non-Veg'], default: 'Veg' }
    },
    { _id: false }
);

const foodAddonSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant',
            required: true,
            index: true
        },
        // Draft is what restaurant is editing and what admin approves/rejects.
        draft: { type: addonPayloadSchema, required: true },
        // Published is what the user app can see (kept while draft is pending).
        published: { type: addonPayloadSchema, default: null },
        approvalStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
            index: true
        },
        rejectionReason: { type: String, trim: true, default: '' },
        requestedAt: { type: Date, default: null, index: true },
        approvedAt: { type: Date, default: null },
        rejectedAt: { type: Date, default: null },
        approvedBy: { type: actionPerformerSchema, default: null },
        rejectedBy: { type: actionPerformerSchema, default: null },
        // Operational toggle controlled by restaurant; user app filters on this.
        isAvailable: { type: Boolean, default: true, index: true },
        // Soft delete for safety + auditability.
        isDeleted: { type: Boolean, default: false, index: true }
    },
    { collection: 'food_addons', timestamps: true }
);

foodAddonSchema.index({ restaurantId: 1, isDeleted: 1, createdAt: -1 });
foodAddonSchema.index({ approvalStatus: 1, isDeleted: 1, requestedAt: -1 });
foodAddonSchema.index({ restaurantId: 1, approvalStatus: 1, isDeleted: 1, requestedAt: -1 });

export const FoodAddon = mongoose.model('FoodAddon', foodAddonSchema, 'food_addons');

