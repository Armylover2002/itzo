import mongoose from 'mongoose';

const hrmsDailyReportCommentSchema = new mongoose.Schema(
    {
        reportId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HrmsDailyReport',
            required: true
        },
        senderType: {
            type: String,
            enum: ['Employee', 'Admin', 'Manager'],
            required: true
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true // Can be HrmsEmployee (if Employee/Manager) or FoodAdmin (if Admin)
        },
        message: {
            type: String,
            required: true,
            trim: true
        },
        attachments: [{
            name: { type: String },
            url: { type: String },
            type: { type: String }
        }]
    },
    {
        timestamps: true,
        collection: 'hrms_daily_report_comments'
    }
);

hrmsDailyReportCommentSchema.index({ reportId: 1 });
hrmsDailyReportCommentSchema.index({ createdAt: 1 });

export const HrmsDailyReportComment = mongoose.model('HrmsDailyReportComment', hrmsDailyReportCommentSchema, 'hrms_daily_report_comments');
