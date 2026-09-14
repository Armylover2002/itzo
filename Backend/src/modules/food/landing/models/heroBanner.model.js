import mongoose from 'mongoose';

const foodHeroBannerSchema = new mongoose.Schema(
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
            type: String,
            default: ''
        },
        zoneId: {
            type: String,
            default: ''
        },
        linkedRestaurantIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant'
        }],
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
        collection: 'food_hero_banners',
        timestamps: true
    }
);

foodHeroBannerSchema.index({ isActive: 1, sortOrder: 1 });

export const FoodHeroBanner = mongoose.model('FoodHeroBanner', foodHeroBannerSchema, 'food_hero_banners');
