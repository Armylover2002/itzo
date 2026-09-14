import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

function parseOrThrow(schema, body) {
    const result = schema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
}

const diningSlotSchema = z.object({
    day: z.enum(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']),
    isOpen: z.boolean().optional(),
    openingTime: z.string().optional(),
    closingTime: z.string().optional(),
    slotDurationMinutes: z.number().int().positive().optional(),
    capacityPerSlot: z.number().int().min(0).optional(),
});

const diningSetupSchema = z.object({
    description: z.string().optional(),
    ambienceImages: z.array(z.string()).optional(),
    avgCostForTwo: z.number().min(0).optional(),
    categoryIds: z.array(z.string()).optional(),
    slots: z.array(diningSlotSchema).optional(),
});
export function validateDiningSetupDto(body) {
    return parseOrThrow(diningSetupSchema, body);
}

const createReservationSchema = z.object({
    restaurantId: z.string().min(1),
    bookingDate: z.string().min(1),
    slotStart: z.string().min(1),
    guests: z.number().int().min(1),
    specialRequest: z.string().optional(),
});
export function validateCreateReservationDto(body) {
    return parseOrThrow(createReservationSchema, body);
}

const updateReservationStatusSchema = z.object({
    status: z.enum(['confirmed', 'seated', 'completed', 'cancelled', 'no_show']),
    note: z.string().optional(),
});
export function validateUpdateReservationStatusDto(body) {
    return parseOrThrow(updateReservationStatusSchema, body);
}

const billItemInputSchema = z.object({
    foodItemId: z.string().optional(),
    name: z.string().min(1),
    price: z.number().min(0),
    quantity: z.number().int().min(1),
});
const saveBillSchema = z.object({
    items: z.array(billItemInputSchema).min(1),
    discount: z.number().min(0).optional(),
});
export function validateSaveBillDto(body) {
    return parseOrThrow(saveBillSchema, body);
}

const categorySchema = z.object({
    name: z.string().min(1),
    image: z.string().min(1),
    isActive: z.boolean().optional(),
    sortOrder: z.number().optional(),
});
export function validateDiningCategoryDto(body) {
    return parseOrThrow(categorySchema.partial(), body);
}
export function validateDiningCategoryCreateDto(body) {
    return parseOrThrow(categorySchema, body);
}

const bannerSchema = z.object({
    title: z.string().optional(),
    image: z.string().min(1),
    link: z.string().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().optional(),
});
export function validateDiningBannerCreateDto(body) {
    return parseOrThrow(bannerSchema, body);
}
export function validateDiningBannerUpdateDto(body) {
    return parseOrThrow(bannerSchema.partial(), body);
}

const settingsSchema = z.object({
    defaultCommission: z.object({
        type: z.enum(['percentage', 'amount']),
        value: z.number().min(0),
    }).optional(),
    minAdvanceBookingMinutes: z.number().int().min(0).optional(),
    maxAdvanceBookingDays: z.number().int().min(1).optional(),
    cancellationWindowMinutes: z.number().int().min(0).optional(),
    taxPercent: z.number().min(0).optional(),
});
export function validateDiningSettingsDto(body) {
    return parseOrThrow(settingsSchema, body);
}

const reviewRequestSchema = z.object({
    decision: z.enum(['approved', 'rejected']),
    rejectionReason: z.string().optional(),
});
export function validateReviewDiningRequestDto(body) {
    return parseOrThrow(reviewRequestSchema, body);
}

const commissionOverrideSchema = z.object({
    override: z.boolean(),
    type: z.enum(['percentage', 'amount']).optional(),
    value: z.number().min(0).optional(),
});
export function validateCommissionOverrideDto(body) {
    return parseOrThrow(commissionOverrideSchema, body);
}
