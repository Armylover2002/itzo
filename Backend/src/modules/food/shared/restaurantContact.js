/**
 * Restaurants keep their public number in `primaryContactNumber` and the account
 * number in `ownerPhone`; there is no `phone` field on the schema. Callers that
 * expose a "call restaurant" action must resolve through both, otherwise the
 * number always comes back empty.
 */
export function resolveRestaurantPhone(restaurant) {
    if (!restaurant || typeof restaurant !== 'object') return '';

    const candidates = [
        restaurant.primaryContactNumber,
        restaurant.phone,
        restaurant.contactNumber,
        restaurant.ownerPhone,
    ];

    for (const candidate of candidates) {
        const value = String(candidate ?? '').trim();
        if (value) return value;
    }

    return '';
}

/** Fields a populate() must select for resolveRestaurantPhone to work. */
export const RESTAURANT_PHONE_SELECT_FIELDS = 'primaryContactNumber ownerPhone';
