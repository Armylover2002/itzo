import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodCategory } from '../../admin/models/category.model.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import {
    backfillLegacyCategoryWorkflow,
    buildLiveCategoryItemStats,
    GLOBAL_CATEGORY_FILTER,
    ensureUniqueCategoryName,
    getCategoryApprovalStatus,
    normalizeCategoryFoodTypeScope,
    serializeCategoryForResponse,
    toObjectId
} from '../../shared/categoryWorkflow.js';

const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const APPROVED_CATEGORY_FILTER = [
    { approvalStatus: 'approved' },
    { approvalStatus: { $exists: false }, isApproved: { $ne: false } }
];

const getRestaurantContext = async (restaurantId) => {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }

    const restaurant = await FoodRestaurant.findById(restaurantId)
        .select('zoneId pureVegRestaurant')
        .lean();
    if (!restaurant?._id) {
        throw new ValidationError('Restaurant not found');
    }

    return {
        restaurantId: toObjectId(restaurantId),
        zoneId: restaurant.zoneId ? String(restaurant.zoneId) : '',
        pureVegRestaurant: restaurant.pureVegRestaurant === true
    };
};

const applyZoneVisibilityFilter = (filterAndList, zoneIdRaw) => {
    if (zoneIdRaw && mongoose.Types.ObjectId.isValid(zoneIdRaw)) {
        filterAndList.push({
            $or: [
                { zoneId: new mongoose.Types.ObjectId(zoneIdRaw) },
                { zoneId: { $exists: false } },
                { zoneId: null }
            ]
        });
        return;
    }

    filterAndList.push({
        $or: [{ zoneId: { $exists: false } }, { zoneId: null }]
    });
};

export async function listRestaurantCategories(restaurantId, query = {}) {
    const context = await getRestaurantContext(restaurantId);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 1000, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const includeInactive = query.includeInactive === 'true' || query.includeInactive === '1';
    const withCounts = query.withCounts === 'true' || query.withCounts === '1';
    const compact = query.compact === 'true' || query.compact === '1';
    const zoneIdRaw = typeof query.zoneId === 'string' ? query.zoneId.trim() : context.zoneId;

    const filter = {};
    if (!includeInactive) filter.isActive = true;

    const visibilityFilter = compact
        ? {
            $or: [
                {
                    $and: [
                        { $or: GLOBAL_CATEGORY_FILTER },
                        { $or: APPROVED_CATEGORY_FILTER }
                    ]
                },
                {
                    restaurantId: context.restaurantId,
                    $or: APPROVED_CATEGORY_FILTER
                }
            ]
        }
        : {
            $or: [
                {
                    $and: [
                        { $or: GLOBAL_CATEGORY_FILTER },
                        { $or: APPROVED_CATEGORY_FILTER }
                    ]
                },
                { restaurantId: context.restaurantId },
                { createdByRestaurantId: context.restaurantId }
            ]
        };

    filter.$and = [visibilityFilter];
    if (search) {
        const term = escapeRegex(search.slice(0, 80));
        filter.$and.push({ name: { $regex: term, $options: 'i' } });
    }
    applyZoneVisibilityFilter(filter.$and, zoneIdRaw);

    if (compact && context.pureVegRestaurant) {
        filter.$and.push({ foodTypeScope: { $ne: 'Non-Veg' } });
    }

    const queryBuilder = FoodCategory.find(filter)
        .sort({ sortOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
            compact
                ? 'name image type foodTypeScope approvalStatus rejectionReason zoneId restaurantId createdByRestaurantId isActive sortOrder requestedAt approvedAt rejectedAt globalizedAt'
                : 'name image type foodTypeScope approvalStatus rejectionReason zoneId restaurantId createdByRestaurantId isActive sortOrder requestedAt approvedAt rejectedAt globalizedAt createdAt updatedAt'
        );

    const [list, total] = await Promise.all([
        queryBuilder.lean(),
        FoodCategory.countDocuments(filter)
    ]);

    // Read-only: normalize legacy records in-memory for the response, but never write on a GET.
    const statsById = await backfillLegacyCategoryWorkflow(list, { persist: false });
    const restaurantIds = !compact
        ? Array.from(
            new Set(
                list
                    .flatMap((category) => [category?.restaurantId, category?.createdByRestaurantId])
                    .map((value) => (value ? String(value) : ''))
                    .filter(Boolean)
            )
        )
        : [];
    const restaurants = restaurantIds.length
        ? await FoodRestaurant.find({ _id: { $in: restaurantIds } })
            .select('restaurantName ownerName ownerPhone')
            .lean()
        : [];
    const restaurantMap = new Map(restaurants.map((restaurant) => [String(restaurant._id), restaurant]));

    const hydratedList = !compact
        ? list.map((category) => ({
            ...category,
            restaurantId: category?.restaurantId ? restaurantMap.get(String(category.restaurantId)) || category.restaurantId : category.restaurantId,
            createdByRestaurantId: category?.createdByRestaurantId ? restaurantMap.get(String(category.createdByRestaurantId)) || category.createdByRestaurantId : category.createdByRestaurantId
        }))
        : list;

    const categories = hydratedList.map((category) =>
        serializeCategoryForResponse(category, {
            currentRestaurantId: restaurantId,
            includeCounts: withCounts || !compact,
            statsById
        })
    );

    return { categories, total, page, limit };
}

// Display order starts at 1. Legacy rows left at 0 carry no explicit position, so
// they queue behind the ordered ones instead of jumping to the front.
const categoryDisplayRank = (category) => {
    const value = Number(category?.sortOrder);
    return Number.isFinite(value) && value > 0 ? value : Number.MAX_SAFE_INTEGER;
};

/**
 * Which of two same-named categories should own the storefront tile (image, casing).
 * Admin-owned rows win so the curated artwork survives, then rows that actually have
 * an image, then the one positioned earliest by the display order.
 */
const isBetterPublicCategoryPrimary = (candidate, current) => {
    const candidateGlobal = !candidate?.restaurantId;
    const currentGlobal = !current?.restaurantId;
    if (candidateGlobal !== currentGlobal) return candidateGlobal;

    const candidateHasImage = Boolean(String(candidate?.image || '').trim());
    const currentHasImage = Boolean(String(current?.image || '').trim());
    if (candidateHasImage !== currentHasImage) return candidateHasImage;

    return categoryDisplayRank(candidate) < categoryDisplayRank(current);
};

/**
 * Storefront category list.
 *
 * - Both admin-created (global) categories and restaurant-created ones the admin has
 *   approved hold orderable dishes, so both belong here. Limiting this to global rows
 *   hid every restaurant-created category — including all the non-veg ones — from
 *   customers, which also left the veg/non-veg toggle with nothing to filter.
 * - Zone scoping only applies when the caller knows the customer's zone. With no zone
 *   there is nothing to scope against, so zone-bound categories stay visible instead of
 *   collapsing the list down to zone-less globals.
 * - A category survives only while it still has an approved + available item inside an
 *   approved + listed restaurant (see `buildLiveCategoryItemStats`).
 * - Names are unique per restaurant, so several restaurants can hold a category of the
 *   same name. Customers navigate by name slug, so those rows collapse into one tile
 *   that carries every underlying category id in `categoryIds`.
 */
export async function listPublicCategories(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 1000, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const zoneIdRaw = typeof query.zoneId === 'string' ? query.zoneId.trim() : '';

    const filter = {
        isActive: true,
        $and: [{ $or: APPROVED_CATEGORY_FILTER }]
    };

    if (search) {
        const term = escapeRegex(search.slice(0, 80));
        filter.$and.push({ name: { $regex: term, $options: 'i' } });
    }
    if (zoneIdRaw && mongoose.Types.ObjectId.isValid(zoneIdRaw)) {
        applyZoneVisibilityFilter(filter.$and, zoneIdRaw);
    }

    const matched = await FoodCategory.find(filter)
        .select('name image type foodTypeScope zoneId restaurantId createdByRestaurantId sortOrder createdAt updatedAt')
        .lean();

    // A customer tapping a category must land on something orderable, so categories
    // without a single approved + available item never reach the storefront.
    const liveStats = await buildLiveCategoryItemStats(matched.map((category) => category._id));
    const withItems = matched.filter(
        (category) => (liveStats.get(String(category._id))?.total || 0) > 0
    );

    const groups = new Map();
    for (const category of withItems) {
        const key = String(category.name || '').trim().toLowerCase();
        if (!key) continue;

        const stats = liveStats.get(String(category._id)) || { total: 0, veg: 0, nonVeg: 0, pureVeg: 0 };
        const group = groups.get(key);
        if (!group) {
            groups.set(key, {
                primary: category,
                ids: [String(category._id)],
                stats: { ...stats },
                rank: categoryDisplayRank(category),
                allNonVeg: normalizeCategoryFoodTypeScope(category.foodTypeScope, 'Veg') === 'Non-Veg'
            });
            continue;
        }

        group.ids.push(String(category._id));
        group.stats.total += stats.total;
        group.stats.veg += stats.veg;
        group.stats.nonVeg += stats.nonVeg;
        group.stats.pureVeg += stats.pureVeg;
        group.rank = Math.min(group.rank, categoryDisplayRank(category));
        group.allNonVeg =
            group.allNonVeg && normalizeCategoryFoodTypeScope(category.foodTypeScope, 'Veg') === 'Non-Veg';
        if (isBetterPublicCategoryPrimary(category, group.primary)) group.primary = category;
    }

    const ordered = Array.from(groups.values()).sort((a, b) => {
        const rankDiff = a.rank - b.rank;
        if (rankDiff !== 0) return rankDiff;
        return new Date(b.primary.createdAt || 0) - new Date(a.primary.createdAt || 0);
    });

    const total = ordered.length;
    const list = ordered.slice(skip, skip + limit);

    // Read-only path; this projection omits fields the backfill would infer from, so persisting
    // here could write wrong values. Normalize in-memory only.
    await backfillLegacyCategoryWorkflow(list.map((group) => group.primary), { persist: false });
    const categories = list.map((group) => ({
        ...serializeCategoryForResponse(group.primary),
        sortOrder: group.rank === Number.MAX_SAFE_INTEGER ? 0 : group.rank,
        // A merged tile spans several category documents; every id has to travel so the
        // category page can collect items from all of them.
        categoryIds: group.ids,
        foodTypeScope: group.allNonVeg ? 'Non-Veg' : 'Veg',
        itemCount: group.stats.total,
        vegItemCount: group.stats.veg,
        nonVegItemCount: group.stats.nonVeg,
        pureVegItemCount: group.stats.pureVeg
    }));

    return { categories, total, page, limit };
}

/**
 * Return the live status of a single category for a restaurant. Used by the
 * restaurant dashboard to dynamically warn when a previously-used category has
 * been deactivated by the admin, without relying on cached/stale values.
 */
export async function getRestaurantCategoryStatus(restaurantId, id) {
    const context = await getRestaurantContext(restaurantId);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('Invalid category id');
    }

    const category = await FoodCategory.findById(id)
        .select('name image foodTypeScope approvalStatus isActive restaurantId createdByRestaurantId zoneId')
        .lean();

    if (!category?._id) return null;

    // Read-only status check: normalize in-memory without writing on a GET.
    await backfillLegacyCategoryWorkflow([category], { persist: false });

    return {
        id: String(category._id),
        _id: String(category._id),
        name: category.name || '',
        isActive: category.isActive !== false,
        approvalStatus: getCategoryApprovalStatus(category),
        foodTypeScope: normalizeCategoryFoodTypeScope(category.foodTypeScope, 'Veg'),
        ownedByRestaurant:
            String(category.restaurantId || '') === String(context.restaurantId) ||
            String(category.createdByRestaurantId || '') === String(context.restaurantId)
    };
}

export async function createRestaurantCategory(restaurantId, body = {}) {
    const context = await getRestaurantContext(restaurantId);

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new ValidationError('Category name is required');
    if (name.length > 200) throw new ValidationError('Category name is too long');

    const foodTypeScopeRaw = typeof body.foodTypeScope === 'string' ? body.foodTypeScope.trim() : '';
    if (!foodTypeScopeRaw) {
        throw new ValidationError('Category diet type is required');
    }
    const foodTypeScope = normalizeCategoryFoodTypeScope(foodTypeScopeRaw, '');
    if (!foodTypeScope) {
        throw new ValidationError('Invalid category diet type');
    }
    if (!['Veg', 'Non-Veg'].includes(foodTypeScope)) {
        throw new ValidationError('Category diet type must be Veg or Non-Veg');
    }
    if (context.pureVegRestaurant && foodTypeScope !== 'Veg') {
        throw new ValidationError('Pure veg restaurants can only create veg categories');
    }

    const zoneId =
        context.zoneId && mongoose.Types.ObjectId.isValid(context.zoneId)
            ? new mongoose.Types.ObjectId(context.zoneId)
            : undefined;

    await ensureUniqueCategoryName(name, { restaurantId: context.restaurantId });

    const doc = new FoodCategory({
        name,
        image: typeof body.image === 'string' ? body.image.trim() : '',
        type: typeof body.type === 'string' ? body.type.trim() : '',
        foodTypeScope,
        isActive: body.isActive !== false,
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
        restaurantId: context.restaurantId,
        createdByRestaurantId: context.restaurantId,
        approvalStatus: 'pending',
        isApproved: false,
        rejectionReason: '',
        requestedAt: new Date(),
        zoneId
    });
    await doc.save();

    try {
        const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
        void notifyAdminsSafely({
            title: 'New Restaurant Category',
            body: `Restaurant "${context.restaurantName || 'Unknown'}" added a new category "${name}" for approval.`,
            data: {
                type: 'category_approval',
                link: '/admin/food/categories',
            },
        });
    } catch (err) {
        console.error('Failed to notify admins about new category:', err);
    }

    return doc.toObject();
}

export async function updateRestaurantCategory(restaurantId, id, body = {}) {
    const context = await getRestaurantContext(restaurantId);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('Invalid category id');
    }

    const doc = await FoodCategory.findOne({ _id: id, restaurantId: context.restaurantId });
    if (!doc) return null;

    const nextFoodTypeScope = body.foodTypeScope !== undefined
        ? normalizeCategoryFoodTypeScope(body.foodTypeScope, '')
        : normalizeCategoryFoodTypeScope(doc.foodTypeScope, 'Veg');
    if (body.foodTypeScope !== undefined && !nextFoodTypeScope) {
        throw new ValidationError('Invalid category diet type');
    }
    if (body.foodTypeScope !== undefined && !['Veg', 'Non-Veg'].includes(nextFoodTypeScope)) {
        throw new ValidationError('Category diet type must be Veg or Non-Veg');
    }
    if (context.pureVegRestaurant && nextFoodTypeScope !== 'Veg') {
        throw new ValidationError('Pure veg restaurants can only keep veg categories');
    }

    let needsApproval = false;

    if (body.name !== undefined) {
        const name = String(body.name || '').trim();
        if (!name) throw new ValidationError('Category name is required');
        if (name.length > 200) throw new ValidationError('Category name is too long');
        if (doc.name !== name) {
            await ensureUniqueCategoryName(name, {
                restaurantId: context.restaurantId,
                excludeCategoryId: doc._id
            });
            doc.name = name;
            needsApproval = true;
        }
    }
    if (body.image !== undefined) {
        const image = String(body.image || '').trim();
        if (doc.image !== image) {
            doc.image = image;
        }
    }
    if (body.type !== undefined) {
        const type = String(body.type || '').trim();
        if (doc.type !== type) {
            doc.type = type;
        }
    }
    if (body.isActive !== undefined) {
        doc.isActive = body.isActive !== false;
    }
    if (body.sortOrder !== undefined) {
        const sortOrder = Number(body.sortOrder) || 0;
        if (doc.sortOrder !== sortOrder) {
            doc.sortOrder = sortOrder;
        }
    }
    if (body.foodTypeScope !== undefined) {
        const incompatibleFoods = await FoodItem.countDocuments({
            categoryId: doc._id,
            foodType: nextFoodTypeScope === 'Veg' ? 'Non-Veg' : 'Veg'
        });
        if (incompatibleFoods > 0) {
            throw new ValidationError(`This category already has ${incompatibleFoods} food item(s) outside the selected diet type`);
        }
        if (doc.foodTypeScope !== nextFoodTypeScope) {
            doc.foodTypeScope = nextFoodTypeScope;
            needsApproval = true;
        }
    }

    if (needsApproval) {
        doc.createdByRestaurantId = doc.createdByRestaurantId || context.restaurantId;
        doc.approvalStatus = 'pending';
        doc.isApproved = false;
        doc.rejectionReason = '';
        doc.requestedAt = new Date();
        doc.rejectedAt = undefined;
        // Keep approvedAt so existing approved items stay visible during re-review.
    }

    await doc.save();
    return doc.toObject();
}

export async function deleteRestaurantCategory(restaurantId, id) {
    const context = await getRestaurantContext(restaurantId);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('Invalid category id');
    }

    const category = await FoodCategory.findOne({ _id: id, restaurantId: context.restaurantId })
        .select('_id name')
        .lean();
    if (!category?._id) return null;

    const linkedItems = await FoodItem.find({
        categoryId: id,
        restaurantId: context.restaurantId
    })
        .select('_id name categoryName')
        .lean();

    if (linkedItems.length > 0) {
        await FoodItem.updateMany(
            { categoryId: id, restaurantId: context.restaurantId },
            {
                $set: {
                    isAvailable: false,
                    categoryId: null,
                    categoryName: ''
                }
            }
        );
    }

    const deleted = await FoodCategory.findOneAndDelete({ _id: id, restaurantId: context.restaurantId }).lean();
    if (!deleted) return null;

    return {
        id,
        deactivatedItemCount: linkedItems.length,
        deactivatedItemIds: linkedItems.map((item) => String(item._id))
    };
}
