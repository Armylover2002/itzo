import express from 'express';
import { authMiddleware } from '../../../core/auth/auth.middleware.js';
import { requireRoles } from '../../../core/roles/role.middleware.js';
import { getSharedMediaController } from '../controllers/media.controller.js';

const router = express.Router();

router.get('/shared', authMiddleware, requireRoles('RESTAURANT'), getSharedMediaController);

export default router;
