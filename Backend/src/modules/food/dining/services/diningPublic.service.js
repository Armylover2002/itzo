import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { DiningProfile } from '../models/diningProfile.model.js';
import { DiningCategory } from '../models/diningCategory.model.js';
import { DiningBanner } from '../models/diningBanner.model.js';
import { DiningSlotCapacity } from '../models/diningSlotCapacity.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { getDiningSettings } from './diningSettings.service.js';
import { DAY_NAMES, buildSlotsForDay, getWeekdayName } from '../utils/dining.helpers.js';

const bookableFilter = { status: 'approved', isDiningEnabled: true };

export async function listDiningCategoriesPublic() {
    const categories = await DiningCategory.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
    return { categories };
}

export async function listDiningBannersPublic() {
    const banners = await DiningBanner.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
    return { banners };
}

/** Restaurants a customer can currently book, optionally filtered by category / search. */
export async function listDiningRestaurantsPublic(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 100);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = { ...bookableFilter };
    if (query.categoryId && mongoose.Types.ObjectId.isValid(String(query.categoryId))) {
        filter.categoryIds = new mongoose.Types.ObjectId(String(query.categoryId));
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

    let restaurantIds = profiles.map((p) => p.restaurantId);
    let restaurantFilter = { _id: { $in: restaurantIds } };
    if (query.search && String(query.search).trim()) {
        restaurantFilter.restaurantName = { $regex: String(query.search).trim(), $options: 'i' };
    }

    const restaurants = restaurantIds.length
        ? await FoodRestaurant.find(restaurantFilter)
            .select('restaurantId restaurantName profileImage coverImages city area cuisines rating totalRatings')
            .lean()
        : [];
    const restaurantMap = new Map(restaurants.map((r) => [String(r._id), r]));

    const results = profiles
        .filter((p) => restaurantMap.has(String(p.restaurantId)))
        .map((profile) => ({
            profileId: profile._id,
            restaurantId: profile.restaurantId,
            restaurant: restaurantMap.get(String(profile.restaurantId)),
            categories: profile.categoryIds,
            description: profile.description,
            avgCostForTwo: profile.avgCostForTwo,
            ambienceImages: profile.ambienceImages,
        }));

    return { restaurants: results, total, page, limit };
}

export async function getDiningRestaurantDetail(restaurantId) {
    if (!mongoose.Types.ObjectId.isValid(String(restaurantId))) throw new ValidationError('Invalid restaurant');

    const profile = await DiningProfile.findOne({ restaurantId, ...bookableFilter })
        .populate('categoryIds', 'name image')
        .lean();
    if (!profile) throw new ValidationError('This restaurant is not currently accepting dining bookings');

    const restaurant = await FoodRestaurant.findById(restaurantId)
        .select('restaurantId restaurantName profileImage coverImages menuImages city area addressLine1 addressLine2 landmark cuisines rating totalRatings location')
        .lean();
    if (!restaurant) throw new ValidationError('Restaurant not found');

    return { profile, restaurant };
}

/**
 * The slots a customer can actually pick for a given date — derived live from
 * the restaurant's day config, with remaining seats read from the atomic
 * capacity counters (see diningReservation.service.js for how those counters
 * are incremented). Nothing here is pre-materialized, so it's always
 * accurate and needs no background job to keep in sync.
 */
export async function getDiningAvailability(restaurantId, dateStr) {
    if (!mongoose.Types.ObjectId.isValid(String(restaurantId))) throw new ValidationError('Invalid restaurant');

    const date = parseDateOnly(dateStr);
    const settings = await getDiningSettings();
    validateBookingDate(date, settings);

    const profile = await DiningProfile.findOne({ restaurantId, ...bookableFilter }).lean();
    if (!profile) throw new ValidationError('This restaurant is not currently accepting dining bookings');

    const day = getWeekdayName(date);
    const dayConfig = (profile.slots || []).find((s) => s.day === day);
    const rawSlots = buildSlotsForDay(dayConfig);
    if (!rawSlots.length) return { date: formatDateKey(date), day, slots: [] };

    const dateKey = formatDateKey(date);
    const capacityDocs = await DiningSlotCapacity.find({
        restaurantId,
        bookingDateKey: dateKey,
        slotStart: { $in: rawSlots.map((s) => s.start) },
    }).lean();
    const bookedBySlot = new Map(capacityDocs.map((d) => [d.slotStart, d.bookedGuests]));

    const now = new Date();
    const isToday = dateKey === formatDateKey(now);
    const minAdvanceMinutes = settings.minAdvanceBookingMinutes || 0;

    const slots = rawSlots.map((slot) => {
        const booked = bookedBySlot.get(slot.start) || 0;
        const remaining = Math.max(0, dayConfig.capacityPerSlot - booked);
        const isPast = isToday && isSlotTooSoon(date, slot.start, now, minAdvanceMinutes);
        return {
            start: slot.start,
            end: slot.end,
            capacity: dayConfig.capacityPerSlot,
            remaining,
            isAvailable: remaining > 0 && !isPast,
        };
    });

    return { date: dateKey, day, slots };
}

// --- shared date helpers, exported for the reservation service to reuse identically ---

export const formatDateKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const parseDateOnly = (value) => {
    const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) throw new ValidationError('Date must be in YYYY-MM-DD format');
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(date.getTime())) throw new ValidationError('Invalid date');
    return date;
};

export const validateBookingDate = (date, settings) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    if (target < today) throw new ValidationError('Cannot book a date in the past');

    const maxDays = settings?.maxAdvanceBookingDays || 30;
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + maxDays);
    if (target > maxDate) throw new ValidationError(`Bookings can only be made up to ${maxDays} days in advance`);
};

const isSlotTooSoon = (date, slotStart, now, minAdvanceMinutes) => {
    const [h, m] = slotStart.split(':').map(Number);
    const slotDateTime = new Date(date);
    slotDateTime.setHours(h, m, 0, 0);
    const diffMinutes = (slotDateTime.getTime() - now.getTime()) / 60000;
    return diffMinutes < minAdvanceMinutes;
};

export { DAY_NAMES };
