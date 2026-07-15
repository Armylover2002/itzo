import mongoose from 'mongoose';
import { MASTER_STATUS_VALUES, ITEM_APPROVAL_VALUES } from '../constants/returnStateMachine.js';

// ─── Sub-Schemas ────────────────────────────────────────────────────────────

const returnItemApprovalSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ITEM_APPROVAL_VALUES,
      default: 'pending',
    },
    approvedQty: { type: Number, default: 0, min: 0 },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodAdmin',
      default: null,
    },
    decidedAt: { type: Date, default: null },
    note: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const returnItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    name: { type: String, required: true, trim: true },
    image: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    orderedQuantity: { type: Number, required: true, min: 1 },
    reason: { type: String, default: '', trim: true },
    approval: {
      type: returnItemApprovalSchema,
      default: () => ({}),
    },
  },
  { _id: false },
);

const returnRefundSchema = new mongoose.Schema(
  {
    estimatedAmount: { type: Number, default: 0, min: 0 },
    approvedAmount: { type: Number, default: 0, min: 0 },
    actualAmount: { type: Number, default: 0, min: 0 },
    method: {
      type: String,
      enum: ['gateway', 'manual'],
      default: 'gateway',
    },
    originalPaymentMethod: {
      type: String,
      enum: ['cash', 'razorpay', 'razorpay_qr', 'wallet'],
      default: 'cash',
    },
    razorpayRefundId: { type: String, default: '' },
    status: {
      type: String,
      enum: ['none', 'pending', 'processing', 'completed', 'failed'],
      default: 'none',
    },
    processedAt: { type: Date, default: null },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodAdmin',
      default: null,
    },
    failureReason: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const cancelledBySchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['USER', 'ADMIN', 'SYSTEM'], default: 'USER' },
    id: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { _id: false },
);

// ─── Main Schema ────────────────────────────────────────────────────────────

const returnRequestSchema = new mongoose.Schema(
  {
    returnId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    orderId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    orderMongoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodOrder',
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodUser',
      required: true,
      index: true,
    },

    // ─── Items ───
    items: {
      type: [returnItemSchema],
      required: true,
      validate: (v) => Array.isArray(v) && v.length > 0,
    },

    // ─── Evidence ───
    reason: {
      type: String,
      required: true,
      trim: true,
    },

    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },

    images: {
      type: [String],
      default: [],
      validate: {
        validator: (v) => Array.isArray(v) && v.length <= 10,
        message: 'Maximum 10 images allowed.',
      },
    },

    // ─── Master Status ───
    status: {
      type: String,
      enum: MASTER_STATUS_VALUES,
      default: 'RETURN_REQUESTED',
      index: true,
    },

    // ─── Seller Legs ───
    sellerLegIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'SellerReturn',
      default: [],
    },

    // ─── Refund ───
    refund: {
      type: returnRefundSchema,
      default: () => ({}),
    },

    // ─── Config Snapshot ───
    returnWindowDays: {
      type: Number,
      default: 7,
      min: 1,
    },

    // ─── Lifecycle Timestamps ───
    requestedAt: { type: Date, default: Date.now },
    reviewStartedAt: { type: Date, default: null },
    reviewCompletedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: {
      type: cancelledBySchema,
      default: undefined,
    },
    cancellationReason: { type: String, default: '', trim: true },
  },
  {
    collection: 'quick_return_requests',
    timestamps: true,
  },
);

// ─── Indexes ────────────────────────────────────────────────────────────────

returnRequestSchema.index({ userId: 1, createdAt: -1 });
returnRequestSchema.index({ status: 1, createdAt: -1 });
returnRequestSchema.index({ orderId: 1, status: 1 });
returnRequestSchema.index({ 'items.productId': 1, orderId: 1, status: 1 });

export const ReturnRequest = mongoose.model(
  'ReturnRequest',
  returnRequestSchema,
  'quick_return_requests',
);
