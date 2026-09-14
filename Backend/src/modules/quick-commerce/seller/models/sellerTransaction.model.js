import mongoose from 'mongoose';

const financeAuditSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    action: { type: String, trim: true, default: '' },
    beforeBalance: { type: Number, default: 0 },
    afterBalance: { type: Number, default: 0 },
    referenceId: { type: String, trim: true, default: '' },
    actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
    actorRole: { type: String, trim: true, default: 'SYSTEM' },
    reason: { type: String, trim: true, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const sellerTransactionSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'Order Payment',
        'Withdrawal',
        'Adjustment',
        'ORDER_CREDIT',
        'RETURN_REFUND',
        'RETURN_PICKUP_FEE',
        'COMMISSION',
        'SETTLEMENT',
        'MANUAL_ADJUSTMENT',
      ],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'Settled', 'Rejected'],
      default: 'Pending',
    },
    reference: {
      type: String,
      trim: true,
      default: '',
    },
    referenceId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    orderId: {
      type: String,
      trim: true,
      default: '',
    },
    returnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SellerReturn',
      default: null,
      index: true,
    },
    customer: {
      type: String,
      trim: true,
      default: '',
    },
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'upi', ''],
      default: '',
    },
    bankDetails: {
      bankName: { type: String, trim: true, default: '' },
      accountHolderName: { type: String, trim: true, default: '' },
      accountNumberLast4: { type: String, trim: true, default: '' },
      ifscCode: { type: String, trim: true, uppercase: true, default: '' },
      upiId: { type: String, trim: true, default: '' },
      upiQrImage: { type: String, trim: true, default: '' },
    },
    adminNote: {
      type: String,
      trim: true,
      default: '',
    },
    processedAt: {
      type: Date,
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    direction: {
      type: String,
      enum: ['credit', 'debit', ''],
      default: '',
    },
    balanceBefore: {
      type: Number,
      default: null,
    },
    balanceAfter: {
      type: Number,
      default: null,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    actorRole: {
      type: String,
      trim: true,
      default: 'SYSTEM',
    },
    settlementState: {
      type: String,
      enum: ['', 'unsettled', 'settled', 'recovered'],
      default: '',
    },
    financeAudit: {
      type: [financeAuditSchema],
      default: [],
    },
  },
  {
    collection: 'quick_seller_transactions',
    timestamps: true,
  },
);

sellerTransactionSchema.index({ sellerId: 1, createdAt: -1 });
sellerTransactionSchema.index(
  { sellerId: 1, referenceId: 1 },
  { unique: true, partialFilterExpression: { referenceId: { $type: 'string', $ne: '' } } },
);
// Idempotent order-payment upserts/lookups filter by sellerId + type + orderId
// (quickOrder.service.js, sellerLedger.service.js) on the order hot path.
sellerTransactionSchema.index({ sellerId: 1, type: 1, orderId: 1 });
// Admin withdrawal grid + finance aggregations filter by type and sort by createdAt.
sellerTransactionSchema.index({ type: 1, createdAt: -1 });

export const SellerTransaction = mongoose.model(
  'SellerTransaction',
  sellerTransactionSchema,
);
