import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

const phoneSchema = z
    .string()
    .min(8, 'Phone must be at least 8 digits')
    .max(15, 'Phone must be at most 15 digits');

const emailSchema = z.string().email('Invalid email').optional().or(z.literal(''));
const requiredBooleanSchema = z.preprocess((value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
        if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
    }
    return value;
}, z.boolean({ required_error: 'Please select whether the restaurant is pure veg' }));

const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const normalizeTimeValue = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const hhmm = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) {
        const h = Number(hhmm[1]);
        const m = Number(hhmm[2]);
        if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return '';
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
    if (ampm) {
        let h = Number(ampm[1]);
        const m = Number(ampm[2]);
        const p = ampm[3].toUpperCase();
        if (!Number.isFinite(h) || !Number.isFinite(m) || h < 1 || h > 12 || m < 0 || m > 59) return '';
        if (p === 'AM') h = h === 12 ? 0 : h;
        if (p === 'PM') h = h === 12 ? 12 : h + 12;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    return '';
};

const timeToMinutes = (value) => {
    const normalized = normalizeTimeValue(value);
    if (!normalized) return null;
    const [h, m] = normalized.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
};

const restaurantRegisterSchema = z.object({
    restaurantName: z.string().optional().or(z.literal('')),
    ownerName: z.string().optional().or(z.literal('')),
    ownerEmail: emailSchema,
    ownerPhone: phoneSchema.optional(),
    primaryContactNumber: phoneSchema.optional(),
    pureVegRestaurant: requiredBooleanSchema,
    businessType: z.enum(['Fixed Restaurant', 'Street Food Vendor']).optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    area: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
    landmark: z.string().optional(),
    formattedAddress: z.string().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    zoneId: z.string().optional(),
    cuisines: z
        .string()
        .optional()
        .transform((val) => (val ? val.split(',').map((c) => c.trim()).filter(Boolean) : [])),
    openingTime: z.string().optional(),
    closingTime: z.string().optional(),
    estimatedDeliveryTime: z.string().optional(),
    openDays: z
        .string()
        .optional()
        .transform((val) => (val ? val.split(',').map((d) => d.trim()).filter(Boolean) : [])),
    panNumber: z
        .string()
        .regex(panRegex, 'Invalid PAN format')
        .optional()
        .or(z.literal('')),
    nameOnPan: z.string().optional(),
    gstRegistered: z
        .string()
        .optional()
        .transform((val) => val === 'true' || val === '1'),
    gstNumber: z.string().optional(),
    gstLegalName: z.string().optional(),
    gstAddress: z.string().optional(),
    fssaiNumber: z.string().optional(),
    fssaiExpiry: z.string().optional(),
    accountNumber: z.string().optional(),
    ifscCode: z.string().optional(),
    accountHolderName: z.string().optional(),
    accountType: z.string().optional(),
        estimatedDeliveryTime: z.string().optional(),
    razorpayOrderId: z.string().optional(),
    razorpayPaymentId: z.string().optional(),
    razorpaySignature: z.string().optional(),
    finalizeOnboarding: z.string().optional()
});

export const validateRestaurantRegisterDto = (body) => {
    const result = restaurantRegisterSchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }

    const data = result.data;
    const openingMinutes = timeToMinutes(data.openingTime);
    const closingMinutes = timeToMinutes(data.closingTime);
    if (openingMinutes !== null && closingMinutes !== null) {
        if (openingMinutes === closingMinutes) {
            throw new ValidationError('Opening time and closing time cannot be same');
        }
        if (closingMinutes < openingMinutes) {
            throw new ValidationError('Closing time cannot be less than opening time');
        }
    }
    const isFinalizeOnboarding =
        data.finalizeOnboarding === true ||
        data.finalizeOnboarding === 'true' ||
        data.finalizeOnboarding === '1';
    if (!isFinalizeOnboarding) {
        if (!String(data.restaurantName || '').trim()) {
            throw new ValidationError('Restaurant name is required');
        }
        if (!String(data.ownerName || '').trim()) {
            throw new ValidationError('Owner name is required');
        }
    }
    return {
        ...data,
        gstRegistered: data.gstRegistered ?? false,
        finalizeOnboarding: data.finalizeOnboarding ?? false
    };
};

const onboardingStep1Schema = z.object({
    restaurantName: z.string().min(1, 'Restaurant name is required'),
    ownerName: z.string().min(1, 'Owner name is required'),
    ownerEmail: emailSchema,
    ownerPhone: phoneSchema,
    primaryContactNumber: phoneSchema.optional(),
    pureVegRestaurant: requiredBooleanSchema,
    businessType: z.enum(['Fixed Restaurant', 'Street Food Vendor']).optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    area: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
    landmark: z.string().optional(),
    formattedAddress: z.string().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    zoneId: z.string().min(1, 'Zone is required'),
});

const onboardingStep2Schema = z.object({
    ownerPhone: phoneSchema,
    cuisines: z
        .string()
        .optional()
        .transform((val) => (val ? val.split(',').map((c) => c.trim()).filter(Boolean) : [])),
    openingTime: z.string().min(1, 'Opening time is required'),
    closingTime: z.string().min(1, 'Closing time is required'),
    openDays: z
        .string()
        .optional()
        .transform((val) => (val ? val.split(',').map((d) => d.trim()).filter(Boolean) : [])),
});

const onboardingStep3Schema = z.object({
    ownerPhone: phoneSchema,
    panNumber: z
        .string()
        .regex(panRegex, 'Invalid PAN format')
        .optional()
        .or(z.literal('')),
    nameOnPan: z.string().optional(),
    gstRegistered: z
        .string()
        .optional()
        .transform((val) => val === 'true' || val === '1'),
    gstNumber: z.string().optional(),
    gstLegalName: z.string().optional(),
    gstAddress: z.string().optional(),
    fssaiNumber: z.string().optional(),
    fssaiExpiry: z.string().optional(),
    accountNumber: z.string().optional(),
    ifscCode: z.string().optional(),
    accountHolderName: z.string().optional(),
    accountType: z.string().optional(),
});

export const validateOnboardingStepDto = (stepNum, body) => {
    const step = Number(stepNum);
    const schema = step === 1 ? onboardingStep1Schema : step === 2 ? onboardingStep2Schema : step === 3 ? onboardingStep3Schema : null;
    if (!schema) {
        throw new ValidationError('Invalid onboarding step');
    }
    const result = schema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    const data = result.data;
    if (step === 2) {
        const openingMinutes = timeToMinutes(data.openingTime);
        const closingMinutes = timeToMinutes(data.closingTime);
        if (openingMinutes !== null && closingMinutes !== null) {
            if (openingMinutes === closingMinutes) {
                throw new ValidationError('Opening time and closing time cannot be same');
            }
            if (closingMinutes < openingMinutes) {
                throw new ValidationError('Closing time cannot be less than opening time');
            }
        }
    }
    return {
        ...data,
        gstRegistered: data.gstRegistered ?? false
    };
};

