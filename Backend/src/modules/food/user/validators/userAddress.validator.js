import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

const labelSchema = z.enum(['Home', 'Office', 'Other', 'Current Location']).default('Home');

const coordSchema = z
    .number()
    .finite()
    .refine((n) => Math.abs(n) <= 180, 'Invalid coordinate');

const createAddressSchema = z.object({
    label: labelSchema.optional(),
    type: z.enum(['saved', 'current']).optional(),
    address: z.string().max(1000).optional().or(z.literal('')).transform((s) => String(s || '').trim()),
    formattedAddress: z.string().max(1000).optional().or(z.literal('')).transform((s) => String(s || '').trim()),
    placeId: z.string().max(255).optional().or(z.literal('')).transform((s) => String(s || '').trim()),
    place_id: z.string().max(255).optional().or(z.literal('')).transform((s) => String(s || '').trim()),
    street: z.string().min(1, 'Street is required').max(200).transform((s) => s.trim()),
    additionalDetails: z.string().max(500).optional().or(z.literal('')).transform((s) => String(s || '').trim()),
    city: z.string().min(1, 'City is required').max(100).transform((s) => s.trim()),
    state: z.string().min(1, 'State is required').max(100).transform((s) => s.trim()),
    zipCode: z.string().max(20).optional().or(z.literal('')).transform((s) => String(s || '').trim()),
    pincode: z.string().max(20).optional().or(z.literal('')).transform((s) => String(s || '').trim()),
    phone: z.string().max(20).optional().or(z.literal('')).transform((s) => String(s || '').trim()),
    latitude: z.number().finite().min(-90).max(90),
    longitude: coordSchema
});

const updateAddressSchema = createAddressSchema.partial();

export const validateCreateAddressDto = (body) => {
    const result = createAddressSchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};

export const validateUpdateAddressDto = (body) => {
    const result = updateAddressSchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    if (!Object.keys(result.data || {}).length) {
        throw new ValidationError('No fields to update');
    }
    return result.data;
};

