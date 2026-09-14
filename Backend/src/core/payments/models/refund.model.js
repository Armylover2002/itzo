import mongoose from 'mongoose';

/**
 * Refund — tracks refund requests against a Payment.
 * Supports partial refunds. Gateway refund id stored once processed.
 */
const refundSchema = new mongoose.Schema(
    {
        paymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Payment',
            required: true,
            index: true
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodOrder',
            required: true,
            index: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodUser',
            required: true,
            index: true
        },

        amount: { type: Number, required: true, min: 0 },
        currency: { type: String, default: 'INR', trim: true },

        reason: { type: String, default: '', trim: true },

        status: {
            type: String,
            enum: ['pending', 'processed', 'failed'],
            default: 'pending',
            index: true
        },

        /** Original payment method → determines refund path (gateway / wallet credit) */
        refundTo: {
            type: String,
            enum: ['gateway', 'wallet'],
            default: 'wallet'
        },

        gatewayRefundId: { type: String, default: '', sparse: true },

        processedAt: { type: Date, default: null },
        processedBy: { type: mongoose.Schema.Types.ObjectId, default: null },

        metadata: { type: mongoose.Schema.Types.Mixed, default: undefined }
    },
    {
        collection: 'refunds',
        timestamps: true
    }
);

refundSchema.index({ orderId: 1, status: 1 });

export const Refund = mongoose.model('Refund', refundSchema);
