import mongoose from 'mongoose';

const hrmsDailyReportSettingsSchema = new mongoose.Schema(
    {
        // Allowed Categories for tasks
        categories: {
            type: [String],
            default: ['General', 'Sales', 'Field Visit', 'Support', 'Meetings', 'Development']
        },
        
        // Required sections and validations
        requireMetrics: { type: Boolean, default: true },
        requireTravelSummary: { type: Boolean, default: false },
        requireTomorrowPlan: { type: Boolean, default: true },
        requireAttachments: { type: Boolean, default: false },
        
        // Attachment limits
        maxUploadSizeMB: { type: Number, default: 5 },
        maxAttachments: { type: Number, default: 5 },
        allowedFileTypes: {
            type: [String],
            default: ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
        },

        // Deadlines & Reminders
        submissionDeadlineTime: { type: String, default: '18:00' }, // HH:mm format
        autoReminderEnabled: { type: Boolean, default: true },
        autoReminderMessage: { 
            type: String, 
            default: 'Please remember to submit your Daily Work Report before the deadline.' 
        },

        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodAdmin' // Standard ECS Admin reference
        }
    },
    {
        timestamps: true,
        collection: 'hrms_daily_report_settings'
    }
);

export const HrmsDailyReportSettings = mongoose.model('HrmsDailyReportSettings', hrmsDailyReportSettingsSchema, 'hrms_daily_report_settings');
