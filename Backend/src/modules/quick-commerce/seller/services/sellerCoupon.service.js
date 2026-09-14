import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { SellerCoupon } from '../../models/sellerCoupon.model.js';
import { SellerCouponUsage } from '../../models/sellerCouponUsage.model.js';
import { Seller } from '../models/seller.model.js';
import { validateAndNormalizeQuickCouponPayload } from '../../utils/couponValidation.helpers.js';

export async function listSellerCoupons(sellerId) {
    if (!sellerId || !mongoose.Types.ObjectId.isValid(String(sellerId))) {
        throw new ValidationError('Invalid seller id');
    }
    const filter = {
        sellerId: new mongoose.Types.ObjectId(String(sellerId))
    };
    return SellerCoupon.find(filter).sort({ createdAt: -1 }).lean();
}

export async function createSellerCoupon(sellerId, body) {
    if (!sellerId || !mongoose.Types.ObjectId.isValid(String(sellerId))) {
        throw new ValidationError('Invalid seller id');
    }
    const sid = new mongoose.Types.ObjectId(String(sellerId));
    const payload = validateAndNormalizeQuickCouponPayload(body);

    const existing = await SellerCoupon.findOne({
        sellerId: sid,
        code: payload.code,
    }).select('_id').lean();

    if (existing) {
        throw new ValidationError('A coupon with this code already exists for your shop');
    }

    const seller = await Seller.findById(sid).select('name shopName').lean();
    if (!seller) throw new ValidationError('Seller not found');

    let doc;
    try {
        doc = await SellerCoupon.create({
            sellerId: sid,
            sellerName: seller.shopName || seller.name || 'Unknown Seller',
            ...payload,
            status: 'Pending',
            isActive: true,
        });
    } catch (err) {
        if (err?.code === 11000) {
            throw new ValidationError('A coupon with this code already exists for your shop');
        }
        throw err;
    }

    try {
        const { invalidateCache } = await import('../../../../middleware/cache.js');
        await invalidateCache('quick_coupons*');
        await invalidateCache('quick_offers*');
    } catch (err) {
        console.error('Failed to invalidate quick coupons cache on create:', err);
    }

    return doc.toObject();
}

export async function updateSellerCoupon(sellerId, couponId, body) {
    if (!sellerId || !mongoose.Types.ObjectId.isValid(String(sellerId))) {
        throw new ValidationError('Invalid seller id');
    }
    if (!couponId || !mongoose.Types.ObjectId.isValid(String(couponId))) {
        throw new ValidationError('Invalid coupon id');
    }
    const sid = new mongoose.Types.ObjectId(String(sellerId));
    const cid = new mongoose.Types.ObjectId(String(couponId));

    const existingCoupon = await SellerCoupon.findOne({ _id: cid, sellerId: sid }).lean();
    if (!existingCoupon) {
        throw new ValidationError('Coupon not found');
    }

    const payload = validateAndNormalizeQuickCouponPayload(body);

    const duplicate = await SellerCoupon.findOne({
        sellerId: sid,
        code: payload.code,
        _id: { $ne: cid },
    }).select('_id').lean();

    if (duplicate) {
        throw new ValidationError('A coupon with this code already exists for your shop');
    }

    // Keep Approved coupons live for users after edits. Only Rejected/new drafts go to Pending.
    const previousStatus = String(existingCoupon.status || '').trim();
    const nextStatus =
        previousStatus === 'Approved'
            ? 'Approved'
            : previousStatus === 'Rejected'
                ? 'Pending'
                : previousStatus || 'Pending';

    let updated;
    try {
        updated = await SellerCoupon.findOneAndUpdate(
            { _id: cid, sellerId: sid },
            {
                $set: {
                    ...payload,
                    status: nextStatus,
                    // Preserve admin deactivation; approved live coupons stay active unless already off.
                    ...(existingCoupon.isActive === false ? { isActive: false } : {}),
                },
            },
            { new: true },
        ).lean();
    } catch (err) {
        if (err?.code === 11000) {
            throw new ValidationError('A coupon with this code already exists for your shop');
        }
        throw err;
    }

    try {
        const { invalidateCache } = await import('../../../../middleware/cache.js');
        await invalidateCache('quick_coupons*');
        await invalidateCache('quick_offers*');
    } catch (err) {
        console.error('Failed to invalidate quick coupons cache on update:', err);
    }

    return updated;
}

export async function deleteSellerCoupon(sellerId, couponId) {
    if (!sellerId || !mongoose.Types.ObjectId.isValid(String(sellerId))) {
        throw new ValidationError('Invalid seller id');
    }
    if (!couponId || !mongoose.Types.ObjectId.isValid(String(couponId))) {
        throw new ValidationError('Invalid coupon id');
    }
    const sid = new mongoose.Types.ObjectId(String(sellerId));
    const cid = new mongoose.Types.ObjectId(String(couponId));

    const result = await SellerCoupon.findOne({ _id: cid, sellerId: sid }).lean();
    if (!result) {
      throw new ValidationError('Coupon not found');
    }

    const usageCount = await SellerCouponUsage.countDocuments({ couponId: cid });
    const isLiveCoupon = String(result.status || '').trim() === 'Approved' || Boolean(result.isActive) || Number(result.usedCount || 0) > 0 || usageCount > 0;

    if (isLiveCoupon) {
        const deactivated = await SellerCoupon.findOneAndUpdate(
            { _id: cid, sellerId: sid },
            { $set: { isActive: false } },
            { new: true }
        ).lean();

        if (!deactivated) {
            throw new ValidationError('Coupon not found');
        }

        try {
            const { invalidateCache } = await import('../../../../middleware/cache.js');
            await invalidateCache('quick_coupons*');
            await invalidateCache('quick_offers*');
        } catch (err) {
            console.error('Failed to invalidate quick coupons cache on delete:', err);
        }

        return { id: cid, deactivated: true };
    }

    const deleted = await SellerCoupon.findOneAndDelete({ _id: cid, sellerId: sid }).lean();
    if (!deleted) {
      throw new ValidationError('Coupon not found');
    }

    try {
        const { invalidateCache } = await import('../../../../middleware/cache.js');
        await invalidateCache('quick_coupons*');
        await invalidateCache('quick_offers*');
    } catch (err) {
        console.error('Failed to invalidate quick coupons cache on delete:', err);
    }

    return { id: cid };
}
