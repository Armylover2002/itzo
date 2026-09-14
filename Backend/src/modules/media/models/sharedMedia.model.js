import mongoose from 'mongoose';

const sharedMediaSchema = new mongoose.Schema(
    {
        url: { type: String, required: true, trim: true },
        normalizedName: { type: String, trim: true, default: '', index: true },
        keywords: { type: [String], default: [], index: true },
        tags: { type: [String], default: [] },
        category: { type: String, trim: true, default: '' },
        isGlobal: { type: Boolean, default: false, index: true },
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', index: true, default: null },
        reuseCount: { type: Number, default: 1, index: true }
    },
    {
        collection: 'shared_media',
        timestamps: true
    }
);

sharedMediaSchema.index({ isGlobal: 1, restaurantId: 1 });
sharedMediaSchema.index({ tags: 1 });
sharedMediaSchema.index({ category: 1 });

export const SharedMedia = mongoose.model('SharedMedia', sharedMediaSchema, 'shared_media');
