import { config } from '../config/env.js';

const normalizeLocal10 = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

/**
 * Best-effort transactional SMS (approvals, rejections). OTP still uses otp.service.js
 * so the DLT OTP template is not reused here. Optional SMS_INDIA_HUB_TXN_DLT_TEMPLATE_ID
 * can be set if a transactional template is registered.
 */
export const sendTransactionalSms = async (phone, message) => {
    const text = String(message || '').trim();
    const local10 = normalizeLocal10(phone);
    if (!text || local10.length !== 10) return false;
    if (!config.smsApiKey || !config.smsSenderId) {
        console.warn('[SMS] Transactional SMS skipped: SMS India Hub is not configured.');
        return false;
    }

    const msisdn = `91${local10}`;
    const url = new URL('http://cloud.smsindiahub.in/vendorsms/pushsms.aspx');
    url.searchParams.append('APIKey', config.smsApiKey);
    url.searchParams.append('msisdn', msisdn);
    url.searchParams.append('sid', config.smsSenderId);
    url.searchParams.append('msg', text);
    url.searchParams.append('fl', '0');
    url.searchParams.append('gwid', '2');
    const txnTemplateId = config.smsTransactionalDltTemplateId || config.smsDltTemplateId;
    if (txnTemplateId) {
        url.searchParams.append('DLT_TE_ID', txnTemplateId);
    }

    try {
        const response = await fetch(url.toString());
        const body = await response.text();
        if (!response.ok) {
            console.error('[SMS] Transactional SMS HTTP error:', response.status, body);
            return false;
        }
        return true;
    } catch (error) {
        console.error('[SMS] Transactional SMS failed:', error.message);
        return false;
    }
};
