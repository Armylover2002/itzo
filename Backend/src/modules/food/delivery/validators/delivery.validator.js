import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

const phoneSchema = z
    .string()
    .min(8, 'Phone must be at least 8 digits')
    .max(15, 'Phone must be at most 15 digits');

const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const aadharRegex = /^[0-9]{12}$/;
const drivingLicenseRegex = /^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$/;

const deliveryRegisterSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    phone: phoneSchema,
    email: z.string().email().optional().or(z.literal('')),
    countryCode: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    vehicleType: z.string().optional(),
    vehicleName: z.string().optional(),
    vehicleNumber: z.string().optional(),
    vehicles: z.string().optional(),
    drivingLicenseNumber: z
        .string({ required_error: 'Driving license number is required' })
        .trim()
        .min(1, 'Driving license number is required')
        .regex(drivingLicenseRegex, 'Invalid driving license format'),
    panNumber: z
        .string({ required_error: 'PAN number is required' })
        .trim()
        .min(1, 'PAN number is required')
        .regex(panRegex, 'Invalid PAN format'),
    aadharNumber: z
        .string({ required_error: 'Aadhar number is required' })
        .trim()
        .min(1, 'Aadhar number is required')
        .regex(aadharRegex, 'Invalid Aadhar format'),
    fcmToken: z.string().optional().nullable(),
    platform: z.enum(['web', 'mobile']).optional().default('web'),
    razorpayOrderId: z.string().optional(),
    razorpayPaymentId: z.string().optional(),
    razorpaySignature: z.string().optional(),
    submissionType: z
        .enum(['initial', 'edit_existing', 'new_onboarding'])
        .optional()
}).superRefine((data, ctx) => {
    // Vehicle details are optional; only validate the format when provided.
    if (data.vehicleNumber && data.vehicleNumber.trim()) {
        const vehicleNumberRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/;
        if (!vehicleNumberRegex.test(data.vehicleNumber.trim())) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Invalid Indian vehicle number format (e.g., MH12AB1234)',
                path: ['vehicleNumber']
            });
        }
    }
});

export const validateDeliveryRegisterDto = (body) => {
    const result = deliveryRegisterSchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};

const deliveryProfileUpdateSchema = z.object({
    name: z.string().min(1).optional(),
    countryCode: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    vehicleType: z.string().optional(),
    vehicleName: z.string().optional(),
    vehicleNumber: z.string().optional(),
    vehicles: z.string().optional(),
    drivingLicenseNumber: z.string().optional().or(z.literal('')),
    fcmToken: z.string().optional().nullable(),
    platform: z.enum(['web', 'mobile']).optional().default('web')
}).superRefine((data, ctx) => {
    const vType = data.vehicleType;
    const dl = data.drivingLicenseNumber;
    const vn = data.vehicleNumber;

    if (vType !== undefined) {
        const isBicycle = vType === 'bicycle';
        const isElectricBike = vType === 'electric_bike';

        if (!isBicycle && !isElectricBike) {
            if (dl && dl.trim()) {
                if (!drivingLicenseRegex.test(dl)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Invalid driving license format',
                        path: ['drivingLicenseNumber']
                    });
                }
            }
            if (vn && vn.trim()) {
                const vehicleNumberRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/;
                if (!vehicleNumberRegex.test(vn.trim())) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Invalid Indian vehicle number format (e.g., MH12AB1234)',
                        path: ['vehicleNumber']
                    });
                }
            }
        } else {
            if (dl && dl.trim()) {
                if (!drivingLicenseRegex.test(dl)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Invalid driving license format',
                        path: ['drivingLicenseNumber']
                    });
                }
            }
        }
    } else {
        if (dl && dl.trim() && !drivingLicenseRegex.test(dl)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Invalid driving license format',
                path: ['drivingLicenseNumber']
            });
        }
        if (vn && vn.trim()) {
            const vehicleNumberRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/;
            if (!vehicleNumberRegex.test(vn.trim())) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Invalid Indian vehicle number format (e.g., MH12AB1234)',
                    path: ['vehicleNumber']
                });
            }
        }
    }
});

export const validateDeliveryProfileUpdateDto = (body) => {
    const result = deliveryProfileUpdateSchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};

const bankDetailsSchema = z.object({
    accountHolderName: z.string().min(1, 'Account holder name is required').optional().or(z.literal('')),
    accountNumber: z.string().min(1, 'Account number is required').optional().or(z.literal('')),
    ifscCode: z.string().min(1, 'IFSC code is required').optional().or(z.literal('')),
    bankName: z.string().min(1, 'Bank name is required').optional().or(z.literal('')),
    upiId: z.string().optional().or(z.literal('')),
    upiQrCode: z.string().optional().or(z.literal(''))
});

const bankDetailsUpdateSchema = z.object({
    documents: z.object({
        bankDetails: bankDetailsSchema.optional(),
        pan: z.object({ number: z.string().optional() }).optional()
    }).optional()
}).optional();

export const validateDeliveryBankDetailsDto = (body) => {
    // If we have flat keys from FormData (multer), reconstruct the nested object for Zod
    const processed = { ...body };
    if (!processed.documents) processed.documents = {};
    if (!processed.documents.bankDetails) {
        processed.documents.bankDetails = {
            accountHolderName: body['documents[bankDetails][accountHolderName]'],
            accountNumber: body['documents[bankDetails][accountNumber]'],
            ifscCode: body['documents[bankDetails][ifscCode]'],
            bankName: body['documents[bankDetails][bankName]'],
            upiId: body['documents[bankDetails][upiId]']
        };
    }
    if (!processed.documents.pan && body['documents[pan][number]']) {
        processed.documents.pan = { number: body['documents[pan][number]'] };
    }

    const result = bankDetailsUpdateSchema.safeParse(processed);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};

