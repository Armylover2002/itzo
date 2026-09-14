import { sendResponse, sendError } from '../../../../utils/response.js';
import {
    getNotificationChannels,
    updateNotificationChannelTopic,
    updateNotificationChannelsBulk
} from '../services/notificationChannel.service.js';

export const getNotificationChannelsController = async (req, res) => {
    try {
        const data = await getNotificationChannels({ role: req.query?.role });
        return sendResponse(res, 200, 'Notification channels fetched successfully', data);
    } catch (error) {
        return sendError(res, error.statusCode || 500, error.message || 'Failed to fetch notification channels');
    }
};

export const updateNotificationChannelTopicController = async (req, res) => {
    try {
        const data = await updateNotificationChannelTopic({
            role: req.params?.role || req.body?.role,
            topicKey: req.params?.topicKey || req.body?.topicKey || req.body?.key,
            channels: req.body?.channels || {
                push: req.body?.push,
                mail: req.body?.mail,
                sms: req.body?.sms,
                inApp: req.body?.inApp
            }
        });
        return sendResponse(res, 200, 'Notification channel updated successfully', data);
    } catch (error) {
        return sendError(res, error.statusCode || 500, error.message || 'Failed to update notification channel');
    }
};

export const updateNotificationChannelsBulkController = async (req, res) => {
    try {
        const data = await updateNotificationChannelsBulk({
            role: req.params?.role || req.body?.role,
            topics: req.body?.topics
        });
        return sendResponse(res, 200, 'Notification channels updated successfully', data);
    } catch (error) {
        return sendError(res, error.statusCode || 500, error.message || 'Failed to update notification channels');
    }
};
