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

export const SellerTransaction = mongoose.model(
  "SellerTransaction",
  sellerTransactionSchema,
);
