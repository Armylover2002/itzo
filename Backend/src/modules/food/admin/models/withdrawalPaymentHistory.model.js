import mongoose from 'mongoose';

/**
 * Immutable payout history for restaurant & delivery partner withdrawals.
 * One document per successful payout (enforced by unique compound index).
 */
const withdrawalPaymentHistorySchema = new mongoose.Schema(
    {
        withdrawalRequestId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        userType: {
            type: String,
            enum: ['restaurant', 'delivery_partner'],
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        userName: {
            type: String,
            trim: true,
            default: '',
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        paymentMethod: {
            type: String,
            trim: true,
            default: 'bank_transfer',
        },
        /** Bank / UPI / gateway reference supplied by admin (optional) */
        transactionReferenceId: {
            type: String,
            trim: true,
            default: null,
        },
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
            index: true,
        },
        adminName: {
            type: String,
            trim: true,
            default: 'Admin',
        },
        paymentStatus: {
            type: String,
            enum: ['paid', 'completed'],
            default: 'paid',
        },
        requestTime: {
            type: Date,
            required: true,
        },
        approvalTime: {
            type: Date,
            required: true,
        },
        paymentTime: {
            type: Date,
            required: true,
        },
        notes: {
            type: String,
            trim: true,
            default: null,
        },
    },
    {
        collection: 'food_withdrawal_payment_history',
        timestamps: true,
    }
);

// One history record per successful payout
withdrawalPaymentHistorySchema.index(
    { withdrawalRequestId: 1, userType: 1 },
    { unique: true }
);
withdrawalPaymentHistorySchema.index({ createdAt: -1 });
withdrawalPaymentHistorySchema.index({ paymentTime: -1 });

function rejectMutation() {
    throw new Error('Withdrawal payment history is immutable');
}

withdrawalPaymentHistorySchema.pre(
    [
        'updateOne',
        'updateMany',
        'findOneAndUpdate',
        'replaceOne',
        'findOneAndReplace',
        'findOneAndDelete',
        'deleteOne',
        'deleteMany',
    ],
    rejectMutation
);

withdrawalPaymentHistorySchema.pre('save', function blockResave(next) {
    if (!this.isNew) {
        return next(new Error('Withdrawal payment history is immutable'));
    }
    return next();
});

export const WithdrawalPaymentHistory = mongoose.model(
    'WithdrawalPaymentHistory',
    withdrawalPaymentHistorySchema,
    'food_withdrawal_payment_history'
);
