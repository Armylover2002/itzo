import { sendResponse, sendError } from '../../../../utils/response.js';
import {
    createBroadcastNotification,
    getBroadcastNotifications,
    deleteBroadcastNotification
} from '../services/notificationBroadcast.service.js';

export const createBroadcastNotificationController = async (req, res) => {
    try {
        const debug =
            String(req.query?.debug || '').trim() === 'true' ||
            process.env.NODE_ENV === 'development';
        const data = await createBroadcastNotification({
            body: req.body,
            adminId: req.user?.userId,
            includeRecipientDetails: debug
        });
        return sendResponse(res, 201, 'Broadcast notification created successfully', data);
    } catch (error) {
        return sendError(res, error.statusCode || 500, error.message || 'Failed to create broadcast notification');
    }
};

export const getBroadcastNotificationsController = async (req, res) => {
    try {
        const data = await getBroadcastNotifications({
            page: req.query?.page,
            limit: req.query?.limit
        });
        return sendResponse(res, 200, 'Broadcast notifications fetched successfully', data);
    } catch (error) {
        return sendError(res, error.statusCode || 500, error.message || 'Failed to fetch broadcast notifications');
    }
};

export const deleteBroadcastNotificationController = async (req, res) => {
    try {
        const data = await deleteBroadcastNotification(req.params?.id);
        return sendResponse(res, 200, 'Broadcast notification deleted successfully', data);
    } catch (error) {
        return sendError(res, error.statusCode || 500, error.message || 'Failed to delete broadcast notification');
    }
};
