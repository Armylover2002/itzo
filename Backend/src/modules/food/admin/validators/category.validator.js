import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

const booleanQuerySchema = z.preprocess((value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
    }
    return value;
}, z.boolean());

const listSchema = z.object({
    search: z.string().optional(),
    zoneId: z.string().optional(),
    isApproved: booleanQuerySchema.optional(),
    approvalStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(1000).optional()
});

const upsertSchema = z.object({
    name: z.string().min(1, 'Category name is required').max(200).optional(),
    image: z.string().min(1, 'Category image is required').max(2000).optional(),
    type: z.string().max(100).optional(),
    foodTypeScope: z.enum(['Veg', 'Non-Veg']).optional(),
    zoneId: z.string().max(100).optional(),
    status: z.boolean().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().min(1, 'Display order must be 1 or greater').optional()
});

const rejectSchema = z.object({
    reason: z.string().min(1, 'Rejection reason is required').max(500)
});

export const validateCategoryListQuery = (query) => {
    const result = listSchema.safeParse(query);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0]?.message || 'Invalid query');
    }
    return result.data;
};

export const validateCategoryUpsertDto = (body) => {
    const result = upsertSchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0]?.message || 'Invalid category data');
    }
    const d = result.data;
    // Normalize active flag: frontend uses `status`
    const isActive = d.isActive !== undefined ? d.isActive : (d.status !== undefined ? d.status : undefined);
    return { ...d, isActive };
};

export const validateCategoryRejectDto = (body) => {
    const result = rejectSchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0]?.message || 'Invalid category rejection data');
    }
    return result.data;
};

