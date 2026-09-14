import mongoose from 'mongoose';
import { FoodUser } from '../../../../core/users/user.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';

const toGeoPoint = ({ latitude, longitude }) => {
    if (latitude === undefined || longitude === undefined) return undefined;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
    return { type: 'Point', coordinates: [lng, lat] };
};

/**
 * Build a GeoJSON point from any of the accepted coordinate shapes:
 *  - { latitude, longitude }
 *  - { location: { coordinates: [lng, lat] } }
 *  - { location: { lat, lng } }
 * Returns undefined when no valid coordinates are present.
 */
const resolveGeoPoint = (dto = {}) => {
    const direct = toGeoPoint(dto);
    if (direct) return direct;

    const loc = dto.location;
    if (loc && typeof loc === 'object') {
        if (Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
            const [lng, lat] = loc.coordinates.map(Number);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                return { type: 'Point', coordinates: [lng, lat] };
            }
        }
        if (loc.lat !== undefined && loc.lng !== undefined) {
            return toGeoPoint({ latitude: loc.lat, longitude: loc.lng });
        }
    }
    return undefined;
};

const normalizeLabel = (label) => {
    const v = String(label || '').trim();
    if (v === 'Work') return 'Office';
    if (v === 'home' || v === 'Home') return 'Home';
    if (v === 'office' || v === 'Office') return 'Office';
    if (v === 'other' || v === 'Other') return 'Other';
    if (v === 'Current Location' || v === 'current location') return 'Current Location';
    return 'Other';
};

const str = (v) => String(v ?? '').trim();

/**
 * Canonical normalization for a saved address. Guarantees a single, consistent
 * shape regardless of which client/path (address CRUD or profile update) writes
 * it, so we never persist duplicate/inconsistent field variants.
 *
 * Accepted input aliases:
 *  - pincode  -> zipCode
 *  - latitude/longitude OR location.coordinates OR location.{lat,lng} -> location
 */
export const normalizeAddressInput = (dto = {}) => {
    let address = str(dto.address || dto.formattedAddress);
    const street = str(dto.street);
    const additionalDetails = str(dto.additionalDetails);
    const city = str(dto.city);
    const state = str(dto.state);
    const zipCode = str(dto.zipCode || dto.pincode);

    // Backward-compatible fallback when legacy clients omit the formatted string.
    if (!address) {
        address = [additionalDetails, street, city, state, zipCode]
            .filter(Boolean)
            .join(', ');
    }

    const normalized = {
        label: normalizeLabel(dto.label),
        address,
        street,
        additionalDetails,
        city,
        state,
        zipCode,
        phone: str(dto.phone),
        placeId: str(dto.placeId || dto.place_id)
    };
    if (dto.type) {
        normalized.type = dto.type;
    }
    const location = resolveGeoPoint(dto);
    if (location) normalized.location = location;
    return normalized;
};

export const listAddresses = async (userId) => {
    const user = await FoodUser.findById(userId).select('addresses').lean();
    return { addresses: user?.addresses || [] };
};

export const addAddress = async (userId, dto) => {
    const user = await FoodUser.findById(userId).select('addresses');
    if (!user) throw new ValidationError('User not found');

    const address = {
        ...normalizeAddressInput(dto),
        isDefault: false
    };

    // If same label exists, update-in-place (keeps "Home/Office/Other" single entry best UX)
    const existingIdx = user.addresses.findIndex((a) => String(a?.label) === String(address.label));
    if (existingIdx >= 0) {
        const existing = user.addresses[existingIdx];
        existing.label = address.label;
        existing.address = address.address;
        existing.street = address.street;
        existing.additionalDetails = address.additionalDetails;
        existing.city = address.city;
        existing.state = address.state;
        existing.zipCode = address.zipCode;
        existing.phone = address.phone;
        if (address.placeId) existing.placeId = address.placeId;
        if (address.location) existing.location = address.location;
        await user.save();
        return { address: existing.toObject() };
    }

    // First saved address becomes default automatically
    if (address.type !== 'current' && address.label !== 'Current Location' && !user.addresses.some((a) => a.isDefault && a.type !== 'current' && a.label !== 'Current Location')) {
        address.isDefault = true;
    }

    user.addresses.push(address);
    await user.save();
    const saved = user.addresses[user.addresses.length - 1];
    return { address: saved.toObject() };
};

export const updateAddress = async (userId, addressId, dto) => {
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
        throw new ValidationError('Invalid address id');
    }
    const user = await FoodUser.findById(userId).select('addresses');
    if (!user) throw new ValidationError('User not found');

    const address = user.addresses.id(addressId);
    if (!address) throw new ValidationError('Address not found');

    if (dto.label !== undefined) address.label = normalizeLabel(dto.label);
    if (dto.address !== undefined) address.address = str(dto.address);
    if (dto.street !== undefined) address.street = str(dto.street);
    if (dto.additionalDetails !== undefined) address.additionalDetails = str(dto.additionalDetails);
    if (dto.city !== undefined) address.city = str(dto.city);
    if (dto.state !== undefined) address.state = str(dto.state);
    if (dto.zipCode !== undefined || dto.pincode !== undefined) {
        address.zipCode = str(dto.zipCode ?? dto.pincode);
    }
    if (dto.phone !== undefined) address.phone = str(dto.phone);
    if (dto.placeId !== undefined || dto.place_id !== undefined) {
        address.placeId = str(dto.placeId ?? dto.place_id);
    }
    const location = resolveGeoPoint(dto);
    if (location) address.location = location;

    await user.save();
    return { address: address.toObject() };
};

export const deleteAddress = async (userId, addressId) => {
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
        throw new ValidationError('Invalid address id');
    }
    const user = await FoodUser.findById(userId).select('addresses');
    if (!user) throw new ValidationError('User not found');

    const address = user.addresses.id(addressId);
    if (!address) throw new ValidationError('Address not found');

    const wasDefault = !!address.isDefault;
    address.deleteOne();

    // If deleting default, promote the newest remaining address to default
    if (wasDefault) {
        const remaining = user.addresses.filter(Boolean);
        if (remaining.length) {
            remaining.forEach((a) => {
                a.isDefault = false;
            });
            remaining[remaining.length - 1].isDefault = true;
        }
    }

    await user.save();
    return { success: true };
};

export const setDefaultAddress = async (userId, addressId) => {
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
        throw new ValidationError('Invalid address id');
    }
    const user = await FoodUser.findById(userId).select('addresses');
    if (!user) throw new ValidationError('User not found');

    const address = user.addresses.id(addressId);
    if (!address) throw new ValidationError('Address not found');

    user.addresses.forEach((a) => {
        a.isDefault = String(a._id) === String(addressId);
    });
    await user.save();

    const updated = user.addresses.id(addressId);
    return { address: updated?.toObject() };
};

