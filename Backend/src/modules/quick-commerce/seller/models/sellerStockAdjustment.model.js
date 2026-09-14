import mongoose from "mongoose";

const sellerStockAdjustmentSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SellerProduct",
      required: true,
      index: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    variantName: {
      type: String,
      trim: true,
      default: "",
    },
    type: {
      type: String,
      enum: ["Restock", "Correction", "Remove", "Sale"],
      default: "Correction",
    },
    quantity: {
      type: Number,
      required: true,
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    collection: 'quick_seller_stock_adjustments',
    timestamps: true,
  },
);

sellerStockAdjustmentSchema.index({ sellerId: 1, createdAt: -1 });

export const SellerStockAdjustment = mongoose.model(
  "SellerStockAdjustment",
  sellerStockAdjustmentSchema,
);
