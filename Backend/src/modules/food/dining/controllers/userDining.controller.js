import { sendResponse, sendError } from '../../../../utils/response.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import {
    createReservation, listMyReservations, getMyReservationDetail, cancelReservationByUser,
} from '../services/diningReservation.service.js';
import { getBillForUser, createBillPaymentOrder, verifyBillPayment } from '../services/diningBill.service.js';
import { validateCreateReservationDto } from '../validators/dining.validator.js';

function handleError(err, res, next) {
    if (err instanceof ValidationError) return sendError(res, err.statusCode || 400, err.message);
    next(err);
}

function userId(req) {
    return req.user?.userId;
}

export async function createReservationController(req, res, next) {
    try {
        const data = validateCreateReservationDto(req.body);
        const reservation = await createReservation(userId(req), data);
        return sendResponse(res, 201, 'Reservation created', { reservation });
    } catch (err) { handleError(err, res, next); }
}

export async function getMyReservations(req, res, next) {
    try {
        const reservations = await listMyReservations(userId(req), { status: req.query.status });
        return sendResponse(res, 200, 'Reservations fetched', { reservations });
    } catch (err) { handleError(err, res, next); }
}

export async function getMyReservationDetailController(req, res, next) {
    try {
        const reservation = await getMyReservationDetail(userId(req), req.params.id);
        return sendResponse(res, 200, 'Reservation fetched', { reservation });
    } catch (err) { handleError(err, res, next); }
}

export async function cancelReservationController(req, res, next) {
    try {
        const reservation = await cancelReservationByUser(userId(req), req.params.id, { reason: req.body?.reason });
        return sendResponse(res, 200, 'Reservation cancelled', { reservation });
    } catch (err) { handleError(err, res, next); }
}

export async function getBillController(req, res, next) {
    try {
        const bill = await getBillForUser(userId(req), req.params.billId);
        return sendResponse(res, 200, 'Bill fetched', { bill });
    } catch (err) { handleError(err, res, next); }
}

export async function createBillPaymentOrderController(req, res, next) {
    try {
        const order = await createBillPaymentOrder(userId(req), req.params.billId);
        return sendResponse(res, 200, 'Payment order created', order);
    } catch (err) { handleError(err, res, next); }
}

export async function verifyBillPaymentController(req, res, next) {
    try {
        const bill = await verifyBillPayment(userId(req), req.params.billId, req.body || {});
        return sendResponse(res, 200, 'Payment verified', { bill });
    } catch (err) { handleError(err, res, next); }
}
