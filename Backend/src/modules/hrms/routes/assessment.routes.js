import { Router } from 'express';
import { authMiddleware } from '../../../core/auth/auth.middleware.js';
import { requireAdminOrManager } from '../middleware/hrmsAuth.middleware.js';
import { 
    createQuestion, 
    getQuestions, 
    updateQuestion, 
    deleteQuestion, 
    getCategories, 
    toggleQuestionStatus 
} from '../controllers/assessmentQuestion.controller.js';
import { 
    getSettings, 
    updateSettings 
} from '../controllers/assessmentSettings.controller.js';
import { 
    startAssessment, 
    syncAssessment, 
    submitAssessment, 
    getAllAttempts, 
    getAttemptDetails, 
    resetAttempt 
} from '../controllers/assessment.controller.js';

const router = Router();

// ==========================================
// APPLICANT / PUBLIC ROUTES (Uses Session Token)
// ==========================================
router.post('/start', startAssessment);
router.post('/sync', syncAssessment);
router.post('/submit', submitAssessment);

// ==========================================
// ECS ADMIN ROUTES (Requires HR/Manager/Admin)
// ==========================================
router.use(authMiddleware, requireAdminOrManager); // All routes below this require Admin auth

// Settings
router.route('/settings')
    .get(getSettings)
    .patch(updateSettings);

// Questions
router.get('/questions/categories', getCategories);
router.route('/questions')
    .post(createQuestion)
    .get(getQuestions);
    
router.route('/questions/:id')
    .patch(updateQuestion)
    .delete(deleteQuestion);

router.patch('/questions/:id/toggle-status', toggleQuestionStatus);

// Attempts Analysis
router.get('/attempts', getAllAttempts);
router.get('/attempts/:id', getAttemptDetails);
router.post('/attempts/:id/reset', resetAttempt);

export default router;
