import mongoose from 'mongoose';

const foodUnder250BannerSchema = new mongoose.Schema(
    {
        imageUrl: {
            type: String,
            required: true
        },
        publicId: {
            type: String,
            required: true
        },
        title: {
            type: String
        },
        ctaText: {
            type: String
        },
        ctaLink: {
            type: String
        },
        zoneId: {
            type: String
        },
        sortOrder: {
            type: Number,
            default: 0,
            index: true
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        }
    },
    {
        collection: 'food_under250_banners',
        timestamps: true
    }
);

foodUnder250BannerSchema.index({ isActive: 1, sortOrder: 1 });

export const FoodUnder250Banner = mongoose.model('FoodUnder250Banner', foodUnder250BannerSchema, 'food_under250_banners');

