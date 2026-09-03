import mongoose from 'mongoose';

const quickCouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    title: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    couponType: {
      type: String,
      enum: ['generic', 'user_specific', 'first_order', 'bulk_order', 'min_order_value', 'free_delivery', 'category_based', 'monthly_volume'],
      default: 'generic',
    },
    discountType: {
      type: String,
      enum: ['percentage', 'flat', 'fixed', 'free_delivery'],
      default: 'percentage',
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDiscount: {
      type: Number,
      min: 0,
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    usageLimit: {
      type: Number,
      min: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    perUserLimit: {
      type: Number,
      default: 1,
      min: 1,
    },
    validFrom: {
      type: Date,
    },
    validTill: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      default: null,
    },
    sellerIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller',
      },
    ],
    scope: {
      type: String,
      enum: ['all', 'seller'],
      default: 'all',
    },
  },
  { timestamps: true }
);

// We need to name the collection 'quick_coupons' because 'content.service.js' directly queries it.
export const QuickCoupon = mongoose.model('quick_coupon', quickCouponSchema);
