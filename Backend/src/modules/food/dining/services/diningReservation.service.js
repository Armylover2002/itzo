import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { DiningProfile } from '../models/diningProfile.model.js';
import { DiningReservation } from '../models/diningReservation.model.js';
import { DiningSlotCapacity } from '../models/diningSlotCapacity.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import { getDiningSettings } from './diningSettings.service.js';
import {
    formatDateKey,
    parseDateOnly,
    validateBookingDate,
} from './diningPublic.service.js';
import { buildSlotsForDay, getWeekdayName, pushDiningStatusHistory } from '../utils/dining.helpers.js';

const bookableFilter = { status: 'approved', isDiningEnabled: true };

/**
 * Atomically claims `guests` seats in a slot's capacity counter. Never reads
 * the current count and then decides — the cap is enforced entirely inside
 * one conditional MongoDB write, so two concurrent requests for the last
 * seats can never both succeed.
 *
 * Handles the one genuine race in the upsert-with-guard pattern: if two
 * requests both find no counter document yet and both try to create one,
 * the unique index on (restaurantId, bookingDateKey, slotStart) turns the
 * loser's upsert into a duplicate-key error, which is caught and retried as
 * a plain conditional $inc against the now-existing document.
 */
async function claimSlotCapacity({ restaurantId, bookingDateKey, slotStart, guests, capacityPerSlot }) {
    const filter = {
        restaurantId,
        bookingDateKey,
        slotStart,
        bookedGuests: { $lte: capacityPerSlot - guests },
    };
    const update = { $inc: { bookedGuests: guests } };

    try {
        const claimed = await DiningSlotCapacity.findOneAndUpdate(
            filter,
            update,
            { new: true, upsert: true, setDefaultsOnInsert: true },
        );
        return Boolean(claimed);
    } catch (err) {
        if (err?.code !== 11000) throw err;
        // Lost the upsert race — the doc now exists, retry as a plain conditional update.
        const claimed = await DiningSlotCapacity.findOneAndUpdate(filter, update, { new: true });
        return Boolean(claimed);
    }
}

async function releaseSlotCapacity({ restaurantId, bookingDateKey, slotStart, guests }) {
    await DiningSlotCapacity.updateOne(
        { restaurantId, bookingDateKey, slotStart },
        { $inc: { bookedGuests: -Math.abs(guests) } },
    );
}

export async function createReservation(userId, body = {}) {
    const restaurantId = body.restaurantId;
    if (!mongoose.Types.ObjectId.isValid(String(restaurantId))) throw new ValidationError('Invalid restaurant');

    const guests = Number(body.guests);
    if (!Number.isFinite(guests) || guests < 1) throw new ValidationError('Guest count must be at least 1');

    const date = parseDateOnly(body.date);
    const settings = await getDiningSettings();
    validateBookingDate(date, settings);

    const profile = await DiningProfile.findOne({ restaurantId, ...bookableFilter }).lean();
    if (!profile) throw new ValidationError('This restaurant is not currently accepting dining bookings');

    const day = getWeekdayName(date);
    const dayConfig = (profile.slots || []).find((s) => s.day === day);
    const availableSlots = buildSlotsForDay(dayConfig);
    const slot = availableSlots.find((s) => s.start === body.slotStart);
    if (!slot) throw new ValidationError('That time slot is not available on the selected date');

    if (guests > dayConfig.capacityPerSlot) {
        throw new ValidationError(`This restaurant can seat at most ${dayConfig.capacityPerSlot} guests per slot`);
    }

    const bookingDateKey = formatDateKey(date);
    const claimed = await claimSlotCapacity({
        restaurantId,
        bookingDateKey,
        slotStart: slot.start,
        guests,
        capacityPerSlot: dayConfig.capacityPerSlot,
    });
    if (!claimed) {
        throw new ValidationError('This slot no longer has enough seats available — please pick another slot');
    }

    try {
        const [restaurant, user] = await Promise.all([
            FoodRestaurant.findById(restaurantId).select('restaurantName').lean(),
            FoodUser.findById(userId).select('name phone').lean(),
        ]);

        const reservation = new DiningReservation({
            restaurantId,
            userId,
            bookingDate: date,
            day,
            slotStart: slot.start,
            slotEnd: slot.end,
            guests,
            specialRequest: String(body.specialRequest || '').trim().slice(0, 500),
            restaurantNameSnapshot: restaurant?.restaurantName || '',
            userNameSnapshot: user?.name || '',
            userPhoneSnapshot: user?.phone || '',
        });
        pushDiningStatusHistory(reservation, { byRole: 'USER', byId: userId, from: '', to: 'pending', note: 'Booking created' });
        await reservation.save();

        try {
            const { notifyOwnersSafely } = await import('../../../../core/notifications/firebase.service.js');
            await notifyOwnersSafely(
                [{ ownerType: 'RESTAURANT', ownerId: restaurantId }],
                { title: 'New dining booking', body: `${guests} guests on ${bookingDateKey} at ${slot.start}` },
            );
        } catch {
            // Push failures must never fail the booking itself.
        }

        return reservation.toObject();
    } catch (err) {
        // The reservation write failed after the seats were already claimed —
        // release them so the slot isn't permanently short by `guests`.
        await releaseSlotCapacity({ restaurantId, bookingDateKey, slotStart: slot.start, guests }).catch(() => {});
        throw err;
    }
}

/** Admin-side: every reservation across every restaurant, filterable. */
export async function listAllReservationsAdmin(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 100, 1), 500);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.restaurantId && mongoose.Types.ObjectId.isValid(String(query.restaurantId))) {
        filter.restaurantId = query.restaurantId;
    }
    if (query.date) {
        const date = parseDateOnly(query.date);
        const start = new Date(date); start.setHours(0, 0, 0, 0);
        const end = new Date(date); end.setHours(23, 59, 59, 999);
        filter.bookingDate = { $gte: start, $lte: end };
    }

    const [reservations, total] = await Promise.all([
        DiningReservation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        DiningReservation.countDocuments(filter),
    ]);
    return { reservations: await withRestaurantInfo(reservations), total, page, limit };
}

/** Joins the restaurant's current photo/area/city onto each reservation — read
 * live rather than snapshotted, so it never goes stale if the restaurant
 * updates its profile after the booking was made. */
async function withRestaurantInfo(reservations) {
    const restaurantIds = [...new Set(reservations.map((r) => String(r.restaurantId)))];
    const restaurants = restaurantIds.length
        ? await FoodRestaurant.find({ _id: { $in: restaurantIds } })
            .select('restaurantName profileImage coverImages area city')
            .lean()
        : [];
    const restaurantMap = new Map(restaurants.map((r) => [String(r._id), r]));
    return reservations.map((r) => ({ ...r, restaurant: restaurantMap.get(String(r.restaurantId)) || null }));
}

export async function listMyReservations(userId, query = {}) {
    const filter = { userId };
    if (query.status) filter.status = query.status;
    const reservations = await DiningReservation.find(filter).sort({ bookingDate: -1, createdAt: -1 }).lean();
    return { reservations: await withRestaurantInfo(reservations) };
}

export async function getMyReservationDetail(userId, reservationId) {
    if (!mongoose.Types.ObjectId.isValid(String(reservationId))) throw new ValidationError('Invalid booking');
    const reservation = await DiningReservation.findOne({ _id: reservationId, userId }).lean();
    if (!reservation) throw new ValidationError('Booking not found');
    const [withInfo] = await withRestaurantInfo([reservation]);
    return withInfo;
}

export async function listRestaurantReservations(restaurantId, query = {}) {
    const filter = { restaurantId };
    if (query.status) filter.status = query.status;
    if (query.date) {
        const date = parseDateOnly(query.date);
        const start = new Date(date); start.setHours(0, 0, 0, 0);
        const end = new Date(date); end.setHours(23, 59, 59, 999);
        filter.bookingDate = { $gte: start, $lte: end };
    }
    const reservations = await DiningReservation.find(filter).sort({ bookingDate: 1, slotStart: 1 }).lean();
    return { reservations };
}

const RESTAURANT_TRANSITIONS = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['seated', 'cancelled', 'no_show'],
    seated: ['completed'],
};

/** Restaurant-side status transitions (confirm / seat / complete / no-show / cancel). */
export async function updateReservationStatusByRestaurant(restaurantId, reservationId, { status, note, byId } = {}) {
    if (!mongoose.Types.ObjectId.isValid(String(reservationId))) throw new ValidationError('Invalid booking');

    const reservation = await DiningReservation.findOne({ _id: reservationId, restaurantId });
    if (!reservation) throw new ValidationError('Booking not found');

    const allowed = RESTAURANT_TRANSITIONS[reservation.status] || [];
    if (!allowed.includes(status)) {
        throw new ValidationError(`Cannot move a ${reservation.status} booking to ${status}`);
    }

    const from = reservation.status;
    reservation.status = status;
    if (status === 'cancelled' || status === 'no_show') {
        await releaseSlotCapacity({
            restaurantId,
            bookingDateKey: formatDateKey(reservation.bookingDate),
            slotStart: reservation.slotStart,
            guests: reservation.guests,
        }).catch(() => {});
    }
    pushDiningStatusHistory(reservation, { byRole: 'RESTAURANT', byId, from, to: status, note });
    await reservation.save();
    return reservation.toObject();
}

/** User-side cancellation — respects the settings-configured cancellation window. */
export async function cancelReservationByUser(userId, reservationId, reason) {
    if (!mongoose.Types.ObjectId.isValid(String(reservationId))) throw new ValidationError('Invalid booking');

    const reservation = await DiningReservation.findOne({ _id: reservationId, userId });
    if (!reservation) throw new ValidationError('Booking not found');
    if (!['pending', 'confirmed'].includes(reservation.status)) {
        throw new ValidationError('This booking can no longer be cancelled');
    }

    const settings = await getDiningSettings();
    const slotDateTime = new Date(reservation.bookingDate);
    const [h, m] = reservation.slotStart.split(':').map(Number);
    slotDateTime.setHours(h, m, 0, 0);
    const minutesUntilSlot = (slotDateTime.getTime() - Date.now()) / 60000;
    if (minutesUntilSlot < (settings.cancellationWindowMinutes || 0)) {
        throw new ValidationError(`Bookings can only be cancelled at least ${settings.cancellationWindowMinutes} minutes before the slot`);
    }

    const from = reservation.status;
    reservation.status = 'cancelled';
    reservation.cancellationReason = String(reason || '').trim().slice(0, 500);
    pushDiningStatusHistory(reservation, { byRole: 'USER', byId: userId, from, to: 'cancelled', note: reservation.cancellationReason });
    await reservation.save();

    await releaseSlotCapacity({
        restaurantId: reservation.restaurantId,
        bookingDateKey: formatDateKey(reservation.bookingDate),
        slotStart: reservation.slotStart,
        guests: reservation.guests,
    }).catch(() => {});

    return reservation.toObject();
}
