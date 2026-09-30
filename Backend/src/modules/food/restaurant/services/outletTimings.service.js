import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodRestaurantOutletTimings } from '../models/outletTimings.model.js';
import { FoodRestaurant } from '../models/restaurant.model.js';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const normalizeDay = (value) => {
    const v = String(value || '').trim();
    if (!v) return null;
    const exact = DAY_NAMES.find((d) => d.toLowerCase() === v.toLowerCase());
    if (exact) return exact;
    const abbr = v.slice(0, 3).toLowerCase();
    const match = DAY_NAMES.find((d) => d.toLowerCase().startsWith(abbr));
    return match || null;
};

const normalizeTime = (value, fallback) => {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    // Accept "HH:mm" or "H:mm"
    const m = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return fallback;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return fallback;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

const defaultTimings = () =>
    DAY_NAMES.map((day) => ({
        day,
        isOpen: true,
        openingTime: '09:00',
        closingTime: '22:00'
    }));

const SHORT_DAYS_MAP = {
    Mon: 'Monday',
    Tue: 'Tuesday',
    Wed: 'Wednesday',
    Thu: 'Thursday',
    Fri: 'Friday',
    Sat: 'Saturday',
    Sun: 'Sunday'
};

const FULL_TO_SHORT_DAYS = {
    Monday: 'Mon',
    Tuesday: 'Tue',
    Wednesday: 'Wed',
    Thursday: 'Thu',
    Friday: 'Fri',
    Saturday: 'Sat',
    Sunday: 'Sun'
};

const MAX_SHIFTS_PER_DAY = 3;

const timeToMinutesLocal = (t) => {
    const m = /^(\d{2}):(\d{2})$/.exec(t || '');
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
};

/**
 * Normalize+validate a raw list of {openingTime, closingTime} shifts for a single day.
 * Max 3, each open<close, and no two non-overnight shifts overlapping. Overnight
 * (wraparound) shifts are accepted without strict overlap math, consistent with the
 * existing single-window overnight handling elsewhere.
 */
const normalizeShiftsList = (rawShifts, dayLabel = '') => {
    if (!Array.isArray(rawShifts) || rawShifts.length === 0) return [];
    if (rawShifts.length > MAX_SHIFTS_PER_DAY) {
        throw new ValidationError(`A maximum of ${MAX_SHIFTS_PER_DAY} shifts is allowed${dayLabel ? ` on ${dayLabel}` : ''}`);
    }

    const list = rawShifts.map((s) => ({
        openingTime: normalizeTime(s?.openingTime, ''),
        closingTime: normalizeTime(s?.closingTime, '')
    }));

    const withMinutes = list.map((s) => {
        if (!s.openingTime || !s.closingTime) {
            throw new ValidationError(`Each shift requires a valid opening and closing time${dayLabel ? ` on ${dayLabel}` : ''}`);
        }
        const start = timeToMinutesLocal(s.openingTime);
        const end = timeToMinutesLocal(s.closingTime);
        if (start === end) {
            throw new ValidationError(`Shift opening and closing time cannot be the same${dayLabel ? ` on ${dayLabel}` : ''}`);
        }
        return { ...s, start, end };
    });

    for (let i = 0; i < withMinutes.length; i++) {
        for (let j = i + 1; j < withMinutes.length; j++) {
            const a = withMinutes[i];
            const b = withMinutes[j];
            const aOvernight = a.end < a.start;
            const bOvernight = b.end < b.start;
            if (!aOvernight && !bOvernight && a.start < b.end && b.start < a.end) {
                throw new ValidationError(`Shift timings overlap${dayLabel ? ` on ${dayLabel}` : ''}; please adjust the shift times`);
            }
        }
    }

    return list;
};

/** Normalize an incoming day-keyed timings object into the canonical stored array. */
const normalizeTimingsFromInput = (outletTimings) =>
    DAY_NAMES.map((day) => {
        const src = outletTimings[day] && typeof outletTimings[day] === 'object' ? outletTimings[day] : {};
        const isOpen = src.isOpen !== false;
        const shifts = normalizeShiftsList(src.shifts, day);
        const openingTime = shifts[0]?.openingTime || normalizeTime(src.openingTime, '09:00');
        const closingTime = shifts[0]?.closingTime || normalizeTime(src.closingTime, '22:00');
        return {
            day,
            isOpen,
            openingTime,
            closingTime,
            shifts: shifts.length ? shifts : (isOpen ? [{ openingTime, closingTime }] : [])
        };
    });

/** Normalize a stored (possibly partial / short-named) timings array into the canonical array. */
const canonicalTimingsArray = (rawTimings) => {
    const map = {};
    for (const t of Array.isArray(rawTimings) ? rawTimings : []) {
        const d = normalizeDay(t?.day);
        if (d) map[d] = t;
    }
    return DAY_NAMES.map((day) => {
        const found = map[day];
        const isOpen = found ? found.isOpen !== false : true;
        const shifts = Array.isArray(found?.shifts) && found.shifts.length
            ? found.shifts.slice(0, MAX_SHIFTS_PER_DAY).map((s) => ({
                openingTime: normalizeTime(s?.openingTime, '09:00'),
                closingTime: normalizeTime(s?.closingTime, '22:00')
            }))
            : [];
        const openingTime = shifts[0]?.openingTime || normalizeTime(found?.openingTime, '09:00');
        const closingTime = shifts[0]?.closingTime || normalizeTime(found?.closingTime, '22:00');
        return {
            day,
            isOpen,
            openingTime,
            closingTime,
            shifts: shifts.length ? shifts : (isOpen ? [{ openingTime, closingTime }] : [])
        };
    });
};

/** Signature of which days are open (ignores time changes). Used to detect real changes. */
const openDaysSignature = (timingsArray) =>
    (Array.isArray(timingsArray) ? timingsArray : [])
        .filter((t) => t.isOpen)
        .map((t) => normalizeDay(t.day))
        .filter(Boolean)
        .sort()
        .join(',');

/** Short day names (Mon, Tue, ...) for the open days, matching restaurant.openDays convention. */
const openDaysShortNames = (timingsArray) =>
    (Array.isArray(timingsArray) ? timingsArray : [])
        .filter((t) => t.isOpen)
        .map((t) => FULL_TO_SHORT_DAYS[normalizeDay(t.day)] || normalizeDay(t.day))
        .filter(Boolean);

const notifyAdminsAboutOpeningDaysReview = (restaurantId, restaurantName) => {
    (async () => {
        try {
            const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
            void notifyAdminsSafely({
                title: 'Opening Days Update Request',
                body: `Restaurant "${restaurantName || 'Unknown Restaurant'}" requested a change to its opening days and is pending approval.`,
                data: {
                    type: 'restaurant_open_days_updated',
                    subType: 'restaurant',
                    id: String(restaurantId)
                }
            });
        } catch (e) {
            console.error('Failed to notify admins of opening-days update request:', e);
        }
    })();
};

/**
 * Build per-day outlet timings from onboarding delivery schedule (openDays + times), OR,
 * when `shiftsInput` is given, from a flat list of up to 3 shift cards each carrying its
 * own day selection: [{ openingTime, closingTime, days: ['Mon', ...] }, ...]. This is the
 * shape the shift-picker UI (Onboarding/AddRestaurant/OutletTimings) submits.
 */
export function buildOutletTimingsArrayFromSchedule(openDays, openingTime, closingTime, shiftsInput) {
    if (Array.isArray(shiftsInput) && shiftsInput.length > 0) {
        if (shiftsInput.length > 3) {
            throw new ValidationError('A maximum of 3 shifts is allowed');
        }
        const shiftCards = shiftsInput.map((s) => {
            const openTime = normalizeTime(s?.openingTime, '');
            const closeTime = normalizeTime(s?.closingTime, '');
            if (!openTime || !closeTime) {
                throw new ValidationError('Each shift requires a valid opening and closing time');
            }
            const rawDays = Array.isArray(s?.days)
                ? s.days
                : typeof s?.days === 'string'
                    ? s.days.split(',').map((d) => d.trim()).filter(Boolean)
                    : [];
            const days = rawDays.map((d) => SHORT_DAYS_MAP[d] || normalizeDay(d)).filter(Boolean);
            return { openingTime: openTime, closingTime: closeTime, days };
        });

        return DAY_NAMES.map((day) => {
            const dayShifts = normalizeShiftsList(
                shiftCards
                    .filter((s) => s.days.includes(day))
                    .map(({ openingTime: o, closingTime: c }) => ({ openingTime: o, closingTime: c })),
                day
            );
            const isOpen = dayShifts.length > 0;
            return {
                day,
                isOpen,
                openingTime: dayShifts[0]?.openingTime || '',
                closingTime: dayShifts[0]?.closingTime || '',
                shifts: dayShifts
            };
        });
    }

    const rawDays = Array.isArray(openDays)
        ? openDays
        : typeof openDays === 'string'
            ? openDays.split(',').map((d) => d.trim()).filter(Boolean)
            : [];

    const normalizedOpenDays = rawDays
        .map((d) => SHORT_DAYS_MAP[d] || d)
        .filter(Boolean);

    const openTime = normalizeTime(openingTime, '');
    const closeTime = normalizeTime(closingTime, '');

    return DAY_NAMES.map((day) => {
        const isOpen = normalizedOpenDays.includes(day);
        return {
            day,
            isOpen,
            openingTime: openTime,
            closingTime: closeTime,
            shifts: isOpen && openTime && closeTime ? [{ openingTime: openTime, closingTime: closeTime }] : []
        };
    });
}

export async function syncOutletTimingsFromOpenDays(restaurantId, openDays, openingTime, closingTime, shiftsInput) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }

    const timings = buildOutletTimingsArrayFromSchedule(openDays, openingTime, closingTime, shiftsInput);

    await FoodRestaurantOutletTimings.findOneAndUpdate(
        { restaurantId },
        { $set: { timings } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
}

const toClientShape = (doc) => {
    const timings = Array.isArray(doc?.timings) ? doc.timings : [];
    const map = {};
    for (const day of DAY_NAMES) {
        const found = timings.find((t) => normalizeDay(t?.day) === day);
        const isOpen = found ? found.isOpen !== false : true;
        const shifts = Array.isArray(found?.shifts) && found.shifts.length
            ? found.shifts.map((s) => ({
                openingTime: normalizeTime(s?.openingTime, '09:00'),
                closingTime: normalizeTime(s?.closingTime, '22:00')
            }))
            : [];
        const openingTime = shifts[0]?.openingTime || normalizeTime(found?.openingTime, '09:00');
        const closingTime = shifts[0]?.closingTime || normalizeTime(found?.closingTime, '22:00');
        map[day] = {
            isOpen,
            openingTime,
            closingTime,
            // Back-compat: single-window consumers keep reading openingTime/closingTime above.
            // Shift-aware consumers read this instead; falls back to the single window as shift 1.
            shifts: shifts.length ? shifts : (isOpen ? [{ openingTime, closingTime }] : [])
        };
    }
    return map;
};

/**
 * @param {string} restaurantId
 * @param {{ includePending?: boolean }} [options] When `includePending` is true (the
 *   restaurant's own dashboard), the staged/proposed schedule is surfaced. Public
 *   callers (user app) omit this and always receive the LIVE approved schedule, so a
 *   pending change is never visible to customers before approval.
 */
export async function getOutletTimingsForRestaurant(restaurantId, options = {}) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    const { includePending = false } = options;

    const doc = await FoodRestaurantOutletTimings.findOne({ restaurantId }).select('timings updatedAt').lean();
    const liveShape = toClientShape(doc || { timings: defaultTimings() });

    if (!includePending) {
        // Public/user-facing: always the currently approved schedule.
        return { outletTimings: liveShape, pendingApproval: false };
    }

    const restaurant = await FoodRestaurant.findById(restaurantId).select('pendingOpenDays').lean();
    const pending = restaurant?.pendingOpenDays;
    if (pending?.hasPendingUpdate && Array.isArray(pending.proposedTimings) && pending.proposedTimings.length) {
        // Dashboard view: show the requested schedule while it awaits approval, and keep
        // the live (currently approved) schedule available for reference.
        return {
            outletTimings: toClientShape({ timings: pending.proposedTimings }),
            liveOutletTimings: liveShape,
            pendingApproval: true,
            pendingOpenDays: {
                proposedOpenDays: pending.proposedOpenDays || openDaysShortNames(pending.proposedTimings),
                previousOpenDays: pending.previousOpenDays || openDaysShortNames(pending.previousTimings),
                requestedAt: pending.requestedAt || null
            }
        };
    }

    return { outletTimings: liveShape, pendingApproval: false };
}

export async function upsertOutletTimingsForRestaurant(restaurantId, outletTimings) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    if (!outletTimings || typeof outletTimings !== 'object' || Array.isArray(outletTimings)) {
        throw new ValidationError('outletTimings must be an object keyed by day name');
    }

    const timings = normalizeTimingsFromInput(outletTimings);

    const restaurant = await FoodRestaurant.findById(restaurantId)
        .select('status restaurantName openDays openingTime closingTime pendingOpenDays')
        .lean();

    const saveLive = async () => {
        const doc = await FoodRestaurantOutletTimings.findOneAndUpdate(
            { restaurantId },
            { $set: { timings } },
            { upsert: true, new: true, setDefaultsOnInsert: true, projection: 'timings updatedAt' }
        ).lean();
        return { outletTimings: toClientShape(doc), pendingApproval: false };
    };

    // Only already-approved restaurants route opening-days changes through re-approval.
    // Onboarding / pending / rejected restaurants save directly (no live schedule to protect yet).
    if (restaurant?.status !== 'approved') {
        return saveLive();
    }

    // Determine the currently live schedule so we can detect a real opening-days change.
    const currentDoc = await FoodRestaurantOutletTimings.findOne({ restaurantId }).select('timings').lean();
    const currentTimings = currentDoc?.timings?.length
        ? canonicalTimingsArray(currentDoc.timings)
        : buildOutletTimingsArrayFromSchedule(restaurant.openDays, restaurant.openingTime, restaurant.closingTime);

    const currentOpenKey = openDaysSignature(currentTimings);
    const proposedOpenKey = openDaysSignature(timings);

    // No change in *which* days are open (e.g. only opening/closing times edited).
    if (proposedOpenKey === currentOpenKey) {
        const result = await saveLive();
        // If a stale opening-days request now matches the live schedule, clear it.
        if (restaurant?.pendingOpenDays?.hasPendingUpdate) {
            await FoodRestaurant.updateOne({ _id: restaurantId }, { $unset: { pendingOpenDays: '' } });
        }
        return result;
    }

    // Opening days changed → stage the request for admin re-approval WITHOUT touching
    // the live schedule. The restaurant stays approved & online with its current days.
    const existingPending = restaurant?.pendingOpenDays;
    const alreadyPendingKey = existingPending?.hasPendingUpdate
        ? openDaysSignature(canonicalTimingsArray(existingPending.proposedTimings))
        : null;
    const isDuplicate = alreadyPendingKey !== null && alreadyPendingKey === proposedOpenKey;

    await FoodRestaurant.updateOne(
        { _id: restaurantId },
        {
            $set: {
                pendingOpenDays: {
                    hasPendingUpdate: true,
                    proposedOpenDays: openDaysShortNames(timings),
                    proposedTimings: timings,
                    previousOpenDays: openDaysShortNames(currentTimings),
                    previousTimings: currentTimings,
                    requestedAt: isDuplicate && existingPending?.requestedAt ? existingPending.requestedAt : new Date()
                }
            }
        }
    );

    // Avoid duplicate notifications when the same request is re-submitted unchanged.
    if (!isDuplicate) {
        notifyAdminsAboutOpeningDaysReview(restaurantId, restaurant.restaurantName);
    }

    return {
        outletTimings: toClientShape({ timings }),
        liveOutletTimings: toClientShape({ timings: currentTimings }),
        pendingApproval: true,
        pendingOpenDays: {
            proposedOpenDays: openDaysShortNames(timings),
            previousOpenDays: openDaysShortNames(currentTimings),
            requestedAt: new Date()
        }
    };
}

/**
 * Apply a staged opening-days change to the live schedule. Called by the admin
 * approval flow. Writes the proposed per-day timings to the outlet-timings
 * collection, syncs restaurant.openDays, and clears the pending request.
 */
export async function applyPendingOpenDaysUpdate(restaurantId) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) return false;
    const restaurant = await FoodRestaurant.findById(restaurantId).select('pendingOpenDays').lean();
    const pending = restaurant?.pendingOpenDays;
    if (!pending?.hasPendingUpdate || !Array.isArray(pending.proposedTimings) || !pending.proposedTimings.length) {
        return false;
    }

    const timings = canonicalTimingsArray(pending.proposedTimings);
    await FoodRestaurantOutletTimings.findOneAndUpdate(
        { restaurantId },
        { $set: { timings } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await FoodRestaurant.updateOne(
        { _id: restaurantId },
        {
            $set: { openDays: Array.isArray(pending.proposedOpenDays) ? pending.proposedOpenDays : openDaysShortNames(timings) },
            $unset: { pendingOpenDays: '' }
        }
    );
    return true;
}

/** Discard a staged opening-days change (admin rejected it). Live schedule is untouched. */
export async function discardPendingOpenDaysUpdate(restaurantId) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) return false;
    const res = await FoodRestaurant.updateOne(
        { _id: restaurantId, 'pendingOpenDays.hasPendingUpdate': true },
        { $unset: { pendingOpenDays: '' } }
    );
    return (res.modifiedCount || res.nModified || 0) > 0;
}

export async function attachOutletTimingsToRestaurants(restaurants) {
    if (!Array.isArray(restaurants) || restaurants.length === 0) return restaurants;
    const ids = restaurants.map((r) => r._id);
    const docs = await FoodRestaurantOutletTimings.find({ restaurantId: { $in: ids } }).lean();
    const map = {};
    for (const doc of docs) {
        map[String(doc.restaurantId)] = toClientShape(doc);
    }
    const fallback = toClientShape({ timings: defaultTimings() });
    for (const r of restaurants) {
        const rId = String(r._id);
        r.outletTimings = map[rId] || fallback;
    }
    return restaurants;
}
