import express from 'express';
import {
    submitJoiningRequest,
    checkRequestStatus,
    getAllJoiningRequests,
    getJoiningRequestById,
    approveJoiningRequest,
    rejectJoiningRequest,
    requestMoreInfo
} from '../controllers/joiningRequest.controller.js';
import { authMiddleware } from '../../../core/auth/auth.middleware.js';
import { requireAdminOrManager } from '../middleware/hrmsAuth.middleware.js';

const router = express.Router();

// PUBLIC routes (no auth required) — for employee self-registration
router.post('/register', submitJoiningRequest);
router.get('/status', checkRequestStatus);

// ADMIN routes — for managing joining requests from ECS
router.get('/', authMiddleware, requireAdminOrManager, getAllJoiningRequests);
router.get('/:id', authMiddleware, requireAdminOrManager, getJoiningRequestById);
router.post('/:id/approve', authMiddleware, requireAdminOrManager, approveJoiningRequest);
router.post('/:id/reject', authMiddleware, requireAdminOrManager, rejectJoiningRequest);
router.post('/:id/request-info', authMiddleware, requireAdminOrManager, requestMoreInfo);

export default router;
