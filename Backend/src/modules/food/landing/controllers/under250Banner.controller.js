import {
    listUnder250Banners,
    createUnder250BannersFromFiles,
    deleteUnder250Banner,
    updateUnder250BannerOrder,
    toggleUnder250BannerStatus
} from '../services/under250Banner.service.js';
import { sendResponse } from '../../../../utils/response.js';
import { ValidationError } from '../../../../core/auth/errors.js';

export const listUnder250BannersController = async (req, res, next) => {
    try {
        const data = await listUnder250Banners();
        return sendResponse(res, 200, 'Under 250 banners fetched successfully', { banners: data });
    } catch (error) {
        next(error);
    }
};

export const uploadUnder250BannersController = async (req, res, next) => {
    try {
        if (!req.files || !req.files.length) {
            throw new ValidationError('No files uploaded');
        }

        const meta = {
            title: req.body.title,
            ctaText: req.body.ctaText,
            ctaLink: req.body.ctaLink,
            zoneId: req.body.zoneId,
        };

        const results = await createUnder250BannersFromFiles(req.files, meta);
        return sendResponse(res, 201, 'Under 250 banners uploaded', { banners: results });
    } catch (error) {
        next(error);
    }
};

export const deleteUnder250BannerController = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) {
            throw new ValidationError('Banner id is required');
        }
        const result = await deleteUnder250Banner(id);
        return sendResponse(res, 200, result.deleted ? 'Under 250 banner deleted' : 'Under 250 banner not found', result);
    } catch (error) {
        next(error);
    }
};

export const updateUnder250BannerOrderController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { order } = req.body;
        const sortOrder = Number(order);
        if (!id || Number.isNaN(sortOrder)) {
            throw new ValidationError('id and numeric order are required');
        }
        const updated = await updateUnder250BannerOrder(id, sortOrder);
        return sendResponse(res, 200, 'Under 250 banner order updated', updated);
    } catch (error) {
        next(error);
    }
};

export const toggleUnder250BannerStatusController = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) {
            throw new ValidationError('Banner id is required');
        }
        // Frontend sends empty body, so toggle based on current
        const banner = await listUnder250Banners().then(list => list.find(b => b._id.toString() === id));
        if (!banner) {
            throw new ValidationError('Under 250 banner not found');
        }
        const updated = await toggleUnder250BannerStatus(id, !banner.isActive);
        return sendResponse(res, 200, 'Under 250 banner status updated', updated);
    } catch (error) {
        next(error);
    }
};

