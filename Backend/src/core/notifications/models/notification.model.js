import mongoose from 'mongoose';
import { computeNotificationExpiresAt } from '../utils/notificationTtl.js';

const notificationSchema = new mongoose.Schema(
    {
        ownerType: {
            type: String,
            enum: ['USER', 'RESTAURANT', 'DELIVERY_PARTNER', 'SELLER'],
            required: true,
            index: true
        },
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        message: {
            type: String,
            required: true,
            trim: true
        },
        link: {
            type: String,
            trim: true
            // No default — omit field when empty (APIs treat missing as '').
        },
        category: {
            type: String,
            default: 'broadcast',
            trim: true
        },
        source: {
            type: String,
            enum: [
                'ADMIN_BROADCAST',
                'FSSAI_EXPIRY',
                'CATEGORY_STATUS',
                'LICENSE_EXPIRY',
                'SYSTEM',
                'ORDER',
                'PAYMENT',
                'APPROVAL',
                'WITHDRAWAL',
            ],
            default: 'SYSTEM',
            index: true
        },
        broadcastId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BroadcastNotification',
            default: undefined,
            index: true
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        isRead: {
            type: Boolean,
            default: false,
            index: true
        },
        readAt: {
            type: Date,
            default: null
        },
        dismissedAt: {
            type: Date,
            default: null,
            index: true
        },
        /** Mongo TTL field — documents removed when expiresAt <= now (expireAfterSeconds: 0). */
        expiresAt: {
            type: Date,
            required: true,
            index: true
        }
    },
    {
        collection: 'food_notifications',
        timestamps: true
    }
);

notificationSchema.pre('validate', function setExpiresAt(next) {
    if (!this.expiresAt) {
        this.expiresAt = computeNotificationExpiresAt(this.createdAt || new Date());
    }
    next();
});

notificationSchema.index({ ownerType: 1, ownerId: 1, createdAt: -1 });
notificationSchema.index({ ownerType: 1, ownerId: 1, isRead: 1, dismissedAt: 1 });
notificationSchema.index({ ownerType: 1, ownerId: 1, 'metadata.dedupeKey': 1 }, { sparse: true });
notificationSchema.index({ broadcastId: 1, ownerType: 1, ownerId: 1 }, { unique: true, sparse: true });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'expiresAt_1' });

export const FoodNotification = mongoose.model('FoodNotification', notificationSchema);
