import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { DiningProfile } from '../models/diningProfile.model.js';
import { DAY_NAMES, parseTimeToMinutes } from '../utils/dining.helpers.js';

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

const validateSlots = (slots) => {
    if (!Array.isArray(slots)) throw new ValidationError('Slots must be an array');

    const byDay = new Map();
    for (const raw of slots) {
        const day = String(raw?.day || '').trim();
        if (!DAY_NAMES.includes(day)) {
            throw new ValidationError(`Invalid day "${raw?.day}"`);
        }
        if (byDay.has(day)) {
            throw new ValidationError(`Duplicate slot config for ${day}`);
        }

        const isOpen = raw.isOpen === true || raw.isOpen === 'true';
        const entry = {
            day,
            isOpen,
            openingTime: '',
            closingTime: '',
            slotDurationMinutes: 60,
            capacityPerSlot: 0,
        };

        if (isOpen) {
            const openMinutes = parseTimeToMinutes(raw.openingTime);
            const closeMinutes = parseTimeToMinutes(raw.closingTime);
            if (openMinutes === null || closeMinutes === null) {
                throw new ValidationError(`${day}: opening/closing time must be in HH:mm format`);
            }
            if (closeMinutes <= openMinutes) {
                throw new ValidationError(`${day}: closing time must be after opening time`);
            }
            const duration = Number(raw.slotDurationMinutes);
            if (!Number.isFinite(duration) || duration < 15) {
                throw new ValidationError(`${day}: slot duration must be at least 15 minutes`);
            }
            const capacity = Number(raw.capacityPerSlot);
            if (!Number.isFinite(capacity) || capacity < 1) {
                throw new ValidationError(`${day}: capacity per slot must be at least 1 guest`);
            }
            entry.openingTime = raw.openingTime.trim();
            entry.closingTime = raw.closingTime.trim();
            entry.slotDurationMinutes = duration;
            entry.capacityPerSlot = capacity;
        }

        byDay.set(day, entry);
    }

    return Array.from(byDay.values());
};

/**
 * Restaurant-side: update dining configuration. Only allowed once a request
 * has been approved — this is the gate that stops a not-yet-reviewed
 * restaurant from configuring (and effectively enabling) dining before an
 * admin has actually looked at it.
 */
export async function updateDiningSetup(restaurantId, body = {}) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant');
    }

    const profile = await DiningProfile.findOne({ restaurantId: toObjectId(restaurantId) });
    if (!profile) throw new ValidationError('Dining has not been requested yet');
    if (profile.status !== 'approved') {
        throw new ValidationError('Dining setup is only available after admin approval');
    }

    if (body.description !== undefined) {
        profile.description = String(body.description || '').trim().slice(0, 2000);
    }
    if (Array.isArray(body.ambienceImages)) {
        const images = body.ambienceImages
            .filter((url) => typeof url === 'string' && url.trim())
            .slice(0, 10);
        if (!images.length) throw new ValidationError('At least one ambience image is required');
        profile.ambienceImages = images;
    }
    if (body.avgCostForTwo !== undefined) {
        const value = Number(body.avgCostForTwo);
        if (!Number.isFinite(value) || value < 0) throw new ValidationError('Average cost for two must be a non-negative number');
        profile.avgCostForTwo = value;
    }
    if (Array.isArray(body.categoryIds)) {
        const ids = body.categoryIds.filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
        profile.categoryIds = ids;
    }
    if (body.slots !== undefined) {
        profile.slots = validateSlots(body.slots);
    }

    await profile.save();
    return profile.toObject();
}

/**
 * Restaurant-side: the day-to-day on/off switch. Only meaningful — and only
 * settable — once approved, and only when at least one open day with
 * capacity has actually been configured (otherwise the restaurant would show
 * up as bookable with zero real availability).
 */
export async function toggleDiningEnabled(restaurantId, enabled) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant');
    }

    const profile = await DiningProfile.findOne({ restaurantId: toObjectId(restaurantId) });
    if (!profile) throw new ValidationError('Dining has not been requested yet');
    if (profile.status !== 'approved') {
        throw new ValidationError('Dining can only be turned on after admin approval');
    }

    const wantsOn = enabled === true || enabled === 'true';
    if (wantsOn) {
        const hasCapacity = (profile.slots || []).some((s) => s.isOpen && s.capacityPerSlot > 0);
        if (!hasCapacity) {
            throw new ValidationError('Set at least one open day with capacity before turning Dining on');
        }
        if (!(profile.ambienceImages || []).length) {
            throw new ValidationError('Add at least one ambience image before turning Dining on');
        }
    }

    profile.isDiningEnabled = wantsOn;
    await profile.save();
    return profile.toObject();
}
