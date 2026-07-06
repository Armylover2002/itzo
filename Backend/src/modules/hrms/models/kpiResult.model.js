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
    // Complete Financial KPI Breakdown (Gross Revenue, GST, Incentives, Ops Cost, Net Profit)
    financialBreakdown: {
        grossRevenue: { type: Number, default: 0 },
        platformCharges: { type: Number, default: 0 },
        gstAmount: { type: Number, default: 0 },
        operationalCost: { type: Number, default: 0 },
        employeeIncentive: { type: Number, default: 0 },
        approvedExpenses: { type: Number, default: 0 },
        netProfit: { type: Number, default: 0 },
        profitMarginPercent: { type: Number, default: 0 }
    },
    // Performance Level (Excellent, Good, Average, Needs Improvement, Poor)
    performanceLevel: {
        levelName: { type: String, default: 'Good' },
        color: { type: String, default: '#3b82f6' },
        icon: { type: String, default: 'Award' },
        description: { type: String, default: '' }
    },
    // Historical analytics snapshots (Daily, Weekly, Monthly, Quarterly, Yearly) without overwriting
    historicalSnapshots: [{
        snapshotDate: { type: Date, default: Date.now },
        snapshotType: { type: String, enum: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'], default: 'Daily' },
        achievedValue: { type: Number, default: 0 },
        scorePercentage: { type: Number, default: 0 },
        weightedScore: { type: Number, default: 0 }
    }],
    // AI-Ready Modular Architecture for future predictive analytics & insights
    aiReadyMetadata: {
        insights: [{ type: String }],
        improvementSuggestions: [{ type: String }],
        forecastScore: { type: Number, default: 0 },
        attritionRiskScore: { type: Number, default: 0 }, // 0 to 100
        growthPrediction: { type: String, default: 'Stable' }, // High Growth, Stable, Declining
        lastAnalyzedAt: { type: Date }
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
kpiResultSchema.index({ 'performanceLevel.levelName': 1 });
kpiResultSchema.index({ period: 1, scorePercentage: -1 });

export const HrmsKpiResult = mongoose.model('HrmsKpiResult', kpiResultSchema);
