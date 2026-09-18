import mongoose from 'mongoose';

const hrmsSalarySchema = new mongoose.Schema(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HrmsEmployee',
            required: true
        },
        month: { type: Number, required: true }, // 1-12
        year: { type: Number, required: true }, // e.g., 2026
        
        // Base Compensation
        baseSalary: { type: Number, default: 0 },

        // Working metrics for the month
        totalWorkingDays: { type: Number, default: 0 },
        presentDays: { type: Number, default: 0 },
        paidLeaveDays: { type: Number, default: 0 },
        lopDays: { type: Number, default: 0 },
        absentDays: { type: Number, default: 0 },
        totalShortHours: { type: Number, default: 0 },
        totalOvertimeHours: { type: Number, default: 0 },

        // Deductions & Additions
        shortHourDeduction: { type: Number, default: 0 },
        overtimeBonus: { type: Number, default: 0 },
        lopDeduction: { type: Number, default: 0 },
        reimbursements: { type: Number, default: 0 },
        
        netSalary: { type: Number, default: 0 },

        // Status & Delivery
        status: {
            type: String,
            enum: ['Draft', 'Approved', 'Paid'],
            default: 'Draft'
        },
        paidAt: { type: Date },
        payslipUrl: { type: String },
        payslipVersion: { type: Number, default: 0 },
        payslipGeneratedAt: { type: Date }
    },
    {
        timestamps: true,
        collection: 'hrms_salaries'
    }
);

hrmsSalarySchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });
hrmsSalarySchema.index({ month: 1, year: 1 });

export const HrmsSalary = mongoose.model('HrmsSalary', hrmsSalarySchema, 'hrms_salaries');
