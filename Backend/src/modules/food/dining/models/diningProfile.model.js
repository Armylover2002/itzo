import mongoose from 'mongoose';

const { Schema } = mongoose;

const diningSlotSchema = new Schema(
    {
        day: { type: String, enum: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], required: true },
        isOpen: { type: Boolean, default: false },
        openingTime: { type: String, default: '' },
        closingTime: { type: String, default: '' },
        slotDurationMinutes: { type: Number, default: 60 },
        capacityPerSlot: { type: Number, default: 0 },
    },
    { _id: false }
);

const diningProfileSchema = new Schema(
    {
        restaurantId: { type: Schema.Types.ObjectId, ref: 'FoodRestaurant', required: true, unique: true, index: true },
        status: { type: String, enum: ['not_requested', 'pending', 'approved', 'rejected'], default: 'not_requested', index: true },
        requestedAt: { type: Date },
        reviewedAt: { type: Date },
        reviewedBy: { type: Schema.Types.ObjectId, ref: 'FoodAdmin' },
        rejectionReason: { type: String },
        isDiningEnabled: { type: Boolean, default: false },
        categoryIds: [{ type: Schema.Types.ObjectId, ref: 'DiningCategory' }],
        description: { type: String, default: '' },
        ambienceImages: [{ type: String }],
        avgCostForTwo: { type: Number, default: 0 },
        slots: { type: [diningSlotSchema], default: [] },
        commission: {
            override: { type: Boolean, default: false },
            type: { type: String, enum: ['percentage', 'amount'], default: 'percentage' },
            value: { type: Number, default: 0 },
        },
    },
    { timestamps: true }
);

export const DiningProfile = mongoose.model('DiningProfile', diningProfileSchema, 'dining_profiles');
