import express from 'express';
import {
    getMyDocuments,
    getEmployeeDocuments,
    uploadDocument,
    deleteDocument,
    getAllDocuments
} from '../controllers/document.controller.js';
import { authMiddleware } from '../../../core/auth/auth.middleware.js';
import { requireHrmsEmployee, requireAdminOrManager } from '../middleware/hrmsAuth.middleware.js';

const router = express.Router();

// EMPLOYEE: View own documents
router.get('/me', authMiddleware, requireHrmsEmployee, getMyDocuments);

// ADMIN: Document management
router.get('/', authMiddleware, requireAdminOrManager, getAllDocuments);
router.get('/employee/:employeeId', authMiddleware, requireAdminOrManager, getEmployeeDocuments);
router.post('/', authMiddleware, requireAdminOrManager, uploadDocument);
router.delete('/:id', authMiddleware, requireAdminOrManager, deleteDocument);

export default router;
