import express from 'express';
import { requireAdmin, authMiddleware } from '../../../core/auth/auth.middleware.js';
import { requireHrmsEmployee, requireHrmsManager } from '../middleware/hrmsAuth.middleware.js';
import { 
    createKpi, updateKpi, getKpis, deleteKpi, 
    getMyPerformance, getTeamPerformance, getCompanyPerformance 
} from '../controllers/performance.controller.js';

const router = express.Router();

// Apply auth middleware for all
router.use(authMiddleware);

// ---------------------------------------------------------
// EMPLOYEE ROUTES
// ---------------------------------------------------------
router.get('/my-performance', requireHrmsEmployee, getMyPerformance);

// ---------------------------------------------------------
// MANAGER ROUTES
// ---------------------------------------------------------
router.get('/team-performance', requireHrmsEmployee, requireHrmsManager, getTeamPerformance);

// ---------------------------------------------------------
// ADMIN ROUTES (ECS)
// ---------------------------------------------------------
// KPIs CRUD
router.post('/kpi', requireAdmin, createKpi);
router.put('/kpi/:id', requireAdmin, updateKpi);
router.get('/kpi', requireAdmin, getKpis);
router.delete('/kpi/:id', requireAdmin, deleteKpi);

// Company Performance
router.get('/company-performance', requireAdmin, getCompanyPerformance);

export default router;
