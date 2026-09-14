import { z } from 'zod';
import { ValidationError } from '../../core/auth/errors.js';

const genderEnum = z.enum(['male', 'female', 'other', 'prefer-not-to-say']);

const isoDate = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (expected YYYY-MM-DD)');

// Loose per-item schema; canonical normalization/validation happens in the
// service layer (shared with the address CRUD path). We accept coordinate and
// pincode aliases here so existing clients keep working.
const addressItemSchema = z
    .object({
        _id: z.string().optional(),
        label: z.string().max(30).optional(),
        address: z.string().max(1000).optional(),
        formattedAddress: z.string().max(1000).optional(),
        placeId: z.string().max(255).optional(),
        place_id: z.string().max(255).optional(),
        street: z.string().max(200).optional(),
        additionalDetails: z.string().max(500).optional(),
        city: z.string().max(100).optional(),
        state: z.string().max(100).optional(),
        zipCode: z.string().max(20).optional(),
        pincode: z.string().max(20).optional(),
        phone: z.string().max(20).optional(),
        latitude: z.number().finite().min(-90).max(90).optional(),
        longitude: z.number().finite().min(-180).max(180).optional(),
        isDefault: z.boolean().optional(),
        location: z
            .object({
                type: z.string().optional(),
                coordinates: z.array(z.number()).optional(),
                lat: z.number().optional(),
                lng: z.number().optional()
            })
            .partial()
            .optional()
    })
    .passthrough();

const schema = z.object({
    name: z.string().max(200).optional(),
    email: z.string().email().max(200).optional(),
    phone: z.string().max(30).optional(),
    alternatePhone: z.string().max(30).optional().or(z.literal("")),
    profileImage: z.string().max(2000).optional(),
    dateOfBirth: isoDate.optional(),
    anniversary: isoDate.optional(),
    gender: genderEnum.optional(),
    addresses: z.array(addressItemSchema).max(50).optional()
});

export const validateUserProfileUpdateDto = (body) => {
    const result = schema.safeParse(body ?? {});
    if (!result.success) {
        const msg = result.error.errors[0]?.message || 'Invalid profile data';
        throw new ValidationError(msg);
    }
    return result.data;
};

