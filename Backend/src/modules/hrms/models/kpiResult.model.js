import mongoose from 'mongoose';

const kpiResultSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HrmsEmployee',
        required: true,
        index: true
    },
    // The specific KPI that was evaluated
    kpiId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HrmsKpi',
        required: true,
        index: true
    },
    // E.g., '2023-10' or '2023-10-15' depending on evaluation frequency
    period: {
        type: String,
        required: true,
        index: true
    },
    // Evaluated Metric Data
    achievedValue: {
        type: Number,
        default: 0
    },
    targetValue: {
        type: Number,
        default: 0
    },
    scorePercentage: {
        type: Number,
        default: 0
    },
    weightedScore: {
        type: Number,
        default: 0
    },
    // Raw metrics used to calculate the result (for drill down / audit)
    rawMetrics: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    calculatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// An employee should have only one result per KPI per period
kpiResultSchema.index({ employeeId: 1, kpiId: 1, period: 1 }, { unique: true });

export const HrmsKpiResult = mongoose.model('HrmsKpiResult', kpiResultSchema);
