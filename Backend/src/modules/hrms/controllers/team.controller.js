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
 * MANAGER/ADMIN: Get all active employees with their assignment status.
 * Returns both unassigned AND assigned employees so the UI can show
 * "Available" vs "Already Assigned to: Manager Name" badges.
 * Backward compatible: unassigned employees still appear as before.
 */
export const getUnassignedEmployees = async (req, res, next) => {
    try {
        const { search } = req.query;
        
        // Base filter: active normal employees only, exclude Managers, inactive/suspended, and self
        const filter = { status: 'Active', _id: { $ne: req.hrmsEmployee?._id }, hrmsRole: { $ne: 'Manager' } };

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

        const employees = await HrmsEmployee.find(filter)
            .populate('adminId', 'name email phone profileImage')
            .populate({
                path: 'managerId',
                populate: { path: 'adminId', select: 'name email' }
            })
            .limit(100)
            .lean();

        // Enrich each employee with assignment status
        const enriched = employees.map(emp => ({
            ...emp,
            assignmentStatus: emp.managerId ? 'Assigned' : 'Available',
            currentManagerName: emp.managerId?.adminId?.name || null,
            currentManagerId: emp.managerId?._id || null
        }));

        return sendResponse(res, 200, 'Employees with assignment status retrieved', enriched);
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
        
        if (employee.status !== 'Active') {
            return sendError(res, 400, employee.status === 'Suspended' ? 'Employee is suspended.' : 'Employee is inactive.');
        }

        if (employee.hrmsRole === 'Manager') {
            return sendError(res, 400, 'Manager accounts cannot be added as team members.');
        }

        if (employee.managerId) {
            if (String(employee.managerId) === String(req.hrmsEmployee._id)) {
                return sendError(res, 400, 'Employee already belongs to this manager.');
            }
            await employee.populate({ path: 'managerId', populate: { path: 'adminId', select: 'name' } });
            const otherManagerName = employee.managerId?.adminId?.name || 'Another Manager';
            return sendError(res, 400, `Employee is already assigned to Manager: ${otherManagerName}.`);
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
