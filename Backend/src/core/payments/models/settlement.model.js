import mongoose from 'mongoose';

/**
 * Settlement — legacy batch payout records (`settlements` collection).
 *
 * NOT the food restaurant payout path. Restaurant withdrawals use:
 *   food_restaurant_withdrawals + food_transactions settlement flags
 * via POST /food/restaurant/withdraw and PATCH /food/admin/withdrawals/:id.
 *
 * New restaurant settlements must not be created via settlement.service
 * (create/process reject entityType=restaurant).
 */
const settlementSchema = new mongoose.Schema(
    {
        entityType: {
            type: String,
            enum: ['restaurant', 'deliveryBoy'],
            required: true,
            index: true
        },
        entityId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true
        },

        amount: { type: Number, required: true, min: 0 },
        currency: { type: String, default: 'INR', trim: true },

        /** Transaction ids included in this settlement batch */
        transactionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }],

        status: {
            type: String,
            enum: ['pending', 'processing', 'processed', 'failed'],
            default: 'pending',
            index: true
        },

        /** External payout reference (bank transfer id, UPI ref, etc.) */
        payoutRef: { type: String, default: '', trim: true },

        processedAt: { type: Date, default: null },
        processedBy: { type: mongoose.Schema.Types.ObjectId, default: null },

        /** Period covered by settlement */
        periodStart: { type: Date, default: null },
        periodEnd: { type: Date, default: null },

        notes: { type: String, default: '', trim: true },
        metadata: { type: mongoose.Schema.Types.Mixed, default: undefined }
    },
    { collection: 'settlements', timestamps: true }
);

settlementSchema.index({ entityType: 1, entityId: 1, status: 1, createdAt: -1 });

export const Settlement = mongoose.model('Settlement', settlementSchema);
