import mongoose from 'mongoose';

const authLockoutSchema = new mongoose.Schema(
    {
        identifier: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        scope: {
            type: String,
            required: true,
            trim: true,
        },
        failedAttempts: {
            type: Number,
            default: 0,
        },
        lockedUntil: {
            type: Date,
            default: null,
        },
        requestCount: {
            type: Number,
            default: 0,
        },
        lastRequestAt: {
            type: Date,
            default: null,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
    },
    {
        collection: 'food_auth_lockouts',
        timestamps: true,
    },
);

authLockoutSchema.index({ identifier: 1, scope: 1 }, { unique: true });
authLockoutSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthLockout = mongoose.model('AuthLockout', authLockoutSchema);
