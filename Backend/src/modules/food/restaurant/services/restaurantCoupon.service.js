import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { RestaurantCoupon } from '../../admin/models/restaurantCoupon.model.js';
import { FoodOffer } from '../../admin/models/offer.model.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { normalizeDiscountType } from '../../shared/coupon.util.js';
import {
    COUPON_OWNER_TYPES,
    claimCouponCodeReservation,
    releaseCouponCodeReservation
} from '../../shared/couponCodeRegistry.util.js';

function startOfDay(date) {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function normalizeRestaurantCouponPayload(body, existingCoupon = null) {
    const couponCode = String(body?.couponCode || '').trim().toUpperCase();
    if (!couponCode) throw new ValidationError('Coupon code is required');

    const discountType = normalizeDiscountType(body?.discountType);
    const discountValue = Number(body?.discountValue);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
        throw new ValidationError('Discount value must be greater than 0');
    }
    if (discountType === 'percentage' && discountValue > 100) {
        throw new ValidationError('Percentage discount cannot exceed 100');
    }

    const customerScope = body?.customerScope === 'first-time' ? 'first-time' : 'all';
    const minOrderValue = Math.max(0, Number(body?.minOrderValue ?? body?.minOrderAmount ?? 0) || 0);

    const maxDiscountRaw = body?.maxDiscount;
    const maxDiscount = maxDiscountRaw === '' || maxDiscountRaw == null
        ? null
        : Number(maxDiscountRaw);
    if (discountType === 'percentage' && (!Number.isFinite(maxDiscount) || maxDiscount <= 0)) {
        throw new ValidationError('Max discount is required for percentage coupons');
    }

    const startDate = body?.startDate ? new Date(body.startDate) : null;
    if (startDate && Number.isNaN(startDate.getTime())) {
        throw new ValidationError('Invalid start date');
    }

    const endDateRaw = body?.endDate || body?.expiryDate;
    let endDate = endDateRaw ? new Date(endDateRaw) : null;
    if (!endDate || Number.isNaN(endDate.getTime())) {
        throw new ValidationError('A valid end date is required');
    }
    if (endDate.getUTCHours() === 0 && endDate.getUTCMinutes() === 0) {
        endDate.setUTCHours(23, 59, 59, 999);
    }

    const now = new Date();
    const todayStart = startOfDay(now);
    const endDay = startOfDay(endDate);
    if (endDay < todayStart) {
        throw new ValidationError('End date cannot be in the past');
    }
    if (startDate) {
        const startDay = startOfDay(startDate);
        const existingStart = existingCoupon?.startDate
            ? startOfDay(existingCoupon.startDate)
            : null;
        if (startDay < todayStart && startDay.getTime() !== existingStart?.getTime()) {
            throw new ValidationError('Start date cannot be in the past');
        }
    }
    if (startDate && startDate > endDate) {
        throw new ValidationError('Start date must be before end date');
    }

    const usageLimit = body?.usageLimit === '' || body?.usageLimit == null
        ? null
        : Number(body.usageLimit);
    if (usageLimit != null && (!Number.isFinite(usageLimit) || usageLimit < 1)) {
        throw new ValidationError('Usage limit must be at least 1');
    }

    const perUserLimit = body?.perUserLimit === '' || body?.perUserLimit == null
        ? null
        : Number(body.perUserLimit);
    if (perUserLimit != null && (!Number.isFinite(perUserLimit) || perUserLimit < 1)) {
        throw new ValidationError('Per user limit must be at least 1');
    }

    return {
        couponCode,
        discountType,
        discountValue,
        customerScope,
        minOrderValue,
        minOrderAmount: minOrderValue,
        maxDiscount: discountType === 'percentage' ? maxDiscount : null,
        startDate: startDate || undefined,
        endDate,
        expiryDate: endDate,
        usageLimit,
        perUserLimit,
        isFirstOrderOnly: Boolean(body?.isFirstOrderOnly),
        description: String(body?.description || '').trim(),
        showInCart: body?.showInCart !== false,
    };
}

async function assertUniqueCouponCode(couponCode, excludeId = null) {
    const offerExists = await FoodOffer.findOne({ couponCode }).select('_id').lean();
    if (offerExists) {
        throw new ValidationError('This coupon code is already used by a platform offer');
    }

    const filter = { couponCode };
    if (excludeId) filter._id = { $ne: new mongoose.Types.ObjectId(String(excludeId)) };
    const duplicate = await RestaurantCoupon.findOne(filter).select('_id restaurantId').lean();
    if (duplicate) {
        throw new ValidationError('A coupon with this code already exists');
    }
}

export async function listRestaurantCoupons(restaurantId) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    const filter = {
        restaurantId: new mongoose.Types.ObjectId(String(restaurantId))
    };
    return RestaurantCoupon.find(filter).sort({ createdAt: -1 }).lean();
}

export async function createRestaurantCoupon(restaurantId, body) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    const rid = new mongoose.Types.ObjectId(String(restaurantId));
    const payload = normalizeRestaurantCouponPayload(body);

    const existing = await RestaurantCoupon.findOne({
        restaurantId: rid,
        couponCode: payload.couponCode,
    }).select('_id').lean();
    if (existing) {
        throw new ValidationError('A coupon with this code already exists for your restaurant');
    }
    await assertUniqueCouponCode(payload.couponCode);

    const restaurant = await FoodRestaurant.findById(rid).select('restaurantName').lean();
    if (!restaurant) throw new ValidationError('Restaurant not found');

    const doc = await RestaurantCoupon.create({
        restaurantId: rid,
        restaurantName: restaurant.restaurantName || 'Unknown Restaurant',
        ...payload,
        status: 'Pending',
    });

    try {
        await claimCouponCodeReservation({
            ownerType: COUPON_OWNER_TYPES.RESTAURANT_COUPON,
            ownerId: doc._id,
            couponCode: doc.couponCode,
        });
    } catch (error) {
        await RestaurantCoupon.findByIdAndDelete(doc._id);
        if (error?.code === 11000) {
            throw new ValidationError('A coupon with this code already exists');
        }
        throw error;
    }

    try {
        const { invalidateCache } = await import('../../../../middleware/cache.js');
        await invalidateCache('offers*');
    } catch (err) {
        console.error('Failed to invalidate offers cache on create:', err);
    }

    return doc.toObject();
}

export async function updateRestaurantCoupon(restaurantId, couponId, body) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    if (!couponId || !mongoose.Types.ObjectId.isValid(String(couponId))) {
        throw new ValidationError('Invalid coupon id');
    }
    const rid = new mongoose.Types.ObjectId(String(restaurantId));
    const cid = new mongoose.Types.ObjectId(String(couponId));

    const existingCoupon = await RestaurantCoupon.findOne({ _id: cid, restaurantId: rid }).lean();
    if (!existingCoupon) {
        throw new ValidationError('Coupon not found');
    }
    const restoreCouponState = {
        couponCode: existingCoupon.couponCode,
        discountType: existingCoupon.discountType,
        discountValue: existingCoupon.discountValue,
        customerScope: existingCoupon.customerScope,
        minOrderValue: existingCoupon.minOrderValue ?? existingCoupon.minOrderAmount ?? 0,
        minOrderAmount: existingCoupon.minOrderValue ?? existingCoupon.minOrderAmount ?? 0,
        maxDiscount: existingCoupon.maxDiscount ?? null,
        startDate: existingCoupon.startDate ?? null,
        endDate: existingCoupon.endDate ?? null,
        expiryDate: existingCoupon.expiryDate ?? existingCoupon.endDate ?? null,
        usageLimit: existingCoupon.usageLimit ?? null,
        perUserLimit: existingCoupon.perUserLimit ?? null,
        isFirstOrderOnly: Boolean(existingCoupon.isFirstOrderOnly),
        description: existingCoupon.description || '',
        showInCart: existingCoupon.showInCart !== false,
        status: existingCoupon.status,
    };

    const payload = normalizeRestaurantCouponPayload(body, existingCoupon);
    if (payload.couponCode !== existingCoupon.couponCode) {
        await assertUniqueCouponCode(payload.couponCode, cid);
    }

    const updated = await RestaurantCoupon.findOneAndUpdate(
        { _id: cid, restaurantId: rid },
        {
            $set: {
                ...payload,
                status: 'Pending',
            }
        },
        { new: true }
    ).lean();

    try {
        await claimCouponCodeReservation({
            ownerType: COUPON_OWNER_TYPES.RESTAURANT_COUPON,
            ownerId: cid,
            couponCode: payload.couponCode,
        });
    } catch (error) {
        await RestaurantCoupon.findOneAndUpdate(
            { _id: cid, restaurantId: rid },
            { $set: restoreCouponState },
            { new: true }
        );
        if (error?.code === 11000) {
            throw new ValidationError('A coupon with this code already exists');
        }
        throw error;
    }

    try {
        const { invalidateCache } = await import('../../../../middleware/cache.js');
        await invalidateCache('offers*');
    } catch (err) {
        console.error('Failed to invalidate offers cache on update:', err);
    }

    return updated;
}

export async function deleteRestaurantCoupon(restaurantId, couponId) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    if (!couponId || !mongoose.Types.ObjectId.isValid(String(couponId))) {
        throw new ValidationError('Invalid coupon id');
    }
    const rid = new mongoose.Types.ObjectId(String(restaurantId));
    const cid = new mongoose.Types.ObjectId(String(couponId));

    const result = await RestaurantCoupon.findOneAndDelete({ _id: cid, restaurantId: rid }).lean();
    if (!result) {
        throw new ValidationError('Coupon not found');
    }

    try {
        const { RestaurantCouponUsage } = await import('../../admin/models/restaurantCouponUsage.model.js');
        await RestaurantCouponUsage.deleteMany({ couponId: cid });
        await releaseCouponCodeReservation({
            ownerType: COUPON_OWNER_TYPES.RESTAURANT_COUPON,
            ownerId: cid,
        });
    } catch {
        // non-fatal
    }

    try {
        const { invalidateCache } = await import('../../../../middleware/cache.js');
        await invalidateCache('offers*');
    } catch (err) {
        console.error('Failed to invalidate offers cache on delete:', err);
    }

    return { id: cid };
}
