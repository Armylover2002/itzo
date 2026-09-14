import { DiningProfile } from '../models/diningProfile.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';

export async function updateDiningSetup(restaurantId, data) {
    const profile = await DiningProfile.findOne({ restaurantId });
    if (!profile) throw new ValidationError('Dining profile not found');
    if (profile.status !== 'approved') {
        throw new ValidationError('Dining setup is only available after your request is approved');
    }

    if (data.description !== undefined) profile.description = data.description;
    if (data.ambienceImages !== undefined) profile.ambienceImages = data.ambienceImages;
    if (data.avgCostForTwo !== undefined) profile.avgCostForTwo = data.avgCostForTwo;
    if (data.categoryIds !== undefined) profile.categoryIds = data.categoryIds;
    if (data.slots !== undefined) profile.slots = data.slots;

    await profile.save();
    return profile;
}

export async function toggleDiningEnabled(restaurantId, enabled) {
    const profile = await DiningProfile.findOne({ restaurantId });
    if (!profile) throw new ValidationError('Dining profile not found');
    if (profile.status !== 'approved') {
        throw new ValidationError('Dining must be approved before it can be enabled');
    }

    if (enabled) {
        const hasOpenDay = (profile.slots || []).some((s) => s.isOpen && Number(s.capacityPerSlot) > 0);
        if (!hasOpenDay) {
            throw new ValidationError('Configure at least one open day with capacity before enabling dining');
        }
        if (!(profile.ambienceImages || []).length) {
            throw new ValidationError('Add at least one ambience image before enabling dining');
        }
    }

    profile.isDiningEnabled = !!enabled;
    await profile.save();
    return profile;
}
