import mongoose from 'mongoose';

// ─── ReturnOtp Schema ───────────────────────────────────────────────────────
// Dedicated OTP model for return pickup and seller handoff verification.
// Uses SHA-256 hashing, TTL expiry, attempt limits, and resend cooldown.
// Completely isolated from the existing auth OTP and delivery OTP systems.

const generatedForSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['USER', 'SELLER'],
      required: true,
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false },
);

const returnOtpSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ['pickup', 'seller'],
      required: true,
    },

    // SHA-256(otp + salt) — plain OTP is never stored
    otpHash: {
      type: String,
      required: true,
    },

    // Random salt used in hashing
    salt: {
      type: String,
      required: true,
    },

    // TTL-based auto-expiry
    expiresAt: {
      type: Date,
      required: true,
    },

    // Attempt tracking
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxAttempts: {
      type: Number,
      default: 5,
      min: 1,
    },

    // Verification state
    verified: {
      type: Boolean,
      default: false,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    // Resend tracking
    resendCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxResends: {
      type: Number,
      default: 3,
      min: 0,
    },

    lastResendAt: {
      type: Date,
      default: null,
    },

    resendCooldownSec: {
      type: Number,
      default: 60,
      min: 10,
    },

    // Who receives this OTP
    generatedFor: {
      type: generatedForSchema,
      required: true,
    },
  },
  {
    collection: 'quick_return_otps',
    timestamps: true,
  },
);

// ─── Indexes ────────────────────────────────────────────────────────────────

// TTL auto-cleanup: MongoDB removes documents after expiresAt
returnOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Lookup by seller return leg + type (for verification)
returnOtpSchema.index({ sellerReturnId: 1, type: 1 });

// Lookup by return request + type (for admin visibility)
returnOtpSchema.index({ returnRequestId: 1, type: 1 });

export const ReturnOtp = mongoose.model(
  'ReturnOtp',
  returnOtpSchema,
  'quick_return_otps',
);
