import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';

const toTrimmedString = (value) => (value == null ? '' : String(value).trim());

export const extractRawFoodVariants = (value = {}) => {
    if (Array.isArray(value?.variants)) return value.variants;
    if (Array.isArray(value?.variations)) return value.variations;
    return [];
};

export const normalizeFoodVariantsInput = (value = [], options = {}) => {
    const {
        allowEmpty = true,
        priceLabel = 'Variant price'
    } = options;

    if (value == null || value === '') {
        if (allowEmpty) return [];
        throw new ValidationError('At least one variant is required');
    }

    if (!Array.isArray(value)) {
        throw new ValidationError('Variants must be an array');
    }

    const normalized = value
        .map((entry = {}) => {
            const name = toTrimmedString(entry?.name);
            if (!name) {
                throw new ValidationError('Each variant must have a name');
            }

            const price = Number(entry?.price);
            if (!Number.isFinite(price) || price <= 0) {
                throw new ValidationError(`${priceLabel} must be greater than 0`);
            }

            const unit = toTrimmedString(entry?.unit).toLowerCase() || 'piece';

            const variant = {
                name,
                price,
                otherPrice: Number(entry?.otherPrice) || 0,
                unit
            };

            const variantId = entry?._id || entry?.id;
            if (variantId && mongoose.Types.ObjectId.isValid(String(variantId))) {
                variant._id = new mongoose.Types.ObjectId(String(variantId));
            }

            return variant;
        })
        .filter(Boolean);

    if (!allowEmpty && normalized.length === 0) {
        throw new ValidationError('At least one variant is required');
    }

    return normalized;
};

export const serializeFoodVariants = (value = []) =>
    (Array.isArray(value) ? value : [])
        .map((entry = {}) => {
            const name = toTrimmedString(entry?.name);
            const price = Number(entry?.price);
            if (!name || !Number.isFinite(price) || price <= 0) return null;

            const variantId = entry?._id || entry?.id;
            return {
                id: variantId ? String(variantId) : '',
                _id: variantId ? String(variantId) : '',
                name,
                price,
                otherPrice: Number(entry?.otherPrice) || 0,
                unit: toTrimmedString(entry?.unit).toLowerCase() || 'piece'
            };
        })
        .filter(Boolean);

export const hasFoodVariants = (value = {}) => serializeFoodVariants(value?.variants || value?.variations || []).length > 0;

export const getFoodDisplayPrice = (value = {}) => {
    const variants = serializeFoodVariants(value?.variants || value?.variations || []);
    if (variants.length > 0) {
        return Math.min(...variants.map((entry) => Number(entry.price) || 0));
    }

    const price = Number(value?.price);
    if (Number.isFinite(price) && price > 0) {
        return price;
    }

    return 0;
};

export const getFoodDisplayOtherPrice = (value = {}) => {
    const variants = serializeFoodVariants(value?.variants || value?.variations || []);
    if (variants.length > 0) {
        const validOtherPrices = variants
            .map((entry) => Number(entry.otherPrice) || 0)
            .filter((p) => p > 0);

        return validOtherPrices.length > 0 ? Math.min(...validOtherPrices) : 0;
    }

    const otherPrice = Number(value?.otherPrice);
    if (Number.isFinite(otherPrice) && otherPrice > 0) {
        return otherPrice;
    }

    return 0;
};
