import { sendError } from '../../utils/response.js';

export const requireRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return sendError(res, 401, 'Not authenticated');
        }

        const userRole = String(req.user.role).toUpperCase();
        const allowedSet = new Set(allowedRoles.map((r) => String(r).toUpperCase()));
        if (!allowedSet.has(userRole)) {
            return sendError(res, 403, 'Forbidden: insufficient permissions');
        }

        next();
    };
};

