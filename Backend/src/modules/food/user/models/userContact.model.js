import mongoose from 'mongoose';

const userContactSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodUser',
            required: true,
            index: true
        },
        contactName: {
            type: String,
            required: true,
            trim: true
        },
        contactNumber: {
            type: String,
            required: true,
            trim: true
        },
        normalizedNumber: {
            type: String,
            required: true,
            trim: true
        }
    },
    { collection: 'food_user_contacts', timestamps: true }
);

// Compound unique index to guarantee uniqueness of normalized contact number per user
userContactSchema.index({ userId: 1, normalizedNumber: 1 }, { unique: true });

export const FoodUserContact = mongoose.model('FoodUserContact', userContactSchema, 'food_user_contacts');
