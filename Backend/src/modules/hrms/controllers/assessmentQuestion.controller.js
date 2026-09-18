import { AssessmentQuestion } from '../models/assessmentQuestion.model.js';
import { sendResponse, sendError } from '../../../utils/response.js';

export const createQuestion = async (req, res, next) => {
    try {
        const { questionText, options, correctOptionIndex, category, difficulty, isActive } = req.body;
        
        if (!questionText || !options || options.length !== 4 || correctOptionIndex === undefined || !category) {
            return sendError(res, 400, 'Invalid question data. Please provide question, 4 options, correct index and category.');
        }

        const question = await AssessmentQuestion.create({
            questionText,
            options,
            correctOptionIndex,
            category,
            difficulty: difficulty || 'Medium',
            isActive: isActive !== undefined ? isActive : true,
            createdBy: req.user._id
        });

        return sendResponse(res, 201, 'Question added successfully', question);
    } catch (error) {
        next(error);
    }
};

export const getQuestions = async (req, res, next) => {
    try {
        const { category, difficulty, search, isActive, page = 1, limit = 50 } = req.query;
        
        const filter = {};
        if (category) filter.category = category;
        if (difficulty) filter.difficulty = difficulty;
        if (isActive !== undefined) filter.isActive = isActive === 'true';
        if (search) {
            filter.questionText = { $regex: search, $options: 'i' };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const questions = await AssessmentQuestion.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        const total = await AssessmentQuestion.countDocuments(filter);

        return sendResponse(res, 200, 'Questions retrieved successfully', {
            questions,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        next(error);
    }
};

export const updateQuestion = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (updates.options && updates.options.length !== 4) {
            return sendError(res, 400, 'Options must be exactly 4.');
        }

        const question = await AssessmentQuestion.findByIdAndUpdate(id, updates, { new: true });
        if (!question) return sendError(res, 404, 'Question not found');

        return sendResponse(res, 200, 'Question updated successfully', question);
    } catch (error) {
        next(error);
    }
};

export const deleteQuestion = async (req, res, next) => {
    try {
        const { id } = req.params;
        const question = await AssessmentQuestion.findByIdAndDelete(id);
        if (!question) return sendError(res, 404, 'Question not found');
        
        return sendResponse(res, 200, 'Question deleted successfully');
    } catch (error) {
        next(error);
    }
};

export const getCategories = async (req, res, next) => {
    try {
        const categories = await AssessmentQuestion.distinct('category');
        return sendResponse(res, 200, 'Categories retrieved', categories);
    } catch (error) {
        next(error);
    }
};

export const toggleQuestionStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const question = await AssessmentQuestion.findById(id);
        if (!question) return sendError(res, 404, 'Question not found');
        
        question.isActive = !question.isActive;
        await question.save();
        
        return sendResponse(res, 200, `Question ${question.isActive ? 'activated' : 'deactivated'}`, question);
    } catch (error) {
        next(error);
    }
};
