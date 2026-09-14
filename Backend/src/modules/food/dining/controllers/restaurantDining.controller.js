import { sendResponse, sendError } from '../../../../utils/response.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { getOrCreateDiningProfile, requestDining } from '../services/diningRequest.service.js';
import { updateDiningSetup, toggleDiningEnabled } from '../services/diningSetup.service.js';
import { listRestaurantReservations, updateReservationStatusByRestaurant } from '../services/diningReservation.service.js';
import { startOrUpdateBill, finalizeBill, getBillForRestaurant } from '../services/diningBill.service.js';
import { validateDiningSetupDto, validateUpdateReservationStatusDto, validateSaveBillDto } from '../validators/dining.validator.js';

function handleError(err, res, next) {
    if (err instanceof ValidationError) return sendError(res, err.statusCode || 400, err.message);
    next(err);
}

function restaurantId(req) {
    return req.user?.userId;
}

export async function getMyDiningProfile(req, res, next) {
    try {
        const profile = await getOrCreateDiningProfile(restaurantId(req));
        return sendResponse(res, 200, 'Dining profile fetched', { profile });
    } catch (err) { handleError(err, res, next); }
}

export async function requestDiningController(req, res, next) {
    try {
        const profile = await requestDining(restaurantId(req));
        return sendResponse(res, 200, 'Dining request submitted', { profile });
    } catch (err) { handleError(err, res, next); }
}

export async function updateDiningSetupController(req, res, next) {
    try {
        const data = validateDiningSetupDto(req.body);
        const profile = await updateDiningSetup(restaurantId(req), data);
        return sendResponse(res, 200, 'Dining setup updated', { profile });
    } catch (err) { handleError(err, res, next); }
}

export async function toggleDiningEnabledController(req, res, next) {
    try {
        const profile = await toggleDiningEnabled(restaurantId(req), !!req.body?.enabled);
        return sendResponse(res, 200, 'Dining status updated', { profile });
    } catch (err) { handleError(err, res, next); }
}

export async function getReservations(req, res, next) {
    try {
        const reservations = await listRestaurantReservations(restaurantId(req), { status: req.query.status, date: req.query.date });
        return sendResponse(res, 200, 'Reservations fetched', { reservations });
    } catch (err) { handleError(err, res, next); }
}

export async function updateReservationStatus(req, res, next) {
    try {
        const data = validateUpdateReservationStatusDto(req.body);
        const reservation = await updateReservationStatusByRestaurant(restaurantId(req), req.params.id, data);
        return sendResponse(res, 200, 'Reservation status updated', { reservation });
    } catch (err) { handleError(err, res, next); }
}

export async function saveBill(req, res, next) {
    try {
        const data = validateSaveBillDto(req.body);
        const bill = await startOrUpdateBill(restaurantId(req), req.params.reservationId, data, req.user?.userId);
        return sendResponse(res, 200, 'Bill saved', { bill });
    } catch (err) { handleError(err, res, next); }
}

export async function finalizeBillController(req, res, next) {
    try {
        const bill = await finalizeBill(restaurantId(req), req.params.billId);
        return sendResponse(res, 200, 'Bill finalized', { bill });
    } catch (err) { handleError(err, res, next); }
}

export async function getBill(req, res, next) {
    try {
        const bill = await getBillForRestaurant(restaurantId(req), req.params.billId);
        return sendResponse(res, 200, 'Bill fetched', { bill });
    } catch (err) { handleError(err, res, next); }
}
