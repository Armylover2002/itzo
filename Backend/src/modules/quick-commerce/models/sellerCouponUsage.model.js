import mongoose from 'mongoose';

const sellerCouponUsageSchema = new mongoose.Schema(
  {
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SellerCoupon',
      required: true,
      index: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodUser',
      default: null,
      index: true,
    },
    sessionId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    consumerKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    count: { type: Number, default: 0, min: 0 },
    firstUsedAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { collection: 'quick_seller_coupon_usages', timestamps: true }
);

sellerCouponUsageSchema.index({ couponId: 1, consumerKey: 1 }, { unique: true });

export const SellerCouponUsage = mongoose.model(
  'SellerCouponUsage',
  sellerCouponUsageSchema,
  'quick_seller_coupon_usages',
);
