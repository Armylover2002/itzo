import { sendResponse } from '../../../../utils/response.js';
import { validateSafetyEmergencyCreateDto } from '../../../../dtos/food/safetyEmergencyCreate.dto.js';
import { createSafetyEmergencyReport, listMySafetyEmergencyReports } from '../services/userSafetyEmergency.service.js';

export const createSafetyEmergencyReportController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const body = validateSafetyEmergencyCreateDto(req.body || {});
        const result = await createSafetyEmergencyReport(userId, body.message);
        return sendResponse(res, 201, 'Safety emergency report submitted successfully', result);
    } catch (error) {
        next(error);
    }
};

export const listMySafetyEmergencyReportsController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const result = await listMySafetyEmergencyReports(userId, req.query || {});
        return sendResponse(res, 200, 'Safety emergency reports fetched successfully', result);
    } catch (error) {
        next(error);
    }
};

