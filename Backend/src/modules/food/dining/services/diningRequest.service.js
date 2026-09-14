import { DiningProfile } from '../models/diningProfile.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { notifyOwnerWithInbox } from '../../../../core/notifications/ownerInboxNotify.js';

export async function getOrCreateDiningProfile(restaurantId) {
    let profile = await DiningProfile.findOne({ restaurantId });
    if (!profile) {
        profile = await DiningProfile.create({ restaurantId, status: 'not_requested' });
    }
    return profile;
}

export async function requestDining(restaurantId) {
    const profile = await getOrCreateDiningProfile(restaurantId);
    if (profile.status === 'pending') {
        throw new ValidationError('Dining request is already pending review');
    }
    if (profile.status === 'approved') {
        throw new ValidationError('Dining is already approved for this restaurant');
    }
    profile.status = 'pending';
    profile.requestedAt = new Date();
    profile.rejectionReason = '';
    await profile.save();
    return profile;
}

export async function listDiningRequests({ status } = {}) {
    const filter = status ? { status } : { status: 'pending' };
    const profiles = await DiningProfile.find(filter).sort({ requestedAt: -1 }).lean();
    if (!profiles.length) return [];

    const restaurantIds = profiles.map((p) => p.restaurantId);
    const restaurants = await FoodRestaurant.find({ _id: { $in: restaurantIds } })
        .select('name phone email images image')
        .lean();
    const restaurantMap = new Map(restaurants.map((r) => [String(r._id), r]));

    return profiles.map((profile) => ({
        ...profile,
        restaurant: restaurantMap.get(String(profile.restaurantId)) || null,
    }));
}

export async function reviewDiningRequest(profileId, { decision, rejectionReason, adminId }) {
    const profile = await DiningProfile.findById(profileId);
    if (!profile) throw new ValidationError('Dining request not found');
    if (profile.status !== 'pending') throw new ValidationError('This request has already been reviewed');

    profile.status = decision;
    profile.reviewedAt = new Date();
    profile.reviewedBy = adminId;
    profile.rejectionReason = decision === 'rejected' ? (rejectionReason || '') : '';
    await profile.save();

    try {
        await notifyOwnerWithInbox(
            { ownerType: 'RESTAURANT', ownerId: profile.restaurantId },
            {
                title: decision === 'approved' ? 'Dining request approved' : 'Dining request rejected',
                body: decision === 'approved'
                    ? 'You can now set up your dining slots and start accepting table bookings.'
                    : `Your dining request was rejected. ${rejectionReason || ''}`.trim(),
                link: '/food/restaurant/dining/setup',
                category: 'dining',
            }
        );
    } catch {
        // notification failure should not block the review
    }

    return profile;
}

export async function listDiningRestaurants({ status } = {}) {
    const filter = status ? { status } : {};
    const profiles = await DiningProfile.find(filter).sort({ createdAt: -1 }).lean();
    if (!profiles.length) return [];

    const restaurantIds = profiles.map((p) => p.restaurantId);
    const restaurants = await FoodRestaurant.find({ _id: { $in: restaurantIds } })
        .select('name phone email images image')
        .lean();
    const restaurantMap = new Map(restaurants.map((r) => [String(r._id), r]));

    return profiles.map((profile) => ({
        ...profile,
        restaurant: restaurantMap.get(String(profile.restaurantId)) || null,
    }));
}

export async function setDiningCommissionOverride(profileId, { override, type, value }) {
    const profile = await DiningProfile.findById(profileId);
    if (!profile) throw new ValidationError('Dining profile not found');
    profile.commission = {
        override: !!override,
        type: type || profile.commission?.type || 'percentage',
        value: typeof value === 'number' ? value : (profile.commission?.value || 0),
    };
    await profile.save();
    return profile;
}
