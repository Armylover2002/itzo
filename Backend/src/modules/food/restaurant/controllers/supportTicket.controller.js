import mongoose from 'mongoose';
import { FoodRestaurantSupportTicket } from '../models/supportTicket.model.js';
import { sendError, sendResponse } from '../../../../utils/response.js';

const ALLOWED_CATEGORIES = ['orders', 'payments', 'menu', 'restaurant', 'technical', 'other'];
const ALLOWED_PRIORITIES = ['low', 'medium', 'high'];
const ALLOWED_STATUSES = ['open', 'in-progress', 'resolved'];

export const createRestaurantSupportTicketController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
            return sendError(res, 401, 'Unauthorized');
        }

        const body = req.body || {};
        const category = String(body.category || '').trim().toLowerCase();
        const issueType = String(body.issueType || '').trim();
        const subject = String(body.subject || '').trim();
        const description = String(body.description || '').trim();
        const orderRef = String(body.orderRef || body.orderId || '').trim();
        const priority = String(body.priority || 'medium').trim().toLowerCase();

        if (!ALLOWED_CATEGORIES.includes(category)) {
            return sendError(res, 400, 'Invalid category');
        }
        if (!issueType) {
            return sendError(res, 400, 'issueType required');
        }
        if (!ALLOWED_PRIORITIES.includes(priority)) {
            return sendError(res, 400, 'Invalid priority');
        }

        const created = await FoodRestaurantSupportTicket.create({
            restaurantId: new mongoose.Types.ObjectId(restaurantId),
            category,
            issueType,
            subject,
            description,
            orderRef,
            priority
        });

        try {
            const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
            void notifyAdminsSafely({
                title: 'Restaurant support ticket',
                body: subject || issueType || 'New restaurant support request',
                data: {
                    type: 'support_ticket',
                    ticketId: String(created._id),
                    link: '/food/admin/support-tickets',
                },
            });
        } catch (_) { /* non-blocking */ }

        return sendResponse(res, 201, 'Support ticket created successfully', {
            ticket: created.toObject()
        });
    } catch (error) {
        next(error);
    }
};

export const listRestaurantSupportTicketsController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
            return sendError(res, 401, 'Unauthorized');
        }

        const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 20, 1), 100);
        const page = Math.max(parseInt(req.query?.page, 10) || 1, 1);
        const skip = (page - 1) * limit;

        const filter = { restaurantId: new mongoose.Types.ObjectId(restaurantId) };
        const status = String(req.query?.status || '').trim().toLowerCase();
        if (ALLOWED_STATUSES.includes(status)) {
            filter.status = status;
        }

        const searchText = String(req.query?.search || '').trim();
        if (searchText) {
            const rx = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [
                { subject: rx },
                { issueType: rx },
                { description: rx },
                { orderRef: rx }
            ];
        }

        const [tickets, total] = await Promise.all([
            FoodRestaurantSupportTicket.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            FoodRestaurantSupportTicket.countDocuments(filter)
        ]);

        return sendResponse(res, 200, 'Support tickets fetched successfully', {
            tickets,
            total,
            page,
            limit
        });
    } catch (error) {
        next(error);
    }
};
