import { getQueueStats } from '../queues/index.js';
import { sendResponse } from '../utils/response.js';

/**
 * GET /api/v1/admin/queues - Queue observability (admin only).
 * Returns job counts per queue. Does not modify queue logic.
 */
export const getQueuesController = async (req, res, next) => {
    try {
        const queues = await getQueueStats();
        return sendResponse(res, 200, 'Queue stats', { queues });
    } catch (error) {
        next(error);
    }
};
