import { z } from 'zod';
import { ValidationError } from '../../core/auth/errors.js';

const schema = z.object({
    email: z.string().email('Invalid email').transform((v) => v.trim().toLowerCase())
});

export const validateAdminForgotPasswordRequestDto = (body) => {
    const result = schema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0]?.message || 'Invalid email');
    }
    return result.data;
};
