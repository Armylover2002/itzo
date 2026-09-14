import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', required: true, index: true },
        type: { type: String, enum: ['order', 'restaurant', 'other'], required: true },
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodOrder', default: null },
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', default: null },
        issueType: { type: String, required: true, trim: true },
        description: { type: String, default: '', trim: true },
        status: { type: String, enum: ['open', 'in-progress', 'resolved'], default: 'open', index: true },
        adminResponse: { type: String, default: '' },
        respondedAt: { type: Date, default: null },
        responseHistory: {
            type: [
                {
                    status: { type: String },
                    adminResponse: { type: String },
                    adminId: { type: mongoose.Schema.Types.ObjectId, default: null },
                    adminName: { type: String, default: '' },
                    at: { type: Date, default: Date.now }
                }
            ],
            default: []
        }
    },
    { collection: 'food_support_tickets', timestamps: true }
);

supportTicketSchema.index({ userId: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, createdAt: -1 });

export const FoodSupportTicket = mongoose.model('FoodSupportTicket', supportTicketSchema, 'food_support_tickets');
