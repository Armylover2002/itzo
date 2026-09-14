import { ValidationError } from '../../../core/auth/errors.js';
import { CouponCodeRegistry } from '../admin/models/couponCodeRegistry.model.js';

export const COUPON_OWNER_TYPES = {
    PLATFORM_OFFER: 'platform-offer',
    RESTAURANT_COUPON: 'restaurant-coupon',
};

export function normalizeCouponCode(value) {
    return String(value || '').trim().toUpperCase();
}

export async function claimCouponCodeReservation({ session, ownerType, ownerId, couponCode }) {
    const normalizedCode = normalizeCouponCode(couponCode);
    if (!normalizedCode) {
        throw new ValidationError('Coupon code is required');
    }
    if (!ownerType) {
        throw new ValidationError('Coupon owner type is required');
    }
    if (!ownerId) {
        throw new ValidationError('Coupon owner id is required');
    }

    return CouponCodeRegistry.findOneAndUpdate(
        { ownerType, ownerId: String(ownerId) },
        {
            $set: {
                ownerType,
                ownerId: String(ownerId),
                couponCode: normalizedCode,
            },
        },
        {
            upsert: true,
            new: true,
            runValidators: true,
            setDefaultsOnInsert: true,
            session,
        }
    );
}

export async function releaseCouponCodeReservation({ session, ownerType, ownerId }) {
    if (!ownerType || !ownerId) return;
    await CouponCodeRegistry.deleteOne({ ownerType, ownerId: String(ownerId) }).session(session);
}
