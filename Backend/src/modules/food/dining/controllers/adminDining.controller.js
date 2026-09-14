import { sendResponse, sendError } from '../../../../utils/response.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import {
    listDiningCategories, createDiningCategory, updateDiningCategory, deleteDiningCategory, toggleDiningCategoryStatus,
} from '../services/diningCategory.service.js';
import {
    listDiningBanners, createDiningBanner, updateDiningBanner, deleteDiningBanner, toggleDiningBannerStatus,
} from '../services/diningBanner.service.js';
import { getDiningSettings, updateDiningSettings } from '../services/diningSettings.service.js';
import {
    listDiningRequests, reviewDiningRequest, listDiningRestaurants, setDiningCommissionOverride,
} from '../services/diningRequest.service.js';
import { listAllReservationsAdmin } from '../services/diningReservation.service.js';
import { listAllBillsAdmin, getDiningRevenueStats } from '../services/diningBill.service.js';
import {
    validateDiningCategoryDto, validateDiningCategoryCreateDto,
    validateDiningBannerCreateDto, validateDiningBannerUpdateDto,
    validateDiningSettingsDto, validateReviewDiningRequestDto, validateCommissionOverrideDto,
} from '../validators/dining.validator.js';

function handleError(err, res, next) {
    if (err instanceof ValidationError) return sendError(res, err.statusCode || 400, err.message);
    next(err);
}

export async function getDiningCategories(req, res, next) {
    try {
        const categories = await listDiningCategories();
        return sendResponse(res, 200, 'Dining categories fetched', { categories });
    } catch (err) { handleError(err, res, next); }
}

export async function createDiningCategoryController(req, res, next) {
    try {
        const data = validateDiningCategoryCreateDto(req.body);
        const category = await createDiningCategory(data);
        return sendResponse(res, 201, 'Dining category created', { category });
    } catch (err) { handleError(err, res, next); }
}

export async function updateDiningCategoryController(req, res, next) {
    try {
        const data = validateDiningCategoryDto(req.body);
        const category = await updateDiningCategory(req.params.id, data);
        return sendResponse(res, 200, 'Dining category updated', { category });
    } catch (err) { handleError(err, res, next); }
}

export async function deleteDiningCategoryController(req, res, next) {
    try {
        await deleteDiningCategory(req.params.id);
        return sendResponse(res, 200, 'Dining category deleted', {});
    } catch (err) { handleError(err, res, next); }
}

export async function toggleDiningCategoryStatusController(req, res, next) {
    try {
        const category = await toggleDiningCategoryStatus(req.params.id);
        return sendResponse(res, 200, 'Dining category status updated', { category });
    } catch (err) { handleError(err, res, next); }
}

export async function getDiningBanners(req, res, next) {
    try {
        const banners = await listDiningBanners();
        return sendResponse(res, 200, 'Dining banners fetched', { banners });
    } catch (err) { handleError(err, res, next); }
}

export async function createDiningBannerController(req, res, next) {
    try {
        const data = validateDiningBannerCreateDto(req.body);
        const banner = await createDiningBanner(data);
        return sendResponse(res, 201, 'Dining banner created', { banner });
    } catch (err) { handleError(err, res, next); }
}

export async function updateDiningBannerController(req, res, next) {
    try {
        const data = validateDiningBannerUpdateDto(req.body);
        const banner = await updateDiningBanner(req.params.id, data);
        return sendResponse(res, 200, 'Dining banner updated', { banner });
    } catch (err) { handleError(err, res, next); }
}

export async function deleteDiningBannerController(req, res, next) {
    try {
        await deleteDiningBanner(req.params.id);
        return sendResponse(res, 200, 'Dining banner deleted', {});
    } catch (err) { handleError(err, res, next); }
}

export async function toggleDiningBannerStatusController(req, res, next) {
    try {
        const banner = await toggleDiningBannerStatus(req.params.id);
        return sendResponse(res, 200, 'Dining banner status updated', { banner });
    } catch (err) { handleError(err, res, next); }
}

export async function getDiningSettingsController(req, res, next) {
    try {
        const settings = await getDiningSettings();
        return sendResponse(res, 200, 'Dining settings fetched', { settings });
    } catch (err) { handleError(err, res, next); }
}

export async function updateDiningSettingsController(req, res, next) {
    try {
        const data = validateDiningSettingsDto(req.body);
        const settings = await updateDiningSettings(data);
        return sendResponse(res, 200, 'Dining settings updated', { settings });
    } catch (err) { handleError(err, res, next); }
}

export async function getDiningRequests(req, res, next) {
    try {
        const result = await listDiningRequests({ status: req.query.status, search: req.query.search });
        return sendResponse(res, 200, 'Dining requests fetched', result);
    } catch (err) { handleError(err, res, next); }
}

export async function reviewDiningRequestController(req, res, next) {
    try {
        const data = validateReviewDiningRequestDto(req.body);
        const profile = await reviewDiningRequest(req.params.id, { ...data, adminId: req.user?.userId });
        return sendResponse(res, 200, 'Dining request reviewed', { profile });
    } catch (err) { handleError(err, res, next); }
}

export async function getDiningRestaurants(req, res, next) {
    try {
        const result = await listDiningRestaurants({ status: req.query.status, search: req.query.search });
        return sendResponse(res, 200, 'Dining restaurants fetched', result);
    } catch (err) { handleError(err, res, next); }
}

export async function setDiningCommissionOverrideController(req, res, next) {
    try {
        const data = validateCommissionOverrideDto(req.body);
        const profile = await setDiningCommissionOverride(req.params.id, data);
        return sendResponse(res, 200, 'Commission override updated', { profile });
    } catch (err) { handleError(err, res, next); }
}

export async function getDiningBookings(req, res, next) {
    try {
        const result = await listAllReservationsAdmin({
            status: req.query.status,
            date: req.query.date,
            page: req.query.page,
            limit: req.query.limit,
        });
        return sendResponse(res, 200, 'Dining bookings fetched', result);
    } catch (err) { handleError(err, res, next); }
}

export async function getDiningBills(req, res, next) {
    try {
        const result = await listAllBillsAdmin({ status: req.query.status, page: req.query.page, limit: req.query.limit });
        return sendResponse(res, 200, 'Dining bills fetched', result);
    } catch (err) { handleError(err, res, next); }
}

export async function getDiningRevenueStatsController(req, res, next) {
    try {
        const stats = await getDiningRevenueStats();
        return sendResponse(res, 200, 'Dining revenue stats fetched', stats);
    } catch (err) { handleError(err, res, next); }
}
