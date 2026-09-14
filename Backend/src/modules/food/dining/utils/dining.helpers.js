export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function getWeekdayName(date) {
    return DAY_NAMES[new Date(date).getDay()];
}

export function formatDateKey(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function parseDateOnly(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
}

export function pushDiningStatusHistory(reservation, { byRole, byId, from, to, note }) {
    reservation.statusHistory = reservation.statusHistory || [];
    reservation.statusHistory.push({ at: new Date(), byRole, byId, from, to, note });
}

export function parseTimeToMinutes(time) {
    if (typeof time !== 'string' || !time.includes(':')) return null;
    const [h, m] = time.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
}

export function minutesToTime(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function buildSlotsForDay(daySlotConfig) {
    if (!daySlotConfig?.isOpen) return [];
    const start = parseTimeToMinutes(daySlotConfig.openingTime);
    const end = parseTimeToMinutes(daySlotConfig.closingTime);
    const duration = Number(daySlotConfig.slotDurationMinutes) || 60;
    if (start === null || end === null || end <= start || duration <= 0) return [];

    const slots = [];
    for (let t = start; t + duration <= end; t += duration) {
        slots.push({ start: minutesToTime(t), end: minutesToTime(t + duration) });
    }
    return slots;
}

export function roundMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

export function resolveEffectiveCommission(profile, globalSettings) {
    if (profile?.commission?.override) {
        return { type: profile.commission.type, value: Number(profile.commission.value) || 0 };
    }
    return {
        type: globalSettings?.defaultCommission?.type || 'percentage',
        value: Number(globalSettings?.defaultCommission?.value) || 0,
    };
}

export function computeCommissionAmount(subtotalOrTotal, commission) {
    if (!commission) return 0;
    if (commission.type === 'amount') return roundMoney(commission.value);
    return roundMoney((Number(subtotalOrTotal) || 0) * (Number(commission.value) || 0) / 100);
}

export function validateBookingDate(dateInput, settings) {
    const date = parseDateOnly(dateInput);
    if (!date) return { valid: false, reason: 'Invalid date' };

    const now = new Date();
    const minAdvanceMs = (Number(settings?.minAdvanceBookingMinutes) || 0) * 60 * 1000;
    const maxAdvanceDays = Number(settings?.maxAdvanceBookingDays) || 14;

    const earliest = new Date(now.getTime() + minAdvanceMs);
    const latest = new Date(now);
    latest.setDate(latest.getDate() + maxAdvanceDays);
    latest.setHours(23, 59, 59, 999);

    if (date < parseDateOnly(earliest)) {
        return { valid: false, reason: `Booking must be at least ${settings?.minAdvanceBookingMinutes || 0} minutes in advance` };
    }
    if (date > latest) {
        return { valid: false, reason: `Booking cannot be more than ${maxAdvanceDays} days in advance` };
    }
    return { valid: true, date };
}
