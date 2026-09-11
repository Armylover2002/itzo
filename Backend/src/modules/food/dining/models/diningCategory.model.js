import mongoose from 'mongoose';

/**
 * Admin-managed tags shown on the dining discovery page (e.g. "Rooftop",
 * "Fine Dining", "Buffet"). Purely presentational content — no approval
 * workflow needed since only admins create these.
 */
const diningCategorySchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, index: true },
        image: { type: String, required: true, trim: true },
        isActive: { type: Boolean, default: true, index: true },
        sortOrder: { type: Number, default: 0, index: true },
    },
    { collection: 'dining_categories', timestamps: true },
);

diningCategorySchema.index({ isActive: 1, sortOrder: 1 });

export const DiningCategory = mongoose.model('DiningCategory', diningCategorySchema, 'dining_categories');
