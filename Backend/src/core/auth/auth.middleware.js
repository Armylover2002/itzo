import { verifyAccessToken } from './token.util.js';
import { sendError } from '../../utils/response.js';
import { FoodUser } from '../users/user.model.js';
import { FoodDeliveryPartner } from '../../modules/food/delivery/models/deliveryPartner.model.js';
import { FoodAdmin } from '../admin/admin.model.js';
import { AdminRole } from '../admin/role.model.js';

export const requireAdmin = (req, res, next) => {
    if (req.user?.role === 'HRMS_EMPLOYEE') {
        return sendError(res, 403, 'HRMS Employee access denied for ECS panel');
    }
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
        return sendError(res, 403, 'Admin access required');
    }
    next();
};

export const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
        return sendError(res, 401, 'Authentication token missing');
    }

    try {
        const decoded = verifyAccessToken(token);
        const role = String(decoded.role || 'USER').toUpperCase();
        req.user = {
            userId: decoded.userId,
            role: (role === 'CUSTOMER' || role === 'FOOD_USER') ? 'USER' : (role === 'DELIVERY' ? 'DELIVERY_PARTNER' : role)
        };
        if (role === 'USER' || role === 'CUSTOMER' || role === 'FOOD_USER') {
            // Enforce active status in real-time - deactivated users are logged out on next request.
            FoodUser.findById(decoded.userId).select('isActive').lean().then((doc) => {
                if (!doc || doc.isActive === false) {
                    return sendError(res, 401, 'User account is deactivated');
                }
                next();
            }).catch(() => sendError(res, 401, 'Authentication failed'));
            return;
        }
        if (role === 'DELIVERY_PARTNER' || role === 'DELIVERY') {
            FoodDeliveryPartner.findById(decoded.userId).select('isActive').lean().then((doc) => {
                if (!doc || doc.isActive === false) {
                    return sendError(res, 401, 'Delivery account is inactive');
                }
                next();
            }).catch(() => sendError(res, 401, 'Authentication failed'));
            return;
        }
        return next();
    } catch (error) {
        return sendError(res, 401, 'Invalid or expired token');
    }
};

// --- RBAC CACHE SYSTEM ---
const rolePermissionsCache = new Map();

export const getCachedRolePermissions = async (roleId) => {
    const now = Date.now();
    const cached = rolePermissionsCache.get(String(roleId));

    if (cached && (now - cached.timestamp < 30000)) {
        return cached.permissions;
    }

    const role = await AdminRole.findById(roleId).select('permissions status').lean();
    const permissionsObj = (role && role.status === 'active') ? (role.permissions || {}) : null;

    rolePermissionsCache.set(String(roleId), {
        permissions: permissionsObj,
        timestamp: now
    });

    return permissionsObj;
};

export const invalidateRoleCache = (roleId) => {
    rolePermissionsCache.delete(String(roleId));
};

// --- RBAC MIDDLEWARE ---
export const checkPermission = (permissionKey, action) => {
    return async (req, res, next) => {
        try {
            const user = req.user;
            if (!user) {
                return sendError(res, 401, 'Authentication required');
            }

            // 1. ADMIN Bypass
            if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
                return next();
            }

            // 1.5 HRMS_EMPLOYEE explicit block
            if (user.role === 'HRMS_EMPLOYEE') {
                return sendError(res, 403, 'HRMS Employee access denied for ECS endpoints');
            }

            // 2. EMPLOYEE strict check
            if (user.role === 'EMPLOYEE') {
                const employee = await FoodAdmin.findById(user.userId)
                    .select('adminRoleId isActive')
                    .lean();

                if (!employee || !employee.isActive) {
                    console.warn(`[RBAC] Access Denied: Suspended/Inactive employee. userId=${user.userId}`);
                    return sendError(res, 403, 'Employee account is suspended or inactive');
                }

                if (!employee.adminRoleId) {
                    console.warn(`[RBAC] Access Denied: No role assigned. userId=${user.userId}`);
                    return sendError(res, 403, 'No administrative role assigned to this account');
                }

                const permissions = await getCachedRolePermissions(employee.adminRoleId);
                if (!permissions) {
                    console.warn(`[RBAC] Access Denied: Inactive role. roleId=${employee.adminRoleId}`);
                    return sendError(res, 403, 'Assigned administrative role is inactive');
                }

                let resolvedKey = permissionKey;
                if (permissionKey.includes('[key]') && req.params.key) {
                    resolvedKey = permissionKey.replace('[key]', req.params.key);
                }
                
                let nodePermissions = permissions[resolvedKey];
                if (!nodePermissions) {
                    // Fallback to parent permission key if specific key is not registered (e.g. food::pages_social_media::consulting -> food::pages_social_media)
                    const parts = resolvedKey.split('::');
                    if (parts.length > 1) {
                        const parentKey = parts.slice(0, -1).join('::');
                        nodePermissions = permissions[parentKey];
                    }
                }

                if (!nodePermissions || nodePermissions[action] !== true) {
                    console.warn(`[RBAC FAILURE] Action Denied: userId=${user.userId}, roleId=${employee.adminRoleId}, permissionKey=${resolvedKey}, action=${action}, endpoint=${req.originalUrl || req.url}, timestamp=${new Date().toISOString()}`);
                    return sendError(res, 403, `Access denied: missing ${action} permission for ${resolvedKey}`);
                }

                return next();
            }

            return sendError(res, 403, 'Access denied: insufficient privileges');
        } catch (error) {
            console.error(`[RBAC ERROR] userId=${req.user?.userId}, error=${error.message}`);
            return sendError(res, 500, `Internal authorization error: ${error.message}`);
        }
    };
};

export const sellerProfileAuth = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
        return sendError(res, 401, 'Authentication token missing');
    }

    try {
        const decoded = verifyAccessToken(token);

        if (String(decoded.role || '').toUpperCase() === 'SELLER' && decoded.userId) {
            req.user = {
                userId: decoded.userId,
                role: 'SELLER',
            };
            return next();
        }

        return sendError(res, 403, 'Seller access required');
    } catch {
        return sendError(res, 401, 'Invalid or expired token');
    }
};


