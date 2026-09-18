import express from 'express';
import { upload } from '../../../../middleware/upload.js';
import * as licensingController from '../controllers/licensingController.js';
import { authMiddleware, checkPermission } from '../../../../core/auth/auth.middleware.js';
import { requireRoles } from '../../../../core/roles/role.middleware.js';

const router = express.Router();

const uploadFields = upload.fields([
    { name: 'aadhaar', maxCount: 1 },
    { name: 'pan', maxCount: 1 },
    { name: 'existingFssai', maxCount: 1 },
    { name: 'existingGst', maxCount: 1 },
    { name: 'shopImage', maxCount: 1 },
    { name: 'restaurantPhoto', maxCount: 1 },
    { name: 'otherDocs', maxCount: 5 }
]);

// Public endpoint for submitting licensing requests (no auth required)
router.post('/', uploadFields, licensingController.submitLicensingRequestController);

// Admin-only endpoints
router.get('/', authMiddleware, requireRoles('ADMIN', 'EMPLOYEE'), checkPermission('food::pages_social_media::consulting', 'view'), licensingController.getAllLicensingRequestsController);
router.get('/:id', authMiddleware, requireRoles('ADMIN', 'EMPLOYEE'), checkPermission('food::pages_social_media::consulting', 'view'), licensingController.getLicensingRequestByIdController);
router.patch('/:id/status', authMiddleware, requireRoles('ADMIN', 'EMPLOYEE'), checkPermission('food::pages_social_media::consulting', 'edit'), licensingController.updateLicensingStatusController);
router.delete('/:id', authMiddleware, requireRoles('ADMIN', 'EMPLOYEE'), checkPermission('food::pages_social_media::consulting', 'delete'), licensingController.deleteLicensingRequestController);

export default router;
