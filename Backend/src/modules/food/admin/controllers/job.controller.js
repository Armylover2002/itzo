import { sendResponse } from '../../../../utils/response.js';
import * as jobService from '../services/job.service.js';

export const createJobController = async (req, res, next) => {
    try {
        const adminId = req.user?.userId;
        const job = await jobService.createJobService(req.body, adminId);
        return sendResponse(res, 201, 'Job created successfully', job);
    } catch (error) {
        next(error);
    }
};

export const updateJobController = async (req, res, next) => {
    try {
        const job = await jobService.updateJobService(req.params.id, req.body);
        return sendResponse(res, 200, 'Job updated successfully', job);
    } catch (error) {
        next(error);
    }
};

export const deleteJobController = async (req, res, next) => {
    try {
        await jobService.deleteJobService(req.params.id);
        return sendResponse(res, 200, 'Job deleted successfully');
    } catch (error) {
        next(error);
    }
};

export const getAllJobsController = async (req, res, next) => {
    try {
        const data = await jobService.getAdminJobsService(req.query);
        return sendResponse(res, 200, 'Jobs retrieved successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getJobByIdController = async (req, res, next) => {
    try {
        const job = await jobService.getAdminJobByIdService(req.params.id);
        return sendResponse(res, 200, 'Job retrieved successfully', job);
    } catch (error) {
        next(error);
    }
};

export const toggleFeaturedController = async (req, res, next) => {
    try {
        const job = await jobService.toggleFeaturedJobService(req.params.id);
        return sendResponse(res, 200, 'Job featured status toggled successfully', job);
    } catch (error) {
        next(error);
    }
};

export const updateStatusController = async (req, res, next) => {
    try {
        const job = await jobService.updateJobStatusService(req.params.id, req.body.status);
        return sendResponse(res, 200, 'Job status updated successfully', job);
    } catch (error) {
        next(error);
    }
};
