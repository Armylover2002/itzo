import express from 'express';
import { getSettings, updateSettings, updateSettingsSection, getPublicSettings } from '../controllers/settings.controller.js';
import { authMiddleware } from '../../../core/auth/auth.middleware.js';
import { requireAdminOrManager } from '../middleware/hrmsAuth.middleware.js';

const router = express.Router();

// GET: Public settings for branding (no auth needed)
router.get('/public', getPublicSettings);

// GET: Accessible by any authenticated user (settings needed for frontend calculations)
router.get('/', authMiddleware, getSettings);

// PUT: Admin-only — update entire settings
router.put('/', authMiddleware, requireAdminOrManager, updateSettings);

// PATCH: Admin-only — update a specific section
router.patch('/:section', authMiddleware, requireAdminOrManager, updateSettingsSection);

export default router;
