import mongoose from 'mongoose';

const deliveryBonusTransactionSchema = new mongoose.Schema(
    {
        deliveryPartnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodDeliveryPartner',
            required: true,
            index: true
        },
        // Denormalized for indexed search without populate / N+1
        deliveryPartnerName: { type: String, trim: true, default: '', index: true },
        deliveryIdStr: { type: String, trim: true, default: null, index: true },
        transactionId: { type: String, required: true, trim: true, unique: true },
        amount: { type: Number, required: true, min: 1 },
        reference: { type: String, trim: true, default: null, maxlength: 200 },
        previousBalance: { type: Number, required: true, min: 0, default: 0 },
        updatedBalance: { type: Number, required: true, min: 0, default: 0 },
        createdByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodAdmin', index: true },
        createdByName: { type: String, trim: true, default: 'Admin', index: true },
        adminRole: { type: String, trim: true, default: null },
        idempotencyKey: { type: String, trim: true, default: null },
        requestId: { type: String, trim: true, default: null, index: true },
        ipAddress: { type: String, trim: true, default: null },
        userAgent: { type: String, trim: true, default: null }
    },
    { collection: 'food_delivery_bonus_transactions', timestamps: true }
);

deliveryBonusTransactionSchema.index({ deliveryPartnerId: 1, createdAt: -1 });
deliveryBonusTransactionSchema.index({ createdAt: -1, _id: -1 });
deliveryBonusTransactionSchema.index({ reference: 1 });
deliveryBonusTransactionSchema.index(
    { idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

export const DeliveryBonusTransaction = mongoose.model(
    'DeliveryBonusTransaction',
    deliveryBonusTransactionSchema,
    'food_delivery_bonus_transactions'
);
