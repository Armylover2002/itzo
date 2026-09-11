import mongoose from 'mongoose';

/** Promotional banners shown at the top of the dining discovery page. */
const diningBannerSchema = new mongoose.Schema(
    {
        title: { type: String, trim: true, default: '' },
        image: { type: String, required: true, trim: true },
        link: { type: String, trim: true, default: '' },
        isActive: { type: Boolean, default: true, index: true },
        sortOrder: { type: Number, default: 0, index: true },
    },
    { collection: 'dining_banners', timestamps: true },
);

diningBannerSchema.index({ isActive: 1, sortOrder: 1 });

export const DiningBanner = mongoose.model('DiningBanner', diningBannerSchema, 'dining_banners');
