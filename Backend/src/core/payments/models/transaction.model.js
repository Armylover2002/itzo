import mongoose from 'mongoose';

/**
 * Transaction — universal financial ledger.
 * Every credit/debit across all entity types (user, restaurant, deliveryBoy, admin)
 * gets a row here. This is the single source of truth for money movement.
 *
 * RULE: Never update Wallet.balance directly — always go through
 *       transaction.service.recordTransaction() which atomically creates
 *       a Transaction row + updates the matching Wallet.
 */
const transactionSchema = new mongoose.Schema(
    {
        /** Link to the Payment document that triggered this transaction (optional for manual adjustments) */
        paymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Payment',
            default: null
        },
        /** Link to the order (optional — wallet top-ups / adjustments may not have an order) */
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodOrder',
            default: null,
            index: true
        },

        /** Which type of entity this transaction belongs to */
        entityType: {
            type: String,
            enum: ['user', 'restaurant', 'deliveryBoy', 'admin'],
            required: true,
            index: true
        },
        /** ObjectId of the entity (userId, restaurantId, deliveryPartnerId, or admin id) */
        entityId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true
        },

        type: {
            type: String,
            enum: ['credit', 'debit'],
            required: true
        },

        amount: { type: Number, required: true, min: 0 },
        /** Wallet balance AFTER this transaction was applied — set atomically */
        balanceAfter: { type: Number, required: true },

        currency: { type: String, default: 'INR', trim: true },

        status: {
            type: String,
            enum: ['completed', 'pending', 'failed', 'reversed'],
            default: 'completed',
            index: true
        },

        /** Human-readable description shown in wallet history */
        description: { type: String, default: '', trim: true },

        /** Category for easier filtering / reporting */
        category: {
            type: String,
            enum: [
                'order_payment',
                'order_refund',
                'wallet_topup',
                'wallet_debit',
                'commission',
                'delivery_earning',
                'platform_fee',
                'settlement_payout',
                'referral_reward',
                'adjustment',
                'other'
            ],
            default: 'other'
        },

        module: { type: String, default: 'food', trim: true },

        metadata: { type: mongoose.Schema.Types.Mixed, default: undefined }
    },
    { collection: 'transactions', timestamps: true }
);

transactionSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
transactionSchema.index({ orderId: 1, entityType: 1 });
transactionSchema.index({ paymentId: 1, type: 1 });
/** Prevent double-credit of delivery/platform earnings for the same order. */
transactionSchema.index(
    { orderId: 1, entityType: 1, category: 1 },
    {
        unique: true,
        name: 'uniq_order_entity_category_delivery_credits',
        partialFilterExpression: {
            orderId: { $type: 'objectId' },
            type: 'credit',
            status: 'completed',
            category: { $in: ['delivery_earning', 'platform_fee'] },
        },
    }
);

export const Transaction = mongoose.model('Transaction', transactionSchema);
