/**
 * Return OTP Service
 *
 * Handles generation, hashing, verification, and resend logic for return
 * pickup OTPs (user → rider) and seller handoff OTPs (seller → rider).
 *
 * Security: SHA-256 hashing with random salt. Plain OTP is never persisted.
 * Reuses: generateFourDigitDeliveryOtp() from order.helpers.js
 */

import crypto from 'crypto';
import mongoose from 'mongoose';
import { ReturnOtp } from '../models/returnOtp.model.js';
import { generateFourDigitDeliveryOtp } from '../../../food/orders/services/order.helpers.js';
import { DEFAULT_RETURN_SETTINGS } from '../constants/returnStateMachine.js';
import { logger } from '../../../../utils/logger.js';

// ─── Hashing Utilities ─────────────────────────────────────────────────────

/**
 * Generates a random 32-character hex salt.
 */
function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Hashes an OTP with the given salt using SHA-256.
 * @param {string} otp - Plain 4-digit OTP
 * @param {string} salt - Random salt
 * @returns {string} Hex-encoded hash
 */
function hashOtp(otp, salt) {
  return crypto
    .createHash('sha256')
    .update(`${String(otp).trim()}:${salt}`)
    .digest('hex');
}

/**
 * Verifies a submitted OTP against a stored hash.
 * @param {string} submittedOtp - OTP entered by rider
 * @param {string} storedHash - Stored SHA-256 hash
 * @param {string} salt - Salt used during hashing
 * @returns {boolean}
 */
function verifyOtpHash(submittedOtp, storedHash, salt) {
  const candidateHash = hashOtp(submittedOtp, salt);
  // Timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(candidateHash, 'hex'),
      Buffer.from(storedHash, 'hex'),
    );
  } catch {
    return false;
  }
}

// ─── Settings Helper ────────────────────────────────────────────────────────

/**
 * Gets return OTP settings. Falls back to defaults if not configured.
 * @param {object} [returnSettings] - Pre-fetched settings (avoids extra DB call)
 * @returns {object}
 */
function getOtpConfig(returnSettings) {
  const s = returnSettings || {};
  return {
    pickupExpiryMinutes: s.pickupOtpExpiryMinutes || DEFAULT_RETURN_SETTINGS.pickupOtpExpiryMinutes,
    sellerExpiryMinutes: s.sellerOtpExpiryMinutes || DEFAULT_RETURN_SETTINGS.sellerOtpExpiryMinutes,
    maxAttempts: s.maxOtpAttempts || DEFAULT_RETURN_SETTINGS.maxOtpAttempts,
    maxResends: s.maxOtpResends || DEFAULT_RETURN_SETTINGS.maxOtpResends,
    resendCooldownSec: s.otpResendCooldownSeconds || DEFAULT_RETURN_SETTINGS.otpResendCooldownSeconds,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generates and stores a new return OTP.
 *
 * @param {object} params
 * @param {string} params.returnRequestId - Master return request _id
 * @param {string} params.sellerReturnId  - Seller return leg _id
 * @param {'pickup' | 'seller'} params.type - OTP type
 * @param {string} params.recipientRole   - 'USER' or 'SELLER'
 * @param {string} params.recipientId     - userId or sellerId
 * @param {string} [params.recipientPhone] - Phone number for SMS delivery
 * @param {object} [params.returnSettings] - Pre-fetched return settings
 * @returns {{ otpDoc: object, plainOtp: string }} The saved OTP document and the plain OTP (for delivery)
 */
export async function generateReturnOtp({
  returnRequestId,
  sellerReturnId,
  type,
  recipientRole,
  recipientId,
  recipientPhone = '',
  returnSettings,
}) {
  const config = getOtpConfig(returnSettings);

  // Invalidate any existing non-verified OTP for this leg + type
  await ReturnOtp.updateMany(
    {
      sellerReturnId: new mongoose.Types.ObjectId(sellerReturnId),
      type,
      verified: false,
    },
    { $set: { expiresAt: new Date(0) } }, // expire immediately, TTL will clean up
  );

  const plainOtp = generateFourDigitDeliveryOtp();
  const salt = generateSalt();
  const otpHash = hashOtp(plainOtp, salt);

  const expiryMinutes = type === 'pickup'
    ? config.pickupExpiryMinutes
    : config.sellerExpiryMinutes;

  const otpDoc = await ReturnOtp.create({
    returnRequestId: new mongoose.Types.ObjectId(returnRequestId),
    sellerReturnId: new mongoose.Types.ObjectId(sellerReturnId),
    type,
    otpHash,
    salt,
    plainOtp,
    expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
    attempts: 0,
    maxAttempts: config.maxAttempts,
    verified: false,
    resendCount: 0,
    maxResends: config.maxResends,
    lastResendAt: new Date(),
    resendCooldownSec: config.resendCooldownSec,
    generatedFor: {
      role: recipientRole,
      id: new mongoose.Types.ObjectId(recipientId),
      phone: recipientPhone,
    },
  });

  logger.info(
    `[ReturnOTP] Generated ${type} OTP for sellerReturn=${sellerReturnId} ` +
    `(recipient=${recipientRole}:${recipientId})`,
  );

  return { otpDoc, plainOtp };
}

/**
 * Verifies a submitted OTP against the active OTP for a seller return leg.
 *
 * @param {object} params
 * @param {string} params.sellerReturnId - Seller return leg _id
 * @param {'pickup' | 'seller'} params.type - OTP type
 * @param {string} params.submittedOtp - OTP entered by delivery partner
 * @returns {{ success: boolean, message: string, otpDoc?: object }}
 */
export async function verifyReturnOtp({ sellerReturnId, type, submittedOtp }) {
  const otp = String(submittedOtp || '').trim();

  if (!otp || otp.length !== 4) {
    return { success: false, message: 'OTP must be a 4-digit code.' };
  }

  // Find the latest non-expired, non-verified OTP for this leg + type
  const otpDoc = await ReturnOtp.findOne({
    sellerReturnId: new mongoose.Types.ObjectId(sellerReturnId),
    type,
    verified: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpDoc) {
    return {
      success: false,
      message: 'OTP has expired or does not exist. Please request a new one.',
    };
  }

  // Check attempt lockout
  if (otpDoc.attempts >= otpDoc.maxAttempts) {
    return {
      success: false,
      message: `Maximum verification attempts (${otpDoc.maxAttempts}) exceeded. Please request a new OTP.`,
    };
  }

  // Increment attempts atomically BEFORE verification
  const updated = await ReturnOtp.findOneAndUpdate(
    { _id: otpDoc._id, verified: false },
    { $inc: { attempts: 1 } },
    { new: true },
  );

  if (!updated) {
    // Already verified by concurrent request (idempotent)
    return { success: true, message: 'OTP already verified.' };
  }

  const isValid = verifyOtpHash(otp, otpDoc.otpHash, otpDoc.salt);

  if (!isValid) {
    const remaining = updated.maxAttempts - updated.attempts;
    logger.warn(
      `[ReturnOTP] Failed verify attempt for sellerReturn=${sellerReturnId} ` +
      `type=${type} (attempts=${updated.attempts}/${updated.maxAttempts})`,
    );
    return {
      success: false,
      message: remaining > 0
        ? `Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : `Maximum verification attempts exceeded. Please request a new OTP.`,
      attemptsRemaining: remaining,
    };
  }

  // Mark as verified
  await ReturnOtp.findOneAndUpdate(
    { _id: otpDoc._id },
    { $set: { verified: true, verifiedAt: new Date() } },
  );

  logger.info(
    `[ReturnOTP] Verified ${type} OTP for sellerReturn=${sellerReturnId}`,
  );

  return { success: true, message: 'OTP verified successfully.', otpDoc: updated };
}

/**
 * Resends an OTP for a seller return leg (generates a new one).
 *
 * @param {object} params
 * @param {string} params.sellerReturnId - Seller return leg _id
 * @param {'pickup' | 'seller'} params.type - OTP type
 * @param {string} params.returnRequestId - Master return request _id
 * @param {string} params.recipientRole - 'USER' or 'SELLER'
 * @param {string} params.recipientId - userId or sellerId
 * @param {string} [params.recipientPhone]
 * @param {object} [params.returnSettings]
 * @returns {{ success: boolean, message: string, plainOtp?: string, otpDoc?: object }}
 */
export async function resendReturnOtp({
  sellerReturnId,
  type,
  returnRequestId,
  recipientRole,
  recipientId,
  recipientPhone = '',
  returnSettings,
}) {
  const config = getOtpConfig(returnSettings);

  // Find the most recent OTP for this leg + type (even if expired)
  const existingOtp = await ReturnOtp.findOne({
    sellerReturnId: new mongoose.Types.ObjectId(sellerReturnId),
    type,
  }).sort({ createdAt: -1 });

  if (existingOtp) {
    // If already verified, no resend needed
    if (existingOtp.verified) {
      return { success: false, message: 'OTP has already been verified.' };
    }

    // Check resend limit
    if (existingOtp.resendCount >= config.maxResends) {
      return {
        success: false,
        message: `Maximum resend limit (${config.maxResends}) reached. Please contact support.`,
      };
    }

    // Check cooldown
    if (existingOtp.lastResendAt) {
      const elapsedSec = (Date.now() - existingOtp.lastResendAt.getTime()) / 1000;
      if (elapsedSec < config.resendCooldownSec) {
        const waitSec = Math.ceil(config.resendCooldownSec - elapsedSec);
        return {
          success: false,
          message: `Please wait ${waitSec} second${waitSec === 1 ? '' : 's'} before requesting a new OTP.`,
          cooldownRemaining: waitSec,
        };
      }
    }
  }

  // Count total resends for this leg+type to enforce the limit across OTP documents
  const totalResends = await ReturnOtp.countDocuments({
    sellerReturnId: new mongoose.Types.ObjectId(sellerReturnId),
    type,
  });

  if (totalResends > config.maxResends) {
    return {
      success: false,
      message: `Maximum resend limit (${config.maxResends}) reached. Please contact support.`,
    };
  }

  // Generate new OTP (invalidates previous ones)
  const { otpDoc, plainOtp } = await generateReturnOtp({
    returnRequestId,
    sellerReturnId,
    type,
    recipientRole,
    recipientId,
    recipientPhone,
    returnSettings,
  });

  // Update resend count on new doc
  await ReturnOtp.findOneAndUpdate(
    { _id: otpDoc._id },
    { $set: { resendCount: totalResends, lastResendAt: new Date() } },
  );

  logger.info(
    `[ReturnOTP] Resent ${type} OTP for sellerReturn=${sellerReturnId} ` +
    `(resendCount=${totalResends})`,
  );

  return { success: true, message: 'New OTP sent.', plainOtp, otpDoc };
}

/**
 * Gets the current OTP status for a seller return leg.
 * Used for frontend display (e.g., showing whether OTP is pending, attempts remaining).
 *
 * @param {string} sellerReturnId
 * @param {'pickup' | 'seller'} type
 * @returns {object|null}
 */
export async function getOtpStatus(sellerReturnId, type) {
  const otpDoc = await ReturnOtp.findOne({
    sellerReturnId: new mongoose.Types.ObjectId(sellerReturnId),
    type,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!otpDoc) return null;

  return {
    exists: true,
    verified: otpDoc.verified,
    verifiedAt: otpDoc.verifiedAt,
    attempts: otpDoc.attempts,
    maxAttempts: otpDoc.maxAttempts,
    attemptsRemaining: Math.max(0, otpDoc.maxAttempts - otpDoc.attempts),
    locked: otpDoc.attempts >= otpDoc.maxAttempts,
    resendCount: otpDoc.resendCount,
    maxResends: otpDoc.maxResends,
    canResend: otpDoc.resendCount < otpDoc.maxResends && !otpDoc.verified,
    expiresAt: otpDoc.expiresAt,
  };
}
