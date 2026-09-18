import express from 'express';
import * as jobController from '../controllers/job.controller.js';
import { checkPermission } from '../../../../core/auth/auth.middleware.js';

const router = express.Router();

router.post('/', checkPermission('food::staff_management::list', 'create'), jobController.createJobController);
router.get('/', checkPermission('food::staff_management::list', 'view'), jobController.getAllJobsController);
router.get('/:id', checkPermission('food::staff_management::list', 'view'), jobController.getJobByIdController);
router.put('/:id', checkPermission('food::staff_management::list', 'edit'), jobController.updateJobController);
router.delete('/:id', checkPermission('food::staff_management::list', 'delete'), jobController.deleteJobController);
router.patch('/:id/featured', checkPermission('food::staff_management::list', 'edit'), jobController.toggleFeaturedController);
router.patch('/:id/status', checkPermission('food::staff_management::list', 'edit'), jobController.updateStatusController);

export default router;
