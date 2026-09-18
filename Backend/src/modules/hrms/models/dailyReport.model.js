import mongoose from 'mongoose';

const hrmsDailyReportSchema = new mongoose.Schema(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HrmsEmployee',
            required: true
        },
        reportDate: {
            type: Date,
            required: true
        },
        
        // Today's Work
        tasks: [{
            title: { type: String, required: true },
            category: { type: String, default: 'General' },
            status: { type: String, enum: ['Completed', 'In Progress', 'Pending'], default: 'Completed' }
        }],
        workSummary: { type: String, trim: true },
        
        // Metrics & KPI (Useful for sales/field agents)
        metrics: {
            restaurantsVisited: { type: Number, default: 0 },
            restaurantsVisitedNames: [{ type: String, trim: true }],
            meetingsConducted: { type: Number, default: 0 },
            callsMade: { type: Number, default: 0 },
            leadsGenerated: { type: Number, default: 0 },
            ordersCompleted: { type: Number, default: 0 }
        },

        // Travel Summary (Integrates with Expense module)
        travelSummary: {
            distanceKm: { type: Number, default: 0 },
            vehicleUsed: { type: String, trim: true },
            travelCost: { type: Number, default: 0 },
            foodExpense: { type: Number, default: 0 },
            hotelExpense: { type: Number, default: 0 },
            otherExpense: { type: Number, default: 0 },
            expenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrmsExpense' } // Linked Draft Expense
        },
        
        // Feedback & Planning
        problemsFaced: { type: String, trim: true },
        achievements: { type: String, trim: true },
        pendingWork: { type: String, trim: true },
        tomorrowPlan: { type: String, trim: true },
        remarks: { type: String, trim: true },

        attachments: [{
            name: { type: String },
            url: { type: String },
            type: { type: String },
            size: { type: Number }
        }],

        status: {
            type: String,
            enum: ['Draft', 'Submitted', 'Under Review', 'Revision Requested', 'Approved', 'Rejected'],
            default: 'Draft'
        },

        // Workflow details
        managerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HrmsEmployee' // Reporting Manager at the time of submission
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodAdmin' // Admin or Manager who reviewed it
        },
        reviewDate: { type: Date }
    },
    {
        timestamps: true,
        collection: 'hrms_daily_reports'
    }
);

// Prevent duplicate reports for the same employee and date (using unique compound index)
// Note: We'll set the date to midnight UTC before saving to ensure strict unique constraint on date.
hrmsDailyReportSchema.index({ employeeId: 1, reportDate: 1 }, { unique: true });
hrmsDailyReportSchema.index({ status: 1 });
hrmsDailyReportSchema.index({ managerId: 1 });

export const HrmsDailyReport = mongoose.model('HrmsDailyReport', hrmsDailyReportSchema, 'hrms_daily_reports');
