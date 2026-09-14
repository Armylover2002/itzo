import mongoose from 'mongoose';
import { computeNotificationExpiresAt } from '../utils/notificationTtl.js';

const broadcastTargetSchema = new mongoose.Schema(
    {
        ownerType: {
            type: String,
            enum: ['USER', 'RESTAURANT', 'SELLER', 'DELIVERY_PARTNER'],
            required: true
        },
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        }
        // Intentionally no label / subLabel — resolve profile data at read time.
    },
    { _id: false }
);

const notificationBroadcastSchema = new mongoose.Schema(
    {
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
        targetType: {
            type: String,
            enum: ['ALL', 'ALL_QC', 'USER', 'RESTAURANT', 'SELLER', 'DELIVERY', 'CUSTOM'],
            required: true,
            index: true
        },
        selectionMode: {
            type: String,
            enum: ['ALL', 'SELECTED'],
            required: true,
            default: 'SELECTED'
            // Backend metadata only (audience resolution mode). Safe for history responses;
            // not used for recipient expansion at send time beyond how targets were stored.
        },
        targetIds: {
            type: [mongoose.Schema.Types.ObjectId],
            default: []
        },
        targets: {
            type: [broadcastTargetSchema],
            default: []
        },
        link: {
            type: String,
            trim: true
            // No default — omit field when empty (APIs treat missing as '').
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodAdmin',
            required: true,
            index: true
        },
        targetCount: {
            type: Number,
            default: 0
        },
        /** Mongo TTL field — documents removed when expiresAt <= now (expireAfterSeconds: 0). */
        expiresAt: {
            type: Date,
            required: true,
            index: true
        }
    },
    {
        collection: 'food_notification_broadcasts',
        timestamps: { createdAt: true, updatedAt: false }
    }
);

notificationBroadcastSchema.pre('validate', function setExpiresAt(next) {
    if (!this.expiresAt) {
        this.expiresAt = computeNotificationExpiresAt(this.createdAt || new Date());
    }
    next();
});

notificationBroadcastSchema.index({ createdAt: -1 });
notificationBroadcastSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'expiresAt_1' });

export const BroadcastNotification = mongoose.model(
    'BroadcastNotification',
    notificationBroadcastSchema
);
