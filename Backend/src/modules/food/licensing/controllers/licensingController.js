import { sendResponse, sendError } from '../../../../utils/response.js';
import * as licensingService from '../services/licensingService.js';

export const submitLicensingRequestController = async (req, res, next) => {
    try {
        const request = await licensingService.submitLicensingRequestService(req.body, req.files);
        return sendResponse(res, 201, 'Licensing request submitted successfully', request);
    } catch (error) {
        if (error.name === 'ValidationError') {
            return sendError(res, 400, error.message);
        }
        next(error);
    }
};

export const getAllLicensingRequestsController = async (req, res, next) => {
    try {
        const data = await licensingService.getAllLicensingRequestsService(req.query);
        return sendResponse(res, 200, 'Licensing requests retrieved successfully', data);
    } catch (error) {
        next(error);
    }
};

export const getLicensingRequestByIdController = async (req, res, next) => {
    try {
        const request = await licensingService.getLicensingRequestByIdService(req.params.id);
        return sendResponse(res, 200, 'Licensing request details retrieved successfully', request);
    } catch (error) {
        if (error.name === 'NotFoundError') {
            return sendError(res, 404, error.message);
        }
        next(error);
    }
};

export const updateLicensingStatusController = async (req, res, next) => {
    try {
        const { status, remarks } = req.body;
        const adminId = req.user ? req.user._id : null;
        
        const request = await licensingService.updateLicensingStatusService(
            req.params.id,
            status,
            remarks,
            adminId
        );
        return sendResponse(res, 200, 'Licensing request status updated successfully', request);
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

export const deleteLicensingRequestController = async (req, res, next) => {
    try {
        await licensingService.deleteLicensingRequestService(req.params.id);
        return sendResponse(res, 200, 'Licensing request deleted successfully');
    } catch (error) {
        if (error.name === 'NotFoundError') {
            return sendError(res, 404, error.message);
        }
        next(error);
    }
};
