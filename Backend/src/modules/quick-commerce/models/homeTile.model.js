import mongoose from 'mongoose';

const quickHomeTileSchema = new mongoose.Schema(
  {
    sectionType: {
      type: String,
      enum: ['fast_fav', 'more'],
      required: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
      default: '',
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    targetPath: {
      type: String,
      trim: true,
      default: '',
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    collection: 'quick_home_tiles',
    timestamps: true,
  },
);

quickHomeTileSchema.index({ sectionType: 1, status: 1, sortOrder: 1 });

export const QuickHomeTile = mongoose.model(
  'quick_home_tile',
  quickHomeTileSchema,
  'quick_home_tiles',
);
