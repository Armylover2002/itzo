import mongoose from 'mongoose';

/**
 * QuickAdminWallet — tracks Quick Commerce platform's overall financial balance.
 * Dedicated platform wallet for Quick Commerce, completely isolated from Food.
 */
const quickAdminWalletSchema = new mongoose.Schema(
    {
        /** Singleton key for Quick Commerce admin platform wallet */
        key: { type: String, default: 'quick_platform', unique: true },
        balance: { type: Number, default: 0 },
        /** Lifetime total quick commerce platform revenue */
        totalRevenue: { type: Number, default: 0, min: 0 },
        /** Total paid out to quick commerce sellers + delivery partners */
        totalPayouts: { type: Number, default: 0, min: 0 },
        /** Total refunds issued */
        totalRefunds: { type: Number, default: 0, min: 0 }
    },
    { collection: 'quick_admin_wallets', timestamps: true }
);

export const QuickAdminWallet = mongoose.model(
    'QuickAdminWallet',
    quickAdminWalletSchema,
    'quick_admin_wallets'
);
