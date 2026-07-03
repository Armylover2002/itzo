import express from 'express';
import { requireAuth } from '../../../core/auth/auth.middleware.js';
import { requireHrmsEmployee, requireHrmsManager } from '../middleware/hrmsAuth.middleware.js';
import { getMyTeam, getUnassignedEmployees, addTeamMember, removeTeamMember } from '../controllers/team.controller.js';

const router = express.Router();

// Apply auth middlewares
router.use(requireAuth);
router.use(requireHrmsEmployee);
router.use(requireHrmsManager);

// Team Management Endpoints
router.get('/my-team', getMyTeam);
router.get('/unassigned', getUnassignedEmployees);
router.post('/assign', addTeamMember);
router.delete('/remove/:employeeId', removeTeamMember);

export default router;
