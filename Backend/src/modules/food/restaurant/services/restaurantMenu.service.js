import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { FoodCategory } from '../../admin/models/category.model.js';
import { getFoodDisplayPrice, getFoodDisplayOtherPrice, serializeFoodVariants } from '../../admin/services/foodVariant.service.js';
import {
    backfillLegacyCategoryWorkflow,
    isCategoryVisibleInPublicMenu
} from '../../shared/categoryWorkflow.js';
import { ItemSlotTiming } from '../models/itemSlotTiming.model.js';
import {
    buildSlotTimingMap,
    filterFoodsByActiveSlotTimings,
    isFoodVisibleForSlotTiming,
    loadSlotTimingsForRestaurants,
    serializeItemSlotTiming
} from './itemSlotTiming.util.js';

const buildMenuFromFoods = async (foods = [], filterPublicOnly = false, options = {}) => {
    const { slotTimings = [], referenceDate = new Date(), applySlotFilter = false } = options;
    const slotMap = buildSlotTimingMap(slotTimings);
    const visibleFoods = applySlotFilter
        ? filterFoodsByActiveSlotTimings(foods, slotTimings, referenceDate)
        : foods;
    const categoryIds = Array.from(
        new Set(
            (foods || [])
                .map((food) => {
                    const raw = food?.categoryId;
                    if (!raw) return '';
                    return String(raw);
                })
                .filter((value) => mongoose.Types.ObjectId.isValid(value))
        )
    );

    const categoryDocs = categoryIds.length
        ? await FoodCategory.find({ _id: { $in: categoryIds } })
            .select('name image sortOrder isActive approvalStatus isApproved approvedAt restaurantId createdByRestaurantId')
            .lean()
        : [];
    if (categoryDocs.length) {
        await backfillLegacyCategoryWorkflow(categoryDocs, { persist: false });
    }
    const categoryMap = new Map(categoryDocs.map((doc) => [String(doc._id), doc]));

    const allowedCategories = new Set();
    if (filterPublicOnly) {
        for (const doc of categoryDocs) {
            if (isCategoryVisibleInPublicMenu(doc)) {
                allowedCategories.add(String(doc._id));
            }
        }
    }

    const byCategory = new Map();
    for (const food of visibleFoods) {
        const categoryId = food?.categoryId ? String(food.categoryId) : '';
        
        if (filterPublicOnly && categoryId && !allowedCategories.has(categoryId)) {
            continue;
        }

        const categoryDoc = categoryMap.get(categoryId) || null;
        const sectionName = (categoryDoc?.name || food?.categoryName || food?.category || 'Menu').trim() || 'Menu';
        const groupKey = categoryId || `name:${sectionName.toLowerCase()}`;

        if (!byCategory.has(groupKey)) {
            byCategory.set(groupKey, {
                id: categoryId || null,
                name: sectionName,
                image: categoryDoc?.image || '',
                sortOrder: Number.isFinite(Number(categoryDoc?.sortOrder)) ? Number(categoryDoc.sortOrder) : Number.MAX_SAFE_INTEGER,
                items: []
            });
        }

        const slotId = food?.itemSlotTimingId ? String(food.itemSlotTimingId) : '';
        const slotDoc = slotId ? slotMap.get(slotId) : null;

        byCategory.get(groupKey).items.push({
            id: String(food._id),
            _id: food._id,
            categoryId: categoryId || null,
            categoryName: sectionName,
            category: sectionName,
            hasValidCategory: Boolean(categoryDoc),
            needsCategoryAssignment: !categoryDoc,
            name: food.name,
            description: food.description || '',
            price: getFoodDisplayPrice(food),
            otherPrice: getFoodDisplayOtherPrice(food),
            variants: serializeFoodVariants(food.variants),
            variations: serializeFoodVariants(food.variants),
            image: food.image || '',
            images: Array.isArray(food.images) && food.images.length > 0 ? food.images.filter(Boolean) : (food.image ? [food.image] : []),
            foodType: food.foodType || 'Non-Veg',
            isAvailable: food.isAvailable !== false,
            approvalStatus: food.approvalStatus || 'approved',
            rejectionReason: food.rejectionReason || '',
            requestedAt: food.requestedAt,
            approvedAt: food.approvedAt,
            rejectedAt: food.rejectedAt,
            preparationTime: food.preparationTime || '',
            itemSlotTimingId: slotId || null,
            itemSlotTiming: slotDoc ? serializeItemSlotTiming(slotDoc) : null,
            isSlotActive: slotDoc ? isFoodVisibleForSlotTiming(food, slotMap, referenceDate) : true,
            createdAt: food.createdAt,
            updatedAt: food.updatedAt
        });
    }

    const orderedGroups = Array.from(byCategory.values()).sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return String(a.name || '').localeCompare(String(b.name || ''));
    });

    const sections = orderedGroups.map((group, idx) => ({
        id: group.id || `section-${idx}`,
        categoryId: group.id || null,
        name: group.name,
        image: group.image || '',
        sortOrder: Number.isFinite(Number(group.sortOrder)) ? Number(group.sortOrder) : 0,
        itemCount: group.items.length,
        items: group.items.sort((a, b) => {
            const at = new Date(a.createdAt || a.requestedAt || 0).getTime();
            const bt = new Date(b.createdAt || b.requestedAt || 0).getTime();
            return bt - at;
        }),
        subsections: []
    }));

    const categories = sections.map((section) => ({
        id: section.categoryId || section.id,
        categoryId: section.categoryId || null,
        name: section.name,
        image: section.image || '',
        sortOrder: section.sortOrder || 0,
        itemCount: section.itemCount || 0
    }));

    return { sections, categories };
};

export async function getRestaurantMenu(restaurantId) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    const foods = await FoodItem.find({ restaurantId })
        .sort({ createdAt: -1 })
        .limit(5000)
        .lean();
    const slotTimings = await ItemSlotTiming.find({ restaurantId }).sort({ startTime: 1, name: 1 }).lean();
    return buildMenuFromFoods(foods, false, { slotTimings });
}

export async function updateRestaurantMenu(restaurantId, body = {}) {
    // Option A: single source of truth (food_items). Menu layout snapshots are disabled.
    // Keep endpoint for backward compatibility, but make it explicit.
    throw new ValidationError('Menu editing is disabled. Menu is generated from food items.');
}

export async function getPublicApprovedRestaurantMenu(restaurantIdOrSlug) {
    const value = String(restaurantIdOrSlug || '').trim();
    if (!value) throw new ValidationError('Restaurant id is required');

    let restaurant = null;
    if (/^[0-9a-fA-F]{24}$/.test(value)) {
        restaurant = await FoodRestaurant.findOne({ _id: value, status: 'approved' })
            .select('_id status')
            .lean();
    } else if (/^REST\d{6}$/i.test(value)) {
        restaurant = await FoodRestaurant.findOne({
            restaurantId: value.toUpperCase(),
            status: 'approved',
        })
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
    const foods = await FoodItem.find({ restaurantId: restaurant._id, approvalStatus: 'approved' })
        .sort({ createdAt: -1 })
        .limit(2000)
        .lean();
    const slotTimings = await ItemSlotTiming.find({ restaurantId: restaurant._id })
        .sort({ startTime: 1, name: 1 })
        .lean();
    return buildMenuFromFoods(foods, true, {
        slotTimings,
        applySlotFilter: true,
        referenceDate: new Date()
    });
}

const MAX_BATCH_MENU_IDS = 50;

/**
 * Lightweight batch fetch for home-page category union.
 * Returns section names + first item image per restaurant in a single DB query.
 */
export async function getPublicMenusBatch(restaurantIds = []) {
    const validIds = Array.from(
        new Set(
            (restaurantIds || [])
                .map((id) => String(id || '').trim())
                .filter((id) => mongoose.Types.ObjectId.isValid(id))
        )
    ).slice(0, MAX_BATCH_MENU_IDS);

    if (!validIds.length) return {};

    const objectIds = validIds.map((id) => new mongoose.Types.ObjectId(id));
    const approvedRestaurants = await FoodRestaurant.find({
        _id: { $in: objectIds },
        status: 'approved',
    })
        .select('_id')
        .lean();

    const approvedIdSet = new Set(approvedRestaurants.map((r) => String(r._id)));
    const approvedObjectIds = validIds
        .filter((id) => approvedIdSet.has(id))
        .map((id) => new mongoose.Types.ObjectId(id));

    if (!approvedObjectIds.length) return {};

    const foods = await FoodItem.find({
        restaurantId: { $in: approvedObjectIds },
        approvalStatus: 'approved',
    })
        .select('restaurantId categoryId categoryName category name image itemSlotTimingId')
        .sort({ createdAt: -1 })
        .limit(5000)
        .lean();

    const slotTimings = await loadSlotTimingsForRestaurants(
        approvedObjectIds.map((id) => String(id)),
        ItemSlotTiming
    );
    const slotTimingsByRestaurant = new Map();
    slotTimings.forEach((slot) => {
        const key = String(slot.restaurantId);
        if (!slotTimingsByRestaurant.has(key)) slotTimingsByRestaurant.set(key, []);
        slotTimingsByRestaurant.get(key).push(slot);
    });
    const referenceDate = new Date();

    const categoryIds = Array.from(
        new Set(
            foods
                .map((f) => (f?.categoryId ? String(f.categoryId) : ''))
                .filter((id) => mongoose.Types.ObjectId.isValid(id))
        )
    );
    const categoryDocs = categoryIds.length
        ? await FoodCategory.find({ _id: { $in: categoryIds } })
            .select('name image isActive approvalStatus isApproved approvedAt restaurantId createdByRestaurantId')
            .lean()
        : [];
    if (categoryDocs.length) {
        await backfillLegacyCategoryWorkflow(categoryDocs, { persist: false });
    }
    const categoryMap = new Map(categoryDocs.map((doc) => [String(doc._id), doc]));

    const allowedCategories = new Set();
    for (const doc of categoryDocs) {
        if (isCategoryVisibleInPublicMenu(doc)) {
            allowedCategories.add(String(doc._id));
        }
    }

    const menusByRestaurant = new Map();

    for (const food of foods) {
        const restaurantSlots = slotTimingsByRestaurant.get(String(food.restaurantId)) || [];
        if (!isFoodVisibleForSlotTiming(food, buildSlotTimingMap(restaurantSlots), referenceDate)) {
            continue;
        }

        const categoryId = food?.categoryId ? String(food.categoryId) : '';
        if (categoryId && !allowedCategories.has(categoryId)) {
            continue;
        }

        const restaurantKey = String(food.restaurantId);
        if (!menusByRestaurant.has(restaurantKey)) {
            menusByRestaurant.set(restaurantKey, new Map());
        }
        const sectionMap = menusByRestaurant.get(restaurantKey);

        const categoryDoc = categoryMap.get(categoryId) || null;
        const sectionName = (categoryDoc?.name || food?.categoryName || food?.category || 'Menu').trim() || 'Menu';
        const groupKey = categoryId || `name:${sectionName.toLowerCase()}`;

        if (!sectionMap.has(groupKey)) {
            sectionMap.set(groupKey, {
                name: sectionName,
                image: categoryDoc?.image || food?.image || '',
            });
        } else if (!sectionMap.get(groupKey).image && food?.image) {
            sectionMap.get(groupKey).image = food.image;
        }
    }

    const result = {};
    for (const [restaurantId, sectionMap] of menusByRestaurant.entries()) {
        result[restaurantId] = {
            sections: Array.from(sectionMap.values()),
        };
    }
    return result;
}

export async function syncMenuItemApprovalStatus(restaurantId, itemId, status, rejectionReason = '') {
    // No-op in Option A (menu snapshots removed). Approval status lives only in food_items.
    // Kept to avoid breaking admin approval flows that call this helper.
    return;
}
