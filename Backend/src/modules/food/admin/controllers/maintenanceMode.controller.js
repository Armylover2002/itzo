import { sendResponse } from '../../../../utils/response.js';
import {
    getMaintenanceMode,
    getMaintenanceModeCached,
    setMaintenanceMode,
} from '../services/maintenanceMode.service.js';

/** Admin panel read (/ecs/food dashboard toggle). */
export async function getMaintenanceModeAdminController(req, res, next) {
    try {
        const state = await getMaintenanceMode();
        return sendResponse(res, 200, 'Maintenance mode retrieved', state);
    } catch (err) {
        next(err);
    }
}

export async function updateMaintenanceModeAdminController(req, res, next) {
    try {
        const { enabled, message } = req.body || {};
        if (enabled === undefined && message === undefined) {
            return res.status(400).json({ success: false, message: 'Nothing to update' });
        }
        if (enabled !== undefined && typeof enabled !== 'boolean') {
            return res.status(400).json({ success: false, message: '`enabled` must be a boolean' });
        }
        if (message !== undefined && String(message).length > 200) {
            return res.status(400).json({ success: false, message: 'Message must be 200 characters or less' });
        }

        const state = await setMaintenanceMode({
            enabled,
            message,
            updatedBy: req.user?.userId || null,
        });
        return sendResponse(res, 200, 'Maintenance mode updated', state);
    } catch (err) {
        next(err);
    }
}

/** Public read so the customer app can show the banner / disable the button up front. */
export async function getMaintenanceModePublicController(req, res, next) {
    try {
        const state = await getMaintenanceModeCached();
        return sendResponse(res, 200, 'Maintenance mode retrieved', {
            enabled: state.enabled,
            message: state.message,
        });
    } catch (err) {
        next(err);
    }
}
