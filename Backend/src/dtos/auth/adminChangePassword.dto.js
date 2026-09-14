import { z } from 'zod';
import { ValidationError } from '../../core/auth/errors.js';

const schema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
    // Optional: caller's current refresh token so its session is preserved
    // while all other sessions are revoked after a password change.
    refreshToken: z.string().optional()
});

export const validateAdminChangePasswordDto = (body) => {
    const result = schema.safeParse(body);
    if (!result.success) {
        const msg = result.error.errors[0]?.message || 'Invalid password data';
        throw new ValidationError(msg);
    }
    return result.data;
};
