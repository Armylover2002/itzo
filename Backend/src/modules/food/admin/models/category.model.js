import mongoose from 'mongoose';

const foodCategorySchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, index: true },
        image: { type: String, trim: true, default: '' },
        type: { type: String, trim: true, default: '' },
        foodTypeScope: { type: String, enum: ['Veg', 'Non-Veg'], default: 'Veg', index: true },
        /**
         * Category scope:
         * - When restaurantId is missing: category is admin/global and can be shared across restaurants.
         * - When restaurantId is set: category is private to that restaurant only.
         *
         * Approval remains available for admin moderation, but approval does not make a
         * restaurant-owned category globally reusable.
         *
         * Note: existing categories (created by admin historically) should be treated as approved.
         */
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', index: true, default: undefined },
        createdByRestaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', index: true, default: undefined },
        approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved', index: true },
        isApproved: { type: Boolean, default: true, index: true },
        rejectionReason: { type: String, trim: true, default: '' },
        requestedAt: { type: Date },
        approvedAt: { type: Date },
        rejectedAt: { type: Date },
        globalizedAt: { type: Date },
        /**
         * Optional zone binding.
         * - When set: category is visible only for that zone.
         * - When null/undefined: category is global (visible for all zones).
         */
        zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodZone', index: true, default: undefined },
        isActive: { type: Boolean, default: true, index: true },
        sortOrder: { type: Number, default: 1, index: true }
    },
    {
        collection: 'food_categories',
        timestamps: true
    }
);

foodCategorySchema.index({ isApproved: 1, createdAt: -1 });
foodCategorySchema.index({ restaurantId: 1, isApproved: 1, createdAt: -1 });
foodCategorySchema.index({ approvalStatus: 1, createdAt: -1 });
foodCategorySchema.index({ createdByRestaurantId: 1, createdAt: -1 });

export const FoodCategory = mongoose.model('FoodCategory', foodCategorySchema, 'food_categories');

