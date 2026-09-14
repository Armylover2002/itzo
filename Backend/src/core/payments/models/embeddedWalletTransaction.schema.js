import mongoose from 'mongoose';

/**
 * Embedded wallet ledger entry (stored on the wallet document itself).
 * Complements the universal `transactions` collection — does not replace it.
 * Not a separate Mongo collection.
 *
 * For FoodRestaurantWallet: entries are referral / subscription / withdrawal
 * settlement audit only. Order earnings are NOT written here on delivery —
 * those live on `food_transactions`.
 */
export const embeddedWalletTransactionSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ['credit', 'debit'],
            required: true,
        },
        amount: { type: Number, required: true, min: 0 },
        openingBalance: { type: Number, default: undefined },
        closingBalance: { type: Number, default: undefined },
        category: { type: String, default: 'other', trim: true },
        description: { type: String, default: '', trim: true },
        status: { type: String, default: 'completed', trim: true },
        orderId: { type: mongoose.Schema.Types.Mixed, default: null },
        paymentId: { type: mongoose.Schema.Types.Mixed, default: null },
        referenceId: { type: String, default: null, trim: true },
        withdrawalId: { type: String, default: null, trim: true },
        universalTransactionId: { type: String, default: null, trim: true },
        metadata: { type: mongoose.Schema.Types.Mixed, default: undefined },
    },
    { timestamps: true, _id: true }
);

/**
 * Build an embedded history entry for restaurant / delivery / admin wallets.
 */
export function buildPartnerEmbeddedTxn({
    type,
    amount,
    openingBalance,
    closingBalance,
    category = 'other',
    description = '',
    orderId = null,
    paymentId = null,
    referenceId = null,
    withdrawalId = null,
    universalTransactionId = null,
    metadata = undefined,
    status = 'completed',
}) {
    const now = new Date();
    return {
        type,
        amount: Number(amount),
        openingBalance: Number(openingBalance),
        closingBalance: Number(closingBalance),
        category: category || 'other',
        description: description || '',
        status,
        orderId: orderId != null ? orderId : null,
        paymentId: paymentId != null ? paymentId : null,
        referenceId: referenceId != null ? String(referenceId) : null,
        withdrawalId: withdrawalId != null ? String(withdrawalId) : null,
        universalTransactionId:
            universalTransactionId != null ? String(universalTransactionId) : null,
        metadata,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Build an embedded history entry for FoodUserWallet (existing UI shape).
 * type: addition | deduction | refund
 */
export function buildUserEmbeddedTxn({
    type,
    amount,
    description = '',
    metadata = {},
    razorpayOrderId = null,
    razorpayPaymentId = null,
    razorpaySignature = null,
    status = 'Completed',
}) {
    const now = new Date();
    return {
        type,
        amount: Number(amount),
        status,
        description: description || '',
        metadata: metadata || {},
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        createdAt: now,
        updatedAt: now,
    };
}

/** Map universal credit/debit + category → user wallet UI type */
export function mapUserEmbeddedType(ledgerType, category) {
    if (category === 'order_refund') return 'refund';
    return ledgerType === 'credit' ? 'addition' : 'deduction';
}
