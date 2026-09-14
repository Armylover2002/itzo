import { z } from 'zod';
import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';

const addonUpsertSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    requiredOrders: z.number().int().min(1, 'Required orders must be at least 1'),
    earningAmount: z.number().positive('Earning amount must be greater than 0'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    maxRedemptions: z.number().int().min(1).nullable().optional()
});

export const validateEarningAddonUpsertDto = (body) => {
    const normalized = {
        title: typeof body?.title === 'string' ? body.title.trim() : '',
        requiredOrders: Number(body?.requiredOrders),
        earningAmount: Number(body?.earningAmount),
        startDate: body?.startDate ? String(body.startDate) : '',
        endDate: body?.endDate ? String(body.endDate) : '',
        maxRedemptions:
            body?.maxRedemptions === null || body?.maxRedemptions === undefined || body?.maxRedemptions === ''
                ? null
                : Number(body.maxRedemptions)
    };

    const result = addonUpsertSchema.safeParse(normalized);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }

    const startDate = new Date(`${result.data.startDate}T00:00:00.000Z`);
    const endDate = new Date(`${result.data.endDate}T00:00:00.000Z`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        throw new ValidationError('Invalid startDate or endDate');
    }
    if (endDate <= startDate) {
        throw new ValidationError('End date must be after start date');
    }

    return {
        title: result.data.title,
        requiredOrders: result.data.requiredOrders,
        earningAmount: result.data.earningAmount,
        startDate,
        endDate,
        maxRedemptions: result.data.maxRedemptions ?? null
    };
};

export const validateToggleEarningAddonStatusDto = (body) => {
    const status = body?.status ? String(body.status) : '';
    if (!['active', 'inactive'].includes(status)) {
        throw new ValidationError('Invalid status');
    }
    return { status };
};

export const validateEarningAddonHistoryActionDto = (body) => {
    const notes = body?.notes != null ? String(body.notes) : '';
    const reason = body?.reason != null ? String(body.reason) : '';
    return { notes: notes.trim(), reason: reason.trim() };
};

export const validateCheckCompletionsDto = (body) => {
    const deliveryPartnerId = body?.deliveryPartnerId ? String(body.deliveryPartnerId) : '';
    const force = Boolean(body?.force);
    
    const isValidId = mongoose.Types.ObjectId.isValid(deliveryPartnerId);
    if (!deliveryPartnerId || (!isValidId && deliveryPartnerId !== 'all')) {
        throw new ValidationError('Invalid deliveryPartnerId');
    }
    return { deliveryPartnerId, force };
};

