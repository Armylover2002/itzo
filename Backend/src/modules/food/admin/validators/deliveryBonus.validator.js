import { z } from 'zod';
import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';

const MAX_BONUS_AMOUNT = 100000;
const MAX_REFERENCE_LENGTH = 200;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;

const sanitizeReference = (value) => {
    if (value == null) return null;
    const cleaned = String(value)
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .trim()
        .slice(0, MAX_REFERENCE_LENGTH);
    return cleaned || null;
};

const sanitizeIdempotencyKey = (value) => {
    if (value == null || value === '') return null;
    const cleaned = String(value)
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .trim()
        .slice(0, MAX_IDEMPOTENCY_KEY_LENGTH);
    return cleaned || null;
};

const addBonusSchema = z.object({
    deliveryPartnerId: z.string().min(1, 'deliveryPartnerId is required'),
    amount: z
        .number({ invalid_type_error: 'Amount must be a number' })
        .int('Amount must be an integer')
        .min(1, 'Amount must be at least 1')
        .max(MAX_BONUS_AMOUNT, `Amount cannot exceed ${MAX_BONUS_AMOUNT}`),
    reference: z.string().max(MAX_REFERENCE_LENGTH).optional().or(z.literal('')),
    idempotencyKey: z
        .string({ required_error: 'idempotencyKey is required' })
        .min(8, 'idempotencyKey must be at least 8 characters')
        .max(MAX_IDEMPOTENCY_KEY_LENGTH)
});

export const validateAddDeliveryBonusDto = (body, headers = {}) => {
    const rawHeaders = headers || {};
    const headerKey =
        rawHeaders['idempotency-key'] ||
        rawHeaders['x-idempotency-key'] ||
        null;

    const normalized = {
        deliveryPartnerId: body?.deliveryPartnerId ? String(body.deliveryPartnerId).trim() : '',
        amount: Number(body?.amount),
        reference: body?.reference != null ? String(body.reference) : '',
        idempotencyKey:
            body?.idempotencyKey != null && String(body.idempotencyKey).trim() !== ''
                ? String(body.idempotencyKey)
                : headerKey != null
                    ? String(headerKey)
                    : ''
    };

    const result = addBonusSchema.safeParse(normalized);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    if (!mongoose.Types.ObjectId.isValid(result.data.deliveryPartnerId)) {
        throw new ValidationError('Invalid deliveryPartnerId');
    }

    const idempotencyKey = sanitizeIdempotencyKey(result.data.idempotencyKey);
    if (!idempotencyKey) {
        throw new ValidationError('idempotencyKey is required');
    }

    return {
        deliveryPartnerId: result.data.deliveryPartnerId,
        amount: result.data.amount,
        reference: sanitizeReference(result.data.reference),
        idempotencyKey
    };
};

export const validateBonusTransactionsQuery = (query = {}) => {
    const pageRaw = query.page != null ? Number(query.page) : 1;
    const limitRaw = query.limit != null ? Number(query.limit) : DEFAULT_LIST_LIMIT;

    if (!Number.isFinite(pageRaw) || pageRaw < 1 || !Number.isInteger(pageRaw)) {
        throw new ValidationError('page must be a positive integer');
    }
    if (!Number.isFinite(limitRaw) || limitRaw < 1 || !Number.isInteger(limitRaw)) {
        throw new ValidationError('limit must be a positive integer');
    }
    if (limitRaw > MAX_LIST_LIMIT) {
        throw new ValidationError(`limit cannot exceed ${MAX_LIST_LIMIT}`);
    }

    const search =
        query.search != null && String(query.search).trim()
            ? String(query.search).trim().slice(0, 100)
            : '';

    return {
        page: pageRaw,
        limit: limitRaw,
        search
    };
};

export { MAX_BONUS_AMOUNT, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT };
