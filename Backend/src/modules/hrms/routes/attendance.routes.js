import express from 'express';
import {
    checkIn,
    checkOut,
    requestRegularization,
    approveRegularization,
    getMyAttendance,
    getAllAttendance,
    getPendingRegularizations
} from '../controllers/attendance.controller.js';
import { authMiddleware } from '../../../core/auth/auth.middleware.js';
import { requireHrmsEmployee, requireAdminOrManager } from '../middleware/hrmsAuth.middleware.js';

const router = express.Router();

// EMPLOYEE: Own attendance
router.post('/check-in', authMiddleware, requireHrmsEmployee, checkIn);
router.post('/check-out', authMiddleware, requireHrmsEmployee, checkOut);
router.get('/me', authMiddleware, requireHrmsEmployee, getMyAttendance);
router.post('/regularize', authMiddleware, requireHrmsEmployee, requestRegularization);

// MANAGER/ADMIN: Approvals
router.get('/pending-regularizations', authMiddleware, requireAdminOrManager, getPendingRegularizations);
router.post('/regularize/:id/action', authMiddleware, requireAdminOrManager, approveRegularization);

// ADMIN: All attendance
router.get('/', authMiddleware, requireAdminOrManager, getAllAttendance);

export default router;
