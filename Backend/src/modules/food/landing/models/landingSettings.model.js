import mongoose from 'mongoose';

const foodLandingSettingsSchema = new mongoose.Schema(
    {
        exploreMoreHeading: {
            type: String,
            default: 'Explore more'
        },

        recommendedRestaurantIds: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'FoodRestaurant',
            default: []
        },
        showHeroBanners: {
            type: Boolean,
            default: true
        },
        showUnder250: {
            type: Boolean,
            default: true
        },
        showExploreIcons: {
            type: Boolean,
            default: true
        },
        showTop10: {
            type: Boolean,
            default: true
        },
        showGourmet: {
            type: Boolean,
            default: true
        }
    },
    {
        collection: 'food_landing_settings',
        timestamps: true
    }
);

export const FoodLandingSettings = mongoose.model('FoodLandingSettings', foodLandingSettingsSchema, 'food_landing_settings');

