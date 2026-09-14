import mongoose from 'mongoose';

/**
 * Payment — one record per payment attempt on an order.
 * Tracks gateway interactions and final payment status.
 */
const paymentSchema = new mongoose.Schema(
    {
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

        method: {
            type: String,
            enum: ['cash', 'razorpay', 'razorpay_qr', 'wallet', 'upi', 'card', 'netbanking'],
            required: true
        },
        gateway: {
            type: String,
            enum: ['razorpay', 'stripe', 'paypal', 'none'],
            default: 'none'
        },

        gatewayOrderId: { type: String, default: '', sparse: true },
        gatewayPaymentId: { type: String, default: '', sparse: true },

        status: {
            type: String,
            enum: ['created', 'pending', 'success', 'failed', 'refunded'],
            default: 'created',
            index: true
        },

        /** Module that triggered the payment (future: dining, grocery, etc.) */
        module: { type: String, default: 'food', trim: true, index: true },

        /** Full gateway response snapshot — stored for audit/support. Never expose to clients. */
        rawResponse: { type: mongoose.Schema.Types.Mixed, default: undefined },

        metadata: { type: mongoose.Schema.Types.Mixed, default: undefined }
    },
    { collection: 'payments', timestamps: true }
);

paymentSchema.index({ orderId: 1, createdAt: -1 });
paymentSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const Payment = mongoose.model('Payment', paymentSchema);
