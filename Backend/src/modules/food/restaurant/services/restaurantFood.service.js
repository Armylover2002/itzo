import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { FoodCategory } from '../../admin/models/category.model.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import {
    extractRawFoodVariants,
    getFoodDisplayPrice,
    getFoodDisplayOtherPrice,
    hasFoodVariants,
    normalizeFoodVariantsInput
} from '../../admin/services/foodVariant.service.js';
import {
    backfillLegacyCategoryWorkflow,
    categoryAllowsFoodType,
    getCategoryApprovalStatus,
    GLOBAL_CATEGORY_FILTER
} from '../../shared/categoryWorkflow.js';
import { resolveRestaurantItemSlotTimingId } from './itemSlotTiming.service.js';

const toStr = (v) => (v != null ? String(v).trim() : '');
const APPROVED_CATEGORY_FILTER = [
    { approvalStatus: 'approved' },
    { approvalStatus: { $exists: false }, isApproved: { $ne: false } }
];

const normalizeFoodType = (v) => {
    const t = String(v || '').trim();
    if (!t) return 'Non-Veg';
    if (t === 'Veg') return 'Veg';
    if (t === 'Non-Veg') return 'Non-Veg';
    if (t === 'Egg') return 'Non-Veg';
    return 'Non-Veg';
};

const getCreateFoodPricing = (body = {}) => {
    const variants = normalizeFoodVariantsInput(extractRawFoodVariants(body));

    if (variants.length > 0) {
        return {
            price: getFoodDisplayPrice({ variants }),
            otherPrice: getFoodDisplayOtherPrice({ variants }),
            variants
        };
    }

    const bodyPrice = Number(body.price);
    const bodyOtherPrice = Number(body.otherPrice);

    return {
        price: Number.isFinite(bodyPrice) && bodyPrice > 0 ? bodyPrice : 0,
        otherPrice: Number.isFinite(bodyOtherPrice) && bodyOtherPrice > 0 ? bodyOtherPrice : 0,
        variants: []
    };
};

const getUpdatedFoodPricing = (existing = {}, body = {}) => {
    const variantsTouched = body.variants !== undefined || body.variations !== undefined;
    const update = {};

    if (variantsTouched) {
        const variants = normalizeFoodVariantsInput(extractRawFoodVariants(body));
        update.variants = variants;
    }

    // Check if price/otherPrice are provided in body
    const bodyPrice = Number(body.price);
    const bodyOtherPrice = Number(body.otherPrice);

    if (variantsTouched) {
        const variants = update.variants || [];
        if (variants.length > 0) {
            update.price = getFoodDisplayPrice({ variants });
            update.otherPrice = getFoodDisplayOtherPrice({ variants });
        } else {
            update.price = Number.isFinite(bodyPrice) && bodyPrice > 0 ? bodyPrice : 0;
            update.otherPrice = Number.isFinite(bodyOtherPrice) && bodyOtherPrice > 0 ? bodyOtherPrice : 0;
        }
    } else {
        if (Number.isFinite(bodyPrice) && bodyPrice > 0) {
            update.price = bodyPrice;
        }
        if (Number.isFinite(bodyOtherPrice) && bodyOtherPrice > 0) {
            update.otherPrice = bodyOtherPrice;
        }
    }

    return update;
};

const getRestaurantContext = async (restaurantId) => {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }

    const restaurant = await FoodRestaurant.findById(restaurantId)
        .select('pureVegRestaurant')
        .lean();
    if (!restaurant?._id) {
        throw new ValidationError('Restaurant not found');
    }

    return {
        restaurantId: new mongoose.Types.ObjectId(String(restaurantId)),
        pureVegRestaurant: restaurant.pureVegRestaurant === true
    };
};

const getAccessibleCategoryFilter = (context) => ({
    $or: [
        { restaurantId: context.restaurantId, $or: APPROVED_CATEGORY_FILTER },
        {
            $and: [
                { $or: GLOBAL_CATEGORY_FILTER },
                { $or: APPROVED_CATEGORY_FILTER }
            ]
        }
    ]
});

const resolveCategoryForRestaurant = async (context, body = {}) => {
    const categoryIdRaw = toStr(body.categoryId);
    const categoryNameRaw = toStr(body.categoryName);
    const foodType = normalizeFoodType(body.foodType);

    if (!categoryIdRaw && !categoryNameRaw) {
        return { categoryObjectId: undefined, categoryName: '' };
    }

    // Note: we intentionally do NOT filter by isActive here. An inactive category can
    // still be resolved so we can surface a precise, professional error message instead
    // of a generic "not found". The explicit isActive check happens after resolution.
    const baseFilter = {
        ...getAccessibleCategoryFilter(context)
    };
    if (context.pureVegRestaurant) {
        baseFilter.foodTypeScope = { $ne: 'Non-Veg' };
    }

    let category = null;
    if (categoryIdRaw) {
        if (!mongoose.Types.ObjectId.isValid(categoryIdRaw)) {
            throw new ValidationError('Invalid category id');
        }

        category = await FoodCategory.findOne({
            _id: new mongoose.Types.ObjectId(categoryIdRaw),
            ...baseFilter
        }).lean();
    } else {
        const exact = `^${String(categoryNameRaw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
        const matches = await FoodCategory.find({
            ...baseFilter,
            name: { $regex: exact, $options: 'i' }
        })
            .sort({ createdAt: -1 })
            .limit(2)
            .lean();
        if (matches.length > 1) {
            throw new ValidationError('Multiple categories share this name. Please choose a specific category.');
        }
        category = matches[0] || null;
    }

    if (!category?._id) {
        throw new ValidationError('Category not found for this restaurant');
    }

    await backfillLegacyCategoryWorkflow([category]);

    if (category.isActive === false) {
        throw new ValidationError('This category is currently inactive and is not available for use.');
    }
    const approvalStatus = getCategoryApprovalStatus(category);
    if (approvalStatus === 'rejected') {
        throw new ValidationError('This category has been rejected by admin');
    }
    if (approvalStatus === 'pending') {
        throw new ValidationError('This category is awaiting admin approval');
    }
    if (context.pureVegRestaurant && String(category.foodTypeScope || '') === 'Non-Veg') {
        throw new ValidationError('Pure veg restaurants cannot use non-veg categories');
    }
    if (!categoryAllowsFoodType(category.foodTypeScope, foodType)) {
        throw new ValidationError(`This ${category.foodTypeScope} category cannot accept ${foodType} food`);
    }

    return {
        categoryObjectId: category._id,
        categoryName: category.name || '',
        category
    };
};

export async function createRestaurantFood(restaurantId, body = {}) {
    const context = await getRestaurantContext(restaurantId);

    const name = toStr(body.name);
    if (!name) throw new ValidationError('Item name is required');
    if (name.length > 200) throw new ValidationError('Item name is too long');

    const { price, otherPrice, variants } = getCreateFoodPricing(body);

    const description = toStr(body.description);
    const images = Array.isArray(body.images) ? body.images.map(toStr) : (body.image ? [toStr(body.image)] : []);
    const image = images.length > 0 ? images[0] : toStr(body.image);
    const isAvailable = body.isAvailable !== false;
    const foodType = normalizeFoodType(body.foodType);
    if (context.pureVegRestaurant && foodType !== 'Veg') {
        throw new ValidationError('Pure veg restaurants can only add veg items');
    }
    const preparationTime = toStr(body.preparationTime);
    const itemSlotTimingId = await resolveRestaurantItemSlotTimingId(restaurantId, body.itemSlotTimingId);
    const { categoryObjectId, categoryName } = await resolveCategoryForRestaurant(context, { ...body, foodType });

    const doc = await FoodItem.create({
        restaurantId,
        categoryId: categoryObjectId,
        categoryName: categoryName || '',
        name,
        description,
        price,
        otherPrice,
        variants,
        image,
        images,
        foodType,
        isAvailable,
        itemSlotTimingId,
        preparationTime,
        discountType: body.discountType === 'Amount' ? 'Amount' : 'Percent',
        discountAmount: typeof body.discountAmount === 'number' ? body.discountAmount : Number(body.discountAmount) || 0,
        discount: typeof body.discount === 'string' ? body.discount.trim() : '',
        isRecommended: body.isRecommended === true,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
        nutrition: Array.isArray(body.nutrition) ? body.nutrition.map(String) : [],
        allergies: Array.isArray(body.allergies) ? body.allergies.map(String) : [],
        availabilityTimeStart: typeof body.availabilityTimeStart === 'string' ? body.availabilityTimeStart.trim() : '',
        availabilityTimeEnd: typeof body.availabilityTimeEnd === 'string' ? body.availabilityTimeEnd.trim() : '',
        originalPrice: typeof body.originalPrice === 'number' ? body.originalPrice : Number(body.originalPrice) || 0,
        approvalStatus: 'pending',
        requestedAt: new Date()
    });

    if (doc.image) {
        // Fire-and-forget background save without awaiting. Catches and logs errors safely.
        import('../../../media/services/media.service.js')
            .then(({ saveToSharedMedia }) => {
                saveToSharedMedia({
                    url: doc.image,
                    name: doc.name,
                    category: doc.categoryName || "",
                    restaurantId: doc.restaurantId
                }).catch(err => {
                    console.error('Failed to auto-save to shared media library in background:', err);
                });
            })
            .catch(err => {
                console.error('Failed to import media service for background auto-save:', err);
            });
    }

    try {
        const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
        await notifyAdminsSafely({
            title: 'New Product Approval Request 🍔',
            body: `Restaurant has submitted a new item "${doc.name}" for approval.`,
            data: {
                type: 'approval_request',
                subType: 'food',
                id: String(doc._id)
            }
        });
    } catch (err) {
        console.error('Failed to notify admins of new food item:', err);
    }

    return doc.toObject();
}

export async function updateRestaurantFood(restaurantId, foodId, body = {}) {
    const context = await getRestaurantContext(restaurantId);
    if (!foodId || !mongoose.Types.ObjectId.isValid(String(foodId))) {
        throw new ValidationError('Invalid food id');
    }

    const existing = await FoodItem.findOne({ _id: foodId, restaurantId }).lean();
    if (!existing) return null;

    const update = {};

    if (body.name !== undefined) {
        const name = toStr(body.name);
        if (!name) throw new ValidationError('Item name is required');
        if (name.length > 200) throw new ValidationError('Item name is too long');
        update.name = name;
    }
    if (body.description !== undefined) update.description = toStr(body.description);
    if (body.images !== undefined) {
        const images = Array.isArray(body.images) ? body.images.map(toStr) : [];
        update.images = images;
        update.image = images.length > 0 ? images[0] : '';
    } else if (body.image !== undefined) {
        const img = toStr(body.image);
        update.image = img;
        update.images = img ? [img] : [];
    }
    Object.assign(update, getUpdatedFoodPricing(existing, body));
    const nextIsAvailable = body.isAvailable !== undefined
        ? body.isAvailable !== false
        : existing.isAvailable !== false;

    if (body.isAvailable !== undefined) {
        if (nextIsAvailable) {
            const categoryIdForCheck = body.categoryId !== undefined ? body.categoryId : existing.categoryId;
            const categoryNameForCheck = body.categoryName !== undefined ? body.categoryName : existing.categoryName;
            const foodTypeForCheck = body.foodType !== undefined ? normalizeFoodType(body.foodType) : normalizeFoodType(existing.foodType);

            if (!categoryIdForCheck && !toStr(categoryNameForCheck)) {
                throw new ValidationError('Assign this item to a category before making it available');
            }

            await resolveCategoryForRestaurant(context, {
                categoryId: categoryIdForCheck,
                categoryName: categoryNameForCheck,
                foodType: foodTypeForCheck
            });
        }
        update.isAvailable = nextIsAvailable;
    }
    if (body.preparationTime !== undefined) update.preparationTime = toStr(body.preparationTime);
    if (body.itemSlotTimingId !== undefined) {
        update.itemSlotTimingId = await resolveRestaurantItemSlotTimingId(restaurantId, body.itemSlotTimingId);
    }

    const targetFoodType = body.foodType !== undefined ? normalizeFoodType(body.foodType) : normalizeFoodType(existing.foodType);
    if (context.pureVegRestaurant && targetFoodType !== 'Veg') {
        throw new ValidationError('Pure veg restaurants can only add veg items');
    }
    if (body.foodType !== undefined) update.foodType = targetFoodType;

    if (body.discountType !== undefined) update.discountType = body.discountType === 'Amount' ? 'Amount' : 'Percent';
    if (body.discountAmount !== undefined) update.discountAmount = Number(body.discountAmount) || 0;
    if (body.discount !== undefined) update.discount = String(body.discount || '').trim();
    if (body.isRecommended !== undefined) update.isRecommended = body.isRecommended === true;
    if (body.tags !== undefined) update.tags = Array.isArray(body.tags) ? body.tags.map(String) : [];
    if (body.nutrition !== undefined) update.nutrition = Array.isArray(body.nutrition) ? body.nutrition.map(String) : [];
    if (body.allergies !== undefined) update.allergies = Array.isArray(body.allergies) ? body.allergies.map(String) : [];
    if (body.availabilityTimeStart !== undefined) update.availabilityTimeStart = String(body.availabilityTimeStart || '').trim();
    if (body.availabilityTimeEnd !== undefined) update.availabilityTimeEnd = String(body.availabilityTimeEnd || '').trim();
    if (body.originalPrice !== undefined) update.originalPrice = Number(body.originalPrice) || 0;

    if (
        body.categoryId !== undefined ||
        body.categoryName !== undefined ||
        body.foodType !== undefined
    ) {
        const { categoryObjectId, categoryName } = await resolveCategoryForRestaurant(context, {
            categoryId: body.categoryId !== undefined ? body.categoryId : existing.categoryId,
            categoryName: body.categoryName !== undefined ? body.categoryName : existing.categoryName,
            foodType: targetFoodType
        });
        update.categoryId = categoryObjectId;
        update.categoryName = categoryName || '';
    }

    const shouldResubmitForApproval = Object.keys(update).length > 0;

    if (shouldResubmitForApproval) {
        update.approvalStatus = 'pending';
        update.requestedAt = new Date();
        update.rejectionReason = '';
        update.approvedAt = null;
        update.rejectedAt = null;
    }

    const updated = await FoodItem.findOneAndUpdate(
        { _id: foodId, restaurantId },
        { $set: update },
        { new: true }
    ).lean();

    if (updated && shouldResubmitForApproval) {
        try {
            const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
            await notifyAdminsSafely({
                title: 'Updated Product Approval Request 🍔',
                body: `Restaurant has updated and resubmitted "${updated.name}" for approval.`,
                data: {
                    type: 'approval_request',
                    subType: 'food',
                    id: String(updated._id)
                }
            });
        } catch (e) {
            console.error('Failed to notify admins of resubmitted food approval request:', e);
        }
    }

    return updated;
}
