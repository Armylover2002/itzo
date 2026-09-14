import mongoose from 'mongoose';

/**
 * Food order settlement ledger — source of truth for restaurant order earnings.
 *
 * `amounts.restaurantShare` is snapshotted at order create (plus quick share
 * realization on delivery). Payout eligibility and HubFinance balances are
 * derived here via `settlement.isRestaurantSettled` / `restaurantSettledAmount`.
 * Restaurant order credits are NOT mirrored into `food_restaurant_wallets`.
 */
const foodTransactionSchema = new mongoose.Schema({
    // Identifiers
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodOrder', required: true, unique: true, index: true },
    orderType: {
        type: String,
        enum: ['food', 'quick', 'mixed'],
        default: 'food',
        index: true
    },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', required: true, index: true },
    // Quick parent orders do not have a restaurant owner on the parent order.
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', default: null, index: true },
    deliveryPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodDeliveryPartner', index: true },

    // Core Payment Info
    paymentMethod: { 
        type: String, 
        enum: ['cash', 'razorpay', 'razorpay_qr', 'wallet'], 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['pending', 'authorized', 'captured', 'failed', 'refunded'], 
        default: 'pending',
        index: true 
    },
    currency: { type: String, default: 'INR' },

    // Snapshot of order pricing at the time transaction was created
    pricing: {
        subtotal: { type: Number, default: 0, min: 0 },
        tax: { type: Number, default: 0, min: 0 },
        packagingFee: { type: Number, default: 0, min: 0 },
        deliveryFee: { type: Number, default: 0, min: 0 },
        totalDeliveryFee: { type: Number, default: 0, min: 0 },
        userDeliveryFee: { type: Number, default: 0, min: 0 },
        restaurantDeliveryFee: { type: Number, default: 0, min: 0 },
        sponsoredDelivery: { type: Boolean, default: false },
        sponsoredKm: { type: Number, default: 0, min: 0 },
        deliveryDistanceKm: { type: Number, default: null, min: 0 },
        deliverySponsorType: { type: String, default: 'USER_FULL', trim: true },
        platformFee: { type: Number, default: 0, min: 0 },
        discount: { type: Number, default: 0, min: 0 },
        couponCode: { type: String, default: null, trim: true },
        appliedCoupon: {
            code: { type: String, default: null, trim: true },
            discount: { type: Number, default: 0, min: 0 },
            source: { type: String, enum: ['admin', 'restaurant'], default: null }
        },
        referralDiscount: { type: Number, default: 0, min: 0 },
        restaurantCommissionPercentage: { type: Number, default: 0 },
        restaurantCommission: { type: Number, default: 0 },
        quickDeliveryFee: { type: Number, default: 0, min: 0 },
        quickPlatformShare: { type: Number, default: 0, min: 0 },
        quickRiderBonus: { type: Number, default: 0, min: 0 },
        quickRiderShare: { type: Number, default: 0, min: 0 },
        quickRestaurantShare: { type: Number, default: 0, min: 0 },
        quickSharePcts: {
            platform: { type: Number, default: 0, min: 0 },
            rider: { type: Number, default: 0, min: 0 },
            restaurant: { type: Number, default: 0, min: 0 },
        },
        quickFinanceVersion: { type: String, default: '' },
        total: { type: Number, default: 0, min: 0 },
        currency: { type: String, default: 'INR', trim: true },
    },

    // Snapshot of payment state at the time of transaction (source of truth for UI)
    payment: {
        method: { type: String, default: 'cash', trim: true },
        status: { type: String, default: 'cod_pending', trim: true },
        amountDue: { type: Number, default: 0, min: 0 },
        razorpay: {
            orderId: { type: String, default: '' },
            paymentId: { type: String, default: '' },
            signature: { type: String, default: '' }
        },
        qr: {
            qrId: { type: String, default: '' },
            imageUrl: { type: String, default: '' },
            paymentLinkId: { type: String, default: '' },
            shortUrl: { type: String, default: '' },
            status: { type: String, default: '' },
            expiresAt: { type: Date, default: null }
        }
    },

    // Financial Breakdown (The Split)
    amounts: {
        totalCustomerPaid: { type: Number, required: true, min: 0 },
        restaurantShare: { type: Number, required: true, min: 0 },
        restaurantCommission: { type: Number, default: 0, min: 0 },
        sellerShare: { type: Number, default: 0, min: 0 },
        sellerCommission: { type: Number, default: 0, min: 0 },
        riderShare: { type: Number, required: true, min: 0 },
        platformNetProfit: { type: Number, required: true, min: 0 },
        taxAmount: { type: Number, default: 0, min: 0 },
        adminDiscountShare: { type: Number, default: 0, min: 0 },
        restaurantDiscountShare: { type: Number, default: 0, min: 0 },
        discountAdminBearPercentage: { type: Number, default: 0, min: 0, max: 100 },
        discountRestaurantBearPercentage: { type: Number, default: 0, min: 0, max: 100 },
        quickDeliveryFee: { type: Number, default: 0, min: 0 },
        quickPlatformShare: { type: Number, default: 0, min: 0 },
        quickRiderBonus: { type: Number, default: 0, min: 0 },
        quickRiderShare: { type: Number, default: 0, min: 0 },
        /**
         * Frozen Restaurant Quick Share snapshot. NOT included in restaurantShare
         * at create — added once on successful delivery (see realizeFoodQuickRestaurantShare).
         */
        quickRestaurantShare: { type: Number, default: 0, min: 0 },
        /** Idempotent guard: restaurant Quick Share already rolled into restaurantShare. */
        quickRestaurantShareRealized: { type: Boolean, default: false },
        quickSharePcts: {
            platform: { type: Number, default: 0, min: 0 },
            rider: { type: Number, default: 0, min: 0 },
            restaurant: { type: Number, default: 0, min: 0 },
        },
        quickFinanceVersion: { type: String, default: '' },
    },

    // Gateway / Provider Metadata
    gateway: {
        provider: { type: String, default: 'razorpay' },
        razorpayOrderId: String,
        razorpayPaymentId: String,
        razorpaySignature: String,
        qrUrl: String,
        qrExpiresAt: Date
    },

    // Settlement Tracking
    settlement: {
        isRestaurantSettled: { type: Boolean, default: false },
        // Cumulative restaurantShare consumed by withdrawals (supports partial settlement)
        restaurantSettledAmount: { type: Number, default: 0, min: 0 },
        restaurantSettledAt: Date,
        isRiderSettled: { type: Boolean, default: false },
        riderSettledAt: Date
    },

    // Audit History (Replacing FoodOrderPayment ledger)
    history: [{
        kind: { type: String, required: true }, // 'created', 'authorized', 'captured', 'refunded', 'settled'
        amount: Number,
        at: { type: Date, default: Date.now },
        note: String,
        recordedBy: { 
            role: { type: String }, 
            id: { type: mongoose.Schema.Types.ObjectId }
        }
    }]
}, { 
    collection: 'food_transactions', 
    timestamps: true 
});

// Powerful indexes for Finance & Analytics
foodTransactionSchema.index({ createdAt: -1 });
foodTransactionSchema.index({ 'settlement.isRestaurantSettled': 1, restaurantId: 1 });
foodTransactionSchema.index({ 'status': 1, paymentMethod: 1 });

export const FoodTransaction = mongoose.model('FoodTransaction', foodTransactionSchema, 'food_transactions');
