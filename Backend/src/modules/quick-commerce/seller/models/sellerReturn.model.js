import mongoose from "mongoose";

// ─── Sub-schemas for Return Management System extensions ────────────────────

const itemApprovalSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, default: null },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedQty: { type: Number, default: 0, min: 0 },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    decidedAt: { type: Date, default: null },
  },
  { _id: false },
);

const assignmentHistoryEntrySchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodDeliveryPartner',
    },
    action: {
      type: String,
      enum: ['assigned', 'accepted', 'rejected', 'timeout', 'reassigned'],
      default: 'assigned',
    },
    at: { type: Date, default: Date.now },
    reason: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const assignmentSchema = new mongoose.Schema(
  {
    deliveryPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodDeliveryPartner',
      default: null,
    },
    assignedAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['unassigned', 'assigned', 'accepted', 'rejected', 'timeout'],
      default: 'unassigned',
    },
    history: { type: [assignmentHistoryEntrySchema], default: [] },
    autoReassignAttempts: { type: Number, default: 0, min: 0 },
    maxAutoReassignAttempts: { type: Number, default: 3, min: 0 },
  },
  { _id: false },
);

// ─── Main Schema ────────────────────────────────────────────────────────────

const sellerReturnSchema = new mongoose.Schema(
  {
    // ═══ EXISTING FIELDS (unchanged) ═══════════════════════════════════════

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
    returnStatus: {
      type: String,
      enum: [
        // Existing values (preserved):
        "return_requested",
        "return_approved",
        "return_rejected",
        "return_pickup_assigned",
        "return_in_transit",
        "returned",
        "refund_completed",
        // New granular values:
        "under_review",
        "partially_approved",
        "pickup_pending",
        "pickup_en_route",
        "pickup_reached",
        "pickup_otp_pending",
        "picked_up",
        "return_en_route",
        "return_reached_seller",
        "seller_otp_pending",
        "return_completed",
        "refund_pending",
        "refund_failed",
        "cancelled",
        "failed_pickup",
        "failed_return",
        "expired",
      ],
      default: "return_requested",
    },
    returnReason: {
      type: String,
      trim: true,
      default: "",
    },
    returnRejectedReason: {
      type: String,
      trim: true,
      default: "",
    },
    returnRequestedAt: {
      type: Date,
      default: Date.now,
    },
    returnItems: {
      type: [
        new mongoose.Schema(
          {
            name: { type: String, trim: true, default: "" },
            quantity: { type: Number, min: 1, default: 1 },
            price: { type: Number, min: 0, default: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    pricing: {
      subtotal: { type: Number, min: 0, default: 0 },
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

    // ═══ NEW FIELDS (all optional with safe defaults) ══════════════════════

    /** Link to master ReturnRequest document */
    returnRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReturnRequest',
      default: null,
      index: true,
    },

    /** User who requested the return */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodUser',
      default: null,
    },

    /** Per-item approval decisions */
    itemApprovals: {
      type: [itemApprovalSchema],
      default: [],
    },

    /** Delivery partner assignment for return pickup */
    assignment: {
      type: assignmentSchema,
      default: () => ({}),
    },

    /** Phase timestamps for tracking lifecycle progression */
    pickupEnRouteAt: { type: Date, default: null },
    pickupReachedAt: { type: Date, default: null },
    pickupOtpVerifiedAt: { type: Date, default: null },
    pickedUpAt: { type: Date, default: null },
    returnEnRouteAt: { type: Date, default: null },
    returnReachedSellerAt: { type: Date, default: null },
    sellerOtpVerifiedAt: { type: Date, default: null },
    returnCompletedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },

    /** Admin notes and failure tracking */
    adminNotes: { type: String, default: '', trim: true },
    failureReason: { type: String, default: '', trim: true },

    /** Proof of Pickup images uploaded by rider */
    pickupProofImages: {
      type: [String],
      default: [],
    },

    /** Concurrency lock for refund processing */
    refundProcessing: {
      type: Boolean,
      default: false,
    },
  },
  {
    collection: 'quick_seller_returns',
    timestamps: true,
  },
);

// ─── Indexes ────────────────────────────────────────────────────────────────

sellerReturnSchema.index({ sellerId: 1, returnRequestedAt: -1 });

// Updated unique index: supports multiple returns per seller+order (one per returnRequest).
// Existing data with null returnRequestId won't conflict because there's at most one
// existing return per seller+order combination.
sellerReturnSchema.index(
  { sellerId: 1, orderId: 1, returnRequestId: 1 },
  { unique: true },
);

// New indexes for return management queries
sellerReturnSchema.index({ returnRequestId: 1 });
sellerReturnSchema.index({ userId: 1, returnStatus: 1 });
sellerReturnSchema.index({ 'assignment.deliveryPartnerId': 1, returnStatus: 1 });

export const SellerReturn = mongoose.model('SellerReturn', sellerReturnSchema, 'quick_seller_returns');
