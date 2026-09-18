import express from 'express';
import {
    applyLeave,
    getMyLeaves,
    getLeaveBalance,
    approveLeave,
    getAllLeaves,
    getPendingLeaves
} from '../controllers/leave.controller.js';
import { authMiddleware } from '../../../core/auth/auth.middleware.js';
import { requireHrmsEmployee, requireAdminOrManager } from '../middleware/hrmsAuth.middleware.js';

const router = express.Router();

// EMPLOYEE: Leave management
router.post('/', authMiddleware, requireHrmsEmployee, applyLeave);
router.get('/me', authMiddleware, requireHrmsEmployee, getMyLeaves);
router.get('/balance', authMiddleware, requireHrmsEmployee, getLeaveBalance);

// MANAGER/ADMIN: Approvals
router.get('/pending', authMiddleware, requireAdminOrManager, getPendingLeaves);
router.post('/:id/action', authMiddleware, requireAdminOrManager, approveLeave);

// ADMIN: All leaves
router.get('/', authMiddleware, requireAdminOrManager, getAllLeaves);

export default router;
