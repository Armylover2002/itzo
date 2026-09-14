import { z } from 'zod';
import { ValidationError } from '../../core/auth/errors.js';

const schema = z.object({
    phone: z
        .string()
        .min(1, 'Phone or Email is required')
        .refine((val) => {
            const isEmail = val.includes('@');
            if (isEmail) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
            } else {
                return /^\d+$/.test(val) && val.length >= 8 && val.length <= 15;
            }
        }, {
            message: 'Must be a valid email address or 8-15 digit phone number'
        })
});

export const validateUserOtpRequestDto = (body) => {
    const result = schema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};

