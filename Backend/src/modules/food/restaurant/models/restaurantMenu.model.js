import mongoose from 'mongoose';

const restaurantMenuSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant',
            required: true,
            unique: true
        },
        // Stored as-is for UI; validated at service layer.
        sections: {
            type: [mongoose.Schema.Types.Mixed],
            default: []
        }
    },
    {
        collection: 'food_restaurant_menus',
        timestamps: true
    }
);

export const FoodRestaurantMenu = mongoose.model('FoodRestaurantMenu', restaurantMenuSchema, 'food_restaurant_menus');

