import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

function parseOptionalNonNegNumber(value) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
        throw new ValidationError('Value must be a number greater than or equal to 0');
    }
    return n;
}

const upsertSchema = z
    .object({
        restaurantMinWithdrawalLimit: z.number().min(0).optional(),
        restaurantMaxWithdrawalLimit: z.number().min(0).nullable().optional()
    })
    .refine(
        (data) => {
            const min = data.restaurantMinWithdrawalLimit;
            const max = data.restaurantMaxWithdrawalLimit;
            if (min === undefined || max == null) return true;
            return max >= min;
        },
        { message: 'Maximum withdrawal limit must be greater than or equal to minimum withdrawal limit' }
    );

/**
 * Validates restaurant withdrawal limit admin upsert body.
 * Max of null/empty/0 means unlimited.
 */
export const validateRestaurantWithdrawalLimitUpsertDto = (body = {}) => {
    const normalized = {
        restaurantMinWithdrawalLimit:
            body?.restaurantMinWithdrawalLimit !== undefined
                ? parseOptionalNonNegNumber(body.restaurantMinWithdrawalLimit) ?? 1
                : undefined,
        restaurantMaxWithdrawalLimit:
            body?.restaurantMaxWithdrawalLimit !== undefined
                ? (() => {
                      const parsed = parseOptionalNonNegNumber(body.restaurantMaxWithdrawalLimit);
                      return parsed === null || parsed === 0 ? null : parsed;
                  })()
                : undefined
    };

    const result = upsertSchema.safeParse(normalized);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};
