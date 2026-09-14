import { z } from "zod";
import { ValidationError } from "../../core/auth/errors.js";

const schema = z.object({
  phone: z
    .string()
    .min(1, "Phone or Email is required")
    .refine((val) => {
        const isEmail = val.includes("@");
        if (isEmail) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
        } else {
            return /^\d+$/.test(val) && val.length >= 8 && val.length <= 15;
        }
    }, {
        message: "Must be a valid email address or 8-15 digit phone number"
    }),
  otp: z
    .string()
    .length(4, "OTP must be exactly 4 digits")
    .regex(/^\d{4}$/, "OTP must be numeric and exactly 4 digits"),
  ref: z.string().trim().max(64).optional().or(z.literal("")),
  fcmToken: z.string().optional(),
  platform: z.enum(["web", "mobile"]).optional(),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100).optional(),
});

export const validateUserOtpVerifyDto = (body) => {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(result.error.errors[0].message);
  }
  return result.data;
};
