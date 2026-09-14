import mongoose from 'mongoose';

const safetyEmergencyReportSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', required: true, index: true },
        userName: { type: String, default: '' },
        userEmail: { type: String, default: '' },
        userPhone: { type: String, default: '' },
        message: { type: String, required: true, trim: true, maxlength: 4000 },
        status: {
            type: String,
            enum: ['unread', 'read', 'urgent', 'resolved'],
            default: 'unread',
            index: true
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium',
            index: true
        }
    },
    { collection: 'food_safety_emergency_reports', timestamps: true }
);

safetyEmergencyReportSchema.index({ createdAt: -1 });
safetyEmergencyReportSchema.index({ status: 1, priority: 1, createdAt: -1 });

export const FoodSafetyEmergencyReport = mongoose.model('FoodSafetyEmergencyReport', safetyEmergencyReportSchema, 'food_safety_emergency_reports');

