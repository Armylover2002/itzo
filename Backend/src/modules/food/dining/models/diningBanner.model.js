import mongoose from 'mongoose';

const { Schema } = mongoose;

const diningBannerSchema = new Schema(
    {
        title: { type: String, trim: true },
        image: { type: String, required: true },
        link: { type: String, trim: true },
        isActive: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export const DiningBanner = mongoose.model('DiningBanner', diningBannerSchema, 'dining_banners');
