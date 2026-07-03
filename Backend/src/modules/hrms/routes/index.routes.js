import express from 'express';
import settingsRoutes from './settings.routes.js';
import employeeRoutes from './employee.routes.js';
import attendanceRoutes from './attendance.routes.js';
import leaveRoutes from './leave.routes.js';
import salaryRoutes from './salary.routes.js';
import expenseRoutes from './expense.routes.js';
import documentRoutes from './document.routes.js';
import joiningRequestRoutes from './joiningRequest.routes.js';
import supportRoutes from './support.routes.js';
import dailyReportRoutes from './dailyReport.routes.js';
import locationTrackRoutes from './locationTrack.routes.js';
import assessmentRoutes from './assessment.routes.js';

const router = express.Router();

router.use('/settings', settingsRoutes);
router.use('/employees', employeeRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leaves', leaveRoutes);
router.use('/salaries', salaryRoutes);
router.use('/expenses', expenseRoutes);
router.use('/documents', documentRoutes);
router.use('/joining-requests', joiningRequestRoutes);
router.use('/support', supportRoutes);
router.use('/daily-reports', dailyReportRoutes);
router.use('/location-tracks', locationTrackRoutes);
router.use('/assessments', assessmentRoutes);

export default router;
