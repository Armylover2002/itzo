import * as categoryService from '../services/diningCategory.service.js';
import * as bannerService from '../services/diningBanner.service.js';
import * as settingsService from '../services/diningSettings.service.js';
import * as requestService from '../services/diningRequest.service.js';
import * as reservationService from '../services/diningReservation.service.js';
import * as billService from '../services/diningBill.service.js';

// --- Categories ---
export async function getDiningCategories(req, res, next) {
    try {
        const data = await categoryService.listDiningCategories(req.query);
        res.json({ success: true, data });
    } catch (error) { next(error); }
}
export async function createDiningCategory(req, res, next) {
    try {
        const category = await categoryService.createDiningCategory(req.body);
        res.status(201).json({ success: true, message: 'Dining category created', data: { category } });
    } catch (error) { next(error); }
}
export async function updateDiningCategory(req, res, next) {
    try {
        const category = await categoryService.updateDiningCategory(req.params.id, req.body);
        res.json({ success: true, message: 'Dining category updated', data: { category } });
    } catch (error) { next(error); }
}
export async function deleteDiningCategory(req, res, next) {
    try {
        await categoryService.deleteDiningCategory(req.params.id);
        res.json({ success: true, message: 'Dining category deleted' });
    } catch (error) { next(error); }
}
export async function toggleDiningCategoryStatus(req, res, next) {
    try {
        const category = await categoryService.toggleDiningCategoryStatus(req.params.id);
        res.json({ success: true, message: 'Dining category status updated', data: { category } });
    } catch (error) { next(error); }
}

// --- Banners ---
export async function getDiningBanners(req, res, next) {
    try {
        const data = await bannerService.listDiningBanners(req.query);
        res.json({ success: true, data });
    } catch (error) { next(error); }
}
export async function createDiningBanner(req, res, next) {
    try {
        const banner = await bannerService.createDiningBanner(req.body);
        res.status(201).json({ success: true, message: 'Dining banner created', data: { banner } });
    } catch (error) { next(error); }
}
export async function updateDiningBanner(req, res, next) {
    try {
        const banner = await bannerService.updateDiningBanner(req.params.id, req.body);
        res.json({ success: true, message: 'Dining banner updated', data: { banner } });
    } catch (error) { next(error); }
}
export async function deleteDiningBanner(req, res, next) {
    try {
        await bannerService.deleteDiningBanner(req.params.id);
        res.json({ success: true, message: 'Dining banner deleted' });
    } catch (error) { next(error); }
}
export async function toggleDiningBannerStatus(req, res, next) {
    try {
        const banner = await bannerService.toggleDiningBannerStatus(req.params.id);
        res.json({ success: true, message: 'Dining banner status updated', data: { banner } });
    } catch (error) { next(error); }
}

// --- Settings ---
export async function getDiningSettings(req, res, next) {
    try {
        const settings = await settingsService.getDiningSettings();
        res.json({ success: true, data: { settings } });
    } catch (error) { next(error); }
}
export async function updateDiningSettings(req, res, next) {
    try {
        const settings = await settingsService.updateDiningSettings(req.body);
        res.json({ success: true, message: 'Dining settings updated', data: { settings } });
    } catch (error) { next(error); }
}

// --- Requests / restaurants / commission ---
export async function getDiningRequests(req, res, next) {
    try {
        const data = await requestService.listDiningRequests(req.query);
        res.json({ success: true, data });
    } catch (error) { next(error); }
}
export async function reviewDiningRequest(req, res, next) {
    try {
        const profile = await requestService.reviewDiningRequest(req.params.id, {
            approve: req.body?.approve === true || req.body?.approve === 'true',
            rejectionReason: req.body?.rejectionReason,
            adminId: req.user?.userId,
        });
        res.json({ success: true, message: 'Dining request reviewed', data: { profile } });
    } catch (error) { next(error); }
}
export async function getDiningRestaurants(req, res, next) {
    try {
        const data = await requestService.listDiningRestaurants(req.query);
        res.json({ success: true, data });
    } catch (error) { next(error); }
}
export async function setDiningCommissionOverride(req, res, next) {
    try {
        const profile = await requestService.setDiningCommissionOverride(req.params.id, req.body);
        res.json({ success: true, message: 'Commission updated', data: { profile } });
    } catch (error) { next(error); }
}

// --- Bookings / bills / revenue ---
export async function getDiningBookings(req, res, next) {
    try {
        const data = await reservationService.listAllReservationsAdmin(req.query);
        res.json({ success: true, data });
    } catch (error) { next(error); }
}
export async function getDiningBills(req, res, next) {
    try {
        const data = await billService.listAllBillsAdmin(req.query);
        res.json({ success: true, data });
    } catch (error) { next(error); }
}
export async function getDiningRevenueStats(req, res, next) {
    try {
        const stats = await billService.getDiningRevenueStats(req.query);
        res.json({ success: true, data: { stats } });
    } catch (error) { next(error); }
}
