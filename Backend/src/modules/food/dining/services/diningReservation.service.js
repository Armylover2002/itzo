import { DiningReservation } from '../models/diningReservation.model.js';
import { DiningProfile } from '../models/diningProfile.model.js';
import { DiningSlotCapacity } from '../models/diningSlotCapacity.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { getDiningSettings } from './diningSettings.service.js';
import { notifyOwnerWithInbox } from '../../../../core/notifications/ownerInboxNotify.js';
import {
    getWeekdayName,
    formatDateKey,
    buildSlotsForDay,
    validateBookingDate,
    pushDiningStatusHistory,
} from '../utils/dining.helpers.js';

async function claimSlotCapacity({ restaurantId, bookingDateKey, slotStart, guests, capacity }) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const doc = await DiningSlotCapacity.findOneAndUpdate(
            { restaurantId, bookingDateKey, slotStart, bookedGuests: { $lte: capacity - guests } },
            { $inc: { bookedGuests: guests } },
            { new: true }
        );
        if (doc) return true;

        const exists = await DiningSlotCapacity.findOne({ restaurantId, bookingDateKey, slotStart }).lean();
        if (exists) return false;

        try {
            await DiningSlotCapacity.create({ restaurantId, bookingDateKey, slotStart, bookedGuests: guests });
            return true;
        } catch (err) {
            if (err?.code !== 11000) throw err;
            // duplicate created concurrently, retry the conditional update
        }
    }
    return false;
}

async function releaseSlotCapacity({ restaurantId, bookingDateKey, slotStart, guests }) {
    await DiningSlotCapacity.updateOne(
        { restaurantId, bookingDateKey, slotStart },
        { $inc: { bookedGuests: -guests } }
    );
}

async function withRestaurantInfo(reservations) {
    if (!reservations.length) return [];
    const restaurantIds = [...new Set(reservations.map((r) => String(r.restaurantId)))];
    const restaurants = await FoodRestaurant.find({ _id: { $in: restaurantIds } })
        .select('name images image phone')
        .lean();
    const map = new Map(restaurants.map((r) => [String(r._id), r]));
    return reservations.map((r) => ({ ...r, restaurant: map.get(String(r.restaurantId)) || null }));
}

export async function createReservation(userId, { restaurantId, bookingDate, slotStart, guests, specialRequest }) {
    const settings = await getDiningSettings();
    const { valid, reason, date } = validateBookingDate(bookingDate, settings);
    if (!valid) throw new ValidationError(reason);

    const profile = await DiningProfile.findOne({ restaurantId, status: 'approved', isDiningEnabled: true }).lean();
    if (!profile) throw new ValidationError('Dining is not available for this restaurant');

    const day = getWeekdayName(date);
    const daySlotConfig = (profile.slots || []).find((s) => s.day === day);
    if (!daySlotConfig || !daySlotConfig.isOpen) {
        throw new ValidationError('Restaurant is not open for dining on this day');
    }

    const slots = buildSlotsForDay(daySlotConfig);
    const slot = slots.find((s) => s.start === slotStart);
    if (!slot) throw new ValidationError('Invalid time slot');

    const capacity = Number(daySlotConfig.capacityPerSlot) || 0;
    const dateKey = formatDateKey(date);
    const claimed = await claimSlotCapacity({ restaurantId, bookingDateKey: dateKey, slotStart: slot.start, guests, capacity });
    if (!claimed) throw new ValidationError('This slot is fully booked, please choose another time');

    const user = await FoodUser.findById(userId).select('name phone').lean();
    const restaurant = await FoodRestaurant.findById(restaurantId).select('name').lean();

    try {
        const reservation = await DiningReservation.create({
            restaurantId,
            userId,
            bookingDate: date,
            day,
            slotStart: slot.start,
            slotEnd: slot.end,
            guests,
            specialRequest: specialRequest || '',
            status: 'pending',
            restaurantNameSnapshot: restaurant?.name || '',
            userNameSnapshot: user?.name || '',
            userPhoneSnapshot: user?.phone || '',
            statusHistory: [{ at: new Date(), byRole: 'USER', byId: userId, from: null, to: 'pending' }],
        });

        try {
            await notifyOwnerWithInbox(
                { ownerType: 'RESTAURANT', ownerId: restaurantId },
                {
                    title: 'New dining reservation',
                    body: `${user?.name || 'A guest'} requested a table for ${guests} on ${dateKey} at ${slot.start}`,
                    link: '/food/restaurant/dining/bookings',
                    category: 'dining',
                }
            );
        } catch {
            // notification failure should not block booking
        }

        return reservation;
    } catch (err) {
        await releaseSlotCapacity({ restaurantId, bookingDateKey: dateKey, slotStart: slot.start, guests });
        throw err;
    }
}

export async function listAllReservationsAdmin({ status, page = 1, limit = 20 } = {}) {
    const filter = status ? { status } : {};
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
        DiningReservation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
        DiningReservation.countDocuments(filter),
    ]);
    return { items: await withRestaurantInfo(items), total, page: Number(page), limit: Number(limit) };
}

export async function listMyReservations(userId, { status } = {}) {
    const filter = { userId };
    if (status) filter.status = status;
    const items = await DiningReservation.find(filter).sort({ createdAt: -1 }).lean();
    return withRestaurantInfo(items);
}

export async function getMyReservationDetail(userId, reservationId) {
    const reservation = await DiningReservation.findOne({ _id: reservationId, userId }).lean();
    if (!reservation) throw new ValidationError('Reservation not found');
    const [withInfo] = await withRestaurantInfo([reservation]);
    return withInfo;
}

export async function listRestaurantReservations(restaurantId, { status, date } = {}) {
    const filter = { restaurantId };
    if (status) filter.status = status;
    if (date) {
        const parsed = new Date(date);
        if (!Number.isNaN(parsed.getTime())) {
            const start = new Date(parsed);
            start.setHours(0, 0, 0, 0);
            const end = new Date(parsed);
            end.setHours(23, 59, 59, 999);
            filter.bookingDate = { $gte: start, $lte: end };
        }
    }
    return DiningReservation.find(filter).sort({ bookingDate: 1, slotStart: 1 }).lean();
}

const ALLOWED_TRANSITIONS = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['seated', 'cancelled', 'no_show'],
    seated: ['completed'],
};

export async function updateReservationStatusByRestaurant(restaurantId, reservationId, { status, note }) {
    const reservation = await DiningReservation.findOne({ _id: reservationId, restaurantId });
    if (!reservation) throw new ValidationError('Reservation not found');

    const allowed = ALLOWED_TRANSITIONS[reservation.status] || [];
    if (!allowed.includes(status)) {
        throw new ValidationError(`Cannot move reservation from ${reservation.status} to ${status}`);
    }

    const previousStatus = reservation.status;
    reservation.status = status;
    pushDiningStatusHistory(reservation, { byRole: 'RESTAURANT', from: previousStatus, to: status, note });

    if (status === 'cancelled' || status === 'no_show') {
        const dateKey = formatDateKey(reservation.bookingDate);
        await releaseSlotCapacity({
            restaurantId: reservation.restaurantId,
            bookingDateKey: dateKey,
            slotStart: reservation.slotStart,
            guests: reservation.guests,
        });
    }

    await reservation.save();
    return reservation;
}

export async function cancelReservationByUser(userId, reservationId, { reason } = {}) {
    const reservation = await DiningReservation.findOne({ _id: reservationId, userId });
    if (!reservation) throw new ValidationError('Reservation not found');
    if (!['pending', 'confirmed'].includes(reservation.status)) {
        throw new ValidationError('This reservation can no longer be cancelled');
    }

    const settings = await getDiningSettings();
    const windowMs = (Number(settings?.cancellationWindowMinutes) || 0) * 60 * 1000;
    const [h, m] = reservation.slotStart.split(':').map(Number);
    const slotDateTime = new Date(reservation.bookingDate);
    slotDateTime.setHours(h, m, 0, 0);
    if (slotDateTime.getTime() - Date.now() < windowMs) {
        throw new ValidationError('Cancellation window has passed for this reservation');
    }

    const previousStatus = reservation.status;
    reservation.status = 'cancelled';
    reservation.cancellationReason = reason || '';
    pushDiningStatusHistory(reservation, { byRole: 'USER', byId: userId, from: previousStatus, to: 'cancelled', note: reason });
    await reservation.save();

    const dateKey = formatDateKey(reservation.bookingDate);
    await releaseSlotCapacity({
        restaurantId: reservation.restaurantId,
        bookingDateKey: dateKey,
        slotStart: reservation.slotStart,
        guests: reservation.guests,
    });

    return reservation;
}
