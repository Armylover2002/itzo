import { sendResponse, sendError } from '../../../../utils/response.js';
import {
    listPendingFoodApprovals,
    approveFoodItem,
    rejectFoodItem
} from '../services/foodApproval.service.js';
import { resolveActionPerformerSnapshot } from '../../../../core/utils/performer.js';

export async function getPendingFoodApprovals(req, res, next) {
    try {
        const data = await listPendingFoodApprovals(req.query || {});
        return sendResponse(res, 200, 'Pending food approvals fetched successfully', data);
    } catch (error) {
        next(error);
    }
}
import { invalidateCache } from '../../../../middleware/cache.js';

export async function approveFoodItemController(req, res, next) {
    try {
        const performer = await resolveActionPerformerSnapshot(req.user);
        const updated = await approveFoodItem(req.params.id, performer);
        if (!updated) return sendError(res, 404, 'Food item not found or not pending');
        
        await Promise.all([
            invalidateCache('restaurants*'),
            invalidateCache('food_search*'),
            invalidateCache(`restaurant_detail*`),
            // A category reaches the storefront only once it holds an approved item.
            invalidateCache('categories:*'),
        ]).catch(console.error);

        return sendResponse(res, 200, 'Food item approved successfully', { food: updated });
    } catch (error) {
        next(error);
    }
}

export async function rejectFoodItemController(req, res, next) {
    try {
        const performer = await resolveActionPerformerSnapshot(req.user);
        const updated = await rejectFoodItem(req.params.id, req.body?.reason, performer);
        if (!updated) return sendError(res, 404, 'Food item not found or not pending');

        await invalidateCache('categories:*').catch(console.error);

        return sendResponse(res, 200, 'Food item rejected successfully', { food: updated });
    } catch (error) {
        next(error);
    }
}

