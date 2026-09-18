import express from 'express';
import {
    submitExpense,
    getMyExpenses,
    getAllExpenses,
    approveExpense,
    submitMonthlyExpense,
    getMyMonthlyExpenses,
    getMonthlyExpenseDetail,
    getAllMonthlyExpenses,
    approveMonthlyExpense
} from '../controllers/expense.controller.js';
import { authMiddleware } from '../../../core/auth/auth.middleware.js';
import { requireHrmsEmployee, requireAdminOrManager } from '../middleware/hrmsAuth.middleware.js';

const router = express.Router();

// EMPLOYEE: Submit and view expenses (legacy individual)
router.post('/', authMiddleware, requireHrmsEmployee, submitExpense);
router.get('/me', authMiddleware, requireHrmsEmployee, getMyExpenses);

// ADMIN/MANAGER: Manage expenses (legacy individual)
router.get('/', authMiddleware, requireAdminOrManager, getAllExpenses);
router.post('/:id/action', authMiddleware, requireAdminOrManager, approveExpense);

// ── MONTHLY BATCH EXPENSES ──

// EMPLOYEE: Submit and view monthly expense batches
router.post('/monthly', authMiddleware, requireHrmsEmployee, submitMonthlyExpense);
router.get('/monthly/me', authMiddleware, requireHrmsEmployee, getMyMonthlyExpenses);
router.get('/monthly/:id', authMiddleware, requireHrmsEmployee, getMonthlyExpenseDetail);

// ADMIN/MANAGER: Manage monthly expense batches
router.get('/monthly', authMiddleware, requireAdminOrManager, getAllMonthlyExpenses);
router.post('/monthly/:id/action', authMiddleware, requireAdminOrManager, approveMonthlyExpense);

export default router;
