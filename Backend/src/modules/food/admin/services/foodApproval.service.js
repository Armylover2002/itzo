import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodItem } from '../models/food.model.js';
import { FoodAddon } from '../../restaurant/models/foodAddon.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { syncMenuItemApprovalStatus } from '../../restaurant/services/restaurantMenu.service.js';
import { getFoodDisplayPrice, getFoodDisplayOtherPrice, serializeFoodVariants } from './foodVariant.service.js';

export async function listPendingFoodApprovals(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 200, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = { approvalStatus: 'pending' };
    if (query.restaurantId && mongoose.Types.ObjectId.isValid(String(query.restaurantId))) {
        filter.restaurantId = query.restaurantId;
    }
    if (query.search && String(query.search).trim()) {
        const term = String(query.search).trim().slice(0, 80);
        filter.$or = [
            { name: { $regex: term, $options: 'i' } },
            { categoryName: { $regex: term, $options: 'i' } }
        ];
    }

    const foodList = await FoodItem.find(filter)
        .sort({ requestedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('restaurantId categoryName name price otherPrice variants image foodType approvalStatus requestedAt createdAt')
        .lean();

    const addonList = await FoodAddon.find({ approvalStatus: 'pending' })
        .sort({ requestedAt: -1, createdAt: -1 })
        .limit(limit)
        .select('restaurantId draft isAvailable requestedAt createdAt')
        .lean();

    const restaurantIds = Array.from(new Set([
        ...foodList.map((f) => String(f.restaurantId)),
        ...addonList.map((a) => String(a.restaurantId))
    ].filter(Boolean)));

    const restaurants = restaurantIds.length
        ? await FoodRestaurant.find({ _id: { $in: restaurantIds } }).select('restaurantName restaurantId').lean()
        : [];
    const restaurantMap = new Map(restaurants.map((r) => [String(r._id), r.restaurantName]));
    const restaurantCodeMap = new Map(restaurants.map((r) => [String(r._id), r.restaurantId || String(r._id)]));

    const foodRequests = foodList.map((f) => ({
        _id: f._id,
        id: f._id,
        entityType: 'food',
        type: 'food',
        restaurantName: restaurantMap.get(String(f.restaurantId)) || 'Unknown Restaurant',
        restaurantId: restaurantCodeMap.get(String(f.restaurantId)) || String(f.restaurantId),
        category: f.categoryName || '',
        itemName: f.name,
        foodType: f.foodType || 'Non-Veg',
        sectionName: f.categoryName || '',
        subsectionName: '',
        approvalStatus: f.approvalStatus || 'pending',
        price: getFoodDisplayPrice(f),
        otherPrice: getFoodDisplayOtherPrice(f),
        variants: serializeFoodVariants(f.variants),
        image: f.image || '',
        images: f.image ? [f.image] : [],
        requestedAt: f.requestedAt || f.createdAt,
        isActionable: (f.approvalStatus || 'pending') === 'pending'
    }));

    const addonRequests = addonList.map((a) => ({
        _id: a._id,
        id: a._id,
        entityType: 'addon',
        type: 'addon',
        restaurantName: restaurantMap.get(String(a.restaurantId)) || 'Unknown Restaurant',
        restaurantId: restaurantCodeMap.get(String(a.restaurantId)) || String(a.restaurantId),
        category: 'Add-on',
        itemName: a.draft?.name || 'Unnamed Add-on',
        foodType: 'Add-on',
        sectionName: 'Add-on',
        subsectionName: '',
        approvalStatus: 'pending',
        price: a.draft?.price ?? 0,
        image: a.draft?.image || (a.draft?.images && a.draft.images[0]) || '',
        images: a.draft?.images || (a.draft?.image ? [a.draft.image] : []),
        requestedAt: a.requestedAt || a.createdAt,
        isActionable: true,
        description: a.draft?.description || ''
    }));

    const allRequests = [...foodRequests, ...addonRequests].sort((a, b) => 
        new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );

    return { requests: allRequests, page, limit, total: allRequests.length };
}

export async function approveFoodItem(id, performer = null) {
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        throw new ValidationError('Invalid food id');
    }
    const updated = await FoodItem.findOneAndUpdate(
        { _id: id, approvalStatus: 'pending' },
        { $set: { approvalStatus: 'approved', approvedAt: new Date(), rejectedAt: null, rejectionReason: '', approvedBy: performer } },
        { new: true }
    ).lean();
    if (updated?.restaurantId) {
        // Single DB update; makes user-facing menu reflect approval immediately.
        await syncMenuItemApprovalStatus(updated.restaurantId, updated._id, 'approved', '');
        
        try {
            const { notifyOwnersSafely } = await import('../../../core/notifications/firebase.service.js');
            await notifyOwnersSafely(
                [{ ownerType: 'RESTAURANT', ownerId: updated.restaurantId }],
                {
                    title: 'Dish Approved! 🍲',
                    body: `Your dish "${updated.name}" has been approved and is now visible to customers.`,
                    image: updated.image || 'https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png',
                    data: {
                        type: 'food_approved',
                        foodId: String(updated._id),
                        restaurantId: String(updated.restaurantId)
                    }
                }
            );
        } catch (e) {
            console.error('Failed to send food approval notification:', e);
        }
    }
    return updated;
}

export async function rejectFoodItem(id, reason, performer = null) {
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        throw new ValidationError('Invalid food id');
    }
    const r = typeof reason === 'string' ? reason.trim() : '';
    if (!r) throw new ValidationError('Rejection reason is required');
    if (r.length > 500) throw new ValidationError('Rejection reason is too long');

    const updated = await FoodItem.findOneAndUpdate(
        { _id: id, approvalStatus: 'pending' },
        { $set: { approvalStatus: 'rejected', rejectedAt: new Date(), rejectionReason: r, approvedAt: null, rejectedBy: performer } },
        { new: true }
    ).lean();
    if (updated?.restaurantId) {
        await syncMenuItemApprovalStatus(updated.restaurantId, updated._id, 'rejected', r);
        
        try {
            const { notifyOwnersSafely } = await import('../../../core/notifications/firebase.service.js');
            await notifyOwnersSafely(
                [{ ownerType: 'RESTAURANT', ownerId: updated.restaurantId }],
                {
                    title: 'Dish Rejected ❌',
                    body: `Your dish "${updated.name}" was rejected. Reason: ${r}`,
                    image: updated.image || 'https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png',
                    data: {
                        type: 'food_rejected',
                        foodId: String(updated._id),
                        restaurantId: String(updated.restaurantId),
                        reason: r
                    }
                }
            );
        } catch (e) {
            console.error('Failed to send food rejection notification:', e);
        }
    }
    return updated;
}

