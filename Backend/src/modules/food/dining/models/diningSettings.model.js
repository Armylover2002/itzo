import mongoose from 'mongoose';

/**
 * Single global config document for the Dining feature. There is exactly one
 * row (key: 'global') — same singleton pattern used by other *Settings
 * models in this codebase.
 */
const diningSettingsSchema = new mongoose.Schema(
    {
        key: { type: String, default: 'global', unique: true, index: true },
        // Applied to every restaurant's dining bills unless that restaurant's
        // DiningProfile.commission.override is true.
        defaultCommission: {
            type: {
                type: String,
                enum: ['percentage', 'amount'],
                default: 'percentage',
            },
            value: { type: Number, default: 10, min: 0 },
        },
        minAdvanceBookingMinutes: { type: Number, default: 30, min: 0 },
        maxAdvanceBookingDays: { type: Number, default: 30, min: 1 },
        cancellationWindowMinutes: { type: Number, default: 60, min: 0 },
        taxPercent: { type: Number, default: 5, min: 0, max: 100 },
    },
    { collection: 'dining_settings', timestamps: true },
);

export const DiningSettings = mongoose.model('DiningSettings', diningSettingsSchema, 'dining_settings');
