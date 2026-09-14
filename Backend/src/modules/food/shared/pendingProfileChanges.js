import mongoose from 'mongoose';

/** Fields that require admin re-approval when an already-approved restaurant changes them. */
export const REVIEWABLE_PROFILE_FIELDS = [
    'restaurantName',
    'restaurantNameNormalized',
    'ownerName',
    'ownerEmail',
    'ownerPhone',
    'ownerPhoneDigits',
    'ownerPhoneLast10',
    'primaryContactNumber',
    'cuisines',
    'zoneId',
    'location',
    'addressLine1',
    'addressLine2',
    'area',
    'city',
    'state',
    'pincode',
    'landmark',
    'profileImage',
    'coverImages',
    'menuImages',
    'accountHolderName',
    'accountNumber',
    'ifscCode',
    'accountType',
    'upiId',
    'upiQrImage',
    'panNumber',
    'nameOnPan',
    'panImage',
    'gstRegistered',
    'gstNumber',
    'gstLegalName',
    'gstAddress',
    'gstImage',
    'fssaiNumber',
    'fssaiExpiry',
    'fssaiImage',
    'reVerification',
];

const valuesEqual = (a, b) => {
    if (a === b) return true;
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;

    if (a instanceof Date || b instanceof Date) {
        const ta = a instanceof Date ? a.getTime() : new Date(a).getTime();
        const tb = b instanceof Date ? b.getTime() : new Date(b).getTime();
        return Number.isFinite(ta) && Number.isFinite(tb) && ta === tb;
    }

    if (Array.isArray(a) || Array.isArray(b)) {
        try {
            return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
        } catch {
            return false;
        }
    }

    if (typeof a === 'object' || typeof b === 'object') {
        try {
            const normalize = (value) => {
                if (value == null) return null;
                if (value instanceof mongoose.Types.ObjectId) return String(value);
                if (value?._id) return String(value._id);
                return value;
            };
            return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
        } catch {
            return false;
        }
    }

    return String(a) === String(b);
};

export const pickLiveSnapshot = (restaurant = {}, keys = []) => {
    const snapshot = {};
    keys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(restaurant, key)) {
            snapshot[key] = restaurant[key];
        }
    });
    return snapshot;
};

/**
 * Split a profile $set into:
 * - liveUpdate: applied immediately (first-time onboard OR non-reviewable fields)
 * - stagedFields: held in pendingProfileChanges.proposed for prior-approved restaurants
 */
export const splitReviewableUpdate = (restaurant, update = {}) => {
    const hadPriorApproval =
        restaurant?.wasEverApproved === true ||
        restaurant?.approvedAt != null ||
        String(restaurant?.status || '').toLowerCase() === 'approved';

    if (!hadPriorApproval) {
        return { liveUpdate: { ...update }, stagedFields: {}, shouldStage: false };
    }

    const liveUpdate = {};
    const stagedFields = {};

    Object.entries(update || {}).forEach(([key, value]) => {
        if (!REVIEWABLE_PROFILE_FIELDS.includes(key)) {
            liveUpdate[key] = value;
            return;
        }
        if (valuesEqual(restaurant?.[key], value)) {
            return;
        }
        stagedFields[key] = value;
    });

    return {
        liveUpdate,
        stagedFields,
        shouldStage: Object.keys(stagedFields).length > 0,
    };
};

export const mergePendingProfileChanges = (existingPending = {}, stagedFields = {}, restaurant = {}) => {
    const keys = Object.keys(stagedFields || {});
    if (!keys.length) return existingPending || null;

    const previousPending = existingPending && typeof existingPending === 'object' ? existingPending : {};
    const previousProposed =
        previousPending.proposed && typeof previousPending.proposed === 'object'
            ? { ...previousPending.proposed }
            : {};
    const previousSnapshot =
        previousPending.previous && typeof previousPending.previous === 'object'
            ? { ...previousPending.previous }
            : {};

    const nextProposed = { ...previousProposed, ...stagedFields };
    const nextPrevious = { ...previousSnapshot };
    keys.forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(nextPrevious, key)) {
            nextPrevious[key] = restaurant?.[key] ?? null;
        }
    });

    const reasons = new Set(
        Array.isArray(previousPending.changeTypes) ? previousPending.changeTypes.filter(Boolean) : []
    );
    if (keys.some((k) => ['zoneId', 'location', 'addressLine1', 'city', 'area', 'state', 'pincode', 'reVerification'].includes(k))) {
        reasons.add('location');
    }
    if (keys.some((k) => ['accountHolderName', 'accountNumber', 'ifscCode', 'accountType', 'upiId', 'upiQrImage'].includes(k))) {
        reasons.add('bank');
    }
    if (keys.some((k) => ['fssaiNumber', 'fssaiExpiry', 'fssaiImage', 'panNumber', 'panImage', 'gstNumber', 'gstImage'].includes(k))) {
        reasons.add('documents');
    }
    if (keys.some((k) => ['profileImage', 'coverImages', 'menuImages'].includes(k))) {
        reasons.add('media');
    }
    if (keys.some((k) => ['restaurantName', 'restaurantNameNormalized', 'ownerName', 'ownerEmail', 'ownerPhone', 'primaryContactNumber', 'cuisines', 'pureVegRestaurant'].includes(k))) {
        reasons.add('outlet_info');
    }

    return {
        hasPendingUpdate: true,
        proposed: nextProposed,
        previous: nextPrevious,
        changeTypes: Array.from(reasons),
        requestedAt: new Date(),
        reason: Array.from(reasons).join(', ') || 'profile_update',
    };
};

/** Parse area/city/state/pincode from a Google-style formatted address when components were empty. */
const fillAddressPartsFromFormatted = (formatted = '', parts = {}) => {
    const next = {
        addressLine1: String(parts.addressLine1 || '').trim(),
        area: String(parts.area || '').trim(),
        city: String(parts.city || '').trim(),
        state: String(parts.state || '').trim(),
        pincode: String(parts.pincode || '').trim(),
    };

    const text = String(formatted || '').trim();
    if (!text) return next;

    const pinMatch = text.match(/\b(\d{6})\b/);
    if (!next.pincode && pinMatch) next.pincode = pinMatch[1];

    const chunks = text
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => !/^india$/i.test(part));

    if (!chunks.length) return next;

    const last = chunks[chunks.length - 1] || '';
    const lastWithoutPin = last.replace(/\b\d{6}\b/, '').trim();
    if (!next.state && lastWithoutPin) next.state = lastWithoutPin;
    if (!next.city && chunks.length >= 2) next.city = chunks[chunks.length - 2];
    if (!next.area && chunks.length >= 3) next.area = chunks[chunks.length - 3];
    if (!next.addressLine1 && chunks[0]) next.addressLine1 = chunks[0];

    return next;
};

const enrichStagedAddressFields = (proposed = {}) => {
    const next = { ...proposed };
    const loc =
        next.location && typeof next.location === 'object' && !Array.isArray(next.location)
            ? { ...next.location }
            : null;
    const formatted =
        loc?.formattedAddress || loc?.address || next.formattedAddress || '';
    if (!formatted) return next;

    const filled = fillAddressPartsFromFormatted(formatted, {
        addressLine1: next.addressLine1 || loc?.addressLine1 || '',
        area: next.area || loc?.area || '',
        city: next.city || loc?.city || '',
        state: next.state || loc?.state || '',
        pincode: next.pincode || loc?.pincode || '',
    });

    if (!String(next.addressLine1 || '').trim()) next.addressLine1 = filled.addressLine1;
    if (!String(next.area || '').trim()) next.area = filled.area;
    if (!String(next.city || '').trim()) next.city = filled.city;
    if (!String(next.state || '').trim()) next.state = filled.state;
    if (!String(next.pincode || '').trim()) next.pincode = filled.pincode;

    if (loc) {
        if (!String(loc.addressLine1 || '').trim()) loc.addressLine1 = filled.addressLine1;
        if (!String(loc.area || '').trim()) loc.area = filled.area;
        if (!String(loc.city || '').trim()) loc.city = filled.city;
        if (!String(loc.state || '').trim()) loc.state = filled.state;
        if (!String(loc.pincode || '').trim()) loc.pincode = filled.pincode;
        next.location = loc;
    }

    return next;
};

export const buildApplyPendingProfileChangesUpdate = (pending = {}) => {
    const proposedRaw = pending?.proposed && typeof pending.proposed === 'object' ? pending.proposed : {};
    if (!Object.keys(proposedRaw).length) {
        return {
            $unset: { pendingProfileChanges: 1, reVerification: 1 },
        };
    }

    // Fill empty area/city/state/pincode from formatted address when map picker left them blank.
    const proposed = enrichStagedAddressFields(proposedRaw);

    // Never $set reVerification while also $unsetting it — Mongo conflict:
    // "Updating the path 'reVerification' would create a conflict at 'reVerification'"
    // reVerification is review metadata only; location fields in proposed are what go live.
    const META_SKIP = new Set(['reVerification', 'pendingProfileChanges']);
    // Don't wipe live outlet address parts with empty staged strings from the map picker.
    const SKIP_EMPTY_OVERWRITE = new Set([
        'area',
        'city',
        'state',
        'pincode',
        'addressLine2',
        'landmark',
    ]);

    const fieldsToApply = {};
    for (const [key, value] of Object.entries(proposed)) {
        if (META_SKIP.has(key)) continue;
        if (
            SKIP_EMPTY_OVERWRITE.has(key) &&
            (value === '' || value === null || value === undefined)
        ) {
            continue;
        }
        fieldsToApply[key] = value;
    }

    return {
        $set: {
            ...fieldsToApply,
            status: 'approved',
            isActive: true,
            wasEverApproved: true,
            approvedAt: new Date(),
            rejectedAt: undefined,
            rejectionReason: undefined,
        },
        $unset: {
            pendingProfileChanges: 1,
            reVerification: 1,
        },
    };
};

export const buildDiscardPendingProfileChangesUpdate = () => ({
    $unset: {
        pendingProfileChanges: 1,
        reVerification: 1,
    },
});
