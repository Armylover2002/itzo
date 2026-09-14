import mongoose from 'mongoose';

const feedbackExperienceSchema = new mongoose.Schema(
    {
        userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            required: true,
            refPath: 'userModel'
        },
        userModel: {
            type: String,
            required: true,
            enum: ['FoodUser', 'FoodRestaurant', 'FoodDeliveryPartner'],
            default: 'FoodUser'
        },
        restaurantId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'FoodRestaurant', 
            index: true 
        },
        rating: { 
            type: Number, 
            required: true,
            min: 1,
            max: 5
        },
        comment: { 
            type: String, 
            trim: true,
            default: ''
        },
        module: { 
            type: String, 
            enum: ['user', 'restaurant', 'delivery'],
            required: true,
            index: true
        }
    },
    {
        collection: 'food_feedback_experiences',
        timestamps: true
    }
);

feedbackExperienceSchema.index({ module: 1, createdAt: -1 });
feedbackExperienceSchema.index({ userId: 1, createdAt: -1 });

export const FeedbackExperience = mongoose.model('FeedbackExperience', feedbackExperienceSchema, 'food_feedback_experiences');
