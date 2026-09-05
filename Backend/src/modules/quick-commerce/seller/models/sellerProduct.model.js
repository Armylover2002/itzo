import mongoose from "mongoose";

const sellerVariantSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    costPrice: { type: Number, min: 0, default: 0 },
    price: { type: Number, min: 0, default: 0 },
    salePrice: { type: Number, min: 0, default: 0 },
    stock: { type: Number, min: 0, default: 0 },
    sku: { type: String, trim: true, default: "" },
    images: { type: [String], default: [] },
  },
  { _id: true },
);

const sellerProductSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true,
    },
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
    sku: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    costPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    mrp: {
      type: Number,
      min: 0,
      default: 0,
    },
    salePrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    stock: {
      type: Number,
      min: 0,
      default: 0,
    },
    image: {
      type: String,
      default: "",
    },
    lowStockAlert: {
      type: Number,
      min: 0,
      default: 5,
    },
    brand: {
      type: String,
      trim: true,
      default: "",
    },
    mainImage: {
      type: String,
      default: "",
    },
    galleryImages: {
      type: [String],
      default: [],
    },
    headerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "quick_category",
      default: null,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "quick_category",
      required: true,
    },
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "quick_category",
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    variants: {
      type: [sellerVariantSchema],
      default: [],
    },
  },
  {
    collection: 'quick_products',
    timestamps: true,
  },
);

sellerProductSchema.index({ sellerId: 1, createdAt: -1 });
sellerProductSchema.index({ sellerId: 1, slug: 1 }, { unique: true });
sellerProductSchema.index({ sellerId: 1, sku: 1 }, { sparse: true });
sellerProductSchema.index({ sellerId: 1, stock: 1, status: 1 });
sellerProductSchema.index({ sellerId: 1, categoryId: 1, subcategoryId: 1 });

export const SellerProduct = mongoose.model(
  "SellerProduct",
  sellerProductSchema,
);
