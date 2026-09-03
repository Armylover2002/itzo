import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

const sponsorRuleSchema = z.object({
  minOrderAmount: z.number().min(0),
  maxOrderAmount: z.number().min(0).nullable().optional(),
  maxDistanceKm: z.number().min(0),
  sponsorType: z.enum(['USER_FULL', 'SELLER_FULL', 'SPLIT']),
  sponsoredKm: z.number().min(0).nullable().optional(),
});

const feeSettingsUpsertSchema = z.object({
  baseDistanceKm: z.number().min(0).nullable().optional(),
  baseDeliveryFee: z.number().min(0).nullable().optional(),
  perKmCharge: z.number().min(0).nullable().optional(),
  sponsorRules: z.array(sponsorRuleSchema).optional(),
  platformFee: z.number().min(0).nullable().optional(),
  gstRate: z.number().min(0).max(100).nullable().optional(),
  minWithdrawal: z.number().min(0).nullable().optional(),
  maxWithdrawal: z.number().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const validateFeeSettingsUpsertDto = (body) => {
  const normalized = {
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
              : Number(rule.sponsoredKm),
        }))
      : undefined,
    platformFee:
      body?.platformFee === null
        ? null
        : body?.platformFee !== undefined
          ? Number(body.platformFee)
          : undefined,
    gstRate:
      body?.gstRate === null
        ? null
        : body?.gstRate !== undefined
          ? Number(body.gstRate)
          : undefined,
    minWithdrawal:
      body?.minWithdrawal === null
        ? null
        : body?.minWithdrawal !== undefined && body?.minWithdrawal !== ''
          ? Number(body.minWithdrawal)
          : undefined,
    maxWithdrawal:
      body?.maxWithdrawal === null
        ? null
        : body?.maxWithdrawal !== undefined && body?.maxWithdrawal !== ''
          ? Number(body.maxWithdrawal)
          : undefined,
    isActive: body?.isActive !== undefined ? Boolean(body.isActive) : undefined,
  };

  const result = feeSettingsUpsertSchema.safeParse(normalized);
  if (!result.success) {
    throw new ValidationError(result.error.errors[0].message);
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

  if (
    result.data.minWithdrawal != null &&
    result.data.maxWithdrawal != null &&
    result.data.minWithdrawal > result.data.maxWithdrawal
  ) {
    throw new ValidationError('Minimum withdrawal cannot be greater than maximum withdrawal');
  }

  return result.data;
};
