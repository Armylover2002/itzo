import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { FoodAddon } from '../models/foodAddon.model.js';

export async function getPublicApprovedRestaurantAddons(restaurantIdOrSlug) {
    const value = String(restaurantIdOrSlug || '').trim();
    if (!value) throw new ValidationError('Restaurant id is required');

    let restaurant = null;
    if (/^[0-9a-fA-F]{24}$/.test(value)) {
        restaurant = await FoodRestaurant.findOne({ _id: value, status: 'approved' })
            .select('_id status')
            .lean();
    } else {
        const normalized = value.trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
        restaurant = await FoodRestaurant.findOne({ restaurantNameNormalized: normalized, status: 'approved' })
            .select('_id status')
            .lean();
    }

    if (!restaurant?._id) {
        return null;
    }

    const addons = await FoodAddon.find({
        restaurantId: new mongoose.Types.ObjectId(String(restaurant._id)),
        isDeleted: { $ne: true },
        approvalStatus: 'approved',
        isAvailable: true,
        published: { $ne: null }
    })
        .sort({ approvedAt: -1, updatedAt: -1 })
        .select('_id published')
        .lean();

    return (addons || [])
        .filter((a) => a && a.published)
        .map((a) => {
            const p = a.published;
            return {
                id: a._id,
                _id: a._id,
                name: p.name || '',
                description: p.description || '',
                price: Number(p.price) || 0,
                image: p.image || '',
                images: Array.isArray(p.images) ? p.images : [],
                foodType: p.foodType || 'Veg'
            };
        });
}

