import crypto from 'crypto';
import ms from 'ms';
import { FoodOtp } from './otp.model.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { ValidationError } from '../auth/errors.js';
import { getGlobalBranding } from '../../modules/common/services/globalBranding.service.js';

const generateOtpCode = () => {
    const code = crypto.randomInt(1000, 9999);
    return String(code);
};

const normalizePhoneForOtp = (phone) => {
    const raw = String(phone || '').trim();
    if (raw.includes('@')) {
        return raw.toLowerCase();
    }
    return raw.replace(/\D/g, '');
};

const getPhoneCandidates = (phone) => {
    const raw = String(phone || '').trim();
    if (raw.includes('@')) {
        return [raw.toLowerCase()];
    }
    const digits = normalizePhoneForOtp(phone);
    const last10 = digits.slice(-10);

    return Array.from(new Set([
        raw,
        digits,
        last10,
        digits ? `+${digits}` : '',
        last10 ? `+91 ${last10}` : '',
        last10 ? `+91${last10}` : '',
        last10 ? `91${last10}` : '',
    ].filter(Boolean)));
};

/**
 * Sends SMS via SMS India Hub API
 * @param {string} phone - 10-digit mobile number (will be prefixed with 91)
 * @param {string} otp
 */
const sendSmsViaIndiaHub = async (phone, otp) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        // Normalize phone: strip non-digits, use last 10 local digits, prefix 91
        const digits = String(phone || '').replace(/\D/g, '');
        const local10 = digits.slice(-10);
        if (local10.length !== 10) {
            logger.error(`[SMS] Invalid phone for SMS delivery: ${phone}`);
            return;
        }
        const msisdn = `91${local10}`;

        // EXACT DLT TEMPLATE provided by user:
        // "Welcome to the ##var## powered by SMSINDIAHUB. Your OTP for registration is ##var##"
        const branding = await getGlobalBranding();
        const message = `Welcome to the ${branding.companyName} powered by SMSINDIAHUB. Your OTP for registration is ${otp}`;

        // SMS India Hub HTTP GET API — query param names are case-sensitive per SOP
        const url = new URL('http://cloud.smsindiahub.in/vendorsms/pushsms.aspx');
        url.searchParams.append('APIKey', config.smsApiKey);
        url.searchParams.append('sid', config.smsSenderId);
        url.searchParams.append('msisdn', msisdn);
        url.searchParams.append('msg', message);
        url.searchParams.append('gwid', '2');
        url.searchParams.append('fl', '0');
        if (config.smsIndiaHubUsername) {
            url.searchParams.append('uname', config.smsIndiaHubUsername);
        }
        if (config.smsDltTemplateId) {
            url.searchParams.append('DLT_TE_ID', config.smsDltTemplateId);
        }

        logger.info(`[SMS] Sending OTP to ${msisdn} via SMS India Hub...`);
        const response = await fetch(url.toString(), { signal: controller.signal });
        const resultText = await response.text();
        logger.info(`[SMS] Raw response for ${msisdn}: ${resultText}`);

        // SMS India Hub often returns HTTP 200 OK even for errors — check response body
        let parsed = null;
        try { parsed = JSON.parse(resultText); } catch (_) { /* plain text response is OK */ }

        if (parsed && parsed.ErrorCode && parsed.ErrorCode !== '000') {
            const errMsg = `SMS India Hub ERROR for ${phone}: [${parsed.ErrorCode}] ${parsed.ErrorMessage || resultText}`;
            logger.error(errMsg);
            // eslint-disable-next-line no-console
            console.error(`❌ [SMS ERROR] ${errMsg}`);
            if (parsed.ErrorCode === '006') {
                // eslint-disable-next-line no-console
                console.error('❌ [SMS ERROR] ErrorCode 006 = DLT Template mismatch. The message text must EXACTLY match your registered TRAI DLT template. Login to https://cloud.smsindiahub.in and verify the approved template text.');
            }
        } else if (!response.ok) {
            logger.error(`SMS API HTTP error for ${phone}: ${response.status} – ${resultText}`);
        } else {
            logger.info(`✅ SMS sent successfully to ${msisdn}`);
        }
    } catch (error) {
        const reason = error?.name === 'AbortError' ? 'timed out after 8s' : error.message;
        logger.error(`Error sending SMS to ${phone}: ${reason}`);
        // eslint-disable-next-line no-console
        console.error(`❌ [SMS ERROR] Failed to send OTP SMS to ${phone}: ${reason}`);
        // Do NOT throw — OTP is already stored in DB; SMS failure should not block the flow
    } finally {
        clearTimeout(timeoutId);
    }
};

export const createOrUpdateOtp = async (phone, options = {}) => {
    const forceRandom = options?.forceRandom === true;
    const phoneCandidates = getPhoneCandidates(phone);
    const normalizedPhone = normalizePhoneForOtp(phone) || String(phone || '').trim();
    const existing = await FoodOtp.findOne({ phone: { $in: phoneCandidates } });
    const now = new Date();

    // Rate Limiting Logic
    if (existing) {
        const windowMs = (config.otpRateWindow || 600) * 1000;
        const isInWindow = now - existing.lastRequestAt < windowMs;

        if (isInWindow) {
            if (existing.requestCount >= (config.otpRateLimit || 3)) {
                logger.warn(`Rate limit exceeded for phone ${phone}`);
                throw new ValidationError(`Too many OTP requests. Please try again after ${Math.ceil(windowMs / 60000)} minutes.`);
            }
            existing.requestCount += 1;
        } else {
            // Reset count if window has passed
            existing.requestCount = 1;
        }
    }

    const shouldUseDefaultOtp = config.useDefaultOtp && !forceRandom;
    const isEmail = String(phone || '').includes('@');

    let otp;
    if (shouldUseDefaultOtp || isEmail) {
        otp = '1234';
        logger.info(`Default OTP '1234' used for ${phone}`);
    } else {
        otp = generateOtpCode();
    }

    // Expiry calculation: prioritize seconds, then minutes, then fallback to MS string
    let ttlMs;
    if (config.otpExpirySeconds) {
        ttlMs = config.otpExpirySeconds * 1000;
    } else if (config.otpExpiryMinutes) {
        ttlMs = config.otpExpiryMinutes * 60 * 1000;
    } else {
        ttlMs = ms(config.otpExpiry || '5m');
    }
    const expiresAt = new Date(now.getTime() + ttlMs);

    if (existing) {
        existing.phone = normalizedPhone;
        existing.otp = otp;
        existing.expiresAt = expiresAt;
        existing.attempts = 0;
        existing.lastRequestAt = now;
        await existing.save();
    } else {
        await FoodOtp.create({ 
            phone: normalizedPhone,
            otp, 
            expiresAt,
            requestCount: 1,
            lastRequestAt: now
        });
    }

    // Delivery based on phone/email context.
    // Never block the HTTP response on SMS — provider latency/hangs were failing seller OTP.
    if (isEmail) {
        try {
            const { sendUserOtpEmail } = await import('../../utils/email.js');
            await sendUserOtpEmail(phone, otp);
        } catch (err) {
            logger.warn(`Could not send email OTP to ${phone}: ${err.message}`);
        }
    } else if (config.smsApiKey && config.smsSenderId) {
        void sendSmsViaIndiaHub(phone, otp);
    } else if (!shouldUseDefaultOtp) {
        logger.warn(`OTP generated for ${phone}, but SMS delivery is skipped because SMS India Hub credentials are missing.`);
    } else {
        logger.info(`OTP ready for ${phone} (default OTP mode, no SMS credentials configured).`);
    }

    return otp;
};

export const verifyOtp = async (phone, otp) => {
    const phoneCandidates = getPhoneCandidates(phone);
    const code = String(otp || '').trim();
    const now = new Date();
    const maxAttempts = Number(config.otpMaxAttempts) || 5;

    // Atomic success path: only one concurrent verify can consume a matching OTP.
    const consumed = await FoodOtp.findOneAndDelete({
        phone: { $in: phoneCandidates },
        otp: code,
        expiresAt: { $gt: now },
        attempts: { $lt: maxAttempts },
    });
    if (consumed) {
        return { valid: true };
    }

    const record = await FoodOtp.findOne({ phone: { $in: phoneCandidates } });
    if (!record) {
        return { valid: false, reason: 'OTP not found' };
    }

    if (record.expiresAt < now) {
        return { valid: false, reason: 'OTP expired' };
    }

    if (record.attempts >= maxAttempts) {
        return { valid: false, reason: 'Max attempts exceeded' };
    }

    // Wrong code (or race lost the successful consume) — bump attempts atomically.
    await FoodOtp.updateOne(
        { _id: record._id, attempts: { $lt: maxAttempts } },
        { $inc: { attempts: 1 } }
    );

    if (record.otp === code) {
        // Matching code but consume lost the race / expiry edge — treat as already used.
        return { valid: false, reason: 'OTP not found' };
    }

    return { valid: false, reason: 'Invalid OTP' };
};

