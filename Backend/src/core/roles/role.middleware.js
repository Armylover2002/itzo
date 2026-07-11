import { sendError } from '../../utils/response.js';

export const requireRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return sendError(res, 401, 'Not authenticated');
        }

        let userRole = String(req.user.role).toUpperCase();
        if (userRole === 'CUSTOMER' || userRole === 'FOOD_USER') userRole = 'USER';
        if (userRole === 'DELIVERY') userRole = 'DELIVERY_PARTNER';

        const allowedSet = new Set(allowedRoles.map((r) => {
            const up = String(r).toUpperCase();
            if (up === 'CUSTOMER' || up === 'FOOD_USER') return 'USER';
            if (up === 'DELIVERY') return 'DELIVERY_PARTNER';
            return up;
        }));
        if (!allowedSet.has(userRole)) {
            return sendError(res, 403, 'Forbidden: insufficient permissions');
        }

        next();
    };
};

