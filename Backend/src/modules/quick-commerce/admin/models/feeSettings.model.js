import mongoose from 'mongoose';

const deliveryFeeRangeSchema = new mongoose.Schema(
  {
    min: { type: Number, required: true, min: 0 },
    max: { type: Number, required: true, min: 0 },
    fee: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const quickFeeSettingsSchema = new mongoose.Schema(
  {
    deliveryFee: { type: Number, min: 0 },
    deliveryFeeRanges: { type: [deliveryFeeRangeSchema], default: [] },
    freeDeliveryThreshold: { type: Number, min: 0 },
    platformFee: { type: Number, min: 0 },
    gstRate: { type: Number, min: 0, max: 100 },
    returnDeliveryCommission: { type: Number, min: 0, default: 0 },
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
