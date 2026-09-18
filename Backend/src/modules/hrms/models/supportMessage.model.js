import mongoose from 'mongoose';

const hrmsSupportMessageSchema = new mongoose.Schema(
    {
        ticketId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HrmsSupportTicket',
            required: true
        },
        senderType: {
            type: String,
            enum: ['Employee', 'Admin'],
            required: true
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            // Could ref HrmsEmployee or FoodAdmin based on senderType
            // For now, no hard ref check, handled in application logic
        },
        message: {
            type: String,
            required: function() { return !this.attachments || this.attachments.length === 0; }
        },
        attachments: [{
            url: { type: String, required: true },
            name: { type: String, required: true },
            type: { type: String },
            size: { type: Number }
        }],
        isRead: { type: Boolean, default: false }
    },
    {
        timestamps: true,
        collection: 'hrms_support_messages'
    }
);

hrmsSupportMessageSchema.index({ ticketId: 1, createdAt: 1 });

export const HrmsSupportMessage = mongoose.model('HrmsSupportMessage', hrmsSupportMessageSchema, 'hrms_support_messages');
