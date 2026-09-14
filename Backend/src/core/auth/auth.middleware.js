import { verifyAccessToken, verifyRestaurantRegistrationToken, verifySellerRegistrationToken } from './token.util.js';
import { sendError } from '../../utils/response.js';
import { FoodUser } from '../users/user.model.js';
import { FoodDeliveryPartner } from '../../modules/food/delivery/models/deliveryPartner.model.js';
import { FoodAdmin } from '../admin/admin.model.js';
import { AdminRole } from '../admin/role.model.js';
import { FoodRestaurant } from '../../modules/food/restaurant/models/restaurant.model.js';

export const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'ADMIN') {
        return sendError(res, 403, 'Admin access required');
    }
    next();
};

/** Seller onboarding/profile APIs accept a full seller session or a short-lived OTP registration token. */
export const sellerProfileAuth = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
        return sendError(res, 401, 'Authentication token missing');
    }

    try {
        let decoded;
        try {
            decoded = verifySellerRegistrationToken(token);
        } catch {
            decoded = verifyAccessToken(token);
        }

        if (decoded?.purpose === 'seller_onboarding') {
            const phoneDigits = String(decoded.phone || decoded.phoneLast10 || '').replace(/\D/g, '');
            const phoneLast10 = String(decoded.phoneLast10 || phoneDigits).replace(/\D/g, '').slice(-10);
            if (!phoneLast10) {
                return sendError(res, 401, 'Invalid seller registration token');
            }
            req.sellerOnboarding = {
                phone: phoneDigits || phoneLast10,
                phoneDigits: phoneDigits || phoneLast10,
                phoneLast10,
            };
            req.user = { role: 'SELLER' };
            return next();
        }

        if (decoded?.purpose === 'restaurant_onboarding') {
            return sendError(res, 401, 'Invalid or expired token');
        }

        if (decoded.role === 'SELLER' && decoded.userId) {
            req.user = {
                userId: decoded.userId,
                role: decoded.role,
            };
            return next();
        }

        return sendError(res, 403, 'Seller access required');
    } catch {
        return sendError(res, 401, 'Invalid or expired token');
    }
};

export const requireRestaurantRegistrationToken = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
        return sendError(res, 401, 'Registration token required. Please verify OTP again.');
    }

    try {
        const decoded = verifyRestaurantRegistrationToken(token);
        const phoneLast10 = String(decoded.phoneLast10 || decoded.phone || '').replace(/\D/g, '').slice(-10);
        if (!phoneLast10) {
            return sendError(res, 401, 'Invalid registration token');
        }
        req.registrationPhone = phoneLast10;
        req.registrationPhoneDigits = String(decoded.phone || phoneLast10).replace(/\D/g, '');
        next();
    } catch {
        return sendError(res, 401, 'Invalid or expired registration token. Please verify OTP again.');
    }
};

export const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
        return sendError(res, 401, 'Authentication token missing');
    }

    try {
        const decoded = verifyAccessToken(token);
        if (
            decoded?.purpose === 'restaurant_onboarding' ||
            decoded?.purpose === 'seller_onboarding'
        ) {
            return sendError(res, 401, 'Invalid or expired token');
        }
        req.user = {
            userId: decoded.userId,
            role: decoded.role
        };
        if (decoded.role === 'USER') {
            // Enforce active status in real-time - deactivated users are logged out on next request.
            FoodUser.findById(decoded.userId).select('isActive').lean().then((doc) => {
                if (!doc || doc.isActive === false) {
                    return sendError(res, 401, 'User account is deactivated');
                }
                next();
            }).catch(() => sendError(res, 401, 'Authentication failed'));
            return;
        }
        if (decoded.role === 'DELIVERY_PARTNER') {
            FoodDeliveryPartner.findById(decoded.userId).select('isActive').lean().then((doc) => {
                if (!doc || doc.isActive === false) {
                    return sendError(res, 401, 'Delivery account is inactive');
                }
                next();
            }).catch(() => sendError(res, 401, 'Authentication failed'));
            return;
        }
        if (decoded.role === 'ADMIN' || decoded.role === 'EMPLOYEE') {
            FoodAdmin.findById(decoded.userId).select('isActive').lean().then((doc) => {
                if (!doc || doc.isActive === false) {
                    return sendError(res, 401, 'Admin account is deactivated');
                }
                next();
            }).catch(() => sendError(res, 401, 'Authentication failed'));
            return;
        }
        if (decoded.role === 'RESTAURANT') {
            FoodRestaurant.findById(decoded.userId)
                .select('status isActive isDeleted accountStatus wasEverApproved')
                .lean()
                .then((doc) => {
                    if (!doc) {
                        return sendError(res, 401, 'Restaurant account not found');
                    }

                    if (doc.isDeleted === true || doc.accountStatus === 'deleted') {
                        return sendError(res, 401, 'Your account has been deleted/deactivated. Please contact support.');
                    }

                    if (String(doc.status || '').toLowerCase() === 'rejected') {
                        return sendError(res, 401, 'Your account has been rejected. Please contact support.');
                    }

                    if (doc.isActive === false && String(doc.status || '').toLowerCase() !== 'pending') {
                        return sendError(res, 401, 'Your account has been deleted/deactivated. Please contact support.');
                    }

                    next();
                })
                .catch(() => sendError(res, 401, 'Authentication failed'));
            return;
        }
        return next();
    } catch (error) {
        return sendError(res, 401, 'Invalid or expired token');
    }
};

/** Sets req.user when a valid Bearer token is present; continues without error when absent. */
export const optionalAuthMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!token) return next();

    try {
        const decoded = verifyAccessToken(token);
        req.user = {
            userId: decoded.userId,
            role: decoded.role,
        };
    } catch {
        // Ignore invalid tokens for public endpoints
    }
    return next();
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
            if (user.role === 'ADMIN') {
                return next();
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
                
                let hasPerm = false;
                const nodePermissions = permissions[resolvedKey];
                if (nodePermissions && nodePermissions[action] === true) {
                    hasPerm = true;
                } else {
                    const subKeyPrefix = resolvedKey + "::";
                    hasPerm = Object.entries(permissions).some(([key, val]) => {
                        return key.startsWith(subKeyPrefix) && val && val[action] === true;
                    });
                }

                if (!hasPerm) {
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
