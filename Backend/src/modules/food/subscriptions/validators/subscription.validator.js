import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

const purchaseSubscriptionSchema = z.object({
    planId: z.string().min(1, 'Plan ID is required')
});

const verifyPurchaseSchema = z.object({
    razorpayOrderId: z.string().optional(),
    razorpaySubscriptionId: z.string().optional(),
    razorpayPaymentId: z.string().min(1, 'Razorpay payment ID is required'),
    razorpaySignature: z.string().min(1, 'Razorpay signature is required')
});

export function validatePurchaseSubscriptionDto(body) {
    const result = purchaseSubscriptionSchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
}

export function validateVerifyPurchaseDto(body) {
    const result = verifyPurchaseSchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
}
