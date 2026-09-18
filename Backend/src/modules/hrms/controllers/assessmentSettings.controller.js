import { AssessmentSettings } from '../models/assessmentSettings.model.js';
import { sendResponse, sendError } from '../../../utils/response.js';

export const getSettings = async (req, res, next) => {
    try {
        let settings = await AssessmentSettings.findOne();
        if (!settings) {
            // Create default settings if none exist
            settings = await AssessmentSettings.create({});
        }
        return sendResponse(res, 200, 'Assessment settings retrieved', settings);
    } catch (error) {
        next(error);
    }
};

export const updateSettings = async (req, res, next) => {
    try {
        let settings = await AssessmentSettings.findOne();
        
        if (!settings) {
            settings = await AssessmentSettings.create(req.body);
        } else {
            // Update the existing singleton document
            settings = await AssessmentSettings.findByIdAndUpdate(settings._id, req.body, { new: true, runValidators: true });
        }
        
        return sendResponse(res, 200, 'Assessment settings updated successfully', settings);
    } catch (error) {
        next(error);
    }
};
