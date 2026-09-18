import express from 'express';
import { authMiddleware } from '../../../core/auth/auth.middleware.js';
import { requireHrmsEmployee, requireHrmsManager } from '../middleware/hrmsAuth.middleware.js';
import { getMyTeam, getUnassignedEmployees, addTeamMember, removeTeamMember } from '../controllers/team.controller.js';

const router = express.Router();

// Apply auth middlewares
router.use(authMiddleware);
router.use(requireHrmsEmployee);
router.use(requireHrmsManager);

// Team Management Endpoints
router.get('/', getMyTeam);
router.get('/unassigned', getUnassignedEmployees);
router.post('/add', addTeamMember);
router.post('/remove', removeTeamMember);

export default router;
