import { z } from 'zod';
import { ValidationError } from '../../core/auth/errors.js';

const schema = z.object({
    name: z.string().max(200).optional(),
    email: z.string().trim().toLowerCase().email('Invalid email').max(200).optional(),
    phone: z
        .string()
        .trim()
        .optional()
        .refine((val) => !val || /^\d{10}$/.test(val), {
            message: 'Phone number must be exactly 10 digits',
        }),
    profileImage: z.string().max(2000).optional()
});

export const validateAdminProfileUpdateDto = (body) => {
    const result = schema.safeParse(body);
    if (!result.success) {
        const msg = result.error.errors[0]?.message || 'Invalid profile data';
        throw new ValidationError(msg);
    }
    return result.data;
};
