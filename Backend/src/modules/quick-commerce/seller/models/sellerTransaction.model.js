import mongoose from "mongoose";

const sellerTransactionSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["Order Payment", "Withdrawal", "Adjustment", "Refund"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Processing", "Settled", "Rejected"],
      default: "Pending",
    },
    reference: {
      type: String,
      trim: true,
      default: "",
    },
    orderId: {
      type: String,
      trim: true,
      default: "",
    },
    customer: {
      type: String,
      trim: true,
      default: "",
    },
    paymentMethod: {
      type: String,
      enum: ["bank_transfer", "upi", "qr", ""],
      default: "",
    },
    bankDetails: {
      bankName: { type: String, trim: true, default: "" },
      accountHolderName: { type: String, trim: true, default: "" },
      accountNumber: { type: String, trim: true, default: "" },
      accountNumberLast4: { type: String, trim: true, default: "" },
      ifscCode: { type: String, trim: true, uppercase: true, default: "" },
      upiId: { type: String, trim: true, default: "" },
      qrCodeImage: { type: String, trim: true, default: "" },
    },
    adminNote: {
      type: String,
      trim: true,
      default: "",
    },
    processedAt: {
      type: Date,
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    collection: 'quick_seller_transactions',
    timestamps: true,
  },
);

sellerTransactionSchema.index({ sellerId: 1, createdAt: -1 });

/**
 * Order earnings are credited with an upsert keyed on (sellerId, type, orderId) from two
 * different delivery paths. Without a unique index that "idempotent" upsert is only
 * idempotent when the calls are serialised — two concurrent ones both match nothing and
 * both insert, double-crediting the seller.
 *
 * Partial so it constrains only order-linked earnings: withdrawals and adjustments have
 * no orderId and may legitimately repeat for the same seller.
 *
 * NOTE: the app connects with autoIndex disabled, so this is created by
 * `npm run verify:indexes`, not on boot.
 */
sellerTransactionSchema.index(
  { sellerId: 1, type: 1, orderId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: 'Order Payment',
      orderId: { $type: 'string' },
    },
  },
);

export const SellerTransaction = mongoose.model(
  "SellerTransaction",
  sellerTransactionSchema,
);
