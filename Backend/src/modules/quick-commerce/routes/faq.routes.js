import express from 'express';
import {
  getFaqCategories,
  createFaqCategory,
  deleteFaqCategory,
  getAdminFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  getPublicFaqs
} from '../controllers/faq.controller.js';
import { authMiddleware, checkPermission } from '../../../core/auth/auth.middleware.js';
import { requireRoles } from '../../../core/roles/role.middleware.js';

const router = express.Router();
const adminOrEmployee = [requireRoles("ADMIN", "EMPLOYEE")];

// --- Admin Category Routes ---
router.get('/admin/faq-categories', authMiddleware, ...adminOrEmployee, checkPermission('quick::core_management::faqs', 'view'), getFaqCategories);
router.post('/admin/faq-categories', authMiddleware, ...adminOrEmployee, checkPermission('quick::core_management::faqs', 'create'), createFaqCategory);
router.delete('/admin/faq-categories/:id', authMiddleware, ...adminOrEmployee, checkPermission('quick::core_management::faqs', 'delete'), deleteFaqCategory);

// --- Admin FAQ Routes ---
router.get('/admin/faqs', authMiddleware, ...adminOrEmployee, checkPermission('quick::core_management::faqs', 'view'), getAdminFaqs);
router.post('/admin/faqs', authMiddleware, ...adminOrEmployee, checkPermission('quick::core_management::faqs', 'create'), createFaq);
router.put('/admin/faqs/:id', authMiddleware, ...adminOrEmployee, checkPermission('quick::core_management::faqs', 'edit'), updateFaq);
router.delete('/admin/faqs/:id', authMiddleware, ...adminOrEmployee, checkPermission('quick::core_management::faqs', 'delete'), deleteFaq);

// --- Public FAQ Routes ---
router.get('/public/faqs', getPublicFaqs);

export default router;
