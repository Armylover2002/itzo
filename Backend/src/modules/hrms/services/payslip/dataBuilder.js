/**
 * Payslip Data Builder
 * ──────────────────────────────────────────────────────────────────────────────
 * Transforms raw salary + employee records into a clean, renderer-ready data
 * object. This layer is purely functional — zero side effects, zero I/O.
 *
 * Handles every edge case: missing names, missing bank details, missing PAN,
 * zero values, null fields, etc. The renderer never needs to worry about data.
 * ──────────────────────────────────────────────────────────────────────────────
 */

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Format a number as Indian Rupee string with 2 decimal places.
 * e.g. 125000 → "1,25,000.00"
 * @param {number} value
 * @returns {string}
 */
const formatINR = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Build renderer-ready payslip data from a salary document and request context.
 *
 * @param {Object} salary    - Mongoose HrmsSalary document (populated with employeeId → adminId)
 * @param {Object} reqUser   - req.user object (for generatedBy)
 * @returns {Object}         - Clean data object ready for the canvas renderer
 */
export const buildPayslipData = (salary, reqUser) => {
    if (!salary) throw new Error('Salary record is required to build payslip data');

    const employee = salary.employeeId || {};
    const admin = employee.adminId || {};

    // ── Computed totals ──────────────────────────────────────────────────────
    const baseSalary    = Number(salary.baseSalary) || 0;
    const overtimeBonus = Number(salary.overtimeBonus) || 0;
    const reimbursements = Number(salary.reimbursements) || 0;
    const grossEarnings = baseSalary + overtimeBonus + reimbursements;

    const lopDeduction       = Number(salary.lopDeduction) || 0;
    const shortHourDeduction = Number(salary.shortHourDeduction) || 0;
    const totalDeductions    = lopDeduction + shortHourDeduction;

    const netSalary = Number(salary.netSalary) || 0;

    const payslipVersion = (Number(salary.payslipVersion) || 0) + 1;

    return {
        // ── Company ──────────────────────────────────────────────────────────
        companyName:    'ItzoFood Enterprise',
        companyAddress: '123 Business Avenue, Tech Park, City, Country',

        // ── Period ───────────────────────────────────────────────────────────
        monthName: MONTH_NAMES[(salary.month || 1) - 1] || 'January',
        year:      salary.year || new Date().getFullYear(),

        // ── Employee details (all edge-case safe) ────────────────────────────
        employeeName: admin.name || 'Employee',
        employeeId:   employee.employeeId || '------',
        designation:  employee.designation || 'Staff',
        department:   employee.department  || 'Operations',
        joiningDate:  employee.joiningDate
            ? (() => { const d = new Date(employee.joiningDate); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; })()
            : 'N/A',

        // ── Attendance ───────────────────────────────────────────────────────
        totalWorkingDays: salary.totalWorkingDays ?? 0,
        presentDays:      salary.presentDays ?? 0,
        lopDays:          salary.lopDays ?? 0,

        // ── Bank info (safe defaults) ────────────────────────────────────────
        bankName:      employee.bankDetails?.bankName      || 'N/A',
        accountNumber: employee.bankDetails?.accountNumber || 'N/A',
        panNumber:     employee.documents?.panNumber  || 'N/A',

        // ── Earnings (formatted strings) ─────────────────────────────────────
        baseSalary:      formatINR(baseSalary),
        overtimeBonus:   formatINR(overtimeBonus),
        reimbursements:  formatINR(reimbursements),
        grossEarnings:   formatINR(grossEarnings),

        // ── Deductions (formatted strings) ───────────────────────────────────
        lopDeduction:       formatINR(lopDeduction),
        shortHourDeduction: formatINR(shortHourDeduction),
        totalDeductions:    formatINR(totalDeductions),

        // ── Net pay ──────────────────────────────────────────────────────────
        netSalary:     formatINR(netSalary),
        amountInWords: `Rupees ${Math.round(netSalary).toLocaleString('en-IN')} Only`,

        // ── Status ───────────────────────────────────────────────────────────
        status: salary.status || 'Draft',

        // ── Metadata ─────────────────────────────────────────────────────────
        generatedBy:   reqUser?.name || 'Admin',
        generatedDate: new Date().toLocaleDateString('en-IN'),
        payslipVersion
    };
};
