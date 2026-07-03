import mongoose from 'mongoose';

const kpiSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    metricKey: {
        type: String,
        required: true,
        trim: true,
        // Represents the internal calculation engine key, e.g., RESTAURANT_ONBOARDED, REVENUE, PROFIT, ATTENDANCE
    },
    description: {
        type: String,
        trim: true
    },
    weightage: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        default: 10
    },
    target: {
        type: Number,
        required: true,
        default: 0
    },
    targetType: {
        type: String,
        enum: ['Numeric', 'Currency', 'Percentage'],
        default: 'Numeric'
    },
    frequency: {
        type: String,
        enum: ['Daily', 'Weekly', 'Monthly', 'Yearly'],
        default: 'Monthly'
    },
    department: {
        type: String,
        default: 'All' // Can be restricted to Sales, Operations, etc.
    },
    role: {
        type: String,
        default: 'All' // Can be restricted to Manager, Employee, etc.
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Allows custom math evaluation if needed, though mostly we use metricKey directly
    formula: {
        type: String,
        trim: true
    },
    // Color thresholds
    thresholds: {
        greenMin: { type: Number, default: 80 }, // Above 80% is Green
        orangeMin: { type: Number, default: 50 }, // 50% to 79% is Orange
        // Below orangeMin is Red
    }
}, {
    timestamps: true
});

kpiSchema.index({ metricKey: 1 });
kpiSchema.index({ department: 1, role: 1, isActive: 1 });

export const HrmsKpi = mongoose.model('HrmsKpi', kpiSchema);
