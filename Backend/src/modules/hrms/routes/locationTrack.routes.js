import express from 'express';
import { authMiddleware } from '../../../core/auth/auth.middleware.js';
import { requireRoles } from '../../../core/roles/role.middleware.js';
import { requireHrmsEmployee, requireAdminOrManager } from '../middleware/hrmsAuth.middleware.js';
import {
    saveLocationPoints,
    getLiveLocations,
    getEmployeeTrack,
    getMyTrack
} from '../controllers/locationTrack.controller.js';

const router = express.Router();

// ── Employee Routes ──
// Batch save GPS tracking points (field employees only)
router.post(
    '/',
    authMiddleware,
    requireRoles('HRMS_EMPLOYEE'),
    requireHrmsEmployee,
    saveLocationPoints
);

// Get own track for a date
router.get(
    '/my/:date',
    authMiddleware,
    requireRoles('HRMS_EMPLOYEE'),
    requireHrmsEmployee,
    getMyTrack
);

// ── Admin/Manager Routes ──
// Get live locations of all active field employees
router.get(
    '/live',
    authMiddleware,
    requireRoles('ADMIN', 'EMPLOYEE', 'HRMS_EMPLOYEE'),
    requireAdminOrManager,
    getLiveLocations
);

// Get full route track for a specific employee on a date
router.get(
    '/:employeeId/:date',
    authMiddleware,
    requireRoles('ADMIN', 'EMPLOYEE', 'HRMS_EMPLOYEE'),
    requireAdminOrManager,
    getEmployeeTrack
);

export default router;
