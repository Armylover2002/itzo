import { HrmsLeave } from '../models/leave.model.js';
import { HrmsEmployee } from '../models/employee.model.js';
import { HrmsSettings } from '../models/settings.model.js';
import { sendResponse, sendError } from '../../../utils/response.js';

/**
 * EMPLOYEE: Apply for leave
 */
export const applyLeave = async (req, res, next) => {
    try {
        const employee = req.hrmsEmployee;
        if (!employee) return sendError(res, 404, 'Employee not found');

        const { leaveType, startDate, endDate, reason, isHalfDay } = req.body;

        if (!leaveType || !startDate || !endDate || !reason) {
            return sendError(res, 400, 'Leave type, start date, end date, and reason are required');
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        if (start > end) return sendError(res, 400, 'Start date must be before end date');
        if (start < new Date(new Date().setHours(0, 0, 0, 0))) {
            return sendError(res, 400, 'Cannot apply leave for past dates');
        }

        // Check overlap
        const overlapping = await HrmsLeave.findOne({
            employeeId: employee._id,
            status: { $in: ['Pending', 'Approved'] },
            startDate: { $lte: end },
            endDate: { $gte: start }
        });
        if (overlapping) return sendError(res, 400, 'Leave dates overlap with an existing request');

        // Calculate days
        let totalDays = 0;
        if (isHalfDay) {
            totalDays = 0.5;
        } else {
            const diffTime = end - start;
            totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }

        // Determine if Paid or LOP
        const settings = await HrmsSettings.findOne().lean();
        const paidPerMonth = settings?.leavePolicies?.paidLeavesPerMonth || 4;

        const month = start.getMonth();
        const year = start.getFullYear();

        // Count paid leaves already used this month
        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
        const paidUsed = await HrmsLeave.aggregate([
            {
                $match: {
                    employeeId: employee._id,
                    status: { $in: ['Pending', 'Approved'] },
                    startDate: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            { $group: { _id: null, total: { $sum: '$paidDays' } } }
        ]);

        const usedPaidDays = paidUsed[0]?.total || 0;
        const remainingPaid = Math.max(0, paidPerMonth - usedPaidDays);

        let isPaid = true;
        let lopDays = 0;
        let paidDays = totalDays;

        if (totalDays > remainingPaid) {
            lopDays = totalDays - remainingPaid;
            paidDays = remainingPaid;
            isPaid = remainingPaid > 0;
        }

        const leave = new HrmsLeave({
            employeeId: employee._id,
            leaveType,
            startDate: start,
            endDate: end,
            totalDays,
            reason,
            isHalfDay: isHalfDay || false,
            status: 'Pending',
            isPaid: lopDays === 0,
            paidDays,
            lopDays
        });

        await leave.save();
        return sendResponse(res, 201, 'Leave applied successfully', leave);
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return sendError(res, 400, `Required fields missing: ${messages.join(', ')}`);
        }
        next(error);
    }
};

/**
 * EMPLOYEE: Get own leaves
 */
export const getMyLeaves = async (req, res, next) => {
    try {
        const employee = req.hrmsEmployee;
        if (!employee) return sendError(res, 404, 'Employee not found');

        const { month, year, status } = req.query;
        const filter = { employeeId: employee._id };

        if (status) filter.status = status;
        if (month && year) {
            filter.startDate = {
                $gte: new Date(parseInt(year), parseInt(month) - 1, 1),
                $lte: new Date(parseInt(year), parseInt(month), 0, 23, 59, 59)
            };
        }

        const leaves = await HrmsLeave.find(filter).sort({ createdAt: -1 }).lean();
        return sendResponse(res, 200, 'Leaves retrieved', leaves);
    } catch (error) {
        next(error);
    }
};

/**
 * EMPLOYEE: Get leave balance for current month
 */
export const getLeaveBalance = async (req, res, next) => {
    try {
        const employee = req.hrmsEmployee;
        if (!employee) return sendError(res, 404, 'Employee not found');

        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();

        const settings = await HrmsSettings.findOne().lean();
        const paidPerMonth = settings?.leavePolicies?.paidLeavesPerMonth || 4;

        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

        const monthlyAgg = await HrmsLeave.aggregate([
            {
                $match: {
                    employeeId: employee._id,
                    status: { $in: ['Pending', 'Approved'] },
                    startDate: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            {
                $group: {
                    _id: null,
                    totalPaidUsed: { $sum: '$paidDays' },
                    totalLOP: { $sum: '$lopDays' },
                    totalDays: { $sum: '$totalDays' }
                }
            }
        ]);

        // Yearly totals
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59);

        const yearlyAgg = await HrmsLeave.aggregate([
            {
                $match: {
                    employeeId: employee._id,
                    status: { $in: ['Pending', 'Approved'] },
                    startDate: { $gte: startOfYear, $lte: endOfYear }
                }
            },
            {
                $group: {
                    _id: null,
                    totalPaidUsed: { $sum: '$paidDays' },
                    totalLOP: { $sum: '$lopDays' },
                    totalDays: { $sum: '$totalDays' }
                }
            }
        ]);

        const monthData = monthlyAgg[0] || { totalPaidUsed: 0, totalLOP: 0, totalDays: 0 };
        const yearData = yearlyAgg[0] || { totalPaidUsed: 0, totalLOP: 0, totalDays: 0 };

        return sendResponse(res, 200, 'Leave balance retrieved', {
            monthly: {
                allowed: paidPerMonth,
                used: monthData.totalPaidUsed,
                remaining: Math.max(0, paidPerMonth - monthData.totalPaidUsed),
                lopDays: monthData.totalLOP,
                totalDays: monthData.totalDays
            },
            yearly: {
                totalAllowed: paidPerMonth * 12,
                totalUsed: yearData.totalPaidUsed,
                totalRemaining: Math.max(0, (paidPerMonth * 12) - yearData.totalPaidUsed),
                totalLOP: yearData.totalLOP,
                totalDays: yearData.totalDays
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * MANAGER/ADMIN: Approve or reject leave
 */
export const approveLeave = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action, rejectionReason } = req.body; // 'Approved' or 'Rejected'

        if (!['Approved', 'Rejected'].includes(action)) {
            return sendError(res, 400, 'Invalid action. Must be Approved or Rejected.');
        }

        const leave = await HrmsLeave.findById(id);
        if (!leave) return sendError(res, 404, 'Leave record not found');

        if (leave.status !== 'Pending') {
            return sendError(res, 400, `Leave is already ${leave.status}`);
        }

        // Manager scope check
        if (req.user.role === 'HRMS_EMPLOYEE' && req.hrmsEmployee) {
            const targetEmployee = await HrmsEmployee.findById(leave.employeeId).lean();
            // Prevent self-approval
            if (String(leave.employeeId) === String(req.hrmsEmployee._id)) {
                return sendError(res, 403, 'You cannot approve your own leave');
            }
            // Manager can only approve team members' leaves
            if (targetEmployee && String(targetEmployee.managerId) !== String(req.hrmsEmployee._id)) {
                return sendError(res, 403, 'You can only manage leaves for your team members');
            }
        }

        const approverEmployee = await HrmsEmployee.findOne({ adminId: req.user.userId });

        if (action === 'Rejected') {
            leave.status = 'Rejected';
            leave.rejectionReason = rejectionReason || '';
        } else {
            leave.status = 'Approved';
        }

        leave.approvedBy = approverEmployee?._id;
        leave.approvedAt = new Date();
        const saveOptions = action === 'Approved' ? {} : { validateBeforeSave: false };
        await leave.save(saveOptions);

        return sendResponse(res, 200, `Leave ${action.toLowerCase()} successfully`, leave);
    } catch (error) {
        if (error.name === 'ValidationError') {
            return sendError(res, 400, 'Cannot approve: this leave record is missing required fields. Please reject it or have the employee re-submit.');
        }
        next(error);
    }
};

/**
 * ADMIN: Get all leaves with filters
 */
export const getAllLeaves = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, status, month, year, employeeId } = req.query;
        const filter = {};

        if (status) filter.status = status;
        if (employeeId) filter.employeeId = employeeId;
        if (month && year) {
            filter.startDate = {
                $gte: new Date(parseInt(year), parseInt(month) - 1, 1),
                $lte: new Date(parseInt(year), parseInt(month), 0, 23, 59, 59)
            };
        }

        // If manager, scope to team only
        if (req.user.role === 'HRMS_EMPLOYEE' && req.hrmsEmployee) {
            const teamIds = await HrmsEmployee.find({ managerId: req.hrmsEmployee._id })
                .select('_id').lean();
            const allowedIds = teamIds.map(t => t._id);
            if (filter.employeeId) {
                if (!allowedIds.some(id => String(id) === String(filter.employeeId))) {
                    return sendResponse(res, 200, 'Leaves retrieved', {
                        leaves: [],
                        pagination: { page: 1, limit: parseInt(limit), total: 0, totalPages: 0 }
                    });
                }
            } else {
                filter.employeeId = { $in: allowedIds };
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [leaves, total] = await Promise.all([
            HrmsLeave.find(filter)
                .populate({
                    path: 'employeeId',
                    populate: { path: 'adminId', select: 'name email' }
                })
                .populate({
                    path: 'approvedBy',
                    populate: { path: 'adminId', select: 'name' }
                })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            HrmsLeave.countDocuments(filter)
        ]);

        return sendResponse(res, 200, 'Leaves retrieved', {
            leaves,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * MANAGER/ADMIN: Get pending leaves
 */
export const getPendingLeaves = async (req, res, next) => {
    try {
        const filter = { status: 'Pending' };

        // Manager scope
        if (req.user.role === 'HRMS_EMPLOYEE' && req.hrmsEmployee) {
            const teamIds = await HrmsEmployee.find({ managerId: req.hrmsEmployee._id }).select('_id').lean();
            filter.employeeId = { $in: teamIds.map(t => t._id) };
        }

        const leaves = await HrmsLeave.find(filter)
            .populate({ path: 'employeeId', populate: { path: 'adminId', select: 'name email' } })
            .sort({ createdAt: -1 })
            .lean();

        return sendResponse(res, 200, 'Pending leaves retrieved', leaves);
    } catch (error) {
        next(error);
    }
};
