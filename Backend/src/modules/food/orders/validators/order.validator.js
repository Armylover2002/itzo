import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

const RECIPIENT_NAME_RE = /^[A-Za-z][A-Za-z\s.'-]{1,49}$/;
const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');

/** Food line items may omit sourceId when top-level restaurantId is present. */
function normalizeOrderItemsBody(body = {}) {
    const restaurantId = String(body.restaurantId || '').trim();
    if (!Array.isArray(body.items)) return body;

    const items = body.items.map((item) => {
        if (!item || typeof item !== 'object') return item;
        const rawSource = item.sourceId;
        const sourceId =
            rawSource != null && String(rawSource).trim() !== ''
                ? String(rawSource).trim()
                : '';
        if (sourceId) return { ...item, sourceId };

        const type = item.type === 'quick' ? 'quick' : 'food';
        if (type === 'food' && restaurantId) {
            return { ...item, sourceId: restaurantId };
        }
        return item;
    });

    return { ...body, items };
}

const orderItemSchema = z.object({
    itemId: z.string().min(1, 'Item id required'),
    name: z.string().min(1, 'Item name required'),
    type: z.enum(['food', 'quick']),
    sourceId: z.string().min(1, 'Source id required'),
    sourceName: z.string().optional(),
    variantId: z.string().optional(),
    variantName: z.string().optional(),
    variantPrice: z.number().min(0).optional(),
    price: z.number().min(0),
    quantity: z.number().int().min(1),
    isVeg: z.boolean().optional().default(true),
    image: z.string().optional(),
    notes: z.string().optional()
});

const addressSchema = z.object({
    label: z.enum(['Home', 'Office', 'Other', 'Current Location']).optional(),
    name: z.string().optional(),
    fullName: z.string().optional(),
    street: z.string().min(1, 'Street required'),
    additionalDetails: z.string().optional(),
    city: z.string().min(1, 'City required'),
    state: z.string().min(1, 'State required'),
    zipCode: z.string().optional(),
    phone: z.string().optional(),
    location: z
        .object({
            type: z.literal('Point').optional(),
            coordinates: z
                .tuple([
                    z.number().finite().min(-180).max(180),
                    z.number().finite().min(-90).max(90),
                ])
                .optional()
        })
        .optional(),
    _id: z.string().optional(),
    id: z.string().optional()
});

const pricingSchema = z.object({
    subtotal: z.number().min(0),
    tax: z.number().min(0).optional(),
    packagingFee: z.number().min(0).optional(),
    deliveryFee: z.number().min(0).optional(),
    totalDeliveryFee: z.number().min(0).optional(),
    userDeliveryFee: z.number().min(0).optional(),
    restaurantDeliveryFee: z.number().min(0).optional(),
    sponsoredDelivery: z.boolean().optional(),
    sponsoredKm: z.number().min(0).optional(),
    deliveryDistanceKm: z.number().min(0).nullable().optional(),
    deliverySponsorType: z.string().optional(),
    platformFee: z.number().min(0).optional(),
    discount: z.number().min(0).optional(),
    total: z.number().min(0),
    currency: z.string().optional(),
    couponCode: z.string().nullable().optional()
});

export function validateCalculateOrderDto(body) {
    const schema = z.object({
        orderType: z.enum(['food', 'quick', 'mixed']).optional(),
        items: z.array(orderItemSchema).min(1, 'At least one item required'),
        address: addressSchema.optional(),
        restaurantId: z.string().optional(),
        deliveryAddressId: z.string().optional(),
        zoneId: z.string().optional(),
        couponCode: z.string().optional(),
        deliveryFleet: z.string().optional(),
        /** Food Instant delivery mode. Do not confuse with orderType:"quick" (QC). */
        deliveryMode: z.enum(['basic', 'quick']).optional(),
        scheduledAt: z.string().optional()
    }).superRefine((data, ctx) => {
        const hasFoodItems = data.items.some((item) => item.type === 'food');
        const hasQuickItems = data.items.some((item) => item.type === 'quick');

        // Auto-correct orderType if it's missing or inconsistent
        let effectiveType = data.orderType;
        if (!effectiveType) {
            if (hasFoodItems && hasQuickItems) effectiveType = 'mixed';
            else if (hasQuickItems) effectiveType = 'quick';
            else effectiveType = 'food';
        }

        if (effectiveType === 'mixed' && (!hasFoodItems || !hasQuickItems)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['items'],
                message: 'Mixed orders must include both food and quick items'
            });
        }
        if (effectiveType === 'food' && hasQuickItems) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['items'],
                message: 'Food orders cannot include quick items. Use mixed order type.'
            });
        }
        if (effectiveType === 'quick' && hasFoodItems) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['items'],
                message: 'Quick orders cannot include food items. Use mixed order type.'
            });
        }
        if (effectiveType === 'food' && !data.restaurantId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['restaurantId'],
                message: 'Restaurant id required'
            });
        }
        if (data.deliveryMode === 'quick' && data.scheduledAt) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['deliveryMode'],
                message: 'Quick Delivery cannot be combined with Schedule Order'
            });
        }
        if (data.deliveryMode === 'quick' && effectiveType !== 'food') {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['deliveryMode'],
                message: 'Quick Delivery is only available for restaurant food orders'
            });
        }
    });
    const result = schema.safeParse(normalizeOrderItemsBody(body));
    if (!result.success) {
        const first = result.error.issues?.[0];
        const path = first?.path?.length ? first.path.join('.') : '';
        const msg = path ? `${path}: ${first?.message || 'Validation failed'}` : first?.message || 'Validation failed';
        throw new ValidationError(msg);
    }
    return result.data;
}

export function validateCreateOrderDto(body) {
    const schema = z.object({
        orderType: z.enum(['food', 'quick', 'mixed']).optional(),
        items: z.array(orderItemSchema).min(1, 'At least one item required'),
        address: addressSchema.optional(),
        restaurantId: z.string().optional(),
        restaurantName: z.string().optional(),
        customerName: z.string().optional(),
        customerPhone: z.string().optional(),
        pricing: pricingSchema,
        couponCode: z.string().nullable().optional(),
        deliveryAddressId: z.string().optional(),
        deliveryFleet: z.string().optional(),
        note: z.string().optional(),
        restaurantNote: z.string().optional(),
        sendCutlery: z.boolean().optional(),
        // 'razorpay_qr' means COD-style flow, but payment is collected via Razorpay QR at delivery.
        paymentMethod: z.enum(['cash', 'razorpay', 'razorpay_qr', 'card', 'wallet']),
        zoneId: z.string().nullable().optional(),
        deliveryMode: z.enum(['basic', 'quick']).optional(),
        scheduledAt: z.string().optional()
    }).superRefine((data, ctx) => {
        const hasFoodItems = data.items.some((item) => item.type === 'food');
        const hasQuickItems = data.items.some((item) => item.type === 'quick');

        // Auto-correct orderType if it's missing or inconsistent
        let effectiveType = data.orderType;
        if (!effectiveType) {
            if (hasFoodItems && hasQuickItems) effectiveType = 'mixed';
            else if (hasQuickItems) effectiveType = 'quick';
            else effectiveType = 'food';
        }

        if (effectiveType === 'mixed' && (!hasFoodItems || !hasQuickItems)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['items'],
                message: 'Mixed orders must include both food and quick items'
            });
        }
        if (effectiveType === 'food' && hasQuickItems) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['items'],
                message: 'Food orders cannot include quick items. Use mixed order type.'
            });
        }
        if (effectiveType === 'quick' && hasFoodItems) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['items'],
                message: 'Quick orders cannot include food items. Use mixed order type.'
            });
        }
        if (effectiveType === 'food' && !data.restaurantId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['restaurantId'],
                message: 'Restaurant id required'
            });
        }
        if ((effectiveType === 'food' || effectiveType === 'mixed' || effectiveType === 'quick') && !data.address) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['address'],
                message: 'Address is required'
            });
        }
        if (data.scheduledAt) {
            const parsed = new Date(data.scheduledAt);
            if (Number.isNaN(parsed.getTime())) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['scheduledAt'],
                    message: 'scheduledAt must be a valid ISO datetime'
                });
            }
        }
        if (data.deliveryMode === 'quick' && data.scheduledAt) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['deliveryMode'],
                message: 'Quick Delivery cannot be combined with Schedule Order'
            });
        }
        if (data.deliveryMode === 'quick' && effectiveType !== 'food') {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['deliveryMode'],
                message: 'Quick Delivery is only available for restaurant food orders'
            });
        }
        if (data.customerName !== undefined) {
            const name = String(data.customerName || '').trim();
            if (!name) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['customerName'],
                    message: 'Customer name is required',
                });
            } else if (!RECIPIENT_NAME_RE.test(name)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['customerName'],
                    message: 'Customer name can contain only letters and spaces',
                });
            }
        }
        if (data.customerPhone !== undefined) {
            const digits = normalizeDigits(data.customerPhone);
            if (digits.length !== 10) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['customerPhone'],
                    message: 'Customer phone must be exactly 10 digits',
                });
            }
        }
        if (data.note !== undefined && String(data.note || '').length > 240) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['note'],
                message: 'Delivery note cannot exceed 240 characters',
            });
        }
        if (data.restaurantNote !== undefined && String(data.restaurantNote || '').length > 240) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['restaurantNote'],
                message: 'Restaurant note cannot exceed 240 characters',
            });
        }
    });
    const result = schema.safeParse(normalizeOrderItemsBody(body));
    if (!result.success) {
        const msg = result.error.errors?.[0]?.message || 'Validation failed';
        throw new ValidationError(msg);
    }
    return result.data;
}

export function validateVerifyPaymentDto(body) {
    const schema = z.object({
        orderId: z.string().min(1, 'Order id required'),
        razorpayOrderId: z.string().min(1, 'Razorpay order id required'),
        razorpayPaymentId: z.string().min(1, 'Razorpay payment id required'),
        razorpaySignature: z.string().min(1, 'Razorpay signature required')
    });
    const result = schema.safeParse(body);
    if (!result.success) {
        const msg = result.error.errors?.[0]?.message || 'Validation failed';
        throw new ValidationError(msg);
    }
    return result.data;
}

export function validateCancelOrderDto(body) {
    const schema = z.object({
        reason: z.string().optional(),
        refundTo: z.enum(['wallet', 'gateway']).optional()
    });
    const result = schema.safeParse(body || {});
    if (!result.success) {
        throw new ValidationError(result.error.errors?.[0]?.message || 'Validation failed');
    }
    return result.data;
}

export function validateOrderStatusDto(body) {
    const schema = z.object({
        orderStatus: z.enum([
            'confirmed',
            'preparing',
            'ready_for_pickup',
            'picked_up',
            'delivered',
            'cancelled_by_restaurant'
        ]),
        reason: z.string().optional(),
        prepTimeMins: z.coerce.number().min(1).max(90).optional(),
        preparationTime: z.union([z.string(), z.number()]).optional(),
    });
    const result = schema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors?.[0]?.message || 'Validation failed');
    }
    return result.data;
}

/**
 * Admin order action DTO for the admin Orders page Accept/Reject buttons.
 * Admin accepts/rejects on behalf of restaurant, so we only allow:
 * - preparing (accept)
 * - cancelled_by_restaurant (reject)
 */
export function validateAdminOrderStatusDto(body) {
    const schema = z.object({
        orderStatus: z.enum([
            'confirmed',
            'cancelled_by_admin',
        ]),
        reason: z.string().optional(),
    });
    const result = schema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors?.[0]?.message || 'Validation failed');
    }
    return result.data;
}

export function validateAssignDeliveryDto(body) {
    const schema = z.object({
        deliveryPartnerId: z.string().min(1, 'Delivery partner id required')
    });
    const result = schema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors?.[0]?.message || 'Validation failed');
    }
    return result.data;
}

export function validateDispatchSettingsDto(body) {
    const schema = z.object({
        dispatchMode: z.enum(['auto', 'manual'])
    });
    const result = schema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors?.[0]?.message || 'Validation failed');
    }
    return result.data;
}

export function validateOrderRatingsDto(body) {
    const schema = z.object({
        restaurantRating: z.number().min(1).max(5),
        deliveryPartnerRating: z.number().min(1).max(5).optional(),
        restaurantComment: z.string().max(500).optional(),
        deliveryPartnerComment: z.string().max(500).optional()
    });
    const result = schema.safeParse(body || {});
    if (!result.success) {
        throw new ValidationError(result.error.errors?.[0]?.message || 'Validation failed');
    }
    return result.data;
}
