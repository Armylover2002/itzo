import { GlobalSettings } from '../models/settings.model.js';
import { logger } from '../../../utils/logger.js';

/**
 * In-memory cache of the "Customer Privacy Settings" fields only.
 * These are read synchronously from hot paths (order sanitization, socket
 * payload building) where an async DB round-trip is not acceptable, so we
 * keep a small dedicated cache here rather than reusing GlobalSettings
 * directly. Unrelated to subscriptionEnforcement.service.js, which uses its
 * own async DB read and is left untouched.
 */
const DEFAULTS = {
    enableFemaleContactProtection: true,
    companySupportNumber: '+919999999999',
    companyWhatsappNumber: '+919999999999',
    privacyMessage: 'For privacy and safety reasons, customer contact information is protected. Please contact ItzoFood Support.',
};

let cached = null;

export async function initPrivacySettingsCache() {
    try {
        const settings = await GlobalSettings.findOne()
            .select('enableFemaleContactProtection companySupportNumber companyWhatsappNumber privacyMessage')
            .lean();
        cached = settings
            ? {
                enableFemaleContactProtection: settings.enableFemaleContactProtection !== false,
                companySupportNumber: settings.companySupportNumber || DEFAULTS.companySupportNumber,
                companyWhatsappNumber: settings.companyWhatsappNumber || DEFAULTS.companyWhatsappNumber,
                privacyMessage: settings.privacyMessage || DEFAULTS.privacyMessage,
            }
            : { ...DEFAULTS };
        logger.info('Privacy settings cache initialized.');
    } catch (err) {
        logger.error(`Failed to initialize privacy settings cache: ${err.message}`);
        cached = { ...DEFAULTS };
    }
}

export function getPrivacySettingsSync() {
    return cached || DEFAULTS;
}

export function updatePrivacySettingsCache(settings) {
    const raw = settings?.toObject ? settings.toObject() : settings;
    if (!raw) return;
    cached = {
        enableFemaleContactProtection: raw.enableFemaleContactProtection !== false,
        companySupportNumber: raw.companySupportNumber || DEFAULTS.companySupportNumber,
        companyWhatsappNumber: raw.companyWhatsappNumber || DEFAULTS.companyWhatsappNumber,
        privacyMessage: raw.privacyMessage || DEFAULTS.privacyMessage,
    };
}
