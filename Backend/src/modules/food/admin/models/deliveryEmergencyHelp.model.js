import mongoose from 'mongoose';

const deliveryEmergencyHelpSchema = new mongoose.Schema(
    {
        medicalEmergency: { type: String, trim: true, default: '' },
        accidentHelpline: { type: String, trim: true, default: '' },
        contactPolice: { type: String, trim: true, default: '' },
        insurance: { type: String, trim: true, default: '' },
        isActive: { type: Boolean, default: true, index: true }
    },
    { collection: 'food_delivery_emergency_help', timestamps: true }
);

deliveryEmergencyHelpSchema.index({ isActive: 1, createdAt: -1 });

export const FoodDeliveryEmergencyHelp = mongoose.model('FoodDeliveryEmergencyHelp', deliveryEmergencyHelpSchema, 'food_delivery_emergency_help');

