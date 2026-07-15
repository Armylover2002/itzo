import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

// ─── Shared Schemas ─────────────────────────────────────────────────────────

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

// ─── User Endpoint Validators ───────────────────────────────────────────────

const returnItemSchema = z.object({
  productId: objectIdSchema,
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  reason: z.string().trim().max(500).optional(),
});

const createReturnRequestSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required').trim(),
  items: z.array(returnItemSchema).min(1, 'At least one item is required'),
  reason: z.string().min(1, 'Primary reason is required').trim().max(500),
  notes: z.string().trim().max(1000).optional().default(''),
  images: z.array(z.string().url('Invalid image URL')).max(10, 'Max 10 images allowed').optional().default([]),
});

export const validateCreateReturnRequest = (body) => {
  const result = createReturnRequestSchema.safeParse(body);
  if (!result.success) throw new ValidationError(result.error.errors[0].message);
  return result.data;
};

const cancelReturnSchema = z.object({
  reason: z.string().trim().max(500).optional().default(''),
});

export const validateCancelReturn = (body) => {
  const result = cancelReturnSchema.safeParse(body);
  if (!result.success) throw new ValidationError(result.error.errors[0].message);
  return result.data;
};

// ─── Admin Endpoint Validators ──────────────────────────────────────────────

const adminApprovalItemSchema = z.object({
  productId: objectIdSchema,
  status: z.enum(['approved', 'rejected']),
  approvedQty: z.number().int().min(0).default(0),
  note: z.string().trim().max(500).optional().default(''),
});

const adminApproveReturnSchema = z.object({
  approvals: z.array(adminApprovalItemSchema).min(1, 'At least one item approval is required'),
});

export const validateAdminApproveReturn = (body) => {
  const result = adminApproveReturnSchema.safeParse(body);
  if (!result.success) throw new ValidationError(result.error.errors[0].message);
  return result.data;
};

// ─── Delivery Partner Endpoint Validators ───────────────────────────────────

const otpVerifySchema = z.object({
  otp: z.string().length(4, 'OTP must be exactly 4 digits').regex(/^\d{4}$/, 'OTP must contain only digits'),
});

export const validateOtpVerify = (body) => {
  const result = otpVerifySchema.safeParse(body);
  if (!result.success) throw new ValidationError(result.error.errors[0].message);
  return result.data;
};

const rejectAssignmentSchema = z.object({
  reason: z.string().trim().max(500).optional().default(''),
});

export const validateRejectAssignment = (body) => {
  const result = rejectAssignmentSchema.safeParse(body);
  if (!result.success) throw new ValidationError(result.error.errors[0].message);
  return result.data;
};

const failedLegSchema = z.object({
  reason: z.string().min(1, 'Failure reason is required').trim().max(500),
});

export const validateFailedLeg = (body) => {
  const result = failedLegSchema.safeParse(body);
  if (!result.success) throw new ValidationError(result.error.errors[0].message);
  return result.data;
};
