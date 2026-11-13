import { GlobalSettings } from '../../../common/models/settings.model.js';

export const MAINTENANCE_DEFAULT_MESSAGE = 'We are coming soon. The app is on maintenance.';

/**
 * Tiny in-process cache so the order-placement guard doesn't hit Mongo on every
 * checkout. Kept at a few seconds (not minutes) because this is a kill-switch —
 * admin expects it to take effect almost immediately. Writes refresh it outright.
 */
const CACHE_TTL_MS = 5 * 1000;
let cached = null;
let cachedAt = 0;

const normalize = (node) => ({
    enabled: !!node?.enabled,
    message: (node?.message || '').trim() || MAINTENANCE_DEFAULT_MESSAGE,
});

const remember = (state) => {
    cached = state;
    cachedAt = Date.now();
    return state;
};

export const clearMaintenanceModeCache = () => {
    cached = null;
    cachedAt = 0;
};

/** Fresh read, used by the admin panel. */
export const getMaintenanceMode = async () => {
    const settings = await GlobalSettings.findOne({ singletonKey: 'global' })
        .select('foodMaintenanceMode')
        .lean();
    return remember(normalize(settings?.foodMaintenanceMode));
};

/** Cached read, used on hot paths (order placement, public polling). */
export const getMaintenanceModeCached = async () => {
    if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
    try {
        return await getMaintenanceMode();
    } catch (error) {
        // Never block ordering because the settings read failed.
        console.error('[maintenance-mode] read failed, treating as disabled:', error?.message);
        return { enabled: false, message: MAINTENANCE_DEFAULT_MESSAGE };
    }
};

export const setMaintenanceMode = async ({ enabled, message, updatedBy } = {}) => {
    const update = {};
    if (enabled !== undefined) update['foodMaintenanceMode.enabled'] = !!enabled;
    if (message !== undefined) {
        update['foodMaintenanceMode.message'] =
            String(message || '').trim() || MAINTENANCE_DEFAULT_MESSAGE;
    }
    if (updatedBy) update['foodMaintenanceMode.updatedBy'] = updatedBy;

    // Make sure the singleton exists first, so we never upsert a half-built settings doc.
    await GlobalSettings.getSingleton();
    const settings = await GlobalSettings.findOneAndUpdate(
        { singletonKey: 'global' },
        { $set: update },
        { new: true }
    )
        .select('foodMaintenanceMode')
        .lean();

    return remember(normalize(settings?.foodMaintenanceMode));
};
