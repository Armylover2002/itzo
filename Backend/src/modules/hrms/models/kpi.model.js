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
        // Represents the internal calculation engine key, e.g., REST_ONBOARDED_COUNT, REVENUE_GENERATED, ATTENDANCE_SCORE, DYNAMIC_FORMULA
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HrmsKpiCategory',
        index: true
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
    // Dynamic formula expression using variables (e.g. RESTAURANTS_ONBOARDED, ACTIVE_RESTAURANTS, GROSS_REVENUE, etc.)
    formulaExpression: {
        type: String,
        trim: true
    },
    // Legacy formula field for backward compatibility
    formula: {
        type: String,
        trim: true
    },
    // Advanced configurable rules for Active Restaurants, Orders threshold, and RBAC scoping
    ruleConfig: {
        appliesToRole: [{ type: String }],
        appliesToDepartment: [{ type: String }],
        appliesToEmployeeType: [{ type: String }],
        minOrdersThreshold: { type: Number, default: 1 },
        minDailyOrders: { type: Number, default: 0 },
        minMonthlyOrders: { type: Number, default: 0 },
        activeRestaurantRules: {
            requireApproved: { type: Boolean, default: true },
            requireMenuAvailable: { type: Boolean, default: true },
            requireAcceptingOrders: { type: Boolean, default: true },
            requireNotSuspended: { type: Boolean, default: true },
            minOrders: { type: Number, default: 1 }
        }
    },
    // Color thresholds (Backward compatible)
    thresholds: {
        greenMin: { type: Number, default: 80 }, // Above 80% is Green
        orangeMin: { type: Number, default: 50 }, // 50% to 79% is Orange
        // Below orangeMin is Red
    },
    // Dynamic Performance Levels (Excellent, Good, Average, Needs Improvement, Poor)
    performanceLevels: {
        type: [{
            levelName: { type: String, required: true },
            minScore: { type: Number, required: true },
            maxScore: { type: Number, required: true },
            color: { type: String, default: '#10b981' },
            icon: { type: String, default: 'Award' },
            description: { type: String, default: '' }
        }],
        default: [
            { levelName: 'Excellent', minScore: 90, maxScore: 9999, color: '#10b981', icon: 'Trophy', description: 'Consistently exceeds all targets and expectations.' },
            { levelName: 'Good', minScore: 75, maxScore: 89.99, color: '#3b82f6', icon: 'Award', description: 'Meets and often exceeds targets.' },
            { levelName: 'Average', minScore: 60, maxScore: 74.99, color: '#f59e0b', icon: 'TrendingUp', description: 'Meets core performance standards.' },
            { levelName: 'Needs Improvement', minScore: 40, maxScore: 59.99, color: '#f97316', icon: 'AlertCircle', description: 'Below target; requires focus and coaching.' },
            { levelName: 'Poor', minScore: 0, maxScore: 39.99, color: '#ef4444', icon: 'XCircle', description: 'Critical underperformance.' }
        ]
    }
}, {
    timestamps: true
});

kpiSchema.index({ metricKey: 1 });
kpiSchema.index({ department: 1, role: 1, isActive: 1 });

export const HrmsKpi = mongoose.model('HrmsKpi', kpiSchema);
