import * as subscriptionService from '../services/subscriptionPlan.service.js';
import { validateCreatePlanDto, validateUpdatePlanDto } from '../validators/subscriptionPlan.validator.js';
import { sendResponse } from '../../../../utils/response.js';

export async function createPlanController(req, res, next) {
    try {
        const dto = validateCreatePlanDto(req.body);
        const plan = await subscriptionService.createPlan(dto);
        return sendResponse(res, 201, 'Subscription plan created successfully', plan);
    } catch (err) {
        next(err);
    }
}

export async function updatePlanController(req, res, next) {
    try {
        const { id } = req.params;
        const dto = validateUpdatePlanDto(req.body);
        const plan = await subscriptionService.updatePlan(id, dto);
        return sendResponse(res, 200, 'Subscription plan updated successfully', plan);
    } catch (err) {
        next(err);
    }
}

export async function listPlansController(req, res, next) {
    try {
        const plans = await subscriptionService.listPlans(req.query);
        return sendResponse(res, 200, 'Subscription plans fetched successfully', plans);
    } catch (err) {
        next(err);
    }
}

export async function deletePlanController(req, res, next) {
    try {
        const { id } = req.params;
        await subscriptionService.deletePlan(id);
        return sendResponse(res, 200, 'Subscription plan deleted successfully');
    } catch (err) {
        next(err);
    }
}

export async function getSubscriptionOverviewController(req, res, next) {
    try {
        const stats = await subscriptionService.getSubscriptionOverview();
        return sendResponse(res, 200, 'Subscription overview fetched successfully', stats);
    } catch (err) {
        next(err);
    }
}

export async function getSubscriptionHistoryController(req, res, next) {
    try {
        const result = await subscriptionService.getSubscriptionHistory(req.query, res);
        if (result) {
            return sendResponse(res, 200, 'Subscription history fetched successfully', result);
        }
    } catch (err) {
        next(err);
    }
}

export async function getSubscriptionAnalyticsController(req, res, next) {
    try {
        const analytics = await subscriptionService.getSubscriptionAnalytics();
        return sendResponse(res, 200, 'Subscription analytics fetched successfully', analytics);
    } catch (err) {
        next(err);
    }
}

