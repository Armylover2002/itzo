import mongoose from 'mongoose';

const adminResetOtpSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true
        },
        otp: {
            type: String,
            required: true
        },
        expiresAt: {
            type: Date,
            required: true
        },
        attempts: {
            type: Number,
            default: 0
        }
    },
    {
        collection: 'food_admin_reset_otps',
        timestamps: true
    }
);

adminResetOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AdminResetOtp = mongoose.model('AdminResetOtp', adminResetOtpSchema);
