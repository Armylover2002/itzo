import mongoose from "mongoose";
import { computeNotificationExpiresAt } from "../../../../core/notifications/utils/notificationTtl.js";

const sellerNotificationSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["inventory", "order", "payment", "system"],
      default: "system",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    /** Mongo TTL field — documents removed when expiresAt <= now (expireAfterSeconds: 0). */
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    collection: 'quick_seller_notifications',
    timestamps: true,
  },
);

sellerNotificationSchema.index({ sellerId: 1, key: 1 }, { unique: true });
sellerNotificationSchema.index({ sellerId: 1, isRead: 1, createdAt: -1 });
// Supports deleteMany({ key: 'broadcast:…' }) without collection scan.
sellerNotificationSchema.index({ key: 1 }, { name: 'key_1' });
sellerNotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'expiresAt_1' });

sellerNotificationSchema.pre('validate', function setExpiresAt(next) {
    if (!this.expiresAt) {
        this.expiresAt = computeNotificationExpiresAt(this.createdAt || new Date());
    }
    next();
});

export const SellerNotification = mongoose.model(
  "SellerNotification",
  sellerNotificationSchema,
);
