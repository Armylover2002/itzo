import { DiningCategory } from '../models/diningCategory.model.js';
import { DiningBanner } from '../models/diningBanner.model.js';
import { DiningProfile } from '../models/diningProfile.model.js';
import { DiningSlotCapacity } from '../models/diningSlotCapacity.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { getDiningSettings } from './diningSettings.service.js';
import {
    getWeekdayName,
    formatDateKey,
    buildSlotsForDay,
    validateBookingDate,
} from '../utils/dining.helpers.js';

export { formatDateKey, validateBookingDate } from '../utils/dining.helpers.js';
export { DAY_NAMES } from '../utils/dining.helpers.js';

export async function listDiningCategoriesPublic() {
    return DiningCategory.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
}

export async function listDiningBannersPublic() {
    return DiningBanner.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
}

function toRestaurantSummary(restaurant) {
    return {
        id: String(restaurant._id),
        name: restaurant.restaurantName || restaurant.name || '',
        image: Array.isArray(restaurant.images) ? restaurant.images[0] : restaurant.image,
        cuisines: restaurant.cuisines || [],
        rating: restaurant.rating || 0,
        location: restaurant.location,
    };
}

export async function listDiningRestaurantsPublic({ zoneId } = {}) {
    const profiles = await DiningProfile.find({ status: 'approved', isDiningEnabled: true })
        .populate('categoryIds', 'name image')
        .lean();

    if (!profiles.length) return [];

    const restaurantIds = profiles.map((p) => p.restaurantId);
    const restaurantFilter = { _id: { $in: restaurantIds }, status: 'approved' };
    if (zoneId) restaurantFilter.zoneId = zoneId;

    const restaurants = await FoodRestaurant.find(restaurantFilter)
        .select('restaurantName images image cuisines rating location zoneId')
        .lean();
    const restaurantMap = new Map(restaurants.map((r) => [String(r._id), r]));

    return profiles
        .map((profile) => {
            const restaurant = restaurantMap.get(String(profile.restaurantId));
            if (!restaurant) return null;
            return {
                ...toRestaurantSummary(restaurant),
                diningProfileId: String(profile._id),
                categories: profile.categoryIds || [],
                avgCostForTwo: profile.avgCostForTwo || 0,
                description: profile.description || '',
            };
        })
        .filter(Boolean);
}

export async function getDiningRestaurantDetail(restaurantId) {
    const profile = await DiningProfile.findOne({ restaurantId, status: 'approved', isDiningEnabled: true })
        .populate('categoryIds', 'name image')
        .lean();
    if (!profile) throw new ValidationError('Dining is not available for this restaurant');

    const restaurant = await FoodRestaurant.findOne({ _id: restaurantId, status: 'approved' })
        .select('restaurantName images image cuisines rating location zoneId')
        .lean();
    if (!restaurant) throw new ValidationError('Restaurant not found');

    return {
        ...toRestaurantSummary(restaurant),
        diningProfileId: String(profile._id),
        categories: profile.categoryIds || [],
        description: profile.description || '',
        ambienceImages: profile.ambienceImages || [],
        avgCostForTwo: profile.avgCostForTwo || 0,
        slots: profile.slots || [],
    };
}

export async function getDiningAvailability(restaurantId, dateInput) {
    const settings = await getDiningSettings();
    const { valid, reason, date } = validateBookingDate(dateInput, settings);
    if (!valid) throw new ValidationError(reason);

    const profile = await DiningProfile.findOne({ restaurantId, status: 'approved', isDiningEnabled: true }).lean();
    if (!profile) throw new ValidationError('Dining is not available for this restaurant');

    const day = getWeekdayName(date);
    const daySlotConfig = (profile.slots || []).find((s) => s.day === day);
    if (!daySlotConfig || !daySlotConfig.isOpen) {
        return { day, dateKey: formatDateKey(date), slots: [] };
    }

    const rawSlots = buildSlotsForDay(daySlotConfig);
    const dateKey = formatDateKey(date);
    const capacityDocs = await DiningSlotCapacity.find({ restaurantId, bookingDateKey: dateKey }).lean();
    const bookedMap = new Map(capacityDocs.map((c) => [c.slotStart, c.bookedGuests]));

    const slots = rawSlots.map((slot) => {
        const booked = bookedMap.get(slot.start) || 0;
        const capacity = Number(daySlotConfig.capacityPerSlot) || 0;
        return {
            start: slot.start,
            end: slot.end,
            capacity,
            booked,
            available: Math.max(0, capacity - booked),
        };
    });

    return { day, dateKey, slots };
}
