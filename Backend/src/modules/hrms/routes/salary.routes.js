import express from 'express';
import {
    generatePayroll,
    approvePayroll,
    markPayrollPaid,
    getPayroll,
    getMySalary,
    getPayslipDetail,
    uploadPayslip,
    generatePayslipPdf,
    proxyPayslipDocument
} from '../controllers/salary.controller.js';
import { authMiddleware } from '../../../core/auth/auth.middleware.js';
import { requireHrmsEmployee, requireAdminOrManager } from '../middleware/hrmsAuth.middleware.js';

const router = express.Router();

// PUBLIC/PROXY: Foolproof document delivery (bypasses client DNS/adblocker blocks and CORS)
router.get('/proxy-document', proxyPayslipDocument);

// EMPLOYEE: View own salary
router.get('/me', authMiddleware, requireHrmsEmployee, getMySalary);
router.get('/payslip/:id', authMiddleware, requireHrmsEmployee, getPayslipDetail);

// ADMIN: Payroll management
router.post('/generate', authMiddleware, requireAdminOrManager, generatePayroll);
router.post('/approve', authMiddleware, requireAdminOrManager, approvePayroll);
router.post('/mark-paid', authMiddleware, requireAdminOrManager, markPayrollPaid);
router.post('/:id/upload-payslip', authMiddleware, requireAdminOrManager, uploadPayslip);
router.post('/:id/generate-payslip', authMiddleware, requireAdminOrManager, generatePayslipPdf);
router.get('/', authMiddleware, requireAdminOrManager, getPayroll);

export default router;
