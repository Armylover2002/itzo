import { HrmsEmployee } from '../models/employee.model.js';
import { sendResponse, sendError } from '../../../utils/response.js';
import mongoose from 'mongoose';

/**
 * MANAGER: Get logged-in manager's team
 */
export const getMyTeam = async (req, res, next) => {
    try {
        if (!req.hrmsEmployee) return sendError(res, 401, 'Unauthorized');

        const { search, department, employeeType } = req.query;
        const filter = { managerId: req.hrmsEmployee._id, status: 'Active' };

        if (department) filter.department = department;
        if (employeeType) filter.employeeType = employeeType;
        if (search) {
            const regex = new RegExp(search, 'i');
            const searchAdmins = await mongoose.model('FoodAdmin').find({
                $or: [{ name: regex }, { email: regex }]
            }).select('_id').lean();
            
            filter.$or = [
                { employeeId: regex },
                { designation: regex },
                { adminId: { $in: searchAdmins.map(a => a._id) } }
            ];
        }

        const team = await HrmsEmployee.find(filter)
            .populate('adminId', 'name email phone profileImage')
            .lean();

        return sendResponse(res, 200, 'Team retrieved', team);
    } catch (error) {
        next(error);
    }
};

/**
 * MANAGER/ADMIN: Get all unassigned active employees (who do not have a managerId)
 */
export const getUnassignedEmployees = async (req, res, next) => {
    try {
        const { search } = req.query;
        
        // Exclude HR and Managers if you want, but for now just unassigned 'Employee' or anyone without a manager
        const filter = { managerId: null, status: 'Active', _id: { $ne: req.hrmsEmployee?._id } };

        if (search) {
            const regex = new RegExp(search, 'i');
            const searchAdmins = await mongoose.model('FoodAdmin').find({
                $or: [{ name: regex }, { email: regex }]
            }).select('_id').lean();
            
            filter.$or = [
                { employeeId: regex },
                { designation: regex },
                { department: regex },
                { adminId: { $in: searchAdmins.map(a => a._id) } }
            ];
        }

        const unassigned = await HrmsEmployee.find(filter)
            .populate('adminId', 'name email phone profileImage')
            .limit(50)
            .lean();

        return sendResponse(res, 200, 'Unassigned employees retrieved', unassigned);
    } catch (error) {
        next(error);
    }
};

/**
 * MANAGER: Add an unassigned employee to team
 */
export const addTeamMember = async (req, res, next) => {
    try {
        if (!req.hrmsEmployee) return sendError(res, 401, 'Unauthorized');
        const { employeeId } = req.body;

        const employee = await HrmsEmployee.findById(employeeId);
        if (!employee) return sendError(res, 404, 'Employee not found');
        
        if (employee.status !== 'Active') return sendError(res, 400, 'Cannot assign an inactive employee');

        if (employee.managerId) {
            return sendError(res, 400, 'This employee is already assigned to another manager');
        }

        // Prevent assigning self
        if (String(employee._id) === String(req.hrmsEmployee._id)) {
            return sendError(res, 400, 'You cannot assign yourself to your own team');
        }

        employee.managerId = req.hrmsEmployee._id;
        employee.teamHistory.push({
            managerId: req.hrmsEmployee._id,
            assignedAt: new Date()
        });

        await employee.save();
        return sendResponse(res, 200, 'Employee added to team successfully', employee);
    } catch (error) {
        next(error);
    }
};

/**
 * MANAGER: Remove an employee from team (makes them unassigned)
 */
export const removeTeamMember = async (req, res, next) => {
    try {
        if (!req.hrmsEmployee) return sendError(res, 401, 'Unauthorized');
        const { employeeId } = req.body;

        const employee = await HrmsEmployee.findById(employeeId);
        if (!employee) return sendError(res, 404, 'Employee not found');

        if (String(employee.managerId) !== String(req.hrmsEmployee._id)) {
            return sendError(res, 403, 'This employee is not in your team');
        }

        employee.managerId = null;
        
        // Update history
        if (employee.teamHistory && employee.teamHistory.length > 0) {
            const lastIndex = employee.teamHistory.length - 1;
            if (!employee.teamHistory[lastIndex].removedAt) {
                employee.teamHistory[lastIndex].removedAt = new Date();
            }
        }

        await employee.save();
        return sendResponse(res, 200, 'Employee removed from team', employee);
    } catch (error) {
        next(error);
    }
};
