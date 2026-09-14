import { AuthLockout } from './authLockout.model.js';
import { config } from '../../config/env.js';
import { AuthError, ValidationError } from './errors.js';

export const LOCKOUT_SCOPES = {
    ADMIN_LOGIN: 'admin_login',
    ADMIN_FORGOT_OTP_REQUEST: 'admin_forgot_otp_request',
    ADMIN_FORGOT_OTP_VERIFY: 'admin_forgot_otp_verify',
};

const expiryFromMinutes = (minutes) =>
    new Date(Date.now() + Math.max(1, minutes) * 60 * 1000);

export const normalizeAdminLockoutIdentifier = (value) => {
    const raw = String(value || '').trim();
    if (/^EMPL\d+$/i.test(raw)) return raw.toUpperCase();
    return raw.toLowerCase();
};

export const getAdminAccountLockoutKey = (admin) => {
    if (!admin?.email) return null;
    return String(admin.email).trim().toLowerCase();
};

const getLockedMinutesLeft = (lockedUntil) =>
    Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60000));

const assertNotLocked = async (identifier, scope, messagePrefix) => {
    if (!identifier) return;

    const record = await AuthLockout.findOne({ identifier, scope }).lean();
    if (record?.lockedUntil && new Date(record.lockedUntil) > new Date()) {
        const minutesLeft = getLockedMinutesLeft(record.lockedUntil);
        throw new AuthError(
            `${messagePrefix} Please try again in ${minutesLeft} minute(s).`,
        );
    }
};

export const assertAdminLoginAllowed = async (lockoutKey) =>
    assertNotLocked(
        lockoutKey,
        LOCKOUT_SCOPES.ADMIN_LOGIN,
        'Too many failed login attempts.',
    );

export const recordAdminLoginFailure = async (lockoutKey) => {
    if (!lockoutKey) return;

    const maxAttempts = config.authLoginMaxAttempts || 5;
    const lockoutMinutes = config.authLoginLockoutMinutes || 15;
    const scope = LOCKOUT_SCOPES.ADMIN_LOGIN;
    const now = new Date();

    await assertAdminLoginAllowed(lockoutKey);

    const record = await AuthLockout.findOneAndUpdate(
        { identifier: lockoutKey, scope },
        {
            $setOnInsert: { identifier: lockoutKey, scope },
            $inc: { failedAttempts: 1 },
            $set: {
                expiresAt: expiryFromMinutes(lockoutMinutes * 2),
                lastRequestAt: now,
            },
        },
        { upsert: true, new: true },
    );

    if (record.failedAttempts >= maxAttempts) {
        const lockedUntil = expiryFromMinutes(lockoutMinutes);
        await AuthLockout.updateOne(
            { identifier: lockoutKey, scope },
            {
                $set: {
                    lockedUntil,
                    failedAttempts: 0,
                    expiresAt: expiryFromMinutes(lockoutMinutes * 2),
                },
            },
        );
        throw new AuthError(
            `Too many failed login attempts. Please try again in ${lockoutMinutes} minute(s).`,
        );
    }
};

export const clearAdminLoginLockout = async (lockoutKey) => {
    if (!lockoutKey) return;
    await AuthLockout.deleteOne({
        identifier: lockoutKey,
        scope: LOCKOUT_SCOPES.ADMIN_LOGIN,
    });
};

export const assertAdminForgotOtpRequestAllowed = async (email) => {
    const identifier = normalizeAdminLockoutIdentifier(email);
    const scope = LOCKOUT_SCOPES.ADMIN_FORGOT_OTP_REQUEST;
    const windowMs = (config.otpRateWindow || 600) * 1000;
    const maxRequests = config.otpRateLimit || 3;
    const now = new Date();
    const waitMinutes = Math.max(1, Math.ceil(windowMs / 60000));

    let record = await AuthLockout.findOne({ identifier, scope });
    if (!record) {
        await AuthLockout.create({
            identifier,
            scope,
            requestCount: 1,
            lastRequestAt: now,
            expiresAt: expiryFromMinutes(waitMinutes + 5),
        });
        return;
    }

    const inWindow =
        record.lastRequestAt &&
        now.getTime() - new Date(record.lastRequestAt).getTime() < windowMs;

    if (inWindow && record.requestCount >= maxRequests) {
        throw new ValidationError(
            `Too many OTP requests. Please try again after ${waitMinutes} minutes.`,
        );
    }

    record.requestCount = inWindow ? record.requestCount + 1 : 1;
    record.lastRequestAt = now;
    record.expiresAt = expiryFromMinutes(waitMinutes + 5);
    await record.save();
};

export const assertAdminForgotOtpVerificationAllowed = async (email) =>
    assertNotLocked(
        normalizeAdminLockoutIdentifier(email),
        LOCKOUT_SCOPES.ADMIN_FORGOT_OTP_VERIFY,
        'Too many failed attempts.',
    );

export const lockAdminForgotOtpVerification = async (email) => {
    const identifier = normalizeAdminLockoutIdentifier(email);
    const lockoutMinutes = config.authLoginLockoutMinutes || 15;

    await AuthLockout.findOneAndUpdate(
        { identifier, scope: LOCKOUT_SCOPES.ADMIN_FORGOT_OTP_VERIFY },
        {
            $set: {
                lockedUntil: expiryFromMinutes(lockoutMinutes),
                failedAttempts: 0,
                expiresAt: expiryFromMinutes(lockoutMinutes * 2),
            },
            $setOnInsert: { identifier, scope: LOCKOUT_SCOPES.ADMIN_FORGOT_OTP_VERIFY },
        },
        { upsert: true },
    );
};

export const clearAdminForgotOtpVerificationLockout = async (email) => {
    const identifier = normalizeAdminLockoutIdentifier(email);
    await AuthLockout.deleteOne({
        identifier,
        scope: LOCKOUT_SCOPES.ADMIN_FORGOT_OTP_VERIFY,
    });
};
