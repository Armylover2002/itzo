import { FoodGourmetRestaurant } from '../models/gourmetRestaurant.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';

export const getPublicGourmetRestaurants = async () => {
    const docs = await FoodGourmetRestaurant.find({ isActive: true })
        .sort({ priority: 1, createdAt: -1 })
        .lean();

    const restaurantIds = docs.map((d) => d.restaurantId);
    const restaurants = await FoodRestaurant.find({ _id: { $in: restaurantIds } })
        .select('restaurantName area city profileImage rating cuisines slug pureVegRestaurant location estimatedDeliveryTime')
        .lean();

    const restaurantMap = new Map(restaurants.map((r) => [r._id.toString(), r]));

    return docs.map((item) => {
        const r = restaurantMap.get(item.restaurantId.toString());
        return {
            ...item,
            restaurant: r ? {
                _id: r._id,
                name: r.restaurantName,
                restaurantName: r.restaurantName,
                rating: r.rating || 0,
                profileImage: r.profileImage ? { url: r.profileImage } : null,
                area: r.area,
                city: r.city,
                cuisines: r.cuisines || [],
                slug: r.slug,
                pureVegRestaurant: r.pureVegRestaurant,
                location: r.location,
                estimatedDeliveryTime: r.estimatedDeliveryTime
            } : null
        };
    });
};

