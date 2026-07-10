import { HrmsEmployee } from '../models/employee.model.js';
import { sendError } from '../../../utils/response.js';
import { FoodAdmin } from '../../../core/admin/admin.model.js';
import { getCachedRolePermissions } from '../../../core/auth/auth.middleware.js';

/**
 * Ensures the authenticated user is an HRMS_EMPLOYEE with an active employee profile.
 * Attaches req.hrmsEmployee for downstream use.
 */
export const requireHrmsEmployee = async (req, res, next) => {
    try {
        if (!req.user || !req.user.userId) {
            return sendError(res, 401, 'Authentication required');
        }

        // Allow HRMS_EMPLOYEE, also allow ADMIN for admin-as-employee scenarios
        if (req.user.role !== 'HRMS_EMPLOYEE' && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return sendError(res, 403, 'HRMS Employee access required');
        }

        const employee = await HrmsEmployee.findOne({
            $or: [{ adminId: req.user.userId }, { _id: req.user.userId }]
        }).lean();
        if (!employee) {
            return sendError(res, 404, 'HRMS Employee profile not found');
        }

        if (employee.status !== 'Active') {
            return sendError(res, 403, 'Employee account is not active');
        }

        req.hrmsEmployee = employee;
        next();
    } catch (error) {
        return sendError(res, 500, `HRMS auth error: ${error.message}`);
    }
};

/**
 * Ensures the authenticated user is a Manager (hrmsRole = 'Manager' or 'HR').
 * Must be used after requireHrmsEmployee.
 */
export const requireHrmsManager = async (req, res, next) => {
    try {
        if (!req.hrmsEmployee) {
            return sendError(res, 403, 'Employee profile required');
        }

        if (req.hrmsEmployee.hrmsRole !== 'Manager') {
            return sendError(res, 403, 'Manager access required');
        }

        next();
    } catch (error) {
        return sendError(res, 500, `HRMS auth error: ${error.message}`);
    }
};

/**
 * Allows access for either ECS Admin OR HRMS Manager.
 * Useful for approval endpoints.
 */
export const requireAdminOrManager = async (req, res, next) => {
    try {
        if (!req.user || !req.user.userId) {
            return sendError(res, 401, 'Authentication required');
        }

        // Admin bypass
        if (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN') {
            return next();
        }

        // Check if HRMS Manager (from HRMS Portal or ECS Admin Portal)
        if (req.user.role === 'HRMS_EMPLOYEE' || req.user.role === 'EMPLOYEE') {
            let hasAccess = false;

            // 1. Check if they have an active HrmsEmployee profile
            const query = { $or: [{ adminId: req.user.userId }, { _id: req.user.userId }] };
            const employee = await HrmsEmployee.findOne(query).lean();
            if (employee && employee.status === 'Active' && employee.hrmsRole === 'Manager') {
                hasAccess = true;
                req.hrmsEmployee = employee;
            }

            // 2. If no HrmsEmployee profile, but they are an ECS EMPLOYEE, check their AdminRole permissions
            if (!hasAccess && req.user.role === 'EMPLOYEE') {
                const adminUser = await FoodAdmin.findById(req.user.userId).select('adminRoleId isActive').lean();
                if (adminUser && adminUser.isActive && adminUser.adminRoleId) {
                    const permissions = await getCachedRolePermissions(adminUser.adminRoleId);
                    // Check if they have ANY 'hrms' permission (e.g., hrms::dashboard, hrms::employees, etc.)
                    // Or if they have the root 'food::hrms' permission
                    if (permissions) {
                         const hasHrmsPerm = Object.keys(permissions).some(key => key.includes('hrms'));
                         if (hasHrmsPerm) {
                             hasAccess = true;
                         }
                    }
                }
            }

            if (hasAccess) {
                return next();
            }
        }

        return sendError(res, 403, 'Admin or Manager access required');
    } catch (error) {
        return sendError(res, 500, `HRMS auth error: ${error.message}`);
    }
};
