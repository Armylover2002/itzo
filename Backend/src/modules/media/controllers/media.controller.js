import { getSharedMedia } from '../services/media.service.js';
import { sendResponse } from '../../../utils/response.js';

export const getSharedMediaController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const results = await getSharedMedia(restaurantId, req.query || {});
        return sendResponse(res, 200, 'Shared media fetched successfully', results);
    } catch (error) {
        next(error);
    }
};
