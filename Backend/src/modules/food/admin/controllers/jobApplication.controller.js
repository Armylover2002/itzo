import { sendResponse, sendError } from '../../../../utils/response.js';
import * as jobApplicationService from '../services/jobApplication.service.js';

export const submitApplicationController = async (req, res, next) => {
    try {
        const application = await jobApplicationService.submitApplicationService(req.body, req.files);
        return sendResponse(res, 201, 'Application submitted successfully', application);
    } catch (error) {
        if (error.name === 'ValidationError') {
            return sendError(res, 400, error.message);
        }
        next(error);
    }
};

export const getAllApplicationsController = async (req, res, next) => {
    try {
        const data = await jobApplicationService.getAllApplicationsService(req.query);
        return sendResponse(res, 200, 'Applications retrieved successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getApplicationByIdController = async (req, res, next) => {
    try {
        const application = await jobApplicationService.getApplicationByIdService(req.params.id);
        return sendResponse(res, 200, 'Application details retrieved successfully', application);
    } catch (error) {
        if (error.name === 'NotFoundError') {
            return sendError(res, 404, error.message);
        }
        next(error);
    }
};

export const updateApplicationStatusController = async (req, res, next) => {
    try {
        const { status, remarks } = req.body;
        const adminId = req.user ? req.user._id : null;
        
        const application = await jobApplicationService.updateApplicationStatusService(
            req.params.id,
            status,
            remarks,
            adminId
        );
        return sendResponse(res, 200, 'Application status updated successfully', application);
    } catch (error) {
        if (error.name === 'NotFoundError') {
            return sendError(res, 404, error.message);
        }
        if (error.name === 'ValidationError') {
            return sendError(res, 400, error.message);
        }
        next(error);
    }
};

export const deleteApplicationController = async (req, res, next) => {
    try {
        await jobApplicationService.deleteApplicationService(req.params.id);
        return sendResponse(res, 200, 'Application deleted successfully');
    } catch (error) {
        if (error.name === 'NotFoundError') {
            return sendError(res, 404, error.message);
        }
        next(error);
    }
};

export const getApplicationStatsController = async (req, res, next) => {
    try {
        const stats = await jobApplicationService.getApplicationStatsService();
        return sendResponse(res, 200, 'Application statistics retrieved successfully', stats);
    } catch (error) {
        next(error);
    }
};
