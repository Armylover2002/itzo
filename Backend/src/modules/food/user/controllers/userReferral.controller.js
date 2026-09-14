import { sendResponse } from '../../../../utils/response.js';
import { getUserReferralDetails, getUserReferralStats } from '../services/userReferral.service.js';

export const getUserReferralStatsController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const stats = await getUserReferralStats(userId);
        return sendResponse(res, 200, 'Referral stats fetched successfully', { stats });
    } catch (error) {
        next(error);
    }
};

export const getUserReferralDetailsController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const details = await getUserReferralDetails(userId);
        return sendResponse(res, 200, 'Referral details fetched successfully', details);
    } catch (error) {
        next(error);
    }
};
