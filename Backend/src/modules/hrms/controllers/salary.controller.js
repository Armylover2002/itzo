import { HrmsSalary } from '../models/salary.model.js';
import { HrmsEmployee } from '../models/employee.model.js';
import { HrmsAttendance } from '../models/attendance.model.js';
import { HrmsLeave } from '../models/leave.model.js';
import { HrmsExpense } from '../models/expense.model.js';
import { HrmsSettings } from '../models/settings.model.js';
import { HrmsDocument } from '../models/document.model.js';
import { generatePdfBuffer, uploadPdfToCloudinary } from '../services/payslip.service.js';
import { sendResponse, sendError } from '../../../utils/response.js';

/**
 * ADMIN: Generate payroll for a month
 */
export const generatePayroll = async (req, res, next) => {
    try {
        const { month, year } = req.body;
        if (!month || !year) return sendError(res, 400, 'Month and year are required');

        const m = parseInt(month);
        const y = parseInt(year);

        // Get all active employees
        const empQuery = { status: 'Active' };
        if (req.user.role === 'HRMS_EMPLOYEE' && req.hrmsEmployee) {
            empQuery.managerId = req.hrmsEmployee._id;
        }
        const allEmployees = await HrmsEmployee.find(empQuery).populate('adminId', 'name email').lean();

        // Filter out employees who already have a salary record for this month
        const existingSalaries = await HrmsSalary.find({ month: m, year: y }, { employeeId: 1 }).lean();
        const existingEmpIds = new Set(existingSalaries.map(s => s.employeeId.toString()));

        const employees = allEmployees.filter(emp => !existingEmpIds.has(emp._id.toString()));

        if (employees.length === 0) {
            return sendError(res, 409, 'Payroll has already been generated for all active employees for this month');
        }

        // Get settings
        const settings = await HrmsSettings.findOne().lean();
        const minHours = settings?.workingHours?.minimumWorkingHours || 8;
        const shortHourRate = settings?.workingHours?.shortHourDeductionRate || 1;
        const overtimeRate = settings?.workingHours?.overtimeRate || 1.5;
        const paidLeavesPerMonth = settings?.leavePolicies?.paidLeavesPerMonth || 4;

        const startDate = new Date(y, m - 1, 1);
        const endDate = new Date(y, m, 0, 23, 59, 59);
        const daysInMonth = new Date(y, m, 0).getDate();

        // Calculate Sundays (weekly offs)
        let sundays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            if (new Date(y, m - 1, d).getDay() === 0) sundays++;
        }

        // Get holidays from settings
        const holidays = (settings?.holidayCalendar || []).filter(h => {
            const hDate = new Date(h.date);
            return hDate >= startDate && hDate <= endDate && !h.isOptional;
        });
        const holidayCount = holidays.length;

        const totalWorkingDays = daysInMonth - sundays - holidayCount;

        const salaryRecords = [];

        for (const emp of employees) {
            // 1. Get attendance for the month
            const attendance = await HrmsAttendance.find({
                employeeId: emp._id,
                date: { $gte: startDate, $lte: endDate }
            }).lean();

            const presentDays = attendance.filter(a => a.status === 'Present').length;
            const totalShortHours = attendance.reduce((sum, a) => sum + (a.shortHours || 0), 0);
            const totalOvertimeHours = attendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);

            // 2. Get approved leaves
            const leaves = await HrmsLeave.find({
                employeeId: emp._id,
                status: 'Approved',
                startDate: { $gte: startDate, $lte: endDate }
            }).lean();

            const paidLeaveDays = leaves.reduce((sum, l) => sum + (l.paidDays || 0), 0);
            const lopDays = leaves.reduce((sum, l) => sum + (l.lopDays || 0), 0);

            // 3. Calculate absent days
            const absentDays = Math.max(0, totalWorkingDays - presentDays - paidLeaveDays - lopDays);

            // 4. Get approved reimbursements
            const approvedExpenses = await HrmsExpense.find({
                employeeId: emp._id,
                status: 'Approved',
                visitDate: { $gte: startDate, $lte: endDate }
            }).lean();
            const totalReimbursement = approvedExpenses.reduce((sum, e) => sum + (e.approvedAmount || e.totalAmount || 0), 0);

            // 5. Calculate salary
            const monthlySalary = emp.monthlySalary || 0;
            const dailySalary = monthlySalary / totalWorkingDays;
            const hourlySalary = dailySalary / minHours;

            // Effective paid days = present + paid leaves
            const effectivePaidDays = presentDays + paidLeaveDays;

            // LOP deduction: (LOP days + absent days) * daily salary
            const lopDeduction = Number(((lopDays + absentDays) * dailySalary).toFixed(2));

            // Short hour deduction
            const shortHourDeduction = Number((totalShortHours * hourlySalary * shortHourRate).toFixed(2));

            // Overtime bonus
            const overtimeBonus = Number((totalOvertimeHours * hourlySalary * overtimeRate).toFixed(2));

            // Net salary
            const basePay = Number((effectivePaidDays * dailySalary).toFixed(2));
            const netSalary = Number(
                Math.max(0, basePay - shortHourDeduction + overtimeBonus + totalReimbursement).toFixed(2)
            );

            salaryRecords.push({
                employeeId: emp._id,
                month: m,
                year: y,
                baseSalary: monthlySalary,
                totalWorkingDays,
                presentDays,
                paidLeaveDays,
                lopDays,
                absentDays,
                totalShortHours,
                totalOvertimeHours,
                shortHourDeduction,
                overtimeBonus,
                reimbursements: totalReimbursement,
                lopDeduction,
                netSalary,
                status: 'Draft'
            });

            // Link expenses to salary
            if (approvedExpenses.length > 0) {
                // Will link after salary record is created
            }
        }

        const savedRecords = await HrmsSalary.insertMany(salaryRecords);

        // Automated PDF generation removed in favor of manual upload

        return sendResponse(res, 201, `Payroll generated for ${employees.length} employees`, {
            month: m,
            year: y,
            count: savedRecords.length,
            summary: savedRecords.map(s => ({
                employeeId: s.employeeId,
                netSalary: s.netSalary,
                status: s.status
            }))
        });
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Approve payroll (move from Draft to Approved)
 */
export const approvePayroll = async (req, res, next) => {
    try {
        const { month, year } = req.body;
        const filter = { month: parseInt(month), year: parseInt(year), status: 'Draft' };
        if (req.user.role === 'HRMS_EMPLOYEE' && req.hrmsEmployee) {
            const teamIds = await HrmsEmployee.find({ managerId: req.hrmsEmployee._id }).select('_id').lean();
            filter.employeeId = { $in: teamIds.map(t => t._id) };
        }

        const result = await HrmsSalary.updateMany(filter, { $set: { status: 'Approved' } });

        return sendResponse(res, 200, `${result.modifiedCount} salary records approved`, result);
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Mark payroll as paid
 */
export const markPayrollPaid = async (req, res, next) => {
    try {
        const { month, year } = req.body;
        const filter = { month: parseInt(month), year: parseInt(year), status: 'Approved' };
        if (req.user.role === 'HRMS_EMPLOYEE' && req.hrmsEmployee) {
            const teamIds = await HrmsEmployee.find({ managerId: req.hrmsEmployee._id }).select('_id').lean();
            filter.employeeId = { $in: teamIds.map(t => t._id) };
        }

        const result = await HrmsSalary.updateMany(filter, { $set: { status: 'Paid', paidAt: new Date() } });

        return sendResponse(res, 200, `${result.modifiedCount} salary records marked as paid`, result);
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Get payroll for a month
 */
export const getPayroll = async (req, res, next) => {
    try {
        const { month, year, page = 1, limit = 50 } = req.query;
        if (!month || !year) return sendError(res, 400, 'Month and year are required');

        const filter = { month: parseInt(month), year: parseInt(year) };
        if (req.user.role === 'HRMS_EMPLOYEE' && req.hrmsEmployee) {
            const teamIds = await HrmsEmployee.find({ managerId: req.hrmsEmployee._id }).select('_id').lean();
            filter.employeeId = { $in: teamIds.map(t => t._id) };
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [records, total] = await Promise.all([
            HrmsSalary.find(filter)
                .populate({ path: 'employeeId', populate: { path: 'adminId', select: 'name email phone' } })
                .sort({ netSalary: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            HrmsSalary.countDocuments(filter)
        ]);

        // Summary
        const summary = await HrmsSalary.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalNetSalary: { $sum: '$netSalary' },
                    totalReimbursements: { $sum: '$reimbursements' },
                    totalLopDeduction: { $sum: '$lopDeduction' },
                    count: { $sum: 1 }
                }
            }
        ]);

        return sendResponse(res, 200, 'Payroll retrieved', {
            records,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
            summary: summary[0] || { totalNetSalary: 0, totalReimbursements: 0, totalLopDeduction: 0, count: 0 }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * EMPLOYEE: Get own salary records
 */
export const getMySalary = async (req, res, next) => {
    try {
        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
        if (!employee) return sendError(res, 404, 'Employee not found');

        const { year } = req.query;
        const filter = { employeeId: employee._id };
        if (year) filter.year = parseInt(year);

        const records = await HrmsSalary.find(filter)
            .sort({ year: -1, month: -1 })
            .lean();

        return sendResponse(res, 200, 'Salary records retrieved', records);
    } catch (error) {
        next(error);
    }
};

/**
 * EMPLOYEE: Get single payslip detail
 */
export const getPayslipDetail = async (req, res, next) => {
    try {
        const { id } = req.params;
        const employee = await HrmsEmployee.findOne({ adminId: req.user.userId });
        if (!employee) return sendError(res, 404, 'Employee not found');

        const salary = await HrmsSalary.findOne({
            _id: id,
            employeeId: employee._id
        }).populate({
            path: 'employeeId',
            populate: { path: 'adminId', select: 'name email phone' }
        }).lean();

        if (!salary) return sendError(res, 404, 'Payslip not found');

        return sendResponse(res, 200, 'Payslip detail retrieved', salary);
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Upload a payslip image/document URL
 */
export const uploadPayslip = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { payslipUrl } = req.body;

        if (!payslipUrl) return sendError(res, 400, 'payslipUrl is required');

        const salary = await HrmsSalary.findByIdAndUpdate(
            id,
            { $set: { payslipUrl } },
            { new: true }
        );
        if (!salary) return sendError(res, 404, 'Salary record not found');

        return sendResponse(res, 200, 'Payslip uploaded successfully', salary);
    } catch (error) {
        next(error);
    }
};

/**
 * ADMIN: Generate a professional PDF payslip
 */
export const generatePayslipPdf = async (req, res, next) => {
    try {
        const { id } = req.params;

        const salary = await HrmsSalary.findById(id).populate({
            path: 'employeeId',
            populate: { path: 'adminId', select: 'name email phone' }
        });

        if (!salary) return sendError(res, 404, 'Salary record not found');
        
        const employee = salary.employeeId;

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        const grossEarnings = (salary.baseSalary || 0) + (salary.overtimeBonus || 0) + (salary.reimbursements || 0);
        const totalDeductions = (salary.shortHourDeduction || 0) + (salary.lopDeduction || 0);

        // Prepare data for Handlebars
        const data = {
            companyName: 'ItzoFood Enterprise',
            companyAddress: '123 Business Avenue, Tech Park, City, Country',
            monthName: monthNames[salary.month - 1],
            year: salary.year,
            employeeName: employee.adminId?.name || 'Employee',
            employeeId: employee._id.toString().slice(-6).toUpperCase(), // simple hash for presentation
            designation: employee.designation || 'Staff',
            department: employee.department || 'Operations',
            joiningDate: employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString() : 'N/A',
            
            totalWorkingDays: salary.totalWorkingDays,
            presentDays: salary.presentDays,
            lopDays: salary.lopDays,
            bankName: employee.bankDetails?.bankName || 'N/A',
            accountNumber: employee.bankDetails?.accountNumber || 'N/A',
            panNumber: employee.panNumber || 'N/A',

            baseSalary: (salary.baseSalary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            overtimeBonus: (salary.overtimeBonus || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            reimbursements: (salary.reimbursements || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            grossEarnings: grossEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 }),

            lopDeduction: (salary.lopDeduction || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            shortHourDeduction: (salary.shortHourDeduction || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            totalDeductions: totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 }),

            netSalary: (salary.netSalary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            
            // Custom helper parameter
            amountInWords: `Rupees ${salary.netSalary} Only`,

            generatedBy: req.user.name || 'Admin',
            generatedDate: new Date().toLocaleDateString(),
            payslipVersion: (salary.payslipVersion || 0) + 1
        };

        // 1. Generate PDF buffer
        const pdfBuffer = await generatePdfBuffer(data);

        // 2. Upload to Cloudinary
        const filename = `Payslip_${employee.adminId?.name?.replace(/\s+/g, '_')}_${data.monthName}_${data.year}_v${data.payslipVersion}`;
        const pdfUrl = await uploadPdfToCloudinary(pdfBuffer, filename);

        // 3. Update HrmsSalary record
        salary.payslipUrl = pdfUrl;
        salary.payslipVersion = data.payslipVersion;
        salary.payslipGeneratedAt = new Date();
        await salary.save();

        // 4. Upsert Document in HRMS Documents
        await HrmsDocument.findOneAndUpdate(
            { employeeId: employee._id, documentType: 'Payslip', month: salary.month, year: salary.year },
            {
                $set: {
                    name: `Payslip - ${data.monthName} ${data.year}`,
                    url: pdfUrl,
                    fileSize: pdfBuffer.length,
                    mimeType: 'application/pdf',
                    uploadedBy: req.user.userId,
                    isVerified: true,
                    remarks: 'Auto-generated by System'
                }
            },
            { upsert: true, new: true }
        );

        return sendResponse(res, 200, 'Payslip generated successfully', salary);
    } catch (error) {
        next(error);
    }
};
