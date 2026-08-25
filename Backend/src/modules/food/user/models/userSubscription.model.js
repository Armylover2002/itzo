import mongoose from 'mongoose';

const userSubscriptionSchema = new mongoose.Schema(
    {
        // Dedicated ownership fields
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant',
            default: null
        },
        deliveryBoyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodDeliveryPartner',
            default: null
        },
        userType: {
            type: String,
            enum: ['RESTAURANT', 'DELIVERY_PARTNER'],
            required: true,
            index: true
        },
        planId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SubscriptionPlan',
            required: true
        },
        subscriptionSource: {
            type: String,
            default: 'ADMIN_PLAN'
        },
        razorpaySubscriptionId: {
            type: String,
            index: true,
            default: null
        },
        razorpayPaymentId: {
            type: String,
            index: true,
            default: null
        },
        startDate: {
            type: Date,
            index: true
        },
        expiryDate: {
            type: Date,
            index: true
        },
        gracePeriodUntil: {
            type: Date,
            index: true
        },
        renewalCount: {
            type: Number,
            default: 0
        },
        lastRenewedAt: {
            type: Date
        },
        autoRenew: {
            type: Boolean,
            default: false
        },
        status: {
            type: String,
            enum: ['pending', 'failed', 'active', 'grace', 'expired', 'cancelled'],
            default: 'pending',
            index: true
        },
        cancelAt: {
            type: Date
        },
        cancelAtCycleEnd: {
            type: Boolean,
            default: false
        },
        cancellationReason: {
            type: String
        },
        purchasedPlanName: {
            type: String,
            default: null
        },
        purchasedPrice: {
            type: Number,
            default: null
        },
        purchasedDuration: {
            type: Number,
            default: null
        },
        purchasedDurationType: {
            type: String,
            default: null
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    { 
        collection: 'food_user_subscriptions', 
        timestamps: true 
    }
);

// Ensure a user can only have one active/grace subscription at a time per role
userSubscriptionSchema.index(
    { restaurantId: 1 }, 
    { 
        unique: true, 
        partialFilterExpression: { 
            restaurantId: { $exists: true, $ne: null }, 
            status: { $in: ['active', 'grace'] } 
        } 
    }
);
userSubscriptionSchema.index(
    { deliveryBoyId: 1 }, 
    { 
        unique: true, 
        partialFilterExpression: { 
            deliveryBoyId: { $exists: true, $ne: null }, 
            status: { $in: ['active', 'grace'] } 
        } 
    }
);

userSubscriptionSchema.index(
    { restaurantId: 1, planId: 1, status: 1 },
    {
        unique: true,
        partialFilterExpression: {
            restaurantId: { $exists: true, $ne: null },
            status: 'pending'
        }
    }
);
userSubscriptionSchema.index(
    { deliveryBoyId: 1, planId: 1, status: 1 },
    {
        unique: true,
        partialFilterExpression: {
            deliveryBoyId: { $exists: true, $ne: null },
            status: 'pending'
        }
    }
);

// Strict Ownership Validation
userSubscriptionSchema.pre('validate', function(next) {
    if (this.userType === 'RESTAURANT') {
        if (!this.restaurantId) return next(new Error('restaurantId is required for RESTAURANT type'));
        if (this.deliveryBoyId) return next(new Error('deliveryBoyId must be null for RESTAURANT type'));
    } else if (this.userType === 'DELIVERY_PARTNER') {
        if (!this.deliveryBoyId) return next(new Error('deliveryBoyId is required for DELIVERY_PARTNER type'));
        if (this.restaurantId) return next(new Error('restaurantId must be null for DELIVERY_PARTNER type'));
    }
    next();
});

export const UserSubscription = mongoose.model('UserSubscription', userSubscriptionSchema, 'food_user_subscriptions');
