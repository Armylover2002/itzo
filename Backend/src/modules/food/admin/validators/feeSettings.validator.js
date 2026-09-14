import { normalizeQuickDeliverySettings } from '../../orders/utils/quickDeliveryConstants.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { z } from 'zod';

// Engineering / dispatch / SLA / reserved MOV remain optional on the wire for API BC.
// Admin UI sends business fields only; upsertFeeSettings preserves internals.
// maxDistanceKm (customer eligibility) ≠ maxRadiusKm (rider search).
// maxEtaMinutes is eligibility/quote only — not a dispatch input.
// minOrderValue is ADR inventory; UI-hidden; default 0.

const rangeSchema = z.object({
    min: z.number().min(0),
    max: z.number().min(0),
    fee: z.number().min(0),
    deliveryBoyPerKm: z.number().min(0).optional().default(0),
    deliveryBoyBasePay: z.number().min(0).optional().default(0)
});

const sponsorRuleSchema = z.object({
    minOrderAmount: z.number().min(0),
    maxOrderAmount: z.number().min(0).nullable().optional(),
    maxDistanceKm: z.number().min(0),
    sponsorType: z.enum(['USER_FULL', 'RESTAURANT_FULL', 'SPLIT']),
    sponsoredKm: z.number().min(0).nullable().optional()
});

const deliveryDistanceSlabSchema = z.object({
    fromKm: z.number().min(0),
    toKm: z.number().min(0),
    deliveryFee: z.number().min(0)
});

const quickDeliverySchema = z.object({
    enabled: z.boolean().optional(),
    charge: z.number().min(0).optional(),
    platformSharePct: z.number().min(0).max(100).optional(),
    riderSharePct: z.number().min(0).max(100).optional(),
    restaurantSharePct: z.number().min(0).max(100).optional(),
    maxDistanceKm: z.number().min(0).optional(),
    maxRadiusKm: z.number().min(0).optional(),
    maxEtaMinutes: z.number().min(0).optional(),
    defaultKitchenPrepMinutes: z.number().min(1).max(90).optional(),
    etaBufferMinutes: z.number().min(0).optional(),
    riderAssignmentMinutes: z.number().min(0).optional(),
    pickupMinutes: z.number().min(0).optional(),
    avgRiderSpeedKmh: z.number().min(1).optional(),
    fallbackTravelMinutes: z.number().min(0).optional(),
    minOrderValue: z.number().min(0).optional(),
    dispatchStartRadiusKm: z.number().min(0).optional(),
    dispatchTimeoutSec: z.number().min(1).optional(),
    maxDispatchWaves: z.number().min(1).optional(),
    slaCompensationPct: z.number().min(0).max(100).optional(),
    slaCompensationMode: z.enum(['wallet', 'refund']).optional(),
});

const feeSettingsUpsertSchema = z.object({
    deliveryFee: z.number().min(0).nullable().optional(),
    baseDistanceKm: z.number().min(0).nullable().optional(),
    baseDeliveryFee: z.number().min(0).nullable().optional(),
    perKmCharge: z.number().min(0).nullable().optional(),
    deliveryFeeRanges: z.array(rangeSchema).optional(),
    sponsorRules: z.array(sponsorRuleSchema).optional(),
    deliveryDistanceSlabs: z.array(deliveryDistanceSlabSchema).optional(),
    platformFee: z.number().min(0).nullable().optional(),
    packagingFee: z.number().min(0).nullable().optional(),
    gstRate: z.number().min(0).max(100).nullable().optional(),
    mixedOrderDistanceLimit: z.number().min(0).nullable().optional(),
    mixedOrderAngleLimit: z.number().min(0).nullable().optional(),
    quickDelivery: quickDeliverySchema.optional(),
    isActive: z.boolean().optional()
});

export const validateFeeSettingsUpsertDto = (body) => {
    const normalized = {
        deliveryFee:
            body?.deliveryFee === null
                ? null
                : body?.deliveryFee !== undefined
                    ? Number(body.deliveryFee)
                    : undefined,
        baseDistanceKm:
            body?.baseDistanceKm === null
                ? null
                : body?.baseDistanceKm !== undefined
                    ? Number(body.baseDistanceKm)
                    : undefined,
        baseDeliveryFee:
            body?.baseDeliveryFee === null
                ? null
                : body?.baseDeliveryFee !== undefined
                    ? Number(body.baseDeliveryFee)
                    : undefined,
        perKmCharge:
            body?.perKmCharge === null
                ? null
                : body?.perKmCharge !== undefined
                    ? Number(body.perKmCharge)
                    : undefined,
        deliveryFeeRanges: Array.isArray(body?.deliveryFeeRanges)
            ? body.deliveryFeeRanges.map((r) => ({
                min: Number(r?.min),
                max: Number(r?.max),
                fee: Number(r?.fee),
                deliveryBoyPerKm: Number(r?.deliveryBoyPerKm || 0),
                deliveryBoyBasePay: Number(r?.deliveryBoyBasePay || 0)
            }))
            : undefined,
        sponsorRules: Array.isArray(body?.sponsorRules)
            ? body.sponsorRules.map((rule) => ({
                minOrderAmount: Number(rule?.minOrderAmount),
                maxOrderAmount:
                    rule?.maxOrderAmount === null || rule?.maxOrderAmount === undefined || rule?.maxOrderAmount === ''
                        ? null
                        : Number(rule.maxOrderAmount),
                maxDistanceKm: Number(rule?.maxDistanceKm),
                sponsorType: String(rule?.sponsorType || '').trim().toUpperCase(),
                sponsoredKm:
                    rule?.sponsoredKm === null || rule?.sponsoredKm === undefined || rule?.sponsoredKm === ''
                        ? null
                        : Number(rule.sponsoredKm)
            }))
            : undefined,
        deliveryDistanceSlabs: Array.isArray(body?.deliveryDistanceSlabs)
            ? body.deliveryDistanceSlabs.map((slab) => ({
                fromKm: Number(slab?.fromKm),
                toKm: Number(slab?.toKm),
                deliveryFee: Number(slab?.deliveryFee)
            }))
            : undefined,
        platformFee:
            body?.platformFee === null ? null : body?.platformFee !== undefined ? Number(body.platformFee) : undefined,
        packagingFee:
            body?.packagingFee === null ? null : body?.packagingFee !== undefined ? Number(body.packagingFee) : undefined,
        gstRate:
            body?.gstRate === null ? null : body?.gstRate !== undefined ? Number(body.gstRate) : undefined,
        mixedOrderDistanceLimit:
            body?.mixedOrderDistanceLimit === null ? null : body?.mixedOrderDistanceLimit !== undefined ? Number(body.mixedOrderDistanceLimit) : undefined,
        mixedOrderAngleLimit:
            body?.mixedOrderAngleLimit === null ? null : body?.mixedOrderAngleLimit !== undefined ? Number(body.mixedOrderAngleLimit) : undefined,
        quickDelivery:
            body?.quickDelivery !== undefined && body?.quickDelivery !== null
                ? body.quickDelivery
                : undefined,
        isActive: body?.isActive !== undefined ? Boolean(body.isActive) : undefined
    };

    const result = feeSettingsUpsertSchema.safeParse(normalized);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }

    if (result.data.quickDelivery !== undefined) {
        // Keep full shape for BC; service merges onto existing internals on upsert.
        const normalizedQuick = normalizeQuickDeliverySettings(result.data.quickDelivery);
        const platformSharePct = Number(normalizedQuick.platformSharePct);
        const riderSharePct = Number(normalizedQuick.riderSharePct);
        const restaurantSharePct = Number(normalizedQuick.restaurantSharePct) || 0;
        if (
            !Number.isFinite(platformSharePct) ||
            !Number.isFinite(riderSharePct) ||
            !Number.isFinite(restaurantSharePct) ||
            Math.abs(platformSharePct + riderSharePct + restaurantSharePct - 100) > 0.01
        ) {
            throw new ValidationError(
                'Platform Share, Rider Share, and Restaurant Share must total exactly 100%.',
            );
        }
        const charge = Number(normalizedQuick.charge);
        if (!Number.isFinite(charge) || charge < 0) {
            throw new ValidationError('Quick Charge must be greater than or equal to 0.');
        }
        const maxDistanceKm = Number(normalizedQuick.maxDistanceKm);
        if (!Number.isFinite(maxDistanceKm) || !(maxDistanceKm > 0)) {
            throw new ValidationError('Maximum Delivery Distance must be greater than 0.');
        }
        const maxEtaMinutes = Number(normalizedQuick.maxEtaMinutes);
        if (!Number.isFinite(maxEtaMinutes) || !(maxEtaMinutes > 0)) {
            throw new ValidationError('Maximum ETA must be greater than 0.');
        }
        const defaultKitchenPrepMinutes = Number(normalizedQuick.defaultKitchenPrepMinutes);
        if (
            !Number.isFinite(defaultKitchenPrepMinutes) ||
            defaultKitchenPrepMinutes < 1 ||
            defaultKitchenPrepMinutes > 90
        ) {
            throw new ValidationError(
                'Default Kitchen Prep must be between 1 and 90 minutes.',
            );
        }
        result.data.quickDelivery = normalizedQuick;
    }

    const ranges = Array.isArray(result.data.deliveryFeeRanges) ? result.data.deliveryFeeRanges : undefined;
    if (ranges) {
        const sorted = [...ranges].sort((a, b) => a.min - b.min);
        for (const r of sorted) {
            if (r.min >= r.max) {
                throw new ValidationError('Each range must have min less than max');
            }
        }
        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const cur = sorted[i];
            if (cur.min < prev.max) {
                throw new ValidationError('Delivery fee ranges must not overlap');
            }
        }
        result.data.deliveryFeeRanges = sorted;
    }

    const slabs = Array.isArray(result.data.deliveryDistanceSlabs) ? result.data.deliveryDistanceSlabs : undefined;
    if (slabs) {
        for (const slab of slabs) {
            if (slab.toKm < slab.fromKm) {
                throw new ValidationError('To KM must be greater than or equal to From KM');
            }
        }
    }

    const sponsorRules = Array.isArray(result.data.sponsorRules) ? result.data.sponsorRules : undefined;
    if (sponsorRules) {
        for (const rule of sponsorRules) {
            if (
                rule.maxOrderAmount != null &&
                Number.isFinite(rule.maxOrderAmount) &&
                rule.maxOrderAmount < rule.minOrderAmount
            ) {
                throw new ValidationError('Maximum order amount must be greater than or equal to minimum order amount');
            }
            if (rule.sponsorType === 'SPLIT') {
                const sponsoredKm = Number(rule.sponsoredKm);
                if (!Number.isFinite(sponsoredKm) || sponsoredKm < 0) {
                    throw new ValidationError('Sponsored KM is required for split rules');
                }
            }
            if (rule.sponsorType !== 'SPLIT') {
                rule.sponsoredKm = null;
            }
        }
    }

    return result.data;
};
