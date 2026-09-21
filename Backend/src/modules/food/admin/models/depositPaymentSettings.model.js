import mongoose from 'mongoose';

/**
 * Admin Deposit Payment Settings
 * Singleton document (only one record) with bank, UPI, QR, and Zone Hub details
 * that delivery boys see when depositing their cash-in-hand limit.
 */
const depositPaymentSettingsSchema = new mongoose.Schema(
    {
        // Bank Transfer Details
        bankName: { type: String, default: '' },
        bankAccountHolder: { type: String, default: '' },
        bankAccountNumber: { type: String, default: '' },
        bankIfscCode: { type: String, default: '' },

        // UPI Details
        upiId: { type: String, default: '' },

        // QR Code (stored upload URL)
        qrCodeUrl: { type: String, default: '' },

    },
    { collection: 'food_deposit_payment_settings', timestamps: true }
);

export const DepositPaymentSettings = mongoose.model(
    'DepositPaymentSettings',
    depositPaymentSettingsSchema,
    'food_deposit_payment_settings'
);
