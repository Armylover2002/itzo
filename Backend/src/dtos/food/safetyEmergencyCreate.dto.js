import { z } from 'zod';
import { ValidationError } from '../../core/auth/errors.js';

const schema = z.object({
    message: z.string().min(10, 'Message must be at least 10 characters').max(4000, 'Message too long')
});

export const validateSafetyEmergencyCreateDto = (body) => {
    const result = schema.safeParse({ message: String(body?.message || '').trim() });
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};

