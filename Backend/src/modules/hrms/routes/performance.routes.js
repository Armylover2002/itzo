import express from 'express';
import { requireAdmin, authMiddleware } from '../../../core/auth/auth.middleware.js';
import { requireHrmsEmployee, requireHrmsManager } from '../middleware/hrmsAuth.middleware.js';
import { 
    createKpiCategory, updateKpiCategory, getKpiCategories, deleteKpiCategory,
    createKpi, updateKpi, getKpis, deleteKpi, testKpiFormula,
    getMyPerformance, getTeamPerformance, getEmployeePerformanceById,
    getCompanyPerformance, getDepartmentPerformance, getZonePerformance,
    getAnalyticsOverview, exportPerformanceReport
} from '../controllers/performance.controller.js';

const router = express.Router();

// Apply base auth middleware for all HRMS performance routes
router.use(authMiddleware);

// ---------------------------------------------------------
// EMPLOYEE ROUTES
// ---------------------------------------------------------
router.get('/my-performance', requireHrmsEmployee, getMyPerformance);

// ---------------------------------------------------------
// MANAGER & DRILL-DOWN ROUTES
// ---------------------------------------------------------
router.get('/team-performance', requireHrmsEmployee, requireHrmsManager, getTeamPerformance);
router.get('/employee-performance/:employeeId', requireHrmsEmployee, getEmployeePerformanceById);

// ---------------------------------------------------------
// ADMIN ROUTES (ECS PERFORMANCE MANAGEMENT)
// ---------------------------------------------------------
// KPI Categories CRUD
router.get('/categories', getKpiCategories); // Readable by all auth users for UI filtering
router.post('/categories', requireAdmin, createKpiCategory);
router.put('/categories/:id', requireAdmin, updateKpiCategory);
router.delete('/categories/:id', requireAdmin, deleteKpiCategory);

// KPIs CRUD & Formula Testing
router.post('/kpi', requireAdmin, createKpi);
router.put('/kpi/:id', requireAdmin, updateKpi);
router.get('/kpi', requireAdmin, getKpis);
router.delete('/kpi/:id', requireAdmin, deleteKpi);
router.post('/test-formula', requireAdmin, testKpiFormula);

// Hierarchical Performance Analytics
router.get('/company-performance', requireAdmin, getCompanyPerformance);
router.get('/department-performance', requireAdmin, getDepartmentPerformance);
router.get('/zone-performance', requireAdmin, getZonePerformance);
router.get('/analytics-overview', requireAdmin, getAnalyticsOverview);

// Export Engine
router.get('/export', requireAdmin, exportPerformanceReport);

export default router;
