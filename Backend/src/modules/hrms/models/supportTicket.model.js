import mongoose from 'mongoose';

const hrmsSupportTicketSchema = new mongoose.Schema(
    {
        ticketId: { type: String, required: true, unique: true },
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HrmsEmployee',
            required: true
        },
        subject: { type: String, required: true },
        category: { type: String, required: true },
        priority: {
            type: String,
            enum: ['Low', 'Medium', 'High', 'Urgent'],
            default: 'Medium'
        },
        status: {
            type: String,
            enum: ['Open', 'In Progress', 'Waiting for Employee', 'Resolved', 'Closed'],
            default: 'Open'
        },
        assignedAdminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodAdmin'
        },
        unreadByAdmin: { type: Boolean, default: true },
        unreadByEmployee: { type: Boolean, default: false }
    },
    {
        timestamps: true,
        collection: 'hrms_support_tickets'
    }
);

// Indexes for faster filtering and sorting
hrmsSupportTicketSchema.index({ status: 1 });
hrmsSupportTicketSchema.index({ priority: 1 });
hrmsSupportTicketSchema.index({ employeeId: 1 });
hrmsSupportTicketSchema.index({ createdAt: -1 });

export const HrmsSupportTicket = mongoose.model('HrmsSupportTicket', hrmsSupportTicketSchema, 'hrms_support_tickets');
