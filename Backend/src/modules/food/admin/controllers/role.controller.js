import { AdminRole } from '../../../../core/admin/role.model.js';
import { FoodAdmin } from '../../../../core/admin/admin.model.js';
import { sendResponse, sendError } from '../../../../utils/response.js';
import { invalidateRoleCache } from '../../../../core/auth/auth.middleware.js';

/**
 * Get all roles
 */
export const getRoles = async (req, res) => {
    try {
        const roles = await AdminRole.find().sort({ createdAt: -1 });
        return sendResponse(res, 200, 'Roles fetched successfully', roles);
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};

/**
 * Get single role
 */
export const getRoleById = async (req, res) => {
    try {
        const role = await AdminRole.findById(req.params.id);
        if (!role) return sendError(res, 404, 'Role not found');
        return sendResponse(res, 200, 'Role fetched successfully', role);
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};

/**
 * Create a new role
 */
export const createRole = async (req, res) => {
    try {
        const { roleName, description, permissions } = req.body;

        // Check if role already exists
        const existingRole = await AdminRole.findOne({ roleName: { $regex: new RegExp(`^${roleName}$`, 'i') } });
        if (existingRole) {
            return sendError(res, 400, 'Role name already exists');
        }

        const newRole = new AdminRole({
            roleName,
            description,
            permissions,
            createdBy: req.user?._id
        });

        await newRole.save();
        return sendResponse(res, 201, 'Role created successfully', newRole);
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};

/**
 * Update an existing role
 */
export const updateRole = async (req, res) => {
    try {
        const { roleName, description, permissions, status } = req.body;
        const roleId = req.params.id;

        const role = await AdminRole.findById(roleId);
        if (!role) return sendError(res, 404, 'Role not found');

        // Prevent disabling default role
        if (role.isDefault && status === 'inactive') {
            return sendError(res, 400, 'Cannot disable system default role');
        }

        // Check name uniqueness if changed
        if (roleName && roleName !== role.roleName) {
            const existingRole = await AdminRole.findOne({ 
                roleName: { $regex: new RegExp(`^${roleName}$`, 'i') },
                _id: { $ne: roleId }
            });
            if (existingRole) {
                return sendError(res, 400, 'Role name already exists');
            }
        }

        role.roleName = roleName || role.roleName;
        role.description = description !== undefined ? description : role.description;
        role.permissions = permissions || role.permissions;
        role.status = status || role.status;

        await role.save();
        invalidateRoleCache(roleId);
        return sendResponse(res, 200, 'Role updated successfully', role);
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};

/**
 * Toggle role status
 */
export const toggleRoleStatus = async (req, res) => {
    try {
        const role = await AdminRole.findById(req.params.id);
        if (!role) return sendError(res, 404, 'Role not found');

        if (role.isDefault && role.status === 'active') {
            return sendError(res, 400, 'Cannot disable system default role');
        }

        role.status = role.status === 'active' ? 'inactive' : 'active';
        await role.save();
        invalidateRoleCache(req.params.id);

        return sendResponse(res, 200, `Role ${role.status === 'active' ? 'activated' : 'deactivated'} successfully`, role);
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};

/**
 * Delete a role (blocked for default roles and roles still assigned to employees)
 */
export const deleteRole = async (req, res) => {
    try {
        const roleId = req.params.id;
        const role = await AdminRole.findById(roleId);
        if (!role) return sendError(res, 404, 'Role not found');

        if (role.isDefault) {
            return sendError(res, 400, 'Cannot delete system default role');
        }

        const assignedCount = await FoodAdmin.countDocuments({
            role: 'EMPLOYEE',
            adminRoleId: roleId,
        });
        if (assignedCount > 0) {
            return sendError(
                res,
                400,
                `Cannot delete role assigned to ${assignedCount} employee${assignedCount === 1 ? '' : 's'}. Reassign them first.`
            );
        }

        await role.deleteOne();
        invalidateRoleCache(roleId);
        return sendResponse(res, 200, 'Role deleted successfully', role);
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};
