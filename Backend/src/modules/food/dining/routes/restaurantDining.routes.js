import express from 'express';
import * as restaurantDiningController from '../controllers/restaurantDining.controller.js';
import { authMiddleware } from '../../../../core/auth/auth.middleware.js';
import { sendError } from '../../../../utils/response.js';

const router = express.Router();

// Same self-contained "requireRestaurant" guard used in
// restaurant/routes/restaurant.routes.js — not exported from there, so kept
// as a small local copy to avoid coupling this module to that file's
// internals.
const requireRestaurant = (req, res, next) => {
    if (req.user?.role !== 'RESTAURANT') {
        return sendError(res, 403, 'Restaurant access required');
    }
    next();
};

router.use(authMiddleware, requireRestaurant);

router.get('/profile', restaurantDiningController.getMyDiningProfile);
router.post('/request', restaurantDiningController.requestDining);
router.patch('/setup', restaurantDiningController.updateDiningSetup);
router.patch('/toggle', restaurantDiningController.toggleDiningEnabled);

router.get('/reservations', restaurantDiningController.getReservations);
router.patch('/reservations/:id/status', restaurantDiningController.updateReservationStatus);

router.put('/reservations/:reservationId/bill', restaurantDiningController.saveBill);
router.post('/bills/:billId/finalize', restaurantDiningController.finalizeBill);
router.get('/bills/:billId', restaurantDiningController.getBill);

export default router;
