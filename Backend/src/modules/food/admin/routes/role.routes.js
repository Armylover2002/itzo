import express from 'express';
import * as roleController from '../controllers/role.controller.js';
import { checkPermission } from '../../../../core/auth/auth.middleware.js';
import { FoodAdmin } from '../../../../core/admin/admin.model.js';
import { sendError } from '../../../../utils/response.js';

const router = express.Router();

const checkRoleViewPermission = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) return sendError(res, 401, 'Authentication required');
        if (user.role === 'ADMIN') return next();

        if (user.role === 'EMPLOYEE') {
            const employee = await FoodAdmin.findById(user.userId).select('adminRoleId isActive').lean();
            if (!employee || !employee.isActive) {
                return sendError(res, 403, 'Employee account is suspended or inactive');
            }
            // Allow if the employee is fetching their own role
            if (employee.adminRoleId && String(employee.adminRoleId) === String(req.params.id)) {
                return next();
            }
        }

        // Otherwise, fall back to standard checkPermission logic
        return checkPermission('food::staff_management::roles', 'view')(req, res, next);
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};

router.get('/', checkPermission('food::staff_management::roles', 'view'), roleController.getRoles);
router.get('/:id', checkRoleViewPermission, roleController.getRoleById);
router.post('/', checkPermission('food::staff_management::roles', 'create'), roleController.createRole);
router.patch('/:id', checkPermission('food::staff_management::roles', 'edit'), roleController.updateRole);
router.patch('/:id/toggle', checkPermission('food::staff_management::roles', 'edit'), roleController.toggleRoleStatus);
router.delete('/:id', checkPermission('food::staff_management::roles', 'delete'), roleController.deleteRole);

export default router;

