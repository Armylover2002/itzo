/** Shared small helpers used across the dining services. Kept dependency-free
 * from the orders module so Dining stays fully decoupled. */

export const DAY_NAMES = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

export const getWeekdayName = (date) => DAY_NAMES[new Date(date).getDay()];

/** Same append-only pattern as orders/services/order.helpers.js's pushStatusHistory. */
export function pushDiningStatusHistory(doc, { byRole, byId, from, to, note = '' }) {
    doc.statusHistory.push({
        at: new Date(),
        byRole,
        byId: byId || undefined,
        from,
        to,
        note,
    });
}

export const parseTimeToMinutes = (value) => {
    if (!value || typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
};

const minutesToTime = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Splits a day's opening window into fixed-length slots.
 * e.g. open 18:00, close 22:00, duration 60 -> ["18:00-19:00", "19:00-20:00", "20:00-21:00", "21:00-22:00"]
 */
export const buildSlotsForDay = (daySlotConfig) => {
    if (!daySlotConfig?.isOpen) return [];
    const openMinutes = parseTimeToMinutes(daySlotConfig.openingTime);
    const closeMinutes = parseTimeToMinutes(daySlotConfig.closingTime);
    const duration = Number(daySlotConfig.slotDurationMinutes) || 60;
    if (openMinutes === null || closeMinutes === null || closeMinutes <= openMinutes || duration < 15) return [];

    const slots = [];
    for (let start = openMinutes; start + duration <= closeMinutes; start += duration) {
        slots.push({ start: minutesToTime(start), end: minutesToTime(start + duration) });
    }
    return slots;
};

/**
 * Resolves the commission that actually applies to a restaurant's dining
 * bills right now: the restaurant's own override if it has one switched on,
 * otherwise the platform-wide default. Read at bill-finalize time only — the
 * resulting value gets frozen onto the bill, never re-read afterwards.
 */
export const resolveEffectiveCommission = (diningProfile, diningSettings) => {
    if (diningProfile?.commission?.override) {
        return {
            type: diningProfile.commission.type || 'percentage',
            value: Number(diningProfile.commission.value) || 0,
        };
    }
    return {
        type: diningSettings?.defaultCommission?.type || 'percentage',
        value: Number(diningSettings?.defaultCommission?.value) || 0,
    };
};

export const computeCommissionAmount = (grandTotal, commission) => {
    const total = Number(grandTotal) || 0;
    const value = Number(commission?.value) || 0;
    if (commission?.type === 'amount') {
        return Math.min(Math.max(value, 0), total);
    }
    // percentage
    return Math.round(((total * Math.max(value, 0)) / 100) * 100) / 100;
};

export const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
