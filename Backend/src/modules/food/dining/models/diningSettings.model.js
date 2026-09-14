import mongoose from 'mongoose';

const { Schema } = mongoose;

const diningSettingsSchema = new Schema(
    {
        key: { type: String, default: 'global', unique: true },
        defaultCommission: {
            type: { type: String, enum: ['percentage', 'amount'], default: 'percentage' },
            value: { type: Number, default: 10 },
        },
        minAdvanceBookingMinutes: { type: Number, default: 30 },
        maxAdvanceBookingDays: { type: Number, default: 14 },
        cancellationWindowMinutes: { type: Number, default: 60 },
        taxPercent: { type: Number, default: 5 },
    },
    { timestamps: true }
);

export const DiningSettings = mongoose.model('DiningSettings', diningSettingsSchema, 'dining_settings');
