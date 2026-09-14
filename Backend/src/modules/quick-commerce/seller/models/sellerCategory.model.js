import mongoose from "mongoose";

const sellerCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "quick_category",
      default: null,
    },
    depth: {
      type: Number,
      required: true,
      min: 0,
      max: 2,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    collection: 'quick_categories',
    timestamps: true,
  },
);

sellerCategorySchema.index({ key: 1 }, { unique: true });
sellerCategorySchema.index({ parentId: 1, sortOrder: 1, name: 1 });

export const SellerCategory = mongoose.model(
  "SellerCategory",
  sellerCategorySchema,
);
