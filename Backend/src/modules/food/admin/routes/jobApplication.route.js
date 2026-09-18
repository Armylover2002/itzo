import express from 'express';
import { upload } from '../../../../middleware/upload.js';
import * as jobApplicationController from '../controllers/jobApplication.controller.js';
import { authMiddleware, checkPermission } from '../../../../core/auth/auth.middleware.js';
import { requireRoles } from '../../../../core/roles/role.middleware.js';

const router = express.Router();

const uploadFields = upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'coverLetter', maxCount: 1 },
    { name: 'additionalFiles', maxCount: 5 }
]);

// Public endpoint for submitting job applications (no auth required)
router.post('/', uploadFields, jobApplicationController.submitApplicationController);

// Admin-only endpoints
router.get('/stats', authMiddleware, requireRoles('ADMIN', 'EMPLOYEE'), checkPermission('food::staff_management::list', 'view'), jobApplicationController.getApplicationStatsController);
router.get('/', authMiddleware, requireRoles('ADMIN', 'EMPLOYEE'), checkPermission('food::staff_management::list', 'view'), jobApplicationController.getAllApplicationsController);
router.get('/:id', authMiddleware, requireRoles('ADMIN', 'EMPLOYEE'), checkPermission('food::staff_management::list', 'view'), jobApplicationController.getApplicationByIdController);
router.patch('/:id/status', authMiddleware, requireRoles('ADMIN', 'EMPLOYEE'), checkPermission('food::staff_management::list', 'edit'), jobApplicationController.updateApplicationStatusController);
router.delete('/:id', authMiddleware, requireRoles('ADMIN', 'EMPLOYEE'), checkPermission('food::staff_management::list', 'delete'), jobApplicationController.deleteApplicationController);

export default router;
