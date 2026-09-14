import { z } from 'zod';
import { ValidationError } from '../../core/auth/errors.js';

const schema = z.object({
    phone: z
        .string()
        .min(8, 'Phone must be at least 8 digits')
        .max(15, 'Phone must be at most 15 digits'),
    otp: z
        .string()
        .min(4, 'OTP must be 4-6 digits')
        .max(6, 'OTP must be 4-6 digits'),
    fcmToken: z.string().optional().nullable(),
    platform: z.enum(['web', 'mobile']).optional().default('web')
});

export const validateRestaurantOtpVerifyDto = (body) => {
    const result = schema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};
