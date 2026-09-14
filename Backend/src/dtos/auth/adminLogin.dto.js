import { z } from 'zod';
import { ValidationError } from '../../core/auth/errors.js';

const schema = z.object({
    email: z.string()
        .trim()
        .min(1, 'Email or Employee ID is required')
        .refine(val => {
            const isEmp = /^EMPL\d+$/i.test(val);
            if (isEmp) return val.length <= 20;
            return val.length <= 100;
        }, {
            message: 'Email or Employee ID exceeds maximum allowed length'
        }),
    password: z.string()
        .min(1, 'Password is required')
        .min(6, 'Password must be at least 6 characters')
        .max(50, 'Password must not exceed 50 characters'),
    roleId: z.string().optional()
});

export const validateAdminLoginDto = (body) => {
    const result = schema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};

