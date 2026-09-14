import { GlobalSettings } from '../modules/common/models/settings.model.js';

const MODULE_KEYS = new Set(['food', 'quickCommerce']);

export function requireEnabledModule(moduleKey) {
    if (!MODULE_KEYS.has(moduleKey)) {
        throw new Error(`Unsupported module key: ${moduleKey}`);
    }

    return async function moduleAccessMiddleware(req, res, next) {
        try {
            const settings = await GlobalSettings.findOne().select('modules').lean();
            const isEnabled = settings?.modules?.[moduleKey];

            if (isEnabled === false) {
                return res.status(403).json({
                    success: false,
                    message: `${moduleKey} module is currently disabled.`
                });
            }

            return next();
        } catch (error) {
            return next(error);
        }
    };
}
