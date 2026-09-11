import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { DiningProfile } from '../models/diningProfile.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

/** Restaurant-side: get (or lazily create) this restaurant's dining profile. */
export async function getOrCreateDiningProfile(restaurantId) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant');
    }
    const profile = await DiningProfile.findOneAndUpdate(
        { restaurantId: toObjectId(restaurantId) },
        { $setOnInsert: { restaurantId: toObjectId(restaurantId) } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return profile;
}

/**
 * Restaurant-side: opt in to Dining. Blocked while a request is already
 * pending or already approved — the restaurant must use the settings screen
 * to change an approved profile, not re-request.
 */
export async function requestDining(restaurantId) {
    const profile = await getOrCreateDiningProfile(restaurantId);

    if (profile.status === 'pending') {
        throw new ValidationError('A dining request is already pending admin review');
    }
    if (profile.status === 'approved') {
        throw new ValidationError('Dining is already enabled for this restaurant');
    }

    const updated = await DiningProfile.findOneAndUpdate(
        { restaurantId: toObjectId(restaurantId) },
        {
            $set: {
                status: 'pending',
                requestedAt: new Date(),
                reviewedAt: null,
                reviewedBy: null,
                rejectionReason: '',
            },
        },
        { new: true },
    ).lean();
    return updated;
}

/** Admin-side: pending / approved / rejected requests, with restaurant identity joined in. */
export async function listDiningRequests(query = {}) {
    const status = ['pending', 'approved', 'rejected', 'not_requested'].includes(query.status)
        ? query.status
        : 'pending';

    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 100, 1), 500);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = { status };
    const [profiles, total] = await Promise.all([
        DiningProfile.find(filter).sort({ requestedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
        DiningProfile.countDocuments(filter),
    ]);

    const restaurantIds = profiles.map((p) => p.restaurantId);
    const restaurants = restaurantIds.length
        ? await FoodRestaurant.find({ _id: { $in: restaurantIds } })
            .select('restaurantId restaurantName ownerName ownerPhone businessType profileImage city area')
            .lean()
        : [];
    const restaurantMap = new Map(restaurants.map((r) => [String(r._id), r]));

    const requests = profiles.map((profile) => ({
        ...profile,
        restaurant: restaurantMap.get(String(profile.restaurantId)) || null,
    }));

    return { requests, total, page, limit };
}

/** Admin-side: approve or reject a pending dining request. */
export async function reviewDiningRequest(profileId, { approve, rejectionReason, adminId } = {}) {
    if (!profileId || !mongoose.Types.ObjectId.isValid(String(profileId))) {
        throw new ValidationError('Invalid dining request id');
    }
    if (!approve && !String(rejectionReason || '').trim()) {
        throw new ValidationError('Rejection reason is required');
    }

    const update = {
        status: approve ? 'approved' : 'rejected',
        reviewedAt: new Date(),
        reviewedBy: adminId || null,
        rejectionReason: approve ? '' : String(rejectionReason).trim(),
    };

    const updated = await DiningProfile.findOneAndUpdate(
        { _id: profileId, status: 'pending' },
        { $set: update },
        { new: true },
    ).lean();

    if (!updated) {
        throw new ValidationError('This request has already been reviewed');
    }

    try {
        const { notifyOwnersSafely } = await import('../../../../core/notifications/firebase.service.js');
        await notifyOwnersSafely(
            [{ ownerType: 'RESTAURANT', ownerId: updated.restaurantId }],
            approve
                ? { title: 'Dining approved', body: 'Your restaurant can now set up Dining and accept table bookings.' }
                : { title: 'Dining request rejected', body: update.rejectionReason },
        );
    } catch {
        // Push failures must never block the review action itself.
    }

    return updated;
}

/** Admin-side: approved restaurants list (dining-enabled or not), with commission info. */
export async function listDiningRestaurants(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 100, 1), 500);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = { status: 'approved' };
    if (query.isDiningEnabled !== undefined) {
        filter.isDiningEnabled = query.isDiningEnabled === 'true' || query.isDiningEnabled === true;
    }

    const [profiles, total] = await Promise.all([
        DiningProfile.find(filter)
            .populate('categoryIds', 'name image')
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        DiningProfile.countDocuments(filter),
    ]);

    const restaurantIds = profiles.map((p) => p.restaurantId);
    const restaurants = restaurantIds.length
        ? await FoodRestaurant.find({ _id: { $in: restaurantIds } })
            .select('restaurantId restaurantName ownerName ownerPhone profileImage city area')
            .lean()
        : [];
    const restaurantMap = new Map(restaurants.map((r) => [String(r._id), r]));

    const restaurantsOut = profiles.map((profile) => ({
        ...profile,
        restaurant: restaurantMap.get(String(profile.restaurantId)) || null,
    }));

    return { restaurants: restaurantsOut, total, page, limit };
}

/** Admin-side: set (or clear) a per-restaurant commission override. */
export async function setDiningCommissionOverride(profileId, { override, type, value } = {}) {
    if (!profileId || !mongoose.Types.ObjectId.isValid(String(profileId))) {
        throw new ValidationError('Invalid dining profile id');
    }

    const update = { 'commission.override': override === true || override === 'true' };
    if (update['commission.override']) {
        const commissionValue = Number(value);
        if (!Number.isFinite(commissionValue) || commissionValue < 0) {
            throw new ValidationError('Commission value must be a non-negative number');
        }
        const commissionType = type === 'amount' ? 'amount' : 'percentage';
        if (commissionType === 'percentage' && commissionValue > 100) {
            throw new ValidationError('Percentage commission cannot exceed 100');
        }
        update['commission.type'] = commissionType;
        update['commission.value'] = commissionValue;
    }

    const updated = await DiningProfile.findByIdAndUpdate(profileId, { $set: update }, { new: true }).lean();
    if (!updated) throw new ValidationError('Dining profile not found');
    return updated;
}
