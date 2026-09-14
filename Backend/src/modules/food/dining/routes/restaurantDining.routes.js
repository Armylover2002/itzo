import express from 'express';
import { authMiddleware } from '../../../../core/auth/auth.middleware.js';
import { sendError } from '../../../../utils/response.js';
import {
    getMyDiningProfile, requestDiningController, updateDiningSetupController, toggleDiningEnabledController,
    getReservations, updateReservationStatus,
    saveBill, finalizeBillController, getBill,
} from '../controllers/restaurantDining.controller.js';

const router = express.Router();

const requireRestaurant = (req, res, next) => {
    if (req.user?.role !== 'RESTAURANT') {
        return sendError(res, 403, 'Restaurant access required');
    }
    next();
};

router.use(authMiddleware, requireRestaurant);

router.get('/profile', getMyDiningProfile);
router.post('/request', requestDiningController);
router.patch('/setup', updateDiningSetupController);
router.patch('/toggle', toggleDiningEnabledController);

router.get('/reservations', getReservations);
router.patch('/reservations/:id/status', updateReservationStatus);

router.put('/reservations/:reservationId/bill', saveBill);
router.post('/bills/:billId/finalize', finalizeBillController);
router.get('/bills/:billId', getBill);

export default router;
