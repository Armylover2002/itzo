import express from 'express';
import {
    createEmployee,
    getEmployees,
    getEmployeeById,
    getMyProfile,
    updateEmployee,
    updateEmployeeStatus,
    getEmployeeStats,
    getTeamMembers,
    requestProfileUpdate,
    getPendingProfileEdits,
    approveProfileEdit,
    getActiveManagers,
    transferEmployee,
    manageEmployeeZones,
    getEmployeeRestaurants
} from '../controllers/employee.controller.js';
import { authMiddleware } from '../../../core/auth/auth.middleware.js';
import { requireHrmsEmployee, requireAdminOrManager } from '../middleware/hrmsAuth.middleware.js';

const router = express.Router();

// EMPLOYEE: Get own profile
router.get('/me', authMiddleware, requireHrmsEmployee, getMyProfile);
// EMPLOYEE: Request profile update
router.post('/me/edit-request', authMiddleware, requireHrmsEmployee, requestProfileUpdate);

// ADMIN: Get pending profile edits
router.get('/pending-edits', authMiddleware, requireAdminOrManager, getPendingProfileEdits);

// EMPLOYEE/MANAGER: Get team members
router.get('/team', authMiddleware, requireHrmsEmployee, getTeamMembers);

// ADMIN: Employee management
router.get('/stats', authMiddleware, requireAdminOrManager, getEmployeeStats);
router.get('/managers/active', authMiddleware, requireAdminOrManager, getActiveManagers);
router.post('/', authMiddleware, requireAdminOrManager, createEmployee);
router.get('/', authMiddleware, requireAdminOrManager, getEmployees);
router.get('/:id', authMiddleware, requireAdminOrManager, getEmployeeById);
router.put('/:id', authMiddleware, requireAdminOrManager, updateEmployee);
router.put('/:id/manager', authMiddleware, requireAdminOrManager, transferEmployee);
router.put('/:id/zones', authMiddleware, requireAdminOrManager, manageEmployeeZones);
router.get('/:id/restaurants', authMiddleware, requireAdminOrManager, getEmployeeRestaurants);
router.patch('/:id/status', authMiddleware, requireAdminOrManager, updateEmployeeStatus);
router.post('/:id/edit-request/action', authMiddleware, requireAdminOrManager, approveProfileEdit);

export default router;
