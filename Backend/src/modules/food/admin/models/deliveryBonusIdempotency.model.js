import mongoose from 'mongoose';

/**
 * Dedicated bonus idempotency ledger.
 * Inserting a row with a unique `key` claims the request BEFORE any wallet credit.
 * Replay returns the stored snapshot only when requestHash matches.
 */
const deliveryBonusIdempotencySchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            trim: true,
            maxlength: 128
        },
        /** SHA-256 of immutable payload (deliveryPartnerId|amount|reference) */
        requestHash: {
            type: String,
            required: true,
            trim: true,
            maxlength: 64
        },
        status: {
            type: String,
            enum: ['completed'],
            default: 'completed',
            required: true
        },
        transactionId: { type: String, required: true, trim: true },
        deliveryPartnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodDeliveryPartner',
            required: true
        },
        deliveryPartnerName: { type: String, trim: true, default: '' },
        amount: { type: Number, required: true, min: 1 },
        reference: { type: String, trim: true, default: null },
        previousBalance: { type: Number, required: true, min: 0 },
        updatedBalance: { type: Number, required: true, min: 0 },
        requestId: { type: String, trim: true, default: null }
    },
    { collection: 'food_delivery_bonus_idempotency', timestamps: true }
);

deliveryBonusIdempotencySchema.index({ key: 1 }, { unique: true });
deliveryBonusIdempotencySchema.index({ transactionId: 1 });
deliveryBonusIdempotencySchema.index({ requestHash: 1 });

export const DeliveryBonusIdempotency = mongoose.model(
    'DeliveryBonusIdempotency',
    deliveryBonusIdempotencySchema,
    'food_delivery_bonus_idempotency'
);
