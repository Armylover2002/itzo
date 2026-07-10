import { HrmsExpense } from '../models/expense.model.js';
import { HrmsEmployee } from '../models/employee.model.js';
import { sendResponse, sendError } from '../../../utils/response.js';

/**
 * EMPLOYEE: Submit a travel/visit expense
 */
export const submitExpense = async (req, res, next) => {
    try {
        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
        if (!employee) return sendError(res, 404, 'Employee not found');

        const { visitDate, purpose, travelDistanceKm, travelCost, hotelCost, foodCost, otherExpenses, attachments, remarks } = req.body;

        if (!visitDate || !purpose) return sendError(res, 400, 'Visit date and purpose are required');

        const expense = new HrmsExpense({
            employeeId: employee._id,
            visitDate,
            purpose,
            travelDistanceKm: travelDistanceKm || 0,
            travelCost: travelCost || 0,
            hotelCost: hotelCost || 0,
            foodCost: foodCost || 0,
            otherExpenses: otherExpenses || 0,
            attachments: attachments || [],
            remarks,
            status: 'Pending'
        });

        await expense.save();
        return sendResponse(res, 201, 'Expense submitted successfully', expense);
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return sendError(res, 400, `Required fields missing: ${messages.join(', ')}`);
        }
        next(error);
    }
};

/**
 * EMPLOYEE: Get own expenses
 */
export const getMyExpenses = async (req, res, next) => {
    try {
        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
        if (!employee) return sendError(res, 404, 'Employee not found');

        const { status, page = 1, limit = 20 } = req.query;
        const filter = { employeeId: employee._id };
        if (status) filter.status = status;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [expenses, total] = await Promise.all([
            HrmsExpense.find(filter).sort({ visitDate: -1 }).skip(skip).limit(parseInt(limit)).lean(),
            HrmsExpense.countDocuments(filter)
        ]);

        return sendResponse(res, 200, 'Expenses retrieved', {
            expenses,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN/MANAGER: Get all expenses with filters
 */
export const getAllExpenses = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, status, employeeId } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (employeeId) filter.employeeId = employeeId;

        // Manager scope
        if (req.user.role === 'HRMS_EMPLOYEE' && req.hrmsEmployee) {
            const teamIds = await HrmsEmployee.find({ managerId: req.hrmsEmployee._id }).select('_id').lean();
            const allowedIds = teamIds.map(t => t._id);
            if (filter.employeeId) {
                if (!allowedIds.some(id => String(id) === String(filter.employeeId))) {
                    return sendResponse(res, 200, 'Expenses retrieved', {
                        expenses: [],
                        pagination: { page: 1, limit: parseInt(limit), total: 0, totalPages: 0 }
                    });
                }
            } else {
                filter.employeeId = { $in: allowedIds };
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [expenses, total] = await Promise.all([
            HrmsExpense.find(filter)
                .populate({ path: 'employeeId', populate: { path: 'adminId', select: 'name email' } })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            HrmsExpense.countDocuments(filter)
        ]);

        return sendResponse(res, 200, 'Expenses retrieved', {
            expenses,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN/MANAGER: Approve/reject expense
 */
export const approveExpense = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action, approvedAmount, rejectionReason } = req.body;

        if (!['Approved', 'Rejected'].includes(action)) {
            return sendError(res, 400, 'Invalid action. Must be Approved or Rejected.');
        }

        const expense = await HrmsExpense.findById(id);
        if (!expense) return sendError(res, 404, 'Expense not found');
        if (expense.status !== 'Pending') return sendError(res, 400, `Expense is already ${expense.status}`);

        // Self-approval prevention and Manager scope check
        if (req.user.role === 'HRMS_EMPLOYEE' && req.hrmsEmployee) {
            if (String(expense.employeeId) === String(req.hrmsEmployee._id)) {
                return sendError(res, 403, 'You cannot approve your own expense');
            }
            
            const targetEmployee = await HrmsEmployee.findById(expense.employeeId).lean();
            if (!targetEmployee || String(targetEmployee.managerId) !== String(req.hrmsEmployee._id)) {
                return sendError(res, 403, 'You can only manage expenses for your team members');
            }
        }

        const approverEmployee = await HrmsEmployee.findOne({ adminId: req.user.userId });

        if (action === 'Approved') {
            expense.status = 'Approved';
            expense.approvedAmount = approvedAmount || expense.totalAmount;
            expense.approvedBy = approverEmployee?._id;
            expense.approvedAt = new Date();
        } else {
            expense.status = 'Rejected';
            expense.rejectionReason = rejectionReason || '';
            expense.approvedBy = approverEmployee?._id;
        }

        const saveOptions = action === 'Approved' ? {} : { validateBeforeSave: false };
        await expense.save(saveOptions);
        return sendResponse(res, 200, `Expense ${action.toLowerCase()}`, expense);
    } catch (error) {
        if (error.name === 'ValidationError') {
            // When approving old data that is missing required fields
            return sendError(res, 400, 'Cannot approve: this expense record is missing required fields (e.g. Visit Date or Purpose). Please reject it or have the employee re-submit.');
        }
        next(error);
    }
};
