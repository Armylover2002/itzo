import mongoose from 'mongoose';

const onboardingFeeConfigSchema = new mongoose.Schema(
    {
        role: {
            type: String,
            enum: ['RESTAURANT', 'SELLER', 'DELIVERY_PARTNER'],
            unique: true,
            required: true
        },
        price: {
            type: Number,
            required: true,
            default: 0,
            min: 0
        },
        isActive: {
            type: Boolean,
            required: true,
            default: true
        },
        updatedBy: {
            adminId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'FoodUser',
                default: null
            },
            role: {
                type: String,
                default: ''
            },
            at: {
                type: Date,
                default: null
            }
        }
    },
    {
        collection: 'common_onboarding_fee_configs',
        timestamps: true
    }
);

export const OnboardingFeeConfig = mongoose.model('OnboardingFeeConfig', onboardingFeeConfigSchema);
