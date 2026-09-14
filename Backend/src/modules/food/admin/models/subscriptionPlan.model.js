import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema(
    {
        userType: {
            type: String,
            enum: ['RESTAURANT', 'DELIVERY_PARTNER'],
            required: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true
        },
        durationValue: {
            type: Number,
            required: true,
            min: 1
        },
        durationUnit: {
            type: String,
            enum: ['DAY', 'WEEK', 'MONTH', 'YEAR'],
            required: true
        },
        paymentType: {
            type: String,
            enum: ['ONE_TIME', 'RECURRING'],
            required: true
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        razorpayPlanId: {
            type: String,
            default: null,
            index: true
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        isDeleted: {
            type: Boolean,
            default: false,
            index: true
        }
    },
    { 
        collection: 'food_subscription_plans', 
        timestamps: true 
    }
);

subscriptionPlanSchema.index({ userType: 1, isActive: 1, isDeleted: 1 });

export const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema, 'food_subscription_plans');
