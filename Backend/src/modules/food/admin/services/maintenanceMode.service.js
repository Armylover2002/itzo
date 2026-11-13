import { FoodMaintenanceMode, MAINTENANCE_DEFAULT_MESSAGE } from '../models/maintenanceMode.model.js';

/**
 * Tiny in-process cache so the order-placement guard doesn't hit Mongo on every
 * checkout. Kept at a few seconds (not minutes) because this is a kill-switch —
 * admin expects it to take effect almost immediately. Writes clear it outright.
 */
const CACHE_TTL_MS = 5 * 1000;
let cached = null;
let cachedAt = 0;

const normalize = (doc) => ({
    enabled: !!doc?.enabled,
    message: (doc?.message || '').trim() || MAINTENANCE_DEFAULT_MESSAGE,
    updatedAt: doc?.updatedAt || null,
});

export const clearMaintenanceModeCache = () => {
    cached = null;
    cachedAt = 0;
};

/** Fresh read, used by the admin panel. */
export const getMaintenanceMode = async () => {
    const doc = await FoodMaintenanceMode.getSingleton();
    cached = normalize(doc);
    cachedAt = Date.now();
    return cached;
};

/** Cached read, used on hot paths (order placement, public polling). */
export const getMaintenanceModeCached = async () => {
    if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
    try {
        return await getMaintenanceMode();
    } catch (error) {
        // Never block ordering because the settings read failed.
        console.error('[maintenance-mode] read failed, treating as disabled:', error?.message);
        return { enabled: false, message: MAINTENANCE_DEFAULT_MESSAGE, updatedAt: null };
    }
};

export const setMaintenanceMode = async ({ enabled, message, updatedBy } = {}) => {
    const update = {};
    if (enabled !== undefined) update.enabled = !!enabled;
    if (message !== undefined) update.message = String(message || '').trim() || MAINTENANCE_DEFAULT_MESSAGE;
    if (updatedBy) update.updatedBy = updatedBy;

    const doc = await FoodMaintenanceMode.findOneAndUpdate(
        { singletonKey: 'food' },
        { $set: update, $setOnInsert: { singletonKey: 'food' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    clearMaintenanceModeCache();
    cached = normalize(doc);
    cachedAt = Date.now();
    return cached;
};

export { MAINTENANCE_DEFAULT_MESSAGE };
