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
        deliveryCashLimit: z.number().min(0).optional(),
        deliveryWithdrawalLimit: z.number().min(0).optional(),
        // null clears max (unlimited); omit = leave unchanged
        deliveryMaxWithdrawalLimit: z.number().min(0).nullable().optional()
    })
    .refine(
        (data) => {
            const min = data.deliveryWithdrawalLimit;
            const max = data.deliveryMaxWithdrawalLimit;
            if (min === undefined || max == null) return true;
            return max >= min;
        },
        { message: 'Maximum withdrawal limit must be greater than or equal to minimum withdrawal limit' }
    );

/**
 * Validates delivery cash / withdrawal limit admin upsert body.
 * Max of null/empty/0 means unlimited (backward compatible when unset).
 */
export const validateDeliveryCashLimitUpsertDto = (body = {}) => {
    const normalized = {
        deliveryCashLimit:
            body?.deliveryCashLimit !== undefined ? parseOptionalNonNegNumber(body.deliveryCashLimit) ?? 0 : undefined,
        deliveryWithdrawalLimit:
            body?.deliveryWithdrawalLimit !== undefined
                ? parseOptionalNonNegNumber(body.deliveryWithdrawalLimit) ?? 0
                : undefined,
        deliveryMaxWithdrawalLimit:
            body?.deliveryMaxWithdrawalLimit !== undefined
                ? (() => {
                      const parsed = parseOptionalNonNegNumber(body.deliveryMaxWithdrawalLimit);
                      // 0 / null → unlimited
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
