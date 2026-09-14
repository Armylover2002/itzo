import mongoose from 'mongoose';

const deliveryFeeRangeSchema = new mongoose.Schema(
  {
    min: { type: Number, required: true, min: 0 },
    max: { type: Number, required: true, min: 0 },
    fee: { type: Number, required: true, min: 0 },
    deliveryBoyPerKm: { type: Number, min: 0, default: 0 },
    deliveryBoyBasePay: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
);

const quickFeeSettingsSchema = new mongoose.Schema(
  {
    deliveryFee: { type: Number, min: 0 },
    deliveryFeeRanges: { type: [deliveryFeeRangeSchema], default: [] },
    freeDeliveryThreshold: { type: Number, min: 0, default: 0 },
    platformFee: { type: Number, min: 0, default: 0 },

    returnDeliveryCommission: { type: Number, min: 0, default: 0 },
    returnPickupFee: { type: Number, min: 0, default: 0 },
    /** @deprecated Customer returns now live on header categories. Kept for old documents. */
    returnWindowHours: { type: Number, min: 1, default: 72 },
    /** @deprecated Customer returns now live on header categories. Kept for old documents. */
    returnsEnabled: { type: Boolean, default: true },
    /** Seller withdrawal request amount limits (₹). 0 max = no upper cap. */
    minWithdrawalAmount: { type: Number, min: 0, default: 0 },
    maxWithdrawalAmount: { type: Number, min: 0, default: 0 },
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
