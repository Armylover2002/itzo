import mongoose from "mongoose";

const sellerOrderSchema = new mongoose.Schema(
  {
    orderType: {
      type: String,
      enum: ["quick", "mixed"],
      default: "quick",
      index: true,
    },
    parentOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FoodOrder",
      default: null,
      index: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true,
    },
    orderId: {
      type: String,
      required: true,
      trim: true,
    },
    customer: {
      name: { type: String, trim: true, default: "Customer" },
      phone: { type: String, trim: true, default: "" },
    },
    items: {
      type: [
        new mongoose.Schema(
          {
            productId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "SellerProduct",
              default: null,
            },
            name: { type: String, trim: true, default: "" },
            price: { type: Number, min: 0, default: 0 },
            quantity: { type: Number, min: 1, default: 1 },
            image: { type: String, default: "" },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    pricing: {
      subtotal: { type: Number, min: 0, default: 0 },
      commission: { type: Number, min: 0, default: 0 },
      total: { type: Number, min: 0, default: 0 },
      /** Portion of the delivery fee this seller absorbed under a SELLER_FULL/SPLIT sponsor rule. */
      deliveryFeeBorne: { type: Number, min: 0, default: 0 },
      /** Net amount payable to seller for this order leg (subtotal - commission - deliveryFeeBorne). */
      receivable: { type: Number, min: 0, default: 0 },
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "packed",
        "ready_for_pickup",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    workflowStatus: {
      type: String,
      default: "SELLER_PENDING",
    },
    deliveredAt: {
      type: Date,
      default: null,
      index: true,
    },
    workflowVersion: {
      type: Number,
      default: 1,
    },
    sellerPendingExpiresAt: {
      type: Date,
      default: null,
    },
    address: {
      address: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      location: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    },
    payment: {
      method: {
        type: String,
        enum: ["cash", "cod", "online", "wallet"],
        default: "online",
      },
    },
  },
  {
    collection: 'quick_seller_orders',
    timestamps: true,
  },
);

sellerOrderSchema.index({ sellerId: 1, createdAt: -1 });
sellerOrderSchema.index({ sellerId: 1, orderType: 1, createdAt: -1 });
sellerOrderSchema.index({ sellerId: 1, orderId: 1 }, { unique: true });

export const SellerOrder = mongoose.model('SellerOrder', sellerOrderSchema, 'quick_seller_orders');
