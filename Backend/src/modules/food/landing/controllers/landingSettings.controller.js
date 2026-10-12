import {
    deleteLandingHeaderVideo,
    getLandingSettings,
    updateLandingSettings,
    uploadLandingHeaderVideo
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
        if (payload.homePriceFilter !== undefined) {
            const filter = payload.homePriceFilter || {};
            const maxPrice = Number(filter.maxPrice);
            if (!Number.isFinite(maxPrice) || maxPrice <= 0) {
                throw new ValidationError('Price limit must be a number greater than 0');
            }
            payload.homePriceFilter = {
                title: String(filter.title || '').trim() || 'Meals under',
                maxPrice: Math.round(maxPrice),
                isActive: filter.isActive !== false
            };
        }
        const updated = await updateLandingSettings(payload);
        return sendResponse(res, 200, 'Landing settings updated successfully', { settings: updated });
    } catch (error) {
        next(error);
    }
};

export const uploadAdminLandingHeaderVideoController = async (req, res, next) => {
    try {
        if (!req.file) {
            throw new ValidationError('Video file is required');
        }
        const updated = await uploadLandingHeaderVideo(req.file);
        return sendResponse(res, 200, 'Landing header video uploaded successfully', { settings: updated });
    } catch (error) {
        next(error);
    }
};

export const deleteAdminLandingHeaderVideoController = async (req, res, next) => {
    try {
        const updated = await deleteLandingHeaderVideo();
        return sendResponse(res, 200, 'Landing header video removed successfully', { settings: updated });
    } catch (error) {
        next(error);
    }
};
