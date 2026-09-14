import mongoose from 'mongoose';
import { FoodSupportTicket } from '../models/supportTicket.model.js';
import { sendResponse, sendError } from '../../../../utils/response.js';

export async function createSupportTicketController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const body = req.body || {};
        const type = String(body.type || '').trim();
        const issueType = String(body.issueType || '').trim();
        const description = String(body.description || '').trim();
        if (!['order', 'restaurant', 'other'].includes(type)) {
            return sendError(res, 400, 'Invalid ticket type');
        }
        if (!issueType) return sendError(res, 400, 'issueType required');
        const doc = {
            userId: new mongoose.Types.ObjectId(userId),
            type,
            issueType,
            description
        };
        if (type === 'order') {
            if (!body.orderId || !mongoose.Types.ObjectId.isValid(body.orderId)) {
                return sendError(res, 400, 'orderId required');
            }
            const orderMongoId = new mongoose.Types.ObjectId(body.orderId);
            doc.orderId = orderMongoId;
            // Also try to link restaurantId automatically if possible
            const { FoodOrder } = await import('../../orders/models/order.model.js');
            const order = await FoodOrder.findById(orderMongoId).select('restaurantId').lean();
            if (order?.restaurantId) {
                doc.restaurantId = order.restaurantId;
            }
        }
        if (type === 'restaurant') {
            if (!body.restaurantId || !mongoose.Types.ObjectId.isValid(body.restaurantId)) {
                return sendError(res, 400, 'restaurantId required');
            }
            doc.restaurantId = new mongoose.Types.ObjectId(body.restaurantId);
        }
        const created = await FoodSupportTicket.create(doc);
        try {
            const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
            void notifyAdminsSafely({
                title: 'New support ticket',
                body: `User ticket: ${issueType || type}`,
                data: {
                    type: 'support_ticket',
                    ticketId: String(created._id),
                    link: '/food/admin/support-tickets',
                },
            });
        } catch (_) { /* non-blocking */ }
        return sendResponse(res, 201, 'Ticket created', { ticket: created.toObject() });
    } catch (e) {
        next(e);
    }
}

export async function listMySupportTicketsController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 20, 1), 50);
        const page = Math.max(parseInt(req.query?.page, 10) || 1, 1);
        const skip = (page - 1) * limit;
        const [tickets, total] = await Promise.all([
            FoodSupportTicket.find({ userId: new mongoose.Types.ObjectId(userId) })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            FoodSupportTicket.countDocuments({ userId: new mongoose.Types.ObjectId(userId) })
        ]);
        return sendResponse(res, 200, 'Tickets fetched', { tickets, total, page, limit });
    } catch (e) {
        next(e);
    }
}
