import express from 'express';
import * as careerController from '../controllers/career.controller.js';

const router = express.Router();

router.get('/', careerController.getActiveJobsController);
router.get('/:id', careerController.getJobDetailsController);

export default router;
