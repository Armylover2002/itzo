import { GlobalSettings } from '../models/settings.model.js';

/**
 * Master kill-switch for the food subscription paywall.
 * Defaults to NOT enforced (false) when settings/flags are missing, so an
 * unconfigured deployment never blocks restaurants/delivery partners that
 * were already operating before this feature existed.
 */
export async function isSubscriptionEnforced(userType) {
    const settings = await GlobalSettings.findOne().select('subscriptionEnforcement').lean();
    const enforcement = settings?.subscriptionEnforcement;
    if (!enforcement) return false;
    if (userType === 'DELIVERY_PARTNER') return !!enforcement.deliveryPartner;
    if (userType === 'RESTAURANT') return !!enforcement.restaurant;
    return false;
}
