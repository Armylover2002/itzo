import { FeedbackExperience } from '../models/feedbackExperience.model.js';
import { sendResponse, sendError } from '../../../../utils/response.js';

/**
 * Create a new feedback experience entry.
 * POST /api/v1/food/restaurant/feedback-experience
 */
export const createFeedbackExperience = async (req, res) => {
    try {
        const { rating, comment, module } = req.body;
        const userId = req.user?.userId; // Sahi field 'userId' hai, '_id' nahi

        if (!rating || !module) {
            return sendError(res, 400, 'Rating and module are required');
        }

        if (!userId) {
            return sendError(res, 401, 'User ID not found in token');
        }

        const feedbackData = {
            userId,
            rating,
            comment: comment || '',
            module
        };

        // Determine user model based on role
        if (req.user?.role === 'RESTAURANT') {
            feedbackData.userModel = 'FoodRestaurant';
            feedbackData.restaurantId = userId;
        } else if (req.user?.role === 'DELIVERY_PARTNER') {
            feedbackData.userModel = 'FoodDeliveryPartner';
        } else {
            feedbackData.userModel = 'FoodUser';
        }

        const feedback = await FeedbackExperience.create(feedbackData);

        return sendResponse(res, 201, 'Feedback submitted successfully', feedback);
    } catch (error) {
        console.error('Error creating feedback:', error);
        return sendError(res, 500, 'Failed to submit feedback: ' + error.message);
    }
};

/**
 * Get all feedback experiences (Admin only).
 * GET /api/v1/food/admin/feedback-experiences
 */
export const getFeedbackExperiences = async (req, res) => {
    try {
        const { module, page = 1, limit = 10, startDate, endDate, rating, experience } = req.query;
        const query = {};
        
        if (module) {
            query.module = module;
        }

        // Date filter
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        // Rating filter (frontend sends 0-10, backend stores 1-5)
        if (rating) {
            query.rating = Math.ceil(parseInt(rating) / 2) || 1;
        }

        // Experience filter (mapping experience labels to rating ranges)
        if (experience) {
            switch (experience) {
                case 'very_bad': query.rating = 1; break;
                case 'bad': query.rating = 1; break;
                case 'below_average': query.rating = 2; break;
                case 'average': query.rating = 3; break;
                case 'above_average': query.rating = 4; break;
                case 'good': query.rating = 4; break;
                case 'very_good': query.rating = 5; break;
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const feedbacks = await FeedbackExperience.find(query)
            .populate('userId', 'name phone email restaurantName ownerPhone ownerEmail')
            .populate('restaurantId', 'restaurantName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await FeedbackExperience.countDocuments(query);

        // Calculate statistics for the current query
        const allFeedbacksForStats = await FeedbackExperience.find(query).select('rating');
        const totalCount = allFeedbacksForStats.length;
        
        let avgRating = 0;
        let minRating = 0;
        let maxRating = 0;

        if (totalCount > 0) {
            const sum = allFeedbacksForStats.reduce((acc, curr) => acc + (curr.rating * 2), 0);
            avgRating = sum / totalCount;
            minRating = Math.min(...allFeedbacksForStats.map(f => f.rating * 2));
            maxRating = Math.max(...allFeedbacksForStats.map(f => f.rating * 2));
        }

        const statistics = {
            totalFeedback: totalCount,
            averageRating: avgRating,
            minRating,
            maxRating
        };

        // Normalize the feedback data to have consistent user fields
        const normalizedFeedbacks = feedbacks.map(fb => {
            const user = fb.userId || {};
            return {
                ...fb.toObject(),
                userName: user.name || user.restaurantName || 'N/A',
                userPhone: user.phone || user.ownerPhone || 'N/A',
                userEmail: user.email || user.ownerEmail || 'N/A'
            };
        });

        return sendResponse(res, 200, 'Feedbacks fetched successfully', {
            feedbacks: normalizedFeedbacks,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            },
            statistics
        });
    } catch (error) {
        console.error('Error fetching feedbacks:', error);
        return sendError(res, 500, 'Failed to fetch feedbacks');
    }
};

/**
 * Delete a feedback experience (Admin only).
 * DELETE /api/v1/food/admin/feedback-experiences/:id
 */
export const deleteFeedbackExperience = async (req, res) => {
    try {
        const { id } = req.params;
        const feedback = await FeedbackExperience.findByIdAndDelete(id);
        
        if (!feedback) {
            return sendError(res, 404, 'Feedback not found');
        }

        return sendResponse(res, 200, 'Feedback deleted successfully');
    } catch (error) {
        console.error('Error deleting feedback:', error);
        return sendError(res, 500, 'Failed to delete feedback');
    }
};
