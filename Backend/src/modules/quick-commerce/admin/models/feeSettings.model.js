import mongoose from 'mongoose';

const deliverySponsorRuleSchema = new mongoose.Schema(
  {
    minOrderAmount: { type: Number, required: true, min: 0 },
    maxOrderAmount: { type: Number, min: 0, default: null },
    maxDistanceKm: { type: Number, required: true, min: 0 },
    sponsorType: {
      type: String,
      enum: ['USER_FULL', 'SELLER_FULL', 'SPLIT'],
      required: true,
    },
    sponsoredKm: { type: Number, min: 0, default: null },
  },
  { _id: false },
);

const quickFeeSettingsSchema = new mongoose.Schema(
  {
    // Legacy alias kept so any flow still reading `deliveryFee` continues to work.
    deliveryFee: { type: Number, min: 0 },
    baseDistanceKm: { type: Number, min: 0 },
    baseDeliveryFee: { type: Number, min: 0 },
    perKmCharge: { type: Number, min: 0 },
    sponsorRules: { type: [deliverySponsorRuleSchema], default: [] },
    platformFee: { type: Number, min: 0 },
    gstRate: { type: Number, min: 0, max: 100 },
    minWithdrawal: { type: Number, min: 0 },
    maxWithdrawal: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { collection: 'quick_fee_settings', timestamps: true },
);

quickFeeSettingsSchema.index({ isActive: 1, createdAt: -1 });

export const QuickFeeSettings = mongoose.model(
  'QuickFeeSettings',
  quickFeeSettingsSchema,
  'quick_fee_settings',
);
