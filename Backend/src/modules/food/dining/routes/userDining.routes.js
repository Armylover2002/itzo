import express from 'express';
import * as userDiningController from '../controllers/userDining.controller.js';

// Mounted at /v1/food/user/dining with authMiddleware + requireRoles('USER')
// already applied in routes/index.js — no auth wiring needed here.
const router = express.Router();

router.post('/reservations', userDiningController.createReservation);
router.get('/reservations', userDiningController.getMyReservations);
router.get('/reservations/:id', userDiningController.getMyReservationDetail);
router.post('/reservations/:id/cancel', userDiningController.cancelReservation);

router.get('/bills/:billId', userDiningController.getBill);
router.post('/bills/:billId/pay', userDiningController.createBillPaymentOrder);
router.post('/bills/:billId/verify', userDiningController.verifyBillPayment);

export default router;
