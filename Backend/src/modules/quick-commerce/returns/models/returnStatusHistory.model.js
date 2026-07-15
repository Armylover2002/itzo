import mongoose from 'mongoose';
import { ACTOR_ROLES } from '../constants/returnStateMachine.js';

// ─── ReturnStatusHistory Schema ─────────────────────────────────────────────
// Immutable audit trail for every status transition in the return lifecycle.
// One document per transition — never updated, only inserted.

const actorSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: Object.values(ACTOR_ROLES),
      required: true,
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    name: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false },
);

const returnStatusHistorySchema = new mongoose.Schema(
  {
    returnRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReturnRequest',
      required: true,
      index: true,
    },

    sellerReturnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SellerReturn',
      default: null,
      index: true,
    },

    fromStatus: {
      type: String,
      required: true,
    },

    toStatus: {
      type: String,
      required: true,
    },

    actor: {
      type: actorSchema,
      required: true,
    },

    note: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    collection: 'quick_return_status_history',
    timestamps: false, // we use our own `timestamp` field
  },
);

// ─── Indexes ────────────────────────────────────────────────────────────────

// Timeline query: all history for a return request, ordered by time
returnStatusHistorySchema.index({ returnRequestId: 1, timestamp: 1 });

// Per-leg history query
returnStatusHistorySchema.index({ sellerReturnId: 1, timestamp: 1 });

export const ReturnStatusHistory = mongoose.model(
  'ReturnStatusHistory',
  returnStatusHistorySchema,
  'quick_return_status_history',
);
