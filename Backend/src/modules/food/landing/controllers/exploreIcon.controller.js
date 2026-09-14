import {
    listExploreIcons,
    createExploreIcon,
    updateExploreIcon,
    deleteExploreIcon,
    toggleExploreIconStatus,
    updateExploreIconOrder
} from '../services/exploreIcon.service.js';
import { sendResponse } from '../../../../utils/response.js';
import { ValidationError } from '../../../../core/auth/errors.js';

/** Normalize item for frontend: expose link, order, and imageUrl (alias for iconUrl) */
const toItem = (doc) => {
    if (!doc) return doc;
    const { targetPath, sortOrder, iconUrl, ...rest } = doc;
    return { ...rest, iconUrl, imageUrl: iconUrl, link: targetPath, order: sortOrder };
};

export const listExploreMoreController = async (req, res, next) => {
    try {
        const data = await listExploreIcons();
        const items = data.map(toItem);
        return sendResponse(res, 200, 'Explore more items fetched successfully', { items });
    } catch (error) {
        next(error);
    }
};

export const createExploreMoreController = async (req, res, next) => {
    try {
        const file = req.file;
        const label = (req.body?.label || '').trim();
        const link = (req.body?.link || '').trim();

        if (!file) {
            throw new ValidationError('Image file is required');
        }
        if (!label) {
            throw new ValidationError('Label is required');
        }

        const created = await createExploreIcon(file, { label, link });
        return sendResponse(res, 201, 'Explore more item created successfully', toItem(created));
    } catch (error) {
        next(error);
    }
};

export const updateExploreMoreController = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) {
            throw new ValidationError('Item id is required');
        }

        const payload = {
            file: req.file,
            label: req.body?.label !== undefined ? req.body.label : undefined,
            link: req.body?.link !== undefined ? req.body.link : undefined
        };

        const updated = await updateExploreIcon(id, payload);
        if (!updated) {
            return sendResponse(res, 404, 'Explore more item not found', null);
        }
        return sendResponse(res, 200, 'Explore more item updated successfully', toItem(updated));
    } catch (error) {
        next(error);
    }
};

export const deleteExploreMoreController = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) {
            throw new ValidationError('Item id is required');
        }
        const result = await deleteExploreIcon(id);
        return sendResponse(
            res,
            200,
            result.deleted ? 'Explore more item deleted' : 'Explore more item not found',
            result
        );
    } catch (error) {
        next(error);
    }
};

/** Toggle isActive (frontend sends empty body) */
export const toggleExploreMoreStatusController = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) {
            throw new ValidationError('Item id is required');
        }
        const updated = await toggleExploreIconStatus(id);
        if (!updated) {
            return sendResponse(res, 404, 'Explore more item not found', null);
        }
        return sendResponse(res, 200, 'Explore more item status updated', toItem(updated));
    } catch (error) {
        next(error);
    }
};

export const updateExploreMoreOrderController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const order = req.body?.order;
        if (!id) {
            throw new ValidationError('Item id is required');
        }
        if (order === undefined || order === null) {
            throw new ValidationError('order is required');
        }
        const num = Number(order);
        if (Number.isNaN(num)) {
            throw new ValidationError('order must be a number');
        }
        const updated = await updateExploreIconOrder(id, num);
        if (!updated) {
            return sendResponse(res, 404, 'Explore more item not found', null);
        }
        return sendResponse(res, 200, 'Explore more order updated', toItem(updated));
    } catch (error) {
        next(error);
    }
};
