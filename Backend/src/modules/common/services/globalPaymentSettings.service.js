import { GlobalSettings } from '../models/settings.model.js';

const PAYMENT_SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedPaymentSettings = null;
let cachedAt = 0;

export async function getGlobalPaymentSettings() {
    const now = Date.now();
    if (cachedPaymentSettings && (now - cachedAt) < PAYMENT_SETTINGS_CACHE_TTL_MS) {
        return cachedPaymentSettings;
    }

    const settings = await GlobalSettings.findOne()
        .select('codEnabled onlineEnabled')
        .lean();

    cachedPaymentSettings = {
        codEnabled: settings?.codEnabled !== false,
        onlineEnabled: settings?.onlineEnabled !== false,
    };
    cachedAt = now;
    return cachedPaymentSettings;
}

export function clearGlobalPaymentSettingsCache() {
    cachedPaymentSettings = null;
    cachedAt = 0;
}

export function assertPaymentMethodAllowed(paymentMethod, paymentSettings) {
    const method = String(paymentMethod || '').trim().toLowerCase();
    const codMethods = new Set(['cash', 'cod', 'razorpay_qr']);
    const onlineMethods = new Set(['razorpay', 'card', 'online']);

    if (!paymentSettings.codEnabled && codMethods.has(method)) {
        return { allowed: false, message: 'Cash on delivery is currently disabled' };
    }

    if (!paymentSettings.onlineEnabled && onlineMethods.has(method)) {
        return { allowed: false, message: 'Online payment is currently disabled' };
    }

    return { allowed: true };
}
