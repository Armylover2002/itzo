import { sendResponse } from '../../../../utils/response.js';
import * as careerService from '../services/career.service.js';

export const getActiveJobsController = async (req, res, next) => {
    try {
        const data = await careerService.getPublicJobsService(req.query);
        return sendResponse(res, 200, 'Active jobs retrieved successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getJobDetailsController = async (req, res, next) => {
    try {
        const job = await careerService.getPublicJobByIdService(req.params.id);
        return sendResponse(res, 200, 'Job details retrieved successfully', job);
    } catch (error) {
        next(error);
    }
};
