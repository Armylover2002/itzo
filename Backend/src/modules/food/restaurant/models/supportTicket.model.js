import mongoose from 'mongoose';

const restaurantSupportTicketSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant',
            required: true,
            index: true
        },
        category: {
            type: String,
            enum: ['orders', 'payments', 'menu', 'restaurant', 'technical', 'other'],
            required: true
        },
        issueType: { type: String, required: true, trim: true },
        subject: { type: String, default: '', trim: true },
        description: { type: String, default: '', trim: true },
        orderRef: { type: String, default: '', trim: true },
        priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium', index: true },
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
    { collection: 'food_restaurant_support_tickets', timestamps: true }
);

restaurantSupportTicketSchema.index({ restaurantId: 1, createdAt: -1 });
restaurantSupportTicketSchema.index({ status: 1, createdAt: -1 });

export const FoodRestaurantSupportTicket = mongoose.model('FoodRestaurantSupportTicket', restaurantSupportTicketSchema
, 'food_restaurant_support_tickets');
