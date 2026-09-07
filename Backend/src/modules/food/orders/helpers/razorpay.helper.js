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

export function createRazorpayOrder(amountPaise, currency = 'INR', receipt = '', notes = {}) {
    const instance = getRazorpayInstance();
    if (!instance) return Promise.reject(new Error('Razorpay not configured'));
    return instance.orders.create({
        amount: Math.round(amountPaise),
        currency,
        receipt: receipt || undefined,
        ...(notes && Object.keys(notes).length > 0 ? { notes } : {})
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

/**
 * Full checkout verification for an order.
 *
 * `verifyPaymentSignature` alone only proves the caller holds a genuine Razorpay
 * (orderId, paymentId) pair — it says nothing about WHICH order was paid or for how
 * much. Callers that skipped these extra checks could be handed a valid ₹1 triple and
 * would happily mark a ₹5,000 order paid, so every order-payment verification must go
 * through here.
 *
 * @param {object}  args
 * @param {string}  args.razorpayOrderId    order id supplied by the client
 * @param {string}  args.razorpayPaymentId  payment id supplied by the client
 * @param {string}  args.razorpaySignature  signature supplied by the client
 * @param {string}  args.expectedOrderId    razorpay order id stored on our order at checkout
 * @param {number} [args.expectedAmount]    amount in rupees we expect to have been paid
 * @returns {Promise<{ok: true, amount: number, payment: object}>}
 * @throws  {Error} with a caller-safe message when verification fails
 */
export async function verifyOrderPayment({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    expectedOrderId,
    expectedAmount
}) {
    const submittedOrderId = String(razorpayOrderId || '').trim();
    const paymentId = String(razorpayPaymentId || '').trim();
    const signature = String(razorpaySignature || '').trim();
    const boundOrderId = String(expectedOrderId || '').trim();

    if (!submittedOrderId || !paymentId || !signature) {
        throw new Error('Missing payment details');
    }

    // 1. The payment must be for the order WE created, not one the caller chose.
    if (!boundOrderId) {
        throw new Error('This order has no payment session to verify');
    }
    if (submittedOrderId !== boundOrderId) {
        throw new Error('Payment does not belong to this order');
    }

    // 2. The signature must be authentic.
    if (!verifyPaymentSignature(submittedOrderId, paymentId, signature)) {
        throw new Error('Payment verification failed');
    }

    // 3. The gateway must agree the money was actually collected, for this order.
    let payment;
    try {
        payment = await fetchRazorpayPayment(paymentId);
    } catch (error) {
        throw new Error('Could not confirm this payment with Razorpay');
    }

    if (String(payment?.order_id || '') !== submittedOrderId) {
        throw new Error('Payment does not belong to this order');
    }
    if (!['captured', 'authorized'].includes(String(payment?.status || ''))) {
        throw new Error('Payment has not been completed');
    }

    // 4. The amount must cover what the order asked for (1 paisa tolerance for rounding).
    const paidAmount = Number(payment.amount) / 100;
    if (Number.isFinite(expectedAmount) && expectedAmount > 0) {
        if (paidAmount + 0.01 < Number(expectedAmount)) {
            throw new Error('Paid amount is less than the order total');
        }
    }

    return { ok: true, amount: paidAmount, payment };
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
 * ✅ NEW: Initiate a refund for a successful payment.
 * NON-BREAKING Extension for automated cancellation refunds.
 * @param {string} paymentId - Original Razorpay payment_id (captured)
 * @param {number} amount - Amount to refund (in major unit, e.g., INR 123.45)
 */
export async function initiateRazorpayRefund(paymentId, amount) {
    if (!isRazorpayConfigured()) {
        throw new Error('Razorpay is not configured on this server');
    }
    const instance = getRazorpayInstance();
    try {
        const refund = await instance.payments.refund(paymentId, {
            amount: Math.round(Number(amount) * 100), // convert to paise
            notes: {
                reason: 'Order cancelled by system flow',
                at: new Date().toISOString()
            }
        });
        return {
            success: true,
            refundId: refund.id,
            status: refund.status || 'processed',
            raw: refund
        };
    } catch (err) {
        // Log locally but pass the error to the service to handle status update
        console.error(`Razorpay Refund API Failure [PaymentId: ${paymentId}]:`, err?.message || err);
        return {
            success: false,
            error: err?.message || 'Razorpay refund API error',
            status: 'failed'
        };
    }
}

/**
 * Create a Dynamic Single-Use UPI QR Code via Razorpay qrCode.create().
 * Returns the full QR code object containing `image_url`, `id`, `status`, etc.
 * @param {Object} data
 * @param {number} data.amountPaise - Amount in paise
 * @param {string} [data.currency] - Currency code (default INR)
 * @param {string} [data.description] - Payment description
 * @param {string} [data.orderId] - Internal order ID for notes
 * @param {string} [data.customerName] - Customer name for notes
 */
export async function createUpiQrCode({ amountPaise, currency = 'INR', description, orderId, customerName }) {
    const instance = getRazorpayInstance();
    if (!instance) throw new Error('Razorpay not configured');

    // QR expires 30 minutes from now
    const closeBy = Math.floor(Date.now() / 1000) + 30 * 60;

    return instance.qrCode.create({
        type: 'upi_qr',
        name: customerName || 'Customer',
        usage: 'single_use',
        fixed_amount: true,
        payment_amount: Math.round(amountPaise),
        description: description || `Order ${orderId || 'payment'}`,
        close_by: closeBy,
        notes: {
            orderId: orderId || '',
            purpose: 'cod_collection',
        },
    });
}

/**
 * Fetch all payments made against a Razorpay QR Code.
 * Used to verify whether the scanned QR payment has been captured/authorized.
 * @param {string} qrCodeId - Razorpay QR code ID (e.g. qr_xxxxx)
 * @returns {Promise<Object>} - Razorpay payments response { items: [...], count }
 */
export async function fetchQrCodePayments(qrCodeId) {
    const instance = getRazorpayInstance();
    if (!instance) throw new Error('Razorpay not configured');
    if (!qrCodeId) throw new Error('qrCodeId is required');
    return instance.qrCode.fetchAllPayments(String(qrCodeId), {});
}
