import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

const contactItemSchema = z.object({
    name: z
        .string()
        .min(1, 'Contact name is required')
        .max(150, 'Contact name is too long')
        .transform((s) => s.trim()),
    phone: z
        .string()
        .min(1, 'Contact phone is required')
        .max(50, 'Contact phone is too long')
        .transform((s) => s.trim())
});

const contactImportSchema = z.object({
    contacts: z
        .array(contactItemSchema)
        .min(1, 'At least one contact is required')
        .max(500, 'Batch size exceeds the maximum limit of 500 contacts'),
    isLastChunk: z
        .boolean({
            required_error: 'isLastChunk is required',
            invalid_type_error: 'isLastChunk must be a boolean'
        })
});

const permissionStatusSchema = z.object({
    status: z.enum(['DENIED', 'SKIPPED'], {
        errorMap: () => ({ message: 'Status must be either DENIED or SKIPPED' })
    })
});

export const validateUserContactImportDto = (body) => {
    const result = contactImportSchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};

export const validateUserContactPermissionStatusDto = (body) => {
    const result = permissionStatusSchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};
