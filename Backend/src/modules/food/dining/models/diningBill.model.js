import mongoose from 'mongoose';

const { Schema } = mongoose;

const billItemSchema = new Schema(
    {
        foodItemId: { type: Schema.Types.ObjectId, ref: 'FoodItem', default: null },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 },
        total: { type: Number, required: true },
    },
    { _id: false }
);

const diningBillSchema = new Schema(
    {
        reservationId: { type: Schema.Types.ObjectId, ref: 'DiningReservation', required: true, unique: true, index: true },
        restaurantId: { type: Schema.Types.ObjectId, ref: 'FoodRestaurant', required: true, index: true },
        userId: { type: Schema.Types.ObjectId, ref: 'FoodUser', required: true, index: true },
        items: { type: [billItemSchema], default: [] },
        subtotal: { type: Number, default: 0 },
        taxPercent: { type: Number, default: 0 },
        taxAmount: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        grandTotal: { type: Number, default: 0 },
        commission: {
            type: { type: String, enum: ['percentage', 'amount'], default: 'percentage' },
            value: { type: Number, default: 0 },
            amount: { type: Number, default: 0 },
        },
        restaurantPayout: { type: Number, default: 0 },
        status: { type: String, enum: ['draft', 'finalized', 'paid', 'settled'], default: 'draft', index: true },
        payment: {
            status: { type: String, enum: ['pending', 'created', 'paid', 'failed'], default: 'pending' },
            method: { type: String, enum: ['razorpay'], default: 'razorpay' },
            razorpay: {
                orderId: { type: String },
                paymentId: { type: String },
                signature: { type: String },
            },
        },
        settlementClaimedAt: { type: Date },
        createdByRole: { type: String, enum: ['RESTAURANT'], default: 'RESTAURANT' },
        createdById: { type: Schema.Types.ObjectId },
        finalizedAt: { type: Date },
        paidAt: { type: Date },
        settledAt: { type: Date },
    },
    { timestamps: true }
);

export const DiningBill = mongoose.model('DiningBill', diningBillSchema, 'dining_bills');
