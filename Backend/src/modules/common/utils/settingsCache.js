import { GlobalSettings } from '../models/settings.model.js';
import { logger } from '../../../utils/logger.js';

let cachedSettings = null;

export async function initSettingsCache() {
  try {
    let settings = await GlobalSettings.findOne().lean();
    if (!settings) {
      // Create default settings if none exist
      settings = await GlobalSettings.create({
        companyName: 'ItzoFood',
        email: 'admin@itzofood.com',
        enableFemaleContactProtection: true,
        companySupportNumber: '+919999999999',
        companyWhatsappNumber: '+919999999999',
        privacyMessage: 'For privacy and safety reasons, customer contact information is protected. Please contact ItzoFood Support.'
      });
      settings = settings.toObject ? settings.toObject() : settings;
    }
    cachedSettings = settings;
    logger.info("Global settings cache initialized successfully.");
  } catch (err) {
    logger.error(`Failed to initialize global settings cache: ${err.message}`);
  }
}

export function getSettingsSync() {
  return cachedSettings || {
    enableFemaleContactProtection: true,
    companySupportNumber: '+919999999999',
    companyWhatsappNumber: '+919999999999',
    privacyMessage: 'Customer contact is protected. Please contact ItzoFood Support.'
  };
}

export function updateSettingsCache(settings) {
  cachedSettings = settings?.toObject ? settings.toObject() : settings;
  logger.info("Global settings cache updated.");
}

/**
 * Whether the subscription / daily-pass gate is active for a partner type.
 * Reads the in-memory settings cache (no DB round-trip), and fails SAFE:
 * anything other than an explicit `false` keeps the existing paywall behaviour.
 *
 * @param {'DELIVERY_PARTNER'|'RESTAURANT'} userType
 * @returns {boolean}
 */
export function isSubscriptionEnforced(userType) {
  const enforcement = getSettingsSync()?.subscriptionEnforcement;
  if (!enforcement) return true;
  if (userType === 'DELIVERY_PARTNER') return enforcement.deliveryPartner !== false;
  if (userType === 'RESTAURANT') return enforcement.restaurant !== false;
  return true;
}
