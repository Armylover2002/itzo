import { sendResponse, sendError } from '../../utils/response.js';
import {
    resolveNotificationOwnerFromRequest,
    getInboxNotifications,
    markNotificationAsRead,
    dismissNotification,
    dismissAllNotifications
} from './notification.service.js';

export const getInboxController = async (req, res) => {
    try {
        const owner = resolveNotificationOwnerFromRequest(req.user);
        const data = await getInboxNotifications({
            ...owner,
            page: req.query?.page,
            limit: req.query?.limit,
            contextModule: req.query?.contextModule || req.headers['x-context-module']
        });
        return sendResponse(res, 200, 'Notifications fetched successfully', data);
    } catch (error) {
        return sendError(res, error.statusCode || 500, error.message || 'Failed to fetch notifications');
    }
};

const inboxContextModule = (req) =>
    req.query?.contextModule || req.headers['x-context-module'];

export const markNotificationReadController = async (req, res) => {
    try {
        const owner = resolveNotificationOwnerFromRequest(req.user);
        const data = await markNotificationAsRead({
            notificationId: req.params?.id,
            ...owner,
            contextModule: inboxContextModule(req)
        });
        return sendResponse(res, 200, 'Notification marked as read', data);
    } catch (error) {
        return sendError(res, error.statusCode || 500, error.message || 'Failed to update notification');
    }
};

export const dismissNotificationController = async (req, res) => {
    try {
        const owner = resolveNotificationOwnerFromRequest(req.user);
        const data = await dismissNotification({
            notificationId: req.params?.id,
            ...owner,
            contextModule: inboxContextModule(req)
        });
        return sendResponse(res, 200, 'Notification removed successfully', data);
    } catch (error) {
        return sendError(res, error.statusCode || 500, error.message || 'Failed to remove notification');
    }
};

export const dismissAllNotificationsController = async (req, res) => {
    try {
        const owner = resolveNotificationOwnerFromRequest(req.user);
        const data = await dismissAllNotifications({
            ...owner,
            contextModule: inboxContextModule(req)
        });
        return sendResponse(res, 200, 'All notifications removed successfully', data);
    } catch (error) {
        return sendError(res, error.statusCode || 500, error.message || 'Failed to clear notifications');
    }
};
