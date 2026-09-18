import mongoose from 'mongoose';

/**
 * HRMS Travel & Visit Expense
 * Restructured to support detailed travel/visit reimbursement claims.
 */
const hrmsExpenseSchema = new mongoose.Schema(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HrmsEmployee',
            required: true
        },

        // Visit Details
        visitDate: { type: Date, required: true },
        purpose: { type: String, required: true, trim: true },

        // Itemized Costs
        travelDistanceKm: { type: Number, default: 0 },
        travelCost: { type: Number, default: 0 },
        hotelCost: { type: Number, default: 0 },
        foodCost: { type: Number, default: 0 },
        otherExpenses: { type: Number, default: 0 },

        // Total (auto-calculated)
        totalAmount: { type: Number, default: 0 },

        // Attachments (bills, receipts)
        attachments: [{
            name: { type: String },
            url: { type: String }
        }],

        remarks: { type: String, trim: true },

        // Approval workflow
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected', 'Reimbursed'],
            default: 'Pending'
        },
        approvedAmount: { type: Number },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HrmsEmployee'
        },
        rejectionReason: { type: String, trim: true },
        approvedAt: { type: Date },

        // Link to salary for reimbursement tracking
        salaryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HrmsSalary'
        }
    },
    {
        timestamps: true,
        collection: 'hrms_expenses'
    }
);

// Auto-calculate total before save
hrmsExpenseSchema.pre('save', function (next) {
    if (this.isModified('travelCost') || this.isModified('hotelCost') ||
        this.isModified('foodCost') || this.isModified('otherExpenses')) {
        this.totalAmount = (
            (Number(this.travelCost) || 0) +
            (Number(this.hotelCost) || 0) +
            (Number(this.foodCost) || 0) +
            (Number(this.otherExpenses) || 0)
        );
    }
    next();
});

hrmsExpenseSchema.index({ employeeId: 1 });
hrmsExpenseSchema.index({ status: 1 });
hrmsExpenseSchema.index({ visitDate: -1 });

export const HrmsExpense = mongoose.model('HrmsExpense', hrmsExpenseSchema, 'hrms_expenses');

/**
 * HRMS Monthly Travel & Visit Expense Batch
 * Groups multiple visit expenses into a single monthly submission.
 * One batch per employee per month. Submitted after month ends.
 */
const monthlyExpenseEntrySchema = new mongoose.Schema(
    {
        visitDate: { type: Date, required: true },
        purpose: { type: String, required: true, trim: true },
        travelDistanceKm: { type: Number, default: 0, min: 0 },
        travelCost: { type: Number, default: 0, min: 0 },
        hotelCost: { type: Number, default: 0, min: 0 },
        foodCost: { type: Number, default: 0, min: 0 },
        otherExpenses: { type: Number, default: 0, min: 0 },
        remarks: { type: String, trim: true },
        attachments: [{
            name: { type: String },
            url: { type: String }
        }],
        entryTotal: { type: Number, default: 0 }
    },
    { _id: true }
);

const hrmsMonthlyExpenseSchema = new mongoose.Schema(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HrmsEmployee',
            required: true
        },

        // Month & Year for this batch
        month: { type: Number, required: true, min: 1, max: 12 },
        year: { type: Number, required: true },

        // All visit entries for this month
        entries: {
            type: [monthlyExpenseEntrySchema],
            validate: {
                validator: function (v) { return v && v.length > 0; },
                message: 'At least one expense entry is required'
            }
        },

        // Batch-level total (auto-calculated)
        totalAmount: { type: Number, default: 0 },

        // Approval workflow
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected', 'Reimbursed'],
            default: 'Pending'
        },
        approvedAmount: { type: Number },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HrmsEmployee'
        },
        rejectionReason: { type: String, trim: true },
        approvedAt: { type: Date },
        submittedAt: { type: Date, default: Date.now },

        // Resubmission tracking
        resubmissionNote: { type: String, trim: true },
        resubmissionCount: { type: Number, default: 0 },

        // Link to salary for reimbursement tracking
        salaryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HrmsSalary'
        },

        // Flag for migrated legacy data
        isLegacy: { type: Boolean, default: false }
    },
    {
        timestamps: true,
        collection: 'hrms_monthly_expenses'
    }
);

// Auto-calculate entry totals and batch total before save
hrmsMonthlyExpenseSchema.pre('save', function (next) {
    if (this.entries && this.entries.length > 0) {
        let batchTotal = 0;
        for (const entry of this.entries) {
            // Clamp negative values to 0
            entry.travelCost = Math.max(0, Number(entry.travelCost) || 0);
            entry.hotelCost = Math.max(0, Number(entry.hotelCost) || 0);
            entry.foodCost = Math.max(0, Number(entry.foodCost) || 0);
            entry.otherExpenses = Math.max(0, Number(entry.otherExpenses) || 0);
            entry.travelDistanceKm = Math.max(0, Number(entry.travelDistanceKm) || 0);

            entry.entryTotal = entry.travelCost + entry.hotelCost + entry.foodCost + entry.otherExpenses;
            batchTotal += entry.entryTotal;
        }
        this.totalAmount = batchTotal;
    }
    next();
});

// Unique constraint: one submission per employee per month
hrmsMonthlyExpenseSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });
hrmsMonthlyExpenseSchema.index({ status: 1 });
hrmsMonthlyExpenseSchema.index({ month: 1, year: 1 });

export const HrmsMonthlyExpense = mongoose.model('HrmsMonthlyExpense', hrmsMonthlyExpenseSchema, 'hrms_monthly_expenses');
