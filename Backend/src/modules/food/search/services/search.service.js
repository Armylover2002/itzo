import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { FoodCategory } from '../../admin/models/category.model.js';
import { FoodZone } from '../../admin/models/zone.model.js';
import mongoose from 'mongoose';
import { getRoadDistancesFromOrigin } from '../../../../services/roadDistance.service.js';

const zoneToPolygon = (zoneDoc) => {
    const coords = Array.isArray(zoneDoc?.coordinates) ? zoneDoc.coordinates : [];
    if (coords.length < 3) return null;

    const ring = coords
        .map((coord) => [Number(coord.longitude), Number(coord.latitude)])
        .filter((pair) => pair.every((value) => Number.isFinite(value)));

    if (ring.length < 3) return null;

    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push(first);
    }

    return { type: 'Polygon', coordinates: [ring] };
};

const buildZoneRestaurantConstraint = async (zoneIdRaw) => {
    const trimmedZoneId = String(zoneIdRaw || '').trim();
    if (!trimmedZoneId || !mongoose.Types.ObjectId.isValid(trimmedZoneId)) {
        return null;
    }

    const zoneClauses = [{ zoneId: new mongoose.Types.ObjectId(trimmedZoneId) }];
    const zoneDoc = await FoodZone.findOne({ _id: trimmedZoneId, isActive: true }).lean();
    const polygon = zoneToPolygon(zoneDoc);
    if (polygon) {
        zoneClauses.push({ location: { $geoWithin: { $geometry: polygon } } });
    }

    return { $or: zoneClauses };
};

/**
 * Unified Search Service
 * Searches for restaurants by name and also searches for food items, 
 * returning matched restaurants with potential dish highlights.
 */
export const searchUnified = async (query = {}, options = {}) => {
    const { 
        q, 
        lat, 
        lng, 
        radiusKm = 20, 
        categoryId, 
        minRating, 
        maxDeliveryTime, 
        isVeg,
        page = 1,
        limit = 20,
        zoneId
    } = query;

    const skip = (page - 1) * limit;
    const term = String(q || '').trim();
    const regex = term ? new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;

    // 1. Initial Filter
    const restaurantFilter = { 
        isDeleted: { $ne: true }, 
        accountStatus: { $ne: 'deleted' },
        status: 'approved',
        isListed: { $ne: false }
    };
    
    console.log(`[Search-Service] Querying with term: "${term}", categoryId: "${categoryId}", zoneId: "${zoneId}"`);

    const zoneConstraint = await buildZoneRestaurantConstraint(zoneId);
    if (zoneConstraint) {
        restaurantFilter.$and = [...(restaurantFilter.$and || []), zoneConstraint];
    }

    if (isVeg === 'true') {
        restaurantFilter.pureVegRestaurant = true;
    }

    if (minRating) {
        restaurantFilter.rating = { $gte: parseFloat(minRating) };
    }

    if (maxDeliveryTime) {
        restaurantFilter.estimatedDeliveryTimeMinutes = { $lte: parseInt(maxDeliveryTime) };
    }
    
    console.log(`[Search-Service] Final Restaurant Filter:`, JSON.stringify(restaurantFilter));

    let restaurantIds = new Set();
    let restaurantDetailsMap = new Map();

    // 2. Handle Category Filtering (Restaurants don't have categoryId, FoodItems do)
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
        const catFoodItems = await FoodItem.find({ 
            categoryId: new mongoose.Types.ObjectId(categoryId),
            approvalStatus: 'approved' 
        }).select('restaurantId').lean();
        
        const catRestaurantIds = [...new Set(catFoodItems.map(f => f.restaurantId.toString()))];
        if (catRestaurantIds.length > 0) {
            restaurantFilter._id = { $in: catRestaurantIds.map(id => new mongoose.Types.ObjectId(id)) };
        } else {
            // No food items in this category -> No restaurants
            return {
                success: true,
                data: { restaurants: [], total: 0, page: parseInt(page), limit: parseInt(limit) }
            };
        }
    }

    // 3. Search Matching
    if (regex) {
        // A. Search by Restaurant Name / Cuisine
        const matchedRestaurants = await FoodRestaurant.find({
            ...restaurantFilter,
            $or: [
                { restaurantName: { $regex: regex } },
                { cuisines: { $regex: regex } }
            ]
        }).limit(limit * 2).lean();

        matchedRestaurants.forEach(r => {
            restaurantIds.add(r._id.toString());
            restaurantDetailsMap.set(r._id.toString(), { ...r, matchType: 'restaurant' });
        });

        // B. Search by Food Item Name
        const foodFilters = { approvalStatus: 'approved' };
        if (isVeg === 'true') foodFilters.foodType = 'Veg';
        
        const matchedFoods = await FoodItem.find({
            ...foodFilters,
            name: { $regex: regex }
        }).limit(limit * 2).lean();

        const foodRestaurantIds = matchedFoods.map(f => f.restaurantId.toString());
        
        if (foodRestaurantIds.length > 0) {
            const unmatchedIds = foodRestaurantIds.filter(id => !restaurantIds.has(id));
            if (unmatchedIds.length > 0) {
                const rsForFoods = await FoodRestaurant.find({
                    ...restaurantFilter,
                    _id: { $in: unmatchedIds.map(id => new mongoose.Types.ObjectId(id)) }
                }).lean();

                rsForFoods.forEach(r => {
                    restaurantIds.add(r._id.toString());
                    restaurantDetailsMap.set(r._id.toString(), { 
                        ...r, 
                        matchType: 'food',
                        matchedDish: matchedFoods.find(f => f.restaurantId.toString() === r._id.toString())?.name,
                        matchedDishImage: matchedFoods.find(f => f.restaurantId.toString() === r._id.toString())?.image,
                        matchedDishId: matchedFoods.find(f => f.restaurantId.toString() === r._id.toString())?._id
                    });
                });
            }
        }
    } else {
        // No search text -> List all restaurants matching filters (category/zone)
        const allMatching = await FoodRestaurant.find(restaurantFilter)
            .sort({ rating: -1, createdAt: -1 })
            .limit(limit * 2)
            .lean();
            
        allMatching.forEach(r => {
            restaurantIds.add(r._id.toString());
            restaurantDetailsMap.set(r._id.toString(), r);
        });
    }

    // 4. Final Result Formatting
    let results = Array.from(restaurantDetailsMap.values());

    // Road-distance sorting when lat/lng are provided
    if (lat && lng && results.length > 0) {
        const userLat = Number(lat);
        const userLng = Number(lng);
        const entries = results
            .map((res, index) => {
                if (!res.location || res.location.latitude == null || res.location.longitude == null) {
                    return { index, missing: true };
                }
                return {
                    index,
                    lat: Number(res.location.latitude),
                    lng: Number(res.location.longitude),
                };
            });

        const validEntries = entries.filter((entry) => !entry.missing && Number.isFinite(entry.lat) && Number.isFinite(entry.lng));
        const distances = validEntries.length
            ? await getRoadDistancesFromOrigin(
                { lat: userLat, lng: userLng },
                validEntries.map((entry) => ({ lat: entry.lat, lng: entry.lng })),
            )
            : [];

        validEntries.forEach((entry, i) => {
            const distanceKm = distances[i]?.distanceKm;
            results[entry.index].distanceScore = Number.isFinite(distanceKm) ? distanceKm : 999;
            results[entry.index].distanceInKm = Number.isFinite(distanceKm) ? distanceKm : null;
        });

        entries
            .filter((entry) => entry.missing)
            .forEach((entry) => {
                results[entry.index].distanceScore = 999;
            });

        results.sort((a, b) => (a.distanceScore || 999) - (b.distanceScore || 999));
    }

    // ... (rest of logic up to result formation)
    const finalResult = {
        success: true,
        data: {
            restaurants: results.slice(skip, skip + limit),
            total: results.length,
            page: parseInt(page),
            limit: parseInt(limit),
            zoneFiltered: !!(zoneId && mongoose.Types.ObjectId.isValid(zoneId))
        }
    };

    return finalResult;
};

/**
 * Fetch Admin-only categories
 */
export const getAdminCategories = async (query = {}) => {
    const filter = {
        isActive: true,
        isApproved: true,
        $and: [
            {
                $or: [
                    { restaurantId: { $exists: false } },
                    { restaurantId: null },
                    { restaurantId: { $eq: undefined } }
                ]
            }
        ]
    };

    if (query.zoneId && mongoose.Types.ObjectId.isValid(query.zoneId)) {
        filter.$and.push({
            $or: [
                { zoneId: new mongoose.Types.ObjectId(query.zoneId) },
                { zoneId: { $exists: false } },
                { zoneId: null }
            ]
        });
    }

    const categories = await FoodCategory.find(filter).sort({ sortOrder: 1, name: 1 }).lean();
    return categories;
};
