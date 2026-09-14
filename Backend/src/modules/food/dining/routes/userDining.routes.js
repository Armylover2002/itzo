import express from 'express';
import {
    createReservationController, getMyReservations, getMyReservationDetailController, cancelReservationController,
    getBillController, createBillPaymentOrderController, verifyBillPaymentController,
} from '../controllers/userDining.controller.js';

const router = express.Router();

router.post('/reservations', createReservationController);
router.get('/reservations', getMyReservations);
router.get('/reservations/:id', getMyReservationDetailController);
router.post('/reservations/:id/cancel', cancelReservationController);

router.get('/bills/:billId', getBillController);
router.post('/bills/:billId/pay', createBillPaymentOrderController);
router.post('/bills/:billId/verify', verifyBillPaymentController);

export default router;
