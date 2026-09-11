import mongoose from 'mongoose';

const billItemSchema = new mongoose.Schema(
    {
        // Nullable: set when the item was picked from the restaurant's approved
        // FoodItem catalog; null for a manually-typed off-menu line.
        foodItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodItem', default: null },
        name: { type: String, required: true, trim: true },
        price: { type: Number, required: true, min: 0 }, // unit price, snapshotted server-side — never trusted from the client
        quantity: { type: Number, required: true, min: 1 },
        total: { type: Number, required: true, min: 0 }, // price * quantity, computed server-side
    },
    { _id: true },
);

const diningBillSchema = new mongoose.Schema(
    {
        reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiningReservation', required: true, unique: true, index: true },
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', required: true, index: true },

        items: { type: [billItemSchema], default: [] },

        subtotal: { type: Number, default: 0, min: 0 },
        taxPercent: { type: Number, default: 0, min: 0 },
        taxAmount: { type: Number, default: 0, min: 0 },
        discount: { type: Number, default: 0, min: 0 },
        grandTotal: { type: Number, default: 0, min: 0 },

        // Snapshot of the commission actually applied, frozen at finalize time —
        // never re-read live DiningSettings/DiningProfile after this point. Same
        // immutable-snapshot principle as FoodTransaction.orderSnapshot.
        commission: {
            type: { type: String, enum: ['percentage', 'amount'], default: 'percentage' },
            value: { type: Number, default: 0 },
            amount: { type: Number, default: 0, min: 0 },
        },
        restaurantPayout: { type: Number, default: 0, min: 0 }, // grandTotal - commission.amount

        status: {
            type: String,
            enum: ['draft', 'finalized', 'paid', 'settled'],
            default: 'draft',
            index: true,
        },

        payment: {
            status: { type: String, enum: ['pending', 'created', 'paid', 'failed'], default: 'pending' },
            method: { type: String, enum: ['razorpay'], default: 'razorpay' },
            razorpay: {
                orderId: { type: String, default: '' },
                paymentId: { type: String, default: '' },
                signature: { type: String, default: '' },
            },
        },

        // Idempotency claim for the settle-to-wallets step — see diningBill.service.js.
        // Set the instant the wallet credits are attempted so a retried verify/webhook
        // call can never double-credit.
        settlementClaimedAt: { type: Date, default: null },

        createdByRole: { type: String, enum: ['RESTAURANT'], default: 'RESTAURANT' },
        createdById: { type: mongoose.Schema.Types.ObjectId, default: null },
        finalizedAt: { type: Date, default: null },
        paidAt: { type: Date, default: null },
        settledAt: { type: Date, default: null },
    },
    { collection: 'dining_bills', timestamps: true },
);

diningBillSchema.index({ restaurantId: 1, createdAt: -1 });
diningBillSchema.index({ status: 1, createdAt: -1 });

export const DiningBill = mongoose.model('DiningBill', diningBillSchema, 'dining_bills');
