import mongoose from 'mongoose';

const sellerCouponSchema = new mongoose.Schema(
    {
        sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
        sellerName: { type: String, required: true },
        code: { type: String, required: true, trim: true, uppercase: true, index: true },
        discountType: { type: String, enum: ['percentage', 'fixed', 'free_delivery'], required: true },
        couponType: { type: String, enum: ['generic', 'min_order_value', 'free_delivery'], default: 'generic' },
        discountValue: { type: Number, required: true, min: 0 },
        minOrderValue: { type: Number, default: 0, min: 0 },
        maxDiscount: { type: Number, min: 0 },
        validFrom: { type: Date, required: true },
        validTill: { type: Date, required: true },
        usageLimit: { type: Number, default: null, min: 0 },
        perUserLimit: { type: Number, default: 1, min: 1 },
        usedCount: { type: Number, default: 0, min: 0 },
        firstOrderOnly: { type: Boolean, default: false },
        description: { type: String },
        status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending', index: true },
        isActive: { type: Boolean, default: true } // admin can deactivate approved coupons
    },
    { collection: 'quick_seller_coupons', timestamps: true }
);

// Coupon apply / duplicate-check look up by sellerId + code.
sellerCouponSchema.index({ sellerId: 1, code: 1 }, { unique: true });
// Public coupon listing filters by sellerId + status + active expiry window.
sellerCouponSchema.index({ sellerId: 1, status: 1, validTill: 1 });

export const SellerCoupon = mongoose.model('SellerCoupon', sellerCouponSchema, 'quick_seller_coupons');
