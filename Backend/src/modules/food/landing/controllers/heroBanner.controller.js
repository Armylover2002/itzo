import {
    listHeroBanners,
    createHeroBannersFromFiles,
    deleteHeroBanner,
    updateHeroBannerOrder,
    toggleHeroBannerStatus,
    updateHeroBanner
} from '../services/heroBanner.service.js';
import { sendResponse } from '../../../../utils/response.js';
import { ValidationError } from '../../../../core/auth/errors.js';

/** Normalize for admin UI which expects `order` (DB stores `sortOrder`). */
const toHeroBanner = (doc) => {
    if (!doc) return doc;
    const { sortOrder, linkedRestaurantIds, ...rest } = doc;
    const linkedIds = Array.isArray(linkedRestaurantIds)
        ? linkedRestaurantIds.map((item) =>
            item && typeof item === 'object' ? String(item._id || '') : String(item || '')
          ).filter(Boolean)
        : [];
    return {
        ...rest,
        sortOrder,
        order: sortOrder,
        linkedRestaurantIds: Array.isArray(linkedRestaurantIds) ? linkedRestaurantIds : [],
        linkedRestaurantId: linkedIds[0] || '',
        ctaLink: typeof rest.ctaLink === 'string' ? rest.ctaLink : ''
    };
};

export const listHeroBannersController = async (req, res, next) => {
    try {
        const data = await listHeroBanners();
        const banners = (data || []).map(toHeroBanner);
        // Wrap in { banners } to match LandingPageManagement.jsx expectations
        return sendResponse(res, 200, 'Hero banners fetched successfully', { banners });
    } catch (error) {
        next(error);
    }
};

export const uploadHeroBannersController = async (req, res, next) => {
    try {
        if (!req.files || !req.files.length) {
            throw new ValidationError('No files uploaded');
        }

        const meta = {
            title: req.body.title,
            ctaText: req.body.ctaText,
            ctaLink: req.body.ctaLink,
            zoneId: req.body.zoneId
        };

        const results = await createHeroBannersFromFiles(req.files, meta);
        const mapped = (results || []).map((item) =>
            item?.banner ? { ...item, banner: toHeroBanner(item.banner) } : item
        );
        return sendResponse(res, 201, 'Hero banners uploaded', { results: mapped });
    } catch (error) {
        next(error);
    }
};

export const deleteHeroBannerController = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) {
            throw new ValidationError('Banner id is required');
        }
        const result = await deleteHeroBanner(id);
        return sendResponse(res, 200, result.deleted ? 'Hero banner deleted' : 'Hero banner not found', result);
    } catch (error) {
        next(error);
    }
};

export const updateHeroBannerOrderController = async (req, res, next) => {
    try {
        const { id } = req.params;
        // Admin UI sends `{ order }`; also accept `{ sortOrder }` for compatibility.
        const rawOrder = req.body?.order ?? req.body?.sortOrder;
        const sortOrder = Number(rawOrder);
        if (!id || Number.isNaN(sortOrder)) {
            throw new ValidationError('id and numeric order are required');
        }
        const updated = await updateHeroBannerOrder(id, sortOrder);
        if (!updated) {
            throw new ValidationError('Hero banner not found');
        }
        return sendResponse(res, 200, 'Hero banner order updated', toHeroBanner(updated));
    } catch (error) {
        next(error);
    }
};

export const toggleHeroBannerStatusController = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) {
            throw new ValidationError('Banner id is required');
        }

        // Frontend often sends empty body; toggle current status in that case.
        let nextIsActive = req.body?.isActive;
        if (typeof nextIsActive !== 'boolean') {
            const banner = await listHeroBanners().then((list) =>
                list.find((b) => String(b._id) === String(id))
            );
            if (!banner) {
                throw new ValidationError('Hero banner not found');
            }
            nextIsActive = !banner.isActive;
        }

        const updated = await toggleHeroBannerStatus(id, nextIsActive);
        if (!updated) {
            throw new ValidationError('Hero banner not found');
        }
        return sendResponse(res, 200, 'Hero banner status updated', toHeroBanner(updated));
    } catch (error) {
        next(error);
    }
};

export const updateHeroBannerController = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) {
            throw new ValidationError('Banner id is required');
        }

        const body = req.body || {};
        const updates = {};
        if (Object.prototype.hasOwnProperty.call(body, 'zoneId')) updates.zoneId = body.zoneId;
        if (Object.prototype.hasOwnProperty.call(body, 'ctaLink')) updates.ctaLink = body.ctaLink;
        if (Object.prototype.hasOwnProperty.call(body, 'ctaText')) updates.ctaText = body.ctaText;
        if (Object.prototype.hasOwnProperty.call(body, 'title')) updates.title = body.title;
        if (Object.prototype.hasOwnProperty.call(body, 'linkedRestaurantIds')) {
            updates.linkedRestaurantIds = body.linkedRestaurantIds;
        }
        if (Object.prototype.hasOwnProperty.call(body, 'linkedRestaurantId')) {
            updates.linkedRestaurantIds = body.linkedRestaurantId
                ? [body.linkedRestaurantId]
                : [];
        }

        const updated = await updateHeroBanner(id, updates);
        if (!updated) {
            throw new ValidationError('Hero banner not found');
        }

        return sendResponse(res, 200, 'Hero banner updated', toHeroBanner(updated));
    } catch (error) {
        next(error);
    }
};
