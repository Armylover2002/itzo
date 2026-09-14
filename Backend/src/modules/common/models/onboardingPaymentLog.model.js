import mongoose from 'mongoose';

const onboardingPaymentLogSchema = new mongoose.Schema(
    {
        razorpayOrderId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        razorpayPaymentId: {
            type: String,
            default: null
        },
        razorpaySignature: {
            type: String,
            default: null
        },
        role: {
            type: String,
            enum: ['RESTAURANT', 'SELLER', 'DELIVERY_PARTNER'],
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        status: {
            type: String,
            enum: ['pending', 'success', 'failed'],
            default: 'pending',
            index: true
        },
        userDetails: {
            name: {
                type: String,
                required: true,
                trim: true
            },
            phone: {
                type: String,
                required: true,
                trim: true
            },
            email: {
                type: String,
                default: '',
                trim: true
            }
        },
        entityId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
            index: true
        },
        errorDetails: {
            type: String,
            default: null
        }
    },
    {
        collection: 'common_onboarding_payment_logs',
        timestamps: true
    }
);

export const OnboardingPaymentLog = mongoose.model('OnboardingPaymentLog', onboardingPaymentLogSchema);
