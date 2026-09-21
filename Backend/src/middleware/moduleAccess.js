import { GlobalSettings } from '../modules/common/models/settings.model.js';

const MODULE_KEYS = new Set(['food', 'quickCommerce', 'streetFood']);

/** Missing/undefined flags count as enabled so existing installs keep working. */
export async function isModuleEnabled(moduleKey) {
    if (!MODULE_KEYS.has(moduleKey)) {
        throw new Error(`Unsupported module key: ${moduleKey}`);
    }
    const settings = await GlobalSettings.findOne().select('modules').lean();
    return settings?.modules?.[moduleKey] !== false;
}

export function requireEnabledModule(moduleKey) {
    if (!MODULE_KEYS.has(moduleKey)) {
        throw new Error(`Unsupported module key: ${moduleKey}`);
    }

    return async function moduleAccessMiddleware(req, res, next) {
        try {
            if (!(await isModuleEnabled(moduleKey))) {
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
