import crypto from 'crypto';

import Razorpay from 'razorpay';

import { config } from '../../../../config/env.js';

const KEY_ID = config.razorpayKeyId || process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = config.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET || '';

export function isRazorpayConfigured() {
    return Boolean(KEY_ID && KEY_SECRET && Razorpay);
}

export function getRazorpayKeyId() {
    return KEY_ID;
}

export function getRazorpayInstance() {
    if (!isRazorpayConfigured()) return null;
    return new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
}

export function createRazorpayOrder(amountPaise, currency = 'INR', receipt = '') {
    const instance = getRazorpayInstance();
    if (!instance) return Promise.reject(new Error('Razorpay not configured'));
    return instance.orders.create({
        amount: Math.round(amountPaise),
        currency,
        receipt: receipt || undefined
    });
}

export function createPaymentLink({ amountPaise, currency = 'INR', description, orderId, customerName, customerEmail, customerPhone }) {
    const instance = getRazorpayInstance();
    if (!instance) return Promise.reject(new Error('Razorpay not configured'));
    return instance.paymentLink.create({
        amount: Math.round(amountPaise),
        currency,
        description: description || `Order ${orderId}`,
        customer: {
            name: customerName || 'Customer',
            email: customerEmail || 'customer@example.com',
            contact: customerPhone ? String(customerPhone).replace(/\D/g, '').slice(-10) : '9999999999'
        }
    });
}

export function verifyPaymentSignature(orderId, paymentId, signature) {
    if (!KEY_SECRET) return false;
    const body = `${orderId}|${paymentId}`;
    const expected = crypto.createHmac('sha256', KEY_SECRET).update(body).digest('hex');
    return expected === signature;
}

export function verifySubscriptionSignature(subscriptionId, paymentId, signature) {
    if (!KEY_SECRET) return false;
    const body = `${paymentId}|${subscriptionId}`;
    const expected = crypto.createHmac('sha256', KEY_SECRET).update(body).digest('hex');
    return expected === signature;
}

/**
 * Fetch Razorpay payment (server-side) for additional validation (amount/status/order match).
 * @param {string} paymentId
 */
export async function fetchRazorpayPayment(paymentId) {
    const instance = getRazorpayInstance();
    if (!instance) throw new Error('Razorpay not configured');
    if (!paymentId) throw new Error('paymentId is required');
    return instance.payments.fetch(String(paymentId));
}

/**
 * Fetch Razorpay payment-link to check status (used for Razorpay QR auto verification).
 * @param {string} paymentLinkId
 */
export async function fetchRazorpayPaymentLink(paymentLinkId) {
    const instance = getRazorpayInstance();
    if (!instance) throw new Error('Razorpay not configured');
    if (!paymentLinkId) throw new Error('paymentLinkId is required');
    return instance.paymentLink.fetch(String(paymentLinkId));
}

/**
 * ✅ NEW: Create a Razorpay Plan for recurring subscriptions.
 * Used for Week/Month plans.
 * @param {Object} data - Plan details
 */
export async function createRazorpayPlan({ name, description, amountPaise, interval, period }) {
    const instance = getRazorpayInstance();
    if (!instance) throw new Error('Razorpay not configured');
    
    // period: 'daily' | 'weekly' | 'monthly' | 'yearly'
    return instance.plans.create({
        period: period.toLowerCase(),
        interval: Number(interval) || 1,
        item: {
            name,
            description: description || `Subscription Plan: ${name}`,
            amount: Math.round(amountPaise),
            currency: 'INR'
        }
    });
}

/**
 * ✅ NEW: Create a Razorpay Subscription for a user.
 * @param {Object} data - Subscription details
 */
export async function createRazorpaySubscription({ planId, totalCount, customerNotes = {} }) {
    const instance = getRazorpayInstance();
    if (!instance) throw new Error('Razorpay not configured');

    return instance.subscriptions.create({
        plan_id: planId,
        total_count: Number(totalCount) || 12, // Default 1 year of cycles if not specified
        quantity: 1,
        customer_notify: 1,
        notes: {
            type: 'subscription',
            ...customerNotes
        }
    });
}

/**
 * ✅ NEW: Cancel an active Razorpay Subscription.
 * @param {string} subscriptionId
 * @param {boolean} atCycleEnd - If true, cancels at end of current period
 */
export async function cancelRazorpaySubscription(subscriptionId, atCycleEnd = true) {
    const instance = getRazorpayInstance();
    if (!instance) throw new Error('Razorpay not configured');

    return instance.subscriptions.cancel(subscriptionId, !!atCycleEnd);
}

/**
 * ✅ NEW: Fetch Razorpay Subscription details.
 * @param {string} subscriptionId
 */
export async function fetchRazorpaySubscription(subscriptionId) {
    const instance = getRazorpayInstance();
    if (!instance) throw new Error('Razorpay not configured');

    return instance.subscriptions.fetch(subscriptionId);
}

/**
 * Initiate a refund for a successful payment.
 * @param {string} paymentId - Original Razorpay payment_id (captured)
 * @param {number} amount - Amount to refund (in major unit, e.g., INR 123.45)
 * @param {{ idempotencyKey?: string, notes?: Record<string, string> }} [options]
 */
export async function initiateRazorpayRefund(paymentId, amount, options = {}) {
    if (!isRazorpayConfigured()) {
        throw new Error('Razorpay is not configured on this server');
    }
    const instance = getRazorpayInstance();
    const amountPaise = Math.round(Number(amount) * 100);
    const idempotencyKey = options?.idempotencyKey
        ? String(options.idempotencyKey).trim().slice(0, 64)
        : '';
    // Prefer caller key; otherwise derive a stable receipt so retries map to the same refund.
    const receipt =
        idempotencyKey ||
        crypto
            .createHash('sha1')
            .update(`${paymentId}:${amountPaise}`)
            .digest('hex')
            .slice(0, 40);

    try {
        const refundPayload = {
            amount: amountPaise,
            receipt,
            notes: {
                reason: 'Order cancelled by system flow',
                at: new Date().toISOString(),
                ...(options?.notes || {}),
            },
        };
        const requestOptions = idempotencyKey
            ? { headers: { 'X-Razorpay-Idempotency-Key': idempotencyKey } }
            : undefined;
        const refund = requestOptions
            ? await instance.payments.refund(paymentId, refundPayload, requestOptions)
            : await instance.payments.refund(paymentId, refundPayload);
        return {
            success: true,
            refundId: refund.id,
            status: refund.status || 'processed',
            raw: refund
        };
    } catch (err) {
        // Already-refunded / duplicate receipt — treat as success when Razorpay reports it
        const msg = String(err?.error?.description || err?.message || '');
        const alreadyRefunded =
            /already.*refund|duplicate|idempotenc/i.test(msg) ||
            (Number(err?.statusCode) === 400 && /receipt/i.test(msg));
        if (alreadyRefunded && err?.error?.metadata?.refund_id) {
            return {
                success: true,
                refundId: err.error.metadata.refund_id,
                status: 'processed',
                raw: err.error,
            };
        }
        console.error(`Razorpay Refund API Failure [PaymentId: ${paymentId}]:`, err?.message || err);
        return {
            success: false,
            error: err?.message || 'Razorpay refund API error',
            status: 'failed'
        };
    }
}
