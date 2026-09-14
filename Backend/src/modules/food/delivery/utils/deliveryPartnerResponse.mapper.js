/**
 * Serializers for delivery partner registration / profile-completion API responses.
 * Database documents are unchanged — only outbound payloads are compacted.
 */

const OPTIONAL_VEHICLE_DOC_FIELDS = [
    'vehiclePhoto',
    'rcPhoto',
    'insurancePhoto',
    'fitnessPhoto',
    'pollutionPhoto',
    'permitPhoto',
];

const hasValue = (value) => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    return true;
};

/** Drop empty strings, null, undefined, and empty arrays from a flat object. */
const compactFields = (obj = {}) => {
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
        if (!hasValue(value)) continue;
        if (typeof value === 'boolean') {
            out[key] = value;
            continue;
        }
        out[key] = value;
    }
    return out;
};

/**
 * Minimal driver vehicle shape for registration responses.
 * Photo/document fields are included only when populated.
 */
export const mapRegistrationDriverVehicle = (vehicle) => {
    if (!vehicle) return null;

    const id = vehicle.id || vehicle._id;
    const base = compactFields({
        id: id ? String(id) : undefined,
        vehicleName: vehicle.vehicleName,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleCode: vehicle.vehicleCode || vehicle.vehicleType,
        model: vehicle.model,
        status: vehicle.status,
        isDefault: vehicle.isDefault === true ? true : undefined,
    });

    for (const field of OPTIONAL_VEHICLE_DOC_FIELDS) {
        if (hasValue(vehicle[field])) {
            base[field] = vehicle[field];
        }
    }

    return Object.keys(base).length ? base : null;
};

/**
 * Production-ready registration / profile-completion partner payload.
 */
export const mapDeliveryPartnerRegistrationResponse = (doc) => {
    const raw = doc?.toObject ? doc.toObject() : (doc || {});
    const id = raw._id ? String(raw._id) : (raw.id ? String(raw.id) : undefined);

    const driverVehicles = Array.isArray(raw.driverVehicles)
        ? raw.driverVehicles.map(mapRegistrationDriverVehicle).filter(Boolean)
        : undefined;

    return compactFields({
        id,
        name: raw.name,
        phone: raw.phone,
        email: raw.email,
        countryCode: raw.countryCode,
        address: raw.address,
        city: raw.city,
        state: raw.state,
        status: raw.status,
        vehicleType: raw.vehicleType,
        vehicleName: raw.vehicleName,
        vehicleNumber: raw.vehicleNumber,
        profilePhoto: raw.profilePhoto,
        aadharPhoto: raw.aadharPhoto,
        panPhoto: raw.panPhoto,
        drivingLicensePhoto: raw.drivingLicensePhoto,
        vehicleImage: raw.vehicleImage,
        activeVehicleId: raw.activeVehicleId ? String(raw.activeVehicleId) : undefined,
        referralCode: raw.referralCode,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
        driverVehicles: driverVehicles?.length ? driverVehicles : undefined,
    });
};

export const mapDeliveryPartnerProfileCompletionResponse = (result) => {
    if (!result) return result;
    return {
        requiresReapproval: Boolean(result.requiresReapproval),
        partner: mapDeliveryPartnerRegistrationResponse(result.partner),
    };
};
