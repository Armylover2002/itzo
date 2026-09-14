import mongoose from 'mongoose';

const returnItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, trim: true, default: '' },
    productId: { type: String, trim: true, default: '' },
    variantId: { type: String, trim: true, default: '' },
    name: { type: String, trim: true, default: '' },
    quantity: { type: Number, min: 1, default: 1 },
    returnedQty: { type: Number, min: 0, default: 0 },
    orderedQty: { type: Number, min: 0, default: 0 },
    remainingQty: { type: Number, min: 0, default: 0 },
    price: { type: Number, min: 0, default: 0 },
    unitPrice: { type: Number, min: 0, default: 0 },
    discountShare: { type: Number, min: 0, default: 0 },
    couponShare: { type: Number, min: 0, default: 0 },
    taxShare: { type: Number, min: 0, default: 0 },
    refundAmount: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
);

const cumulativeReturnItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, trim: true, default: '' },
    productId: { type: String, trim: true, default: '' },
    variantId: { type: String, trim: true, default: '' },
    returnedQty: { type: Number, min: 0, default: 0 },
    refundAmount: { type: Number, min: 0, default: 0 },
    couponShare: { type: Number, min: 0, default: 0 },
    taxShare: { type: Number, min: 0, default: 0 },
    completedAt: { type: Date, default: null },
  },
  { _id: false },
);

const returnDispatchOfferSchema = new mongoose.Schema(
  {
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodDeliveryPartner' },
    at: { type: Date, default: Date.now },
    action: { type: String, enum: ['offered', 'rejected', 'timeout'], default: 'offered' },
  },
  { _id: false },
);

const returnDispatchSchema = new mongoose.Schema(
  {
    modeAtCreation: { type: String, enum: ['auto', 'manual'], default: 'auto' },
    status: {
      type: String,
      enum: ['unassigned', 'assigned', 'accepted', 'rejected', 'cancelled', 'completed'],
      default: 'unassigned',
    },
    deliveryPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodDeliveryPartner',
      default: null,
    },
    assignedAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    dispatchingAt: { type: Date, default: null },
    offeredTo: { type: [returnDispatchOfferSchema], default: [] },
  },
  { _id: false },
);

const returnDeliveryStateSchema = new mongoose.Schema(
  {
    currentPhase: {
      type: String,
      enum: [
        'en_route_to_pickup',
        'at_pickup',
        'en_route_to_delivery',
        'at_drop',
        'completed',
      ],
      default: 'en_route_to_pickup',
    },
    status: { type: String, trim: true, default: '' },
    reachedPickupAt: { type: Date, default: null },
    pickedUpAt: { type: Date, default: null },
    reachedDropAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { _id: false },
);

const pickupImageEntrySchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, required: true },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    uploadedByRole: {
      type: String,
      enum: ['USER', 'SELLER', 'ADMIN', 'DELIVERY_PARTNER', 'SYSTEM'],
      default: 'DELIVERY_PARTNER',
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const returnHistorySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    byRole: {
      type: String,
      enum: ['USER', 'SELLER', 'ADMIN', 'DELIVERY_PARTNER', 'SYSTEM'],
      default: 'SYSTEM',
    },
    byId: { type: mongoose.Schema.Types.ObjectId, default: null },
    action: { type: String, trim: true, default: '' },
    fromStatus: { type: String, trim: true, default: '' },
    toStatus: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const qualityCheckSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'passed', 'failed'],
      default: 'pending',
    },
    notes: { type: String, trim: true, default: '' },
    checkedAt: { type: Date, default: null },
    checkedByRole: {
      type: String,
      enum: ['', 'SELLER', 'ADMIN', 'SYSTEM', 'DELIVERY_PARTNER', 'DELIVERY'],
      default: '',
    },
    checkedById: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { _id: false },
);

const sellerReturnSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
      index: true,
    },
    parentOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodOrder',
      default: null,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodUser',
      default: null,
      index: true,
    },
    orderId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    customer: {
      name: { type: String, trim: true, default: 'Customer' },
      phone: { type: String, trim: true, default: '' },
    },
    returnStatus: {
      type: String,
      enum: [
        'return_requested',
        'return_approved',
        'return_rejected',
        'return_pickup_assigned',
        'return_in_transit',
        'returned',
        'refund_completed',
        'return_cancelled',
      ],
      default: 'return_requested',
    },
    returnReason: {
      type: String,
      trim: true,
      default: '',
    },
    returnRejectedReason: {
      type: String,
      trim: true,
      default: '',
    },
    returnRequestedAt: {
      type: Date,
      default: Date.now,
    },
    returnItems: {
      type: [returnItemSchema],
      default: [],
    },
    cumulativeReturnItems: {
      type: [cumulativeReturnItemSchema],
      default: [],
    },
    pricing: {
      subtotal: { type: Number, min: 0, default: 0 },
      couponShare: { type: Number, min: 0, default: 0 },
      taxShare: { type: Number, min: 0, default: 0 },
      discountShare: { type: Number, min: 0, default: 0 },
      deliveryFeeRefunded: { type: Number, min: 0, default: 0 },
      platformFeeRefunded: { type: Number, min: 0, default: 0 },
      finalRefundAmount: { type: Number, min: 0, default: 0 },
      orderCouponTotal: { type: Number, min: 0, default: 0 },
      orderTaxTotal: { type: Number, min: 0, default: 0 },
      orderPaidTotal: { type: Number, min: 0, default: 0 },
      totalRefundedAmount: { type: Number, min: 0, default: 0 },
      totalCouponRefunded: { type: Number, min: 0, default: 0 },
      totalTaxRefunded: { type: Number, min: 0, default: 0 },
      remainingCouponAmount: { type: Number, min: 0, default: 0 },
      remainingTaxAmount: { type: Number, min: 0, default: 0 },
      remainingRefundableAmount: { type: Number, min: 0, default: 0 },
    },
    returnRefundAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    returnDeliveryCommission: {
      type: Number,
      min: 0,
      default: 0,
    },
    refundMethod: {
      type: String,
      enum: ['wallet', 'upi', 'bank', ''],
      default: '',
    },
    refundStatus: {
      type: String,
      enum: ['none', 'pending', 'processing', 'completed', 'failed'],
      default: 'none',
    },
    refundTransactionId: {
      type: String,
      trim: true,
      default: '',
    },
    refundReference: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    refundAuditLog: {
      type: [
        new mongoose.Schema(
          {
            at: { type: Date, default: Date.now },
            action: { type: String, trim: true, default: '' },
            refundStatus: { type: String, trim: true, default: '' },
            refundMethod: { type: String, trim: true, default: '' },
            amount: { type: Number, min: 0, default: 0 },
            refundTransactionId: { type: String, trim: true, default: '' },
            refundReference: { type: String, trim: true, default: '' },
            actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
            actorRole: { type: String, trim: true, default: 'SYSTEM' },
            note: { type: String, trim: true, default: '' },
            metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    finance: {
      sellerLedgerApplied: { type: Boolean, default: false },
      sellerLedgerAppliedAt: { type: Date, default: null },
      settlementMode: {
        type: String,
        enum: ['', 'pre_settlement', 'post_settlement', 'mixed'],
        default: '',
      },
      preSettlementDeducted: { type: Number, min: 0, default: 0 },
      postSettlementDebited: { type: Number, min: 0, default: 0 },
      pickupFeeDebited: { type: Number, min: 0, default: 0 },
      /** Rider pickup cost charged to admin (not seller) for new returns. */
      adminPickupFeeCharged: { type: Number, min: 0, default: 0 },
      sellerReceivableAdjusted: { type: Boolean, default: false },
      sellerReceivableClawed: { type: Number, min: 0, default: 0 },
      stockRestoredAt: { type: Date, default: null },
    },
    customerOtp: {
      type: String,
      trim: true,
      default: '',
      select: false,
    },
    sellerOtp: {
      type: String,
      trim: true,
      default: '',
      select: false,
    },
    customerOtpExpiresAt: { type: Date, default: null },
    sellerOtpExpiresAt: { type: Date, default: null },
    customerOtpAttempts: { type: Number, min: 0, default: 0 },
    sellerOtpAttempts: { type: Number, min: 0, default: 0 },
    pickupImages: {
      type: [String],
      default: [],
    },
    pickupImageEntries: {
      type: [pickupImageEntrySchema],
      default: [],
    },
    riderEarning: { type: Number, min: 0, default: 0 },
    calculatedPickupCharge: { type: Number, min: 0, default: 0 },
    pickupDistanceKm: { type: Number, min: 0, default: 0 },
    pickupPricingBreakdown: { type: mongoose.Schema.Types.Mixed, default: null },
    sellerInspectionImages: {
      type: [String],
      default: [],
    },
    dispatch: {
      type: returnDispatchSchema,
      default: () => ({}),
    },
    deliveryState: {
      type: returnDeliveryStateSchema,
      default: () => ({}),
    },
    returnHistory: {
      type: [returnHistorySchema],
      default: [],
    },
    qualityCheck: {
      type: qualityCheckSchema,
      default: () => ({}),
    },
  },
  {
    collection: 'quick_seller_returns',
    timestamps: true,
  },
);

sellerReturnSchema.index({ sellerId: 1, returnRequestedAt: -1 });
// ONE ORDER = ONE SELLERRETURN — at most one return document per seller+order pair.
sellerReturnSchema.index({ sellerId: 1, orderId: 1 }, { unique: true });
sellerReturnSchema.index({ orderId: 1, userId: 1, returnStatus: 1 });
sellerReturnSchema.index({ 'dispatch.deliveryPartnerId': 1, returnStatus: 1 });
sellerReturnSchema.index({ 'dispatch.status': 1, returnStatus: 1 });
// Admin returns grid + pickup queue filter by returnStatus and sort by returnRequestedAt.
sellerReturnSchema.index({ returnStatus: 1, returnRequestedAt: -1 });
// Refund reconciliation sweep filters by refundStatus (+ refundMethod).
sellerReturnSchema.index({ refundStatus: 1, refundMethod: 1 });

export const SellerReturn = mongoose.model('SellerReturn', sellerReturnSchema, 'quick_seller_returns');
