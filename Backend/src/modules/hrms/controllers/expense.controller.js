import { HrmsExpense, HrmsMonthlyExpense } from '../models/expense.model.js';
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

// ─────────────────────────────────────────────────────────────────────────────
// MONTHLY BATCH EXPENSE ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper: Get the number of days in a given month/year
 */
function daysInMonth(month, year) {
    return new Date(year, month, 0).getDate();
}

/**
 * EMPLOYEE: Submit a monthly expense batch
 */
export const submitMonthlyExpense = async (req, res, next) => {
    try {
        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
        if (!employee) return sendError(res, 404, 'Employee not found');

        const { month, year, entries, resubmissionNote } = req.body;

        // ── Validate month/year ──
        if (!month || !year) return sendError(res, 400, 'Month and year are required');
        const m = parseInt(month);
        const y = parseInt(year);
        if (m < 1 || m > 12) return sendError(res, 400, 'Month must be between 1 and 12');
        if (y < 2000 || y > 2100) return sendError(res, 400, 'Invalid year');

        // ── Only allow past months ──
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-indexed
        const currentYear = now.getFullYear();
        if (y > currentYear || (y === currentYear && m >= currentMonth)) {
            return sendError(res, 400, 'You can only submit expenses for past months. Current and future months are not allowed.');
        }

        // ── Validate entries ──
        if (!entries || !Array.isArray(entries) || entries.length === 0) {
            return sendError(res, 400, 'At least one expense entry is required');
        }

        // Validate each entry
        const monthStart = new Date(y, m - 1, 1);
        const monthEnd = new Date(y, m - 1, daysInMonth(m, y), 23, 59, 59, 999);

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (!entry.visitDate) return sendError(res, 400, `Entry ${i + 1}: Visit date is required`);
            if (!entry.purpose || !entry.purpose.trim()) return sendError(res, 400, `Entry ${i + 1}: Purpose is required`);

            const visitDate = new Date(entry.visitDate);
            if (isNaN(visitDate.getTime())) return sendError(res, 400, `Entry ${i + 1}: Invalid visit date`);
            if (visitDate < monthStart || visitDate > monthEnd) {
                return sendError(res, 400, `Entry ${i + 1}: Visit date must be within ${monthStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`);
            }
        }

        // ── Check for existing batch ──
        const existing = await HrmsMonthlyExpense.findOne({ employeeId: employee._id, month: m, year: y });

        if (existing) {
            if (existing.status === 'Rejected') {
                // Allow resubmission — require resubmission note
                if (!resubmissionNote || !resubmissionNote.trim()) {
                    return sendError(res, 400, 'Resubmission note is required when resubmitting a rejected expense batch. Please explain the corrections made.');
                }
                // Delete the rejected batch so we can create a new one
                await HrmsMonthlyExpense.deleteOne({ _id: existing._id });
            } else {
                return sendError(res, 409, `You have already submitted expenses for this month (status: ${existing.status}). Only one submission per month is allowed.`);
            }
        }

        // ── Build and save ──
        const batch = new HrmsMonthlyExpense({
            employeeId: employee._id,
            month: m,
            year: y,
            entries: entries.map(e => ({
                visitDate: new Date(e.visitDate),
                purpose: e.purpose.trim(),
                travelDistanceKm: Math.max(0, Number(e.travelDistanceKm) || 0),
                travelCost: Math.max(0, Number(e.travelCost) || 0),
                hotelCost: Math.max(0, Number(e.hotelCost) || 0),
                foodCost: Math.max(0, Number(e.foodCost) || 0),
                otherExpenses: Math.max(0, Number(e.otherExpenses) || 0),
                remarks: e.remarks || '',
                attachments: e.attachments || []
            })),
            status: 'Pending',
            submittedAt: new Date(),
            resubmissionNote: resubmissionNote?.trim() || '',
            resubmissionCount: existing ? (existing.resubmissionCount || 0) + 1 : 0
        });

        await batch.save();
        return sendResponse(res, 201, 'Monthly expense batch submitted successfully', batch);
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return sendError(res, 400, `Validation failed: ${messages.join(', ')}`);
        }
        if (error.code === 11000) {
            return sendError(res, 409, 'A monthly expense batch already exists for this month. Only one submission per month is allowed.');
        }
        next(error);
    }
};

/**
 * EMPLOYEE: Get own monthly expense batches
 */
export const getMyMonthlyExpenses = async (req, res, next) => {
    try {
        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
        if (!employee) return sendError(res, 404, 'Employee not found');

        const { status, page = 1, limit = 20 } = req.query;
        const filter = { employeeId: employee._id };
        if (status) filter.status = status;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [batches, total] = await Promise.all([
            HrmsMonthlyExpense.find(filter)
                .sort({ year: -1, month: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            HrmsMonthlyExpense.countDocuments(filter)
        ]);

        return sendResponse(res, 200, 'Monthly expenses retrieved', {
            batches,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * EMPLOYEE: Get a single monthly expense batch by ID
 */
export const getMonthlyExpenseDetail = async (req, res, next) => {
    try {
        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
        if (!employee) return sendError(res, 404, 'Employee not found');

        const batch = await HrmsMonthlyExpense.findOne({
            _id: req.params.id,
            employeeId: employee._id
        }).lean();

        if (!batch) return sendError(res, 404, 'Monthly expense batch not found');

        return sendResponse(res, 200, 'Monthly expense detail retrieved', batch);
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN/MANAGER: Get all monthly expense batches with filters
 */
export const getAllMonthlyExpenses = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, status, employeeId, month, year } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (employeeId) filter.employeeId = employeeId;
        if (month) filter.month = parseInt(month);
        if (year) filter.year = parseInt(year);

        // Manager scope
        if (req.user.role === 'HRMS_EMPLOYEE' && req.hrmsEmployee) {
            const teamIds = await HrmsEmployee.find({ managerId: req.hrmsEmployee._id }).select('_id').lean();
            const allowedIds = teamIds.map(t => t._id);
            if (filter.employeeId) {
                if (!allowedIds.some(id => String(id) === String(filter.employeeId))) {
                    return sendResponse(res, 200, 'Monthly expenses retrieved', {
                        batches: [],
                        pagination: { page: 1, limit: parseInt(limit), total: 0, totalPages: 0 }
                    });
                }
            } else {
                filter.employeeId = { $in: allowedIds };
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [batches, total] = await Promise.all([
            HrmsMonthlyExpense.find(filter)
                .populate({ path: 'employeeId', populate: { path: 'adminId', select: 'name email' } })
                .sort({ year: -1, month: -1, createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            HrmsMonthlyExpense.countDocuments(filter)
        ]);

        return sendResponse(res, 200, 'Monthly expenses retrieved', {
            batches,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN/MANAGER: Approve/reject a monthly expense batch
 */
export const approveMonthlyExpense = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action, approvedAmount, rejectionReason } = req.body;

        if (!['Approved', 'Rejected'].includes(action)) {
            return sendError(res, 400, 'Invalid action. Must be Approved or Rejected.');
        }

        const batch = await HrmsMonthlyExpense.findById(id);
        if (!batch) return sendError(res, 404, 'Monthly expense batch not found');
        if (batch.status !== 'Pending') return sendError(res, 400, `Expense batch is already ${batch.status}`);

        // Self-approval prevention and Manager scope check
        if (req.user.role === 'HRMS_EMPLOYEE' && req.hrmsEmployee) {
            if (String(batch.employeeId) === String(req.hrmsEmployee._id)) {
                return sendError(res, 403, 'You cannot approve your own expense batch');
            }

            const targetEmployee = await HrmsEmployee.findById(batch.employeeId).lean();
            if (!targetEmployee || String(targetEmployee.managerId) !== String(req.hrmsEmployee._id)) {
                return sendError(res, 403, 'You can only manage expenses for your team members');
            }
        }

        const approverEmployee = await HrmsEmployee.findOne({ adminId: req.user.userId });

        if (action === 'Approved') {
            batch.status = 'Approved';
            batch.approvedAmount = approvedAmount != null ? Number(approvedAmount) : batch.totalAmount;
            batch.approvedBy = approverEmployee?._id;
            batch.approvedAt = new Date();
        } else {
            if (!rejectionReason || !rejectionReason.trim()) {
                return sendError(res, 400, 'Rejection reason is required');
            }
            batch.status = 'Rejected';
            batch.rejectionReason = rejectionReason.trim();
            batch.approvedBy = approverEmployee?._id;
        }

        await batch.save();
        return sendResponse(res, 200, `Monthly expense batch ${action.toLowerCase()}`, batch);
    } catch (error) {
        if (error.name === 'ValidationError') {
            return sendError(res, 400, 'Cannot process: expense batch has validation errors.');
        }
        next(error);
    }
};
