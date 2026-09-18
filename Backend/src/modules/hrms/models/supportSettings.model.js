import mongoose from 'mongoose';

const hrmsSupportSettingsSchema = new mongoose.Schema(
    {
        hrContact: {
            name: { type: String, default: 'HR Manager' },
            email: { type: String, default: 'hr@itzofood.com' },
            mobile: { type: String, default: '+91 9876543210' },
            companySupportEmail: { type: String, default: 'support@itzofood.com' },
            companySupportNumber: { type: String, default: '1800-123-4567' },
            officeAddress: { type: String, default: '123 Tech Park, Bangalore, India' },
            workingDays: { type: String, default: 'Monday to Friday' },
            workingHours: { type: String, default: '10:00 AM - 06:00 PM' },
        },
        ticketConfig: {
            categories: {
                type: [String],
                default: [
                    'Login Issue', 'Attendance', 'Payroll', 'Salary', 'Leave',
                    'Travel Expense', 'Documents', 'Offer Letter', 'Payslip',
                    'Profile', 'Technical Issue', 'Other'
                ]
            },
            priorities: {
                type: [String],
                default: ['Low', 'Medium', 'High', 'Urgent']
            },
            defaultStatus: { type: String, default: 'Open' },
            autoReplyMessage: {
                type: String,
                default: 'Thank you for reaching out to HRMS Support. Your ticket has been logged and our team will get back to you shortly.'
            },
            maxAttachmentSizeMB: { type: Number, default: 5 }
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodAdmin'
        }
    },
    {
        timestamps: true,
        collection: 'hrms_support_settings'
    }
);

export const HrmsSupportSettings = mongoose.model('HrmsSupportSettings', hrmsSupportSettingsSchema, 'hrms_support_settings');
