import mongoose from 'mongoose';
import { FoodItem } from '../../admin/models/food.model.js';
import { getFoodDisplayPrice, serializeFoodVariants } from '../../admin/services/foodVariant.service.js';
import { listApprovedRestaurants } from './restaurant.service.js';
import { ItemSlotTiming } from '../models/itemSlotTiming.model.js';
import {
    buildSlotTimingMap,
    isFoodVisibleForSlotTiming,
    loadSlotTimingsForRestaurants,
    serializeItemSlotTiming
} from './itemSlotTiming.util.js';

const MAX_UNDER_250_PRICE = 250;
const MAX_RESTAURANTS = 1000;
const MAX_FOOD_ITEMS = 10000;

const toSlug = (value = '') =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const pickRestaurantImage = (restaurant = {}) => {
    const cover = restaurant?.coverImages?.[0];
    if (typeof cover === 'string' && cover.trim()) return cover.trim();
    if (cover?.url) return String(cover.url).trim();

    const menu = restaurant?.menuImages?.[0];
    if (typeof menu === 'string' && menu.trim()) return menu.trim();
    if (menu?.url) return String(menu.url).trim();

    const profile = restaurant?.profileImage;
    if (typeof profile === 'string' && profile.trim()) return profile.trim();
    if (profile?.url) return String(profile.url).trim();

    return '';
};

/**
 * Returns approved restaurants that have at least one dish priced at or below ₹250.
 * Uses two DB round-trips (restaurant list + batched food items) instead of N menu calls.
 */
export async function listUnder250Restaurants(query = {}) {
    const { restaurants: approvedRestaurants = [] } = await listApprovedRestaurants({
        ...query,
        limit: MAX_RESTAURANTS,
    });

    if (!approvedRestaurants.length) {
        return { restaurants: [] };
    }

    const restaurantMap = new Map();
    const objectIds = [];

    approvedRestaurants.forEach((restaurant, index) => {
        const id = String(restaurant?.restaurantId || restaurant?._id || restaurant?.id || '').trim();
        if (!id || !mongoose.Types.ObjectId.isValid(id)) return;

        objectIds.push(new mongoose.Types.ObjectId(id));
        const fallbackImage = pickRestaurantImage(restaurant);
        restaurantMap.set(id, {
            id,
            restaurantId: id,
            slug: toSlug(restaurant?.slug || restaurant?.restaurantName || restaurant?.name),
            name: restaurant?.restaurantName || restaurant?.name || 'Restaurant',
            rating: Number(restaurant?.rating || 0),
            totalRatings: Number(restaurant?.totalRatings || restaurant?.ratingCount || 0),
            deliveryTime:
                restaurant?.estimatedDeliveryTime ||
                (restaurant?.estimatedDeliveryTimeMinutes
                    ? `${restaurant.estimatedDeliveryTimeMinutes} mins`
                    : '30 mins'),
            estimatedDeliveryTimeMinutes: Number(restaurant?.estimatedDeliveryTimeMinutes) || null,
            location: restaurant?.location || null,
            profileImage: restaurant?.profileImage || null,
            coverImages: Array.isArray(restaurant?.coverImages) ? restaurant.coverImages : [],
            menuImages: Array.isArray(restaurant?.menuImages) ? restaurant.menuImages : [],
            isActive: restaurant?.isActive,
            isAcceptingOrders: restaurant?.isAcceptingOrders,
            openDays: restaurant?.openDays,
            openingTime: restaurant?.openingTime,
            closingTime: restaurant?.closingTime,
            deliveryTimings: restaurant?.deliveryTimings,
            outletTimings: restaurant?.outletTimings,
            fallbackImage,
            pureVegRestaurant: restaurant?.pureVegRestaurant === true,
            originalIndex: index,
            menuItems: [],
        });
    });

    if (!objectIds.length) {
        return { restaurants: [] };
    }

    const foods = await FoodItem.find({
        restaurantId: { $in: objectIds },
        approvalStatus: 'approved',
        isAvailable: { $ne: false },
    })
        .select(
            'restaurantId categoryId categoryName category name description price otherPrice variants image images foodType isAvailable itemSlotTimingId'
        )
        .sort({ createdAt: -1 })
        .limit(MAX_FOOD_ITEMS)
        .lean();

    const slotTimings = await loadSlotTimingsForRestaurants(objectIds, ItemSlotTiming);
    const slotTimingsByRestaurant = new Map();
    slotTimings.forEach((slot) => {
        const key = String(slot.restaurantId);
        if (!slotTimingsByRestaurant.has(key)) slotTimingsByRestaurant.set(key, []);
        slotTimingsByRestaurant.get(key).push(slot);
    });
    const referenceDate = new Date();

    for (const food of foods) {
        const restaurantSlots = slotTimingsByRestaurant.get(String(food.restaurantId)) || [];
        if (!isFoodVisibleForSlotTiming(food, buildSlotTimingMap(restaurantSlots), referenceDate)) {
            continue;
        }

        const displayPrice = getFoodDisplayPrice(food);
        if (!Number.isFinite(displayPrice) || displayPrice <= 0 || displayPrice > MAX_UNDER_250_PRICE) {
            continue;
        }

        const restaurantKey = String(food.restaurantId);
        const restaurant = restaurantMap.get(restaurantKey);
        if (!restaurant) continue;

        const sectionName = (food?.categoryName || food?.category || 'Menu').trim() || 'Menu';
        const foodType = String(food?.foodType || '').toLowerCase();
        const isVeg = foodType.includes('veg') && !foodType.includes('non');
        const itemImage =
            (typeof food?.image === 'string' && food.image.trim()) ||
            (Array.isArray(food?.images) ? food.images.find((img) => typeof img === 'string' && img.trim()) : '') ||
            restaurant.fallbackImage ||
            '';

        const slotId = food?.itemSlotTimingId ? String(food.itemSlotTimingId) : '';
        const slotDoc = slotId ? buildSlotTimingMap(restaurantSlots).get(slotId) : null;

        restaurant.menuItems.push({
            id: String(food._id),
            _id: food._id,
            name: food.name,
            description: food.description || '',
            price: displayPrice,
            image: itemImage,
            foodType: food.foodType || 'Non-Veg',
            isVeg,
            isAvailable: food.isAvailable !== false,
            category: sectionName,
            sectionName,
            subsectionName: '',
            variants: serializeFoodVariants(food.variants),
            itemSlotTimingId: slotId || null,
            itemSlotTiming: slotDoc ? serializeItemSlotTiming(slotDoc) : null,
        });
    }

    const restaurants = Array.from(restaurantMap.values())
        .filter((restaurant) => restaurant.menuItems.length > 0)
        .map(({ fallbackImage, ...restaurant }) => restaurant);

    return { restaurants };
}
