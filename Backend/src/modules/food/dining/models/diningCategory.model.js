import mongoose from 'mongoose';

const { Schema } = mongoose;

const diningCategorySchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        image: { type: String, required: true },
        isActive: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export const DiningCategory = mongoose.model('DiningCategory', diningCategorySchema, 'dining_categories');
