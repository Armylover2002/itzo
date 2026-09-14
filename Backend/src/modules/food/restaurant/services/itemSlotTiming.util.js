import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const normalizeSlotTime = (value) => {
    const raw = String(value || '').trim();
    if (!TIME_REGEX.test(raw)) {
        throw new ValidationError('Time must be in HH:mm format');
    }
    return raw;
};

export const timeToMinutes = (hhmm) => {
    const [hours, minutes] = String(hhmm || '').split(':').map(Number);
    return (hours * 60) + minutes;
};

const getReferenceMinutes = (referenceDate = new Date()) => {
    // Keep slot behavior aligned with India business hours regardless of server timezone.
    const asDate = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    if (!(asDate instanceof Date) || Number.isNaN(asDate.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(asDate);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return (hour * 60) + minute;
};

export const isSlotActiveAt = (startTime, endTime, referenceDate = new Date()) => {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    const now = getReferenceMinutes(referenceDate);
    if (!Number.isFinite(now)) return true;
    return now >= start && now < end;
};

export const serializeItemSlotTiming = (doc = {}) => {
    if (!doc?._id && !doc?.id) return null;
    return {
        id: String(doc._id || doc.id),
        _id: String(doc._id || doc.id),
        restaurantId: doc.restaurantId ? String(doc.restaurantId) : '',
        name: String(doc.name || '').trim(),
        startTime: String(doc.startTime || '').trim(),
        endTime: String(doc.endTime || '').trim(),
        createdAt: doc.createdAt || null,
        updatedAt: doc.updatedAt || null,
        createdBy: doc.createdBy || null,
        updatedBy: doc.updatedBy || null
    };
};

export const buildSlotTimingMap = (slots = []) => {
    const map = new Map();
    (slots || []).forEach((slot) => {
        const id = String(slot?._id || slot?.id || '');
        if (!id) return;
        map.set(id, slot);
    });
    return map;
};

export const isFoodVisibleForSlotTiming = (food = {}, slotMap = new Map(), referenceDate = new Date()) => {
    const slotId = food?.itemSlotTimingId ? String(food.itemSlotTimingId) : '';
    if (!slotId) return true;

    const slot = slotMap.get(slotId);
    if (!slot) return true;

    return isSlotActiveAt(slot.startTime, slot.endTime, referenceDate);
};

export const filterFoodsByActiveSlotTimings = (foods = [], slots = [], referenceDate = new Date()) => {
    const slotMap = buildSlotTimingMap(slots);
    return (foods || []).filter((food) => isFoodVisibleForSlotTiming(food, slotMap, referenceDate));
};

export const loadSlotTimingsForRestaurants = async (restaurantIds = [], ItemSlotTimingModel) => {
    const validIds = Array.from(
        new Set(
            (restaurantIds || [])
                .map((id) => String(id || '').trim())
                .filter((id) => mongoose.Types.ObjectId.isValid(id))
        )
    );

    if (!validIds.length) return [];

    return ItemSlotTimingModel.find({
        restaurantId: { $in: validIds.map((id) => new mongoose.Types.ObjectId(id)) }
    })
        .select('restaurantId name startTime endTime createdAt updatedAt')
        .lean();
};

export const validateSlotTimingPayload = ({ name, startTime, endTime }) => {
    const normalizedName = String(name || '').trim();
    if (!normalizedName) throw new ValidationError('Slot name is required');
    if (normalizedName.length > 80) throw new ValidationError('Slot name is too long');

    const normalizedStart = normalizeSlotTime(startTime);
    const normalizedEnd = normalizeSlotTime(endTime);

    if (timeToMinutes(normalizedEnd) <= timeToMinutes(normalizedStart)) {
        throw new ValidationError('End time must be after start time');
    }

    return {
        name: normalizedName,
        startTime: normalizedStart,
        endTime: normalizedEnd
    };
};

export const buildActionPerformer = (req = {}) => ({
    userId: req.user?.userId && mongoose.Types.ObjectId.isValid(String(req.user.userId))
        ? new mongoose.Types.ObjectId(String(req.user.userId))
        : null,
    role: String(req.user?.role || 'RESTAURANT'),
    actionAt: new Date()
});
