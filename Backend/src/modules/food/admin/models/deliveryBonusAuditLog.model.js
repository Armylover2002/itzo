import mongoose from 'mongoose';

const deliveryBonusAuditLogSchema = new mongoose.Schema(
    {
        adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodAdmin', required: true },
        adminName: { type: String, trim: true, required: true },
        adminRole: { type: String, trim: true, default: null },
        deliveryPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodDeliveryPartner', required: true },
        deliveryPartnerName: { type: String, trim: true, required: true },
        deliveryPartnerIdStr: { type: String, trim: true },
        bonusAmount: { type: Number, required: true, min: 1 },
        reference: { type: String, trim: true, default: null, maxlength: 200 },
        previousBalance: { type: Number, required: true, min: 0 },
        updatedBalance: { type: Number, required: true, min: 0 },
        transactionId: { type: String, required: true, trim: true, unique: true },
        requestId: { type: String, trim: true, default: null, index: true },
        idempotencyKey: { type: String, trim: true, default: null },
        ipAddress: { type: String, trim: true, default: null },
        userAgent: { type: String, trim: true, default: null }
    },
    { collection: 'food_delivery_bonus_audit_logs', timestamps: true }
);

deliveryBonusAuditLogSchema.index({ adminId: 1, createdAt: -1 });
deliveryBonusAuditLogSchema.index({ deliveryPartnerId: 1, createdAt: -1 });
deliveryBonusAuditLogSchema.index({ createdAt: -1 });

export const DeliveryBonusAuditLog = mongoose.model(
    'DeliveryBonusAuditLog',
    deliveryBonusAuditLogSchema,
    'food_delivery_bonus_audit_logs'
);
