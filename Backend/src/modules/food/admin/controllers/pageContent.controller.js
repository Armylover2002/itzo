import { sendResponse } from '../../../../utils/response.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import {
    getPublicPageByKey,
    getAdminPageByKey,
    upsertLegalPage,
    upsertAboutPage
} from '../services/pageContent.service.js';

const parseKeyFromParam = (req) => String(req.params?.key || '').trim().toLowerCase();

export const getPublicPageController = async (req, res, next) => {
    try {
        const key = parseKeyFromParam(req);
        let role = req.query?.role;
        if (!role) {
            role = (key === 'about') ? 'all' : 'user';
        }
        const result = await getPublicPageByKey(key, role);
        return sendResponse(res, 200, 'Page fetched successfully', result.data);
    } catch (error) {
        next(error);
    }
};

export const getAdminPageController = async (req, res, next) => {
    try {
        const key = parseKeyFromParam(req);
        let role = req.query?.role;
        if (!role) {
            role = (key === 'about') ? 'all' : 'user';
        }
        const result = await getAdminPageByKey(key, role);
        return sendResponse(res, 200, 'Page fetched successfully', result.data);
    } catch (error) {
        next(error);
    }
};

export const upsertAdminPageController = async (req, res, next) => {
    try {
        const key = parseKeyFromParam(req);
        const role = req.body?.role || 'user';
        const updatedBy = req.user?.userId || null;

        if (key === 'about') {
            const result = await upsertAboutPage(req.body ?? {}, updatedBy);
            return sendResponse(res, 200, 'Page updated successfully', result.data);
        }
        if (['terms', 'privacy', 'support', 'refund', 'shipping', 'cancellation'].includes(key)) {
            const result = await upsertLegalPage(key, req.body ?? {}, updatedBy, role);
            return sendResponse(res, 200, 'Page updated successfully', result.data);
        }
        throw new ValidationError('Invalid page key');
    } catch (error) {
        next(error);
    }
};

