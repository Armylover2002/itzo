import mongoose from "mongoose";

const sellerVariantSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    price: { type: Number, min: 0, default: 0 },
    salePrice: { type: Number, min: 0, default: 0 },
    stock: { type: Number, min: 0, default: 0 },
    sku: { type: String, trim: true, default: "" },
    // Pharmacy-only optional metadata (ignored for non-pharmacy sellers).
    strength: { type: String, trim: true, default: "" },
    packType: { type: String, trim: true, default: "" },
    packQuantity: { type: Number, min: 0, default: 0 },
    unit: { type: String, trim: true, default: "" },
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
    unit: {
      type: String,
      trim: true,
      default: "",
    },
    stock: {
      type: Number,
      min: 0,
      default: 0,
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
    weight: {
      type: String,
      trim: true,
      default: "",
    },
    tags: {
      type: [String],
      default: [],
    },
    image: {
      type: String,
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
      index: true,
    },
    // Keep in sync with QuickProduct so public catalog / admin filters work.
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    /**
     * Same collection as QuickProduct, so this mirrors the cascade stamp written when a
     * category is deactivated (see categoryCascade.service.js).
     */
    deactivatedByParentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "quick_category",
      default: null,
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
      index: true,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    variants: {
      type: [sellerVariantSchema],
      default: [],
    },
    // Pharmacy-only metadata. Stored for pharmacy sellers; ignored for others.
    pharmacyDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    packingFee: {
      type: Number,
      min: 0,
      default: 0,
    },
    clientRequestId: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    collection: 'quick_products',
    timestamps: true,
  },
);

sellerProductSchema.index({ sellerId: 1, createdAt: -1 });
sellerProductSchema.index({ sellerId: 1, slug: 1 }, { unique: true });
sellerProductSchema.index({ sellerId: 1, sku: 1 }, { unique: true, sparse: true });
sellerProductSchema.index(
  { sellerId: 1, clientRequestId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientRequestId: { $type: "string", $gt: "" } },
  },
);
sellerProductSchema.index({ sellerId: 1, stock: 1, status: 1 });
sellerProductSchema.index({ sellerId: 1, categoryId: 1, subcategoryId: 1 });

export const SellerProduct = mongoose.model(
  "SellerProduct",
  sellerProductSchema,
);
