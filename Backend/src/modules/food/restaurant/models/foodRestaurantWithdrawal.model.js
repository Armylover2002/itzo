import mongoose from 'mongoose';

const foodRestaurantWithdrawalSchema = new mongoose.Schema({
    restaurantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FoodRestaurant',
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        min: [1, 'Minimum withdrawal amount is ₹1']
    },
    status: {
        type: String,
        // processing = claimed for settle; still locks available balance until approved/reverted
        enum: ['pending', 'processing', 'approved', 'rejected', 'cancelled'],
        default: 'pending',
        index: true
    },
    /** Client retry key — unique per restaurant when provided */
    idempotencyKey: {
        type: String,
        trim: true,
        maxlength: 128,
        default: undefined,
    },
    paymentMethod: {
        type: String,
        default: 'bank_transfer'
    },
    bankDetails: {
        accountNumber: String,
        ifscCode: String,
        bankName: String,
        accountHolderName: String
    },
    adminNote: String,
    rejectionReason: String,
    transactionId: String, // Final bank transaction reference from admin
    processedAt: Date,
    /** Set inside settle txn so approve retries after crash do not re-consume shares */
    ledgerSettled: { type: Boolean, default: false },
}, { 
    collection: 'food_restaurant_withdrawals', 
    timestamps: true 
});

foodRestaurantWithdrawalSchema.index({ createdAt: -1 });
foodRestaurantWithdrawalSchema.index(
    { restaurantId: 1, idempotencyKey: 1 },
    {
        unique: true,
        partialFilterExpression: {
            idempotencyKey: { $type: 'string' },
        },
    }
);

export const FoodRestaurantWithdrawal = mongoose.model('FoodRestaurantWithdrawal', foodRestaurantWithdrawalSchema, 'food_restaurant_withdrawals');
