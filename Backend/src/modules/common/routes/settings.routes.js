import express from 'express';
import * as settingsController from '../controllers/settings.controller.js';
import { handleSettingsUpload } from '../../../middleware/settingsUpload.js';
import { authMiddleware, checkPermission } from '../../../core/auth/auth.middleware.js';
import { requireRoles } from '../../../core/roles/role.middleware.js';

const router = express.Router();

const requireGlobalSettingsPatchPermission = async (req, res, next) => {
    try {
        let data = {};
        if (req.body?.data) {
            data = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
        } else if (req.body && typeof req.body === 'object') {
            data = req.body;
        }

        const hasModulesUpdate = data && typeof data === 'object' && data.modules !== undefined;
        const hasAppSettingsUpdate = data && typeof data === 'object'
            ? Object.keys(data).some((key) => key !== 'modules')
            : false;

        const checks = [];
        if (hasModulesUpdate) {
            checks.push(
                new Promise((resolve, reject) => {
                    checkPermission('global::settings::customization::modules', 'edit')(req, res, (err) => {
                        if (err) return reject(err);
                        return resolve();
                    });
                })
            );
        }
        if (hasAppSettingsUpdate || checks.length === 0) {
            checks.push(
                new Promise((resolve, reject) => {
                    checkPermission('global::settings::app_settings', 'edit')(req, res, (err) => {
                        if (err) return reject(err);
                        return resolve();
                    });
                })
            );
        }

        await Promise.all(checks);
        return next();
    } catch (error) {
        return next(error);
    }
};

// Public endpoint for app logo/theme
router.get('/public', settingsController.getGlobalSettings);

// Protected admin endpoints
router.get('/', authMiddleware, requireRoles('ADMIN', 'EMPLOYEE'), checkPermission('global::settings', 'view'), settingsController.getGlobalSettings);
router.patch('/', authMiddleware, requireRoles('ADMIN', 'EMPLOYEE'), handleSettingsUpload, requireGlobalSettingsPatchPermission, settingsController.updateGlobalSettings);

export default router;
