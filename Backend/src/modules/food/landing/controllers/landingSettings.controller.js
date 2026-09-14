import {
    getLandingSettings,
    updateLandingSettings
} from '../services/landingSettings.service.js';
import { sendResponse } from '../../../../utils/response.js';
import { ValidationError } from '../../../../core/auth/errors.js';

export const getAdminLandingSettingsController = async (req, res, next) => {
    try {
        const settings = await getLandingSettings();
        return sendResponse(res, 200, 'Landing settings fetched successfully', { settings });
    } catch (error) {
        next(error);
    }
};

export const updateAdminLandingSettingsController = async (req, res, next) => {
    try {
        const payload = req.body || {};
        if (typeof payload !== 'object') {
            throw new ValidationError('Invalid settings payload');
        }
        const updated = await updateLandingSettings(payload);
        return sendResponse(res, 200, 'Landing settings updated successfully', { settings: updated });
    } catch (error) {
        next(error);
    }
};



