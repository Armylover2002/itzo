import express from 'express';
import {
    getInboxController,
    markNotificationReadController,
    dismissNotificationController,
    dismissAllNotificationsController
} from './notification.controller.js';

const router = express.Router();

router.get('/inbox', getInboxController);
router.patch('/:id/read', markNotificationReadController);
router.delete('/:id', dismissNotificationController);
router.delete('/inbox/all', dismissAllNotificationsController);

export default router;
