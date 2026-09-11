import * as requestService from '../services/diningRequest.service.js';
import * as setupService from '../services/diningSetup.service.js';
import * as reservationService from '../services/diningReservation.service.js';
import * as billService from '../services/diningBill.service.js';

const restaurantId = (req) => req.user?.userId;

export async function getMyDiningProfile(req, res, next) {
    try {
        const profile = await requestService.getOrCreateDiningProfile(restaurantId(req));
        res.json({ success: true, data: { profile } });
    } catch (error) { next(error); }
}

export async function requestDining(req, res, next) {
    try {
        const profile = await requestService.requestDining(restaurantId(req));
        res.json({ success: true, message: 'Dining request submitted — awaiting admin approval', data: { profile } });
    } catch (error) { next(error); }
}

export async function updateDiningSetup(req, res, next) {
    try {
        const profile = await setupService.updateDiningSetup(restaurantId(req), req.body);
        res.json({ success: true, message: 'Dining setup saved', data: { profile } });
    } catch (error) { next(error); }
}

export async function toggleDiningEnabled(req, res, next) {
    try {
        const profile = await setupService.toggleDiningEnabled(restaurantId(req), req.body?.enabled);
        res.json({ success: true, message: `Dining turned ${profile.isDiningEnabled ? 'on' : 'off'}`, data: { profile } });
    } catch (error) { next(error); }
}

export async function getReservations(req, res, next) {
    try {
        const data = await reservationService.listRestaurantReservations(restaurantId(req), req.query);
        res.json({ success: true, data });
    } catch (error) { next(error); }
}

export async function updateReservationStatus(req, res, next) {
    try {
        const reservation = await reservationService.updateReservationStatusByRestaurant(
            restaurantId(req),
            req.params.id,
            { status: req.body?.status, note: req.body?.note, byId: req.user?.userId },
        );
        res.json({ success: true, message: 'Booking updated', data: { reservation } });
    } catch (error) { next(error); }
}

export async function saveBill(req, res, next) {
    try {
        const bill = await billService.startOrUpdateBill(restaurantId(req), req.params.reservationId, {
            items: req.body?.items,
            discount: req.body?.discount,
            createdById: req.user?.userId,
        });
        res.json({ success: true, message: 'Bill saved', data: { bill } });
    } catch (error) { next(error); }
}

export async function finalizeBill(req, res, next) {
    try {
        const bill = await billService.finalizeBill(restaurantId(req), req.params.billId, { byId: req.user?.userId });
        res.json({ success: true, message: 'Bill sent to guest', data: { bill } });
    } catch (error) { next(error); }
}

export async function getBill(req, res, next) {
    try {
        const bill = await billService.getBillForRestaurant(restaurantId(req), req.params.billId);
        res.json({ success: true, data: { bill } });
    } catch (error) { next(error); }
}
