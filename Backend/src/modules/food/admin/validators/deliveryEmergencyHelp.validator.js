import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

const phoneString = z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((v) => String(v || '').trim())
    .transform((v) => v.replace(/[^\d]/g, ''))
    .refine((v) => v === '' || /^\d{3,15}$/.test(v), {
        message: 'Phone number must be 3 to 15 digits'
    });

const upsertSchema = z.object({
    medicalEmergency: phoneString,
    accidentHelpline: phoneString,
    contactPolice: phoneString,
    insurance: phoneString
});

export const validateDeliveryEmergencyHelpUpsertDto = (body) => {
    const normalized = {
        medicalEmergency: body?.medicalEmergency,
        accidentHelpline: body?.accidentHelpline,
        contactPolice: body?.contactPolice,
        insurance: body?.insurance
    };
    const result = upsertSchema.safeParse(normalized);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};

