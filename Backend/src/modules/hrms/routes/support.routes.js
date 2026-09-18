import express from 'express';
import { authMiddleware } from '../../../core/auth/auth.middleware.js';
import { requireHrmsEmployee, requireAdminOrManager } from '../middleware/hrmsAuth.middleware.js';
import {
    getSettings,
    createTicket,
    getEmployeeTickets,
    getTicketDetails,
    replyToTicket,
    getEmployeeUnreadCount,
    updateSettings,
    getAdminDashboardStats,
    getAdminTickets,
    changeTicketStatus,
    assignTicket,
    getAdminUnreadCount
} from '../controllers/support.controller.js';

const router = express.Router();

// ---------------------------------------------------------
// PUBLIC / SHARED
// ---------------------------------------------------------
// Employees and Admins can both read the settings (for Contact HR page)
router.get('/settings', authMiddleware, getSettings);

// ---------------------------------------------------------
// EMPLOYEE ROUTES (HRMS_EMPLOYEE role)
// ---------------------------------------------------------
// All these routes require the HRMS_EMPLOYEE role specifically
router.post('/tickets', authMiddleware, requireHrmsEmployee, createTicket);
router.get('/tickets', authMiddleware, requireHrmsEmployee, getEmployeeTickets);
router.get('/unread-count', authMiddleware, requireHrmsEmployee, getEmployeeUnreadCount);

// ---------------------------------------------------------
// ADMIN ROUTES (ADMIN or MANAGER roles)
// ---------------------------------------------------------
router.get('/admin/dashboard', authMiddleware, requireAdminOrManager, getAdminDashboardStats);
router.get('/admin/tickets', authMiddleware, requireAdminOrManager, getAdminTickets);
router.get('/admin/unread-count', authMiddleware, requireAdminOrManager, getAdminUnreadCount);
router.put('/admin/settings', authMiddleware, requireAdminOrManager, updateSettings);

// ---------------------------------------------------------
// SHARED TICKET ACTION ROUTES (Handled by Controller internally)
// ---------------------------------------------------------
// These routes operate on a specific ticket. The controller checks if the user is an employee or admin
// and applies the necessary logic.
router.get('/tickets/:id', authMiddleware, getTicketDetails);
router.post('/tickets/:id/reply', authMiddleware, replyToTicket);

// Admin specific actions on a ticket
router.put('/tickets/:id/status', authMiddleware, requireAdminOrManager, changeTicketStatus);
router.put('/tickets/:id/assign', authMiddleware, requireAdminOrManager, assignTicket);

export default router;
