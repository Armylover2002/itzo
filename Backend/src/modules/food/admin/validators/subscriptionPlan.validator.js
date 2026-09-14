import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

const subscriptionPlanSchema = z.object({
    userType: z.enum(['RESTAURANT', 'DELIVERY_PARTNER']),
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    durationValue: z.number().min(1, 'Duration value must be at least 1'),
    durationUnit: z.enum(['DAY', 'WEEK', 'MONTH', 'YEAR']),
    price: z.number().min(0, 'Price cannot be negative'),
    isActive: z.boolean().optional()
});

const updatePlanSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    price: z.number().min(0).optional(),
    isActive: z.boolean().optional()
});

export function validateCreatePlanDto(body) {
    const result = subscriptionPlanSchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
}

export function validateUpdatePlanDto(body) {
    const result = updatePlanSchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
}
