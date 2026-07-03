import { AssessmentQuestion } from '../models/assessmentQuestion.model.js';
import { AssessmentSettings } from '../models/assessmentSettings.model.js';
import { AssessmentAttempt } from '../models/assessmentAttempt.model.js';
import { sendResponse, sendError } from '../../../utils/response.js';
import crypto from 'crypto';

// Helper to shuffle arrays (Fisher-Yates)
const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

// Start or Resume Assessment
export const startAssessment = async (req, res, next) => {
    try {
        const { applicantEmail, applicantPhone, applicantName, sessionToken } = req.body;

        if (!applicantEmail || !applicantPhone) {
            return sendError(res, 400, 'Email and Phone are required to start the assessment.');
        }

        const settings = await AssessmentSettings.findOne() || await AssessmentSettings.create({});
        if (!settings.isAssessmentEnabled) {
            return sendError(res, 403, 'Assessment is currently disabled by admin.');
        }

        // Check if an attempt already exists
        let query = {};
        if (sessionToken) {
            query = { sessionToken };
        } else {
            query = { applicantEmail, applicantPhone };
        }

        const existingAttempts = await AssessmentAttempt.find(query).sort({ createdAt: -1 });
        
        let activeAttempt = existingAttempts.find(a => a.status === 'In_Progress');
        let completedAttempt = existingAttempts.find(a => a.status === 'Completed' || a.status === 'Timeout');

        if (completedAttempt) {
            if (!settings.allowRetest || existingAttempts.length >= settings.maxAttempts) {
                // If retest not allowed or max attempts reached, return the result directly.
                return sendResponse(res, 200, 'Assessment already completed.', {
                    sessionToken: completedAttempt.sessionToken,
                    status: completedAttempt.status,
                    score: completedAttempt.score,
                    percentage: completedAttempt.percentage,
                    isPassed: completedAttempt.isPassed,
                    attemptId: completedAttempt._id
                });
            }
        }

        if (activeAttempt) {
            // Resume active attempt
            // Check if time expired
            const now = new Date();
            const elapsedMins = (now - new Date(activeAttempt.startTime)) / 60000;
            if (settings.enableTimer && elapsedMins > settings.durationMinutes + 1) { // 1 min buffer
                activeAttempt.status = 'Timeout';
                await activeAttempt.save();
                return sendError(res, 400, 'Assessment time expired. Please contact admin.');
            }

            // Return active attempt (sanitize answers)
            const sanitizedQuestions = activeAttempt.questions.map(q => ({
                questionId: q.questionId,
                questionText: q.snapshot.questionText,
                options: q.optionsOrder.map(idx => q.snapshot.options[idx]),
                selectedOptionIndex: q.selectedOptionIndex, // Keep track of what they already answered
                timeSpentSeconds: q.timeSpentSeconds
            }));

            return sendResponse(res, 200, 'Resumed active assessment', {
                sessionToken: activeAttempt.sessionToken,
                status: activeAttempt.status,
                startTime: activeAttempt.startTime,
                durationMinutes: settings.durationMinutes,
                questions: sanitizedQuestions
            });
        }

        // Generate New Assessment
        const newSessionToken = crypto.randomBytes(32).toString('hex');
        const selectedQuestions = [];

        // Distribute by category if configured, else random
        let remainingNeeded = settings.questionsPerTest;
        
        if (settings.categoryDistribution && settings.categoryDistribution.length > 0) {
            for (const catDist of settings.categoryDistribution) {
                if (catDist.count > 0 && remainingNeeded > 0) {
                    const countToFetch = Math.min(catDist.count, remainingNeeded);
                    const qList = await AssessmentQuestion.aggregate([
                        { $match: { category: catDist.category, isActive: true } },
                        { $sample: { size: countToFetch } }
                    ]);
                    selectedQuestions.push(...qList);
                    remainingNeeded -= qList.length;
                }
            }
        }

        // Fill remaining with random questions if we didn't hit the target
        if (remainingNeeded > 0) {
            const excludeIds = selectedQuestions.map(q => q._id);
            const extraQList = await AssessmentQuestion.aggregate([
                { $match: { _id: { $nin: excludeIds }, isActive: true } },
                { $sample: { size: remainingNeeded } }
            ]);
            selectedQuestions.push(...extraQList);
            remainingNeeded -= extraQList.length;
        }

        if (selectedQuestions.length === 0) {
            return sendError(res, 500, 'No questions available in the question bank.');
        }

        // Shuffle questions
        const finalQuestions = settings.shuffleQuestions ? shuffleArray(selectedQuestions) : selectedQuestions;

        // Build attempt payload
        const attemptQuestions = finalQuestions.map(q => {
            const optionsOrder = settings.shuffleOptions ? shuffleArray([0, 1, 2, 3]) : [0, 1, 2, 3];
            return {
                questionId: q._id,
                snapshot: {
                    questionText: q.questionText,
                    options: q.options,
                    correctOptionIndex: q.correctOptionIndex,
                    category: q.category,
                    difficulty: q.difficulty
                },
                optionsOrder,
                selectedOptionIndex: null,
                timeSpentSeconds: 0
            };
        });

        const newAttempt = await AssessmentAttempt.create({
            applicantEmail,
            applicantPhone,
            applicantName: applicantName || 'Unknown',
            sessionToken: newSessionToken,
            status: 'In_Progress',
            startTime: new Date(),
            questions: attemptQuestions
        });

        // Sanitize for frontend
        const sanitizedQuestions = attemptQuestions.map(q => ({
            questionId: q.questionId,
            questionText: q.snapshot.questionText,
            options: q.optionsOrder.map(idx => q.snapshot.options[idx]),
            selectedOptionIndex: null,
            timeSpentSeconds: 0
        }));

        return sendResponse(res, 201, 'Assessment started successfully', {
            sessionToken: newSessionToken,
            status: newAttempt.status,
            startTime: newAttempt.startTime,
            durationMinutes: settings.durationMinutes,
            questions: sanitizedQuestions
        });

    } catch (error) {
        next(error);
    }
};

// Sync Progress (Auto-save)
export const syncAssessment = async (req, res, next) => {
    try {
        const { sessionToken, answers } = req.body; // answers: [{ questionId, selectedOptionIndex, timeSpentSeconds }]
        
        if (!sessionToken) return sendError(res, 401, 'Session token missing');

        const attempt = await AssessmentAttempt.findOne({ sessionToken, status: 'In_Progress' });
        if (!attempt) return sendError(res, 404, 'Active assessment not found');

        // Update answers
        if (answers && Array.isArray(answers)) {
            answers.forEach(ans => {
                const qRef = attempt.questions.find(q => q.questionId.toString() === ans.questionId);
                if (qRef) {
                    qRef.selectedOptionIndex = ans.selectedOptionIndex;
                    if (ans.timeSpentSeconds) qRef.timeSpentSeconds = ans.timeSpentSeconds;
                }
            });
            await attempt.save();
        }

        return sendResponse(res, 200, 'Progress saved');
    } catch (error) {
        next(error);
    }
};

// Submit Assessment
export const submitAssessment = async (req, res, next) => {
    try {
        const { sessionToken, answers } = req.body;
        
        if (!sessionToken) return sendError(res, 401, 'Session token missing');

        const attempt = await AssessmentAttempt.findOne({ sessionToken, status: { $in: ['In_Progress', 'Timeout'] } });
        if (!attempt) return sendError(res, 404, 'Active assessment not found or already submitted');

        const settings = await AssessmentSettings.findOne() || { passingPercentage: 60 };

        // Apply any final answers before scoring
        if (answers && Array.isArray(answers)) {
            answers.forEach(ans => {
                const qRef = attempt.questions.find(q => q.questionId.toString() === ans.questionId);
                if (qRef) {
                    qRef.selectedOptionIndex = ans.selectedOptionIndex;
                }
            });
        }

        // Grade it
        let correctCount = 0;
        let wrongCount = 0;
        let skippedCount = 0;

        attempt.questions.forEach(q => {
            if (q.selectedOptionIndex === null || q.selectedOptionIndex === undefined) {
                skippedCount++;
            } else {
                // Map the frontend selected index back to the original DB index
                const originalSelectedIndex = q.optionsOrder[q.selectedOptionIndex];
                if (originalSelectedIndex === q.snapshot.correctOptionIndex) {
                    correctCount++;
                } else {
                    wrongCount++;
                }
            }
        });

        const totalQuestions = attempt.questions.length;
        const score = correctCount; // 1 mark per question
        const percentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
        const isPassed = percentage >= settings.passingPercentage;

        attempt.score = score;
        attempt.percentage = percentage;
        attempt.correctCount = correctCount;
        attempt.wrongCount = wrongCount;
        attempt.skippedCount = skippedCount;
        attempt.isPassed = isPassed;
        attempt.status = 'Completed';
        attempt.endTime = new Date();
        attempt.durationSeconds = Math.floor((attempt.endTime - attempt.startTime) / 1000);

        await attempt.save();

        return sendResponse(res, 200, 'Assessment submitted successfully', {
            score,
            percentage,
            correctCount,
            wrongCount,
            skippedCount,
            isPassed,
            attemptId: attempt._id
        });

    } catch (error) {
        next(error);
    }
};

// Admin Endpoints
export const getAllAttempts = async (req, res, next) => {
    try {
        const { search, status, isPassed, page = 1, limit = 50 } = req.query;
        
        const filter = {};
        if (status) filter.status = status;
        if (isPassed !== undefined) filter.isPassed = isPassed === 'true';
        if (search) {
            filter.$or = [
                { applicantName: { $regex: search, $options: 'i' } },
                { applicantEmail: { $regex: search, $options: 'i' } },
                { applicantPhone: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const attempts = await AssessmentAttempt.find(filter)
            .select('-questions.snapshot.options -questions.optionsOrder') // Exclude heavy payloads for list view
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        const total = await AssessmentAttempt.countDocuments(filter);

        return sendResponse(res, 200, 'Attempts retrieved', {
            attempts,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        next(error);
    }
};

export const getAttemptDetails = async (req, res, next) => {
    try {
        const { id } = req.params;
        const attempt = await AssessmentAttempt.findById(id);
        if (!attempt) return sendError(res, 404, 'Attempt not found');
        
        return sendResponse(res, 200, 'Attempt details retrieved', attempt);
    } catch (error) {
        next(error);
    }
};

export const resetAttempt = async (req, res, next) => {
    try {
        const { id } = req.params;
        const attempt = await AssessmentAttempt.findById(id);
        if (!attempt) return sendError(res, 404, 'Attempt not found');
        
        attempt.status = 'Reset';
        await attempt.save();
        
        return sendResponse(res, 200, 'Attempt reset. Applicant can retest.', attempt);
    } catch (error) {
        next(error);
    }
};
