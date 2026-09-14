import mongoose from 'mongoose';

/**
 * FoodWalletLedger - Tracks all transactions specifically for the Subscription Wallet.
 * This includes Topups, Deductions for Daily Passes, and Transfers to Earnings.
 */
const foodWalletLedgerSchema = new mongoose.Schema(
    {
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true
        },
        ownerType: {
            type: String,
            enum: ['RESTAURANT', 'DELIVERY_PARTNER'],
            required: true,
            index: true
        },
        type: {
            type: String,
            enum: [
                'TOPUP', 
                'DAILY_DEDUCTION', 
                'TRANSFER_TO_EARNING', 
                'WEEKLY_SUBSCRIPTION', 
                'MONTHLY_SUBSCRIPTION',
                'REFUND'
            ],
            required: true,
            index: true
        },
        amount: {
            type: Number,
            required: true
        },
        beforeBalance: {
            type: Number,
            required: true
        },
        afterBalance: {
            type: Number,
            required: true
        },
        /** Reference ID (Razorpay Order ID, Daily Pass ID, etc.) */
        referenceId: {
            type: String,
            default: null,
            index: true
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    { 
        collection: 'food_wallet_ledger', 
        timestamps: { createdAt: true, updatedAt: false } 
    }
);

export const FoodWalletLedger = mongoose.model('FoodWalletLedger', foodWalletLedgerSchema, 'food_wallet_ledger');
