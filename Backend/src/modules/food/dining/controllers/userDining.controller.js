import * as reservationService from '../services/diningReservation.service.js';
import * as billService from '../services/diningBill.service.js';

const userId = (req) => req.user?.userId;

export async function createReservation(req, res, next) {
    try {
        const reservation = await reservationService.createReservation(userId(req), req.body);
        res.status(201).json({ success: true, message: 'Table booked', data: { reservation } });
    } catch (error) { next(error); }
}

export async function getMyReservations(req, res, next) {
    try {
        const data = await reservationService.listMyReservations(userId(req), req.query);
        res.json({ success: true, data });
    } catch (error) { next(error); }
}

export async function getMyReservationDetail(req, res, next) {
    try {
        const reservation = await reservationService.getMyReservationDetail(userId(req), req.params.id);
        res.json({ success: true, data: { reservation } });
    } catch (error) { next(error); }
}

export async function cancelReservation(req, res, next) {
    try {
        const reservation = await reservationService.cancelReservationByUser(userId(req), req.params.id, req.body?.reason);
        res.json({ success: true, message: 'Booking cancelled', data: { reservation } });
    } catch (error) { next(error); }
}

export async function getBill(req, res, next) {
    try {
        const bill = await billService.getBillForUser(userId(req), req.params.billId);
        res.json({ success: true, data: { bill } });
    } catch (error) { next(error); }
}

export async function createBillPaymentOrder(req, res, next) {
    try {
        const payload = await billService.createBillPaymentOrder(userId(req), req.params.billId);
        res.json({ success: true, data: payload });
    } catch (error) { next(error); }
}

export async function verifyBillPayment(req, res, next) {
    try {
        const bill = await billService.verifyBillPayment(userId(req), req.params.billId, {
            razorpayOrderId: req.body?.razorpayOrderId,
            razorpayPaymentId: req.body?.razorpayPaymentId,
            razorpaySignature: req.body?.razorpaySignature,
        });
        res.json({ success: true, message: 'Payment successful', data: { bill } });
    } catch (error) { next(error); }
}
