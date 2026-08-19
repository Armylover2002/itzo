import crypto from 'crypto';
import ms from 'ms';
import { FoodOtp } from './otp.model.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { ValidationError } from '../auth/errors.js';

const generateOtpCode = () => {
    const code = crypto.randomInt(1000, 9999);
    return String(code);
};

const normalizePhoneForOtp = (phone) => String(phone || '').replace(/\D/g, '');

const getPhoneCandidates = (phone) => {
    const raw = String(phone || '').trim();
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
    try {
        // Normalize phone: strip non-digits, ensure 91 country code prefix
        const digits = String(phone || '').replace(/\D/g, '');
        const msisdn = digits.startsWith('91') ? digits : `91${digits}`;

        // EXACT DLT TEMPLATE provided by user:
        // "Welcome to the ##var## powered by SMSINDIAHUB. Your OTP for registration is ##var##"
        const message = `Welcome to the Appzeto powered by SMSINDIAHUB. Your OTP for registration is ${otp}`;

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
        const response = await fetch(url.toString());
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
        logger.error(`Error sending SMS to ${phone}: ${error.message}`);
        // Do NOT throw — OTP is already stored in DB; SMS failure should not block the flow
    }
};

/**
 * Sends a custom SMS via SMS India Hub API
 * @param {string} phone - 10-digit mobile number
 * @param {string} message - The exact DLT approved text
 * @param {string} [dltTemplateId] - The specific DLT template ID for this custom message (optional)
 */
export const sendCustomSms = async (phone, message, dltTemplateId = null) => {
    try {
        if (!config.smsApiKey || !config.smsSenderId) {
            logger.warn('Custom SMS skipped: SMS credentials not configured');
            return;
        }
        const digits = String(phone || '').replace(/\D/g, '');
        const msisdn = digits.startsWith('91') ? digits : `91${digits}`;

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
        
        // Use the provided template ID, or fallback to the default one in .env
        const templateIdToUse = dltTemplateId || config.smsDltTemplateId;
        if (templateIdToUse) {
            url.searchParams.append('DLT_TE_ID', templateIdToUse);
        }

        logger.info(`[SMS] Sending custom SMS to ${msisdn}...`);
        const response = await fetch(url.toString());
        const resultText = await response.text();
        
        let parsed = null;
        try { parsed = JSON.parse(resultText); } catch (_) { /* */ }

        if (parsed && parsed.ErrorCode && parsed.ErrorCode !== '000') {
            logger.error(`SMS ERROR for ${phone}: [${parsed.ErrorCode}] ${parsed.ErrorMessage || resultText}`);
        } else if (!response.ok) {
            logger.error(`SMS API HTTP error for ${phone}: ${response.status} – ${resultText}`);
        } else {
            logger.info(`✅ Custom SMS sent successfully to ${msisdn}`);
        }
    } catch (error) {
        logger.error(`Error sending custom SMS to ${phone}: ${error.message}`);
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

    let otp;
    if (shouldUseDefaultOtp) {
        otp = '1234';
        logger.info(`Default OTP mode enabled – OTP is ${otp} for phone ${phone}`);
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

    // Only send SMS if not in default OTP mode and credentials exist.
    if (!shouldUseDefaultOtp && config.smsApiKey && config.smsSenderId) {
        await sendSmsViaIndiaHub(phone, otp);
    } else if (!shouldUseDefaultOtp) {
        logger.warn(`OTP generated for ${phone}, but SMS delivery is skipped because SMS India Hub credentials are missing.`);
    }

    return otp;
};

export const verifyOtp = async (phone, otp, options = {}) => {
    const phoneCandidates = getPhoneCandidates(phone);
    const record = await FoodOtp.findOne({ phone: { $in: phoneCandidates } });
    if (!record) {
        return { valid: false, reason: 'OTP not found' };
    }

    if (record.expiresAt < new Date()) {
        return { valid: false, reason: 'OTP expired' };
    }

    if (record.attempts >= config.otpMaxAttempts) {
        return { valid: false, reason: 'Max attempts exceeded' };
    }

    record.attempts += 1;

    if (record.otp !== otp) {
        await record.save();
        return { valid: false, reason: 'Invalid OTP' };
    }

    if (options.keepOnSuccess !== true) {
        await record.deleteOne();
    }
    return { valid: true };
};

export const deleteOtp = async (phone) => {
    const phoneCandidates = getPhoneCandidates(phone);
    await FoodOtp.deleteMany({ phone: { $in: phoneCandidates } });
};

