import mongoose from 'mongoose';

const quickBannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      default: '',
      trim: true,
    },
    image: {
      type: String,
      required: true,
      trim: true,
    },
    targetZoneType: {
      type: String,
      enum: ['all', 'specific'],
      default: 'all',
      index: true,
    },
    zoneIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'quick_zone',
      },
    ],
    targetCategoryType: {
      type: String,
      enum: ['all', 'specific'],
      default: 'all',
      index: true,
    },
    headerCategoryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'quick_category',
      },
    ],
    isAlwaysActive: {
      type: Boolean,
      default: false,
      index: true,
    },
    startDate: {
      type: Date,
      index: true,
    },
    endDate: {
      type: Date,
      index: true,
    },
    linkType: {
      type: String,
      enum: ['none', 'category', 'product', 'external'],
      default: 'none',
    },
    linkValue: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    priority: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  { timestamps: true }
);

quickBannerSchema.index({ status: 1, isAlwaysActive: 1, startDate: 1, endDate: 1, priority: -1 });

export const QuickBanner = mongoose.model('quick_banner', quickBannerSchema);
