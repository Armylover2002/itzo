import mongoose from 'mongoose';

const quickSupportTicketSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', default: null, index: true },
    sessionId: { type: String, default: '', trim: true, index: true },
    type: { type: String, enum: ['order', 'seller', 'other'], required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodOrder', default: null },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', default: null },
    issueType: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    status: { type: String, enum: ['open', 'in-progress', 'resolved'], default: 'open', index: true },
    adminResponse: { type: String, default: '', trim: true },
  },
  { collection: 'quick_support_tickets', timestamps: true },
);

quickSupportTicketSchema.index({ createdAt: -1 });
quickSupportTicketSchema.index({ userId: 1, createdAt: -1 });
quickSupportTicketSchema.index({ sessionId: 1, createdAt: -1 });
// Admin support grid filters by status/type and sorts by createdAt desc.
quickSupportTicketSchema.index({ status: 1, createdAt: -1 });
quickSupportTicketSchema.index({ type: 1, status: 1, createdAt: -1 });

export const QuickSupportTicket = mongoose.model(
  'QuickSupportTicket',
  quickSupportTicketSchema,
  'quick_support_tickets',
);
