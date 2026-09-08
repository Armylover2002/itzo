import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import { FoodUserWallet } from '../models/userWallet.model.js';
import { createRazorpayOrder, fetchRazorpayPayment, getRazorpayKeyId, isRazorpayConfigured, verifyPaymentSignature } from '../../orders/helpers/razorpay.helper.js';
import { getIO, rooms } from '../../../../config/socket.js';

const syncUserWalletBalance = async (userId, balance) => {
    const numericBalance = Math.max(0, Number(balance) || 0);
    await FoodUser.updateOne(
        { _id: userId },
        { $set: { walletBalance: numericBalance } }
    );
    const io = getIO();
    if (io && rooms) {
        io.to(rooms.user(userId)).emit('wallet_updated', {
            balance: numericBalance
        });
    }
};

const ensureWallet = async (userId) => {
    const id = String(userId || '');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('User not found');
    }
    const oid = new mongoose.Types.ObjectId(id);
    const existing = await FoodUserWallet.findOne({ userId: oid });
    if (existing) return existing;
    const created = await FoodUserWallet.create({ userId: oid, balance: 0, transactions: [] });
    await syncUserWalletBalance(oid, created.balance);
    return created;
};

export const creditReferralReward = async (userId, amountInr, metadata = {}) => {
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        return { wallet: await getUserWallet(userId) };
    }
    const id = String(userId || '');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('User not found');
    }
    const oid = new mongoose.Types.ObjectId(id);

    const entry = {
        type: 'addition',
        amount,
        status: 'Completed',
        description: 'Referral reward',
        metadata: { source: 'referral_reward', ...(metadata || {}) }
    };

    // Atomic so concurrent rewards cannot overwrite each other's balance.
    const updated = await FoodUserWallet.findOneAndUpdate(
        { userId: oid },
        {
            $inc: { balance: amount, referralEarnings: amount },
            $push: { transactions: { $each: [entry], $position: 0 } },
            $setOnInsert: { userId: oid }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await syncUserWalletBalance(oid, updated.balance);
    return { wallet: await getUserWallet(userId) };
};

export const getUserWallet = async (userId) => {
    const id = String(userId || '');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('User not found');
    }
    const oid = new mongoose.Types.ObjectId(id);
    const wallet = await FoodUserWallet.findOne({ userId: oid });
    if (!wallet) {
        return { balance: 0, referralEarnings: 0, transactions: [] };
    }
    // Return newest first (UI expects recent transactions on top)
    const tx = Array.isArray(wallet.transactions) ? [...wallet.transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];
    return {
        balance: Number(wallet.balance) || 0,
        referralEarnings: Number(wallet.referralEarnings) || 0,
        transactions: tx.map((t) => ({
            id: String(t._id),
            _id: t._id,
            type: t.type,
            amount: Number(t.amount) || 0,
            status: t.status || 'Completed',
            description: t.description || '',
            date: t.createdAt,
            createdAt: t.createdAt,
            metadata: t.metadata || {}
        }))
    };
};

export const createWalletTopupOrder = async (userId, amountInr) => {
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
        throw new ValidationError('User not found');
    }
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new ValidationError('Amount must be greater than 0');
    }
    if (amount > 50000) {
        throw new ValidationError('Maximum amount is 50,000');
    }

    const amountPaise = Math.round(amount * 100);

    if (!isRazorpayConfigured()) {
        // Dev fallback: return a compatible shape without writing to DB.
        const orderId = `order_dev_${Date.now()}`;
        return {
            razorpay: {
                key: getRazorpayKeyId() || 'rzp_test_dummy',
                orderId,
                amount: amountPaise,
                currency: 'INR'
            }
        };
    }

    const receipt = `wallet_topup_${String(userId).slice(-8)}_${Date.now()}`;
    
    try {
        const order = await createRazorpayOrder(amountPaise, 'INR', receipt);

        return {
            razorpay: {
                key: getRazorpayKeyId(),
                orderId: String(order.id),
                amount: Number(order.amount) || amountPaise,
                currency: order.currency || 'INR'
            }
        };
    } catch (error) {
        console.error('Razorpay Wallet Topup Error:', error);
        throw new Error(error.description || error.message || 'Failed to create payment order');
    }
};

export const verifyWalletTopupPayment = async (userId, payload) => {
    const orderId = String(payload?.razorpayOrderId || '').trim();
    const paymentId = String(payload?.razorpayPaymentId || '').trim();
    const signature = String(payload?.razorpaySignature || '').trim();

    if (!orderId) throw new ValidationError('razorpayOrderId is required');
    if (!paymentId) throw new ValidationError('razorpayPaymentId is required');
    if (!signature) throw new ValidationError('razorpaySignature is required');

    const wallet = await ensureWallet(userId);
    const existing = wallet.transactions.find((t) => String(t.razorpayOrderId || '') === orderId);
    if (existing && String(existing.status).toLowerCase() === 'completed') {
        return { wallet: await getUserWallet(userId) };
    }

    // The credited amount is ALWAYS derived from Razorpay, never from the request
    // body: the signature only covers `orderId|paymentId`, so a caller who replays a
    // genuine ₹1 payment could otherwise name any amount and have it credited.
    let amount;

    if (isRazorpayConfigured()) {
        if (!verifyPaymentSignature(orderId, paymentId, signature)) {
            throw new ValidationError('Payment verification failed');
        }

        let payment;
        try {
            payment = await fetchRazorpayPayment(paymentId);
        } catch (error) {
            throw new ValidationError('Could not confirm this payment with Razorpay');
        }

        // The payment must belong to the order that was signed, and must have
        // actually been collected.
        if (String(payment?.order_id || '') !== orderId) {
            throw new ValidationError('Payment does not belong to this order');
        }
        if (!['captured', 'authorized'].includes(String(payment?.status || ''))) {
            throw new ValidationError('Payment has not been completed');
        }

        amount = Number(payment.amount) / 100;
    } else {
        // Dev fallback (no Razorpay keys): there is no gateway to confirm against,
        // so fall back to the requested amount.
        amount = Number(payload?.amount);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new ValidationError('Could not determine a valid top-up amount');
    }

    // Store ONLY after payment is verified. The `razorpayOrderId` filter makes the
    // credit idempotent: a replayed verify call for the same gateway order matches an
    // existing entry and no second credit is applied.
    const entry = {
        type: 'addition',
        amount,
        status: 'Completed',
        description: isRazorpayConfigured() ? 'Wallet top-up' : 'Wallet top-up (dev)',
        metadata: { source: 'wallet_topup', mode: isRazorpayConfigured() ? 'razorpay' : 'dev' },
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature
    };

    const updated = await FoodUserWallet.findOneAndUpdate(
        { userId: wallet.userId, 'transactions.razorpayOrderId': { $ne: orderId } },
        {
            $inc: { balance: amount },
            $push: { transactions: { $each: [entry], $position: 0 } }
        },
        { new: true }
    );

    // Already credited by a concurrent or earlier call — return current state.
    if (!updated) {
        return { wallet: await getUserWallet(userId) };
    }

    await syncUserWalletBalance(wallet.userId, updated.balance);

    return { wallet: await getUserWallet(userId) };
};

/**
 * Debit the user's wallet for an order.
 *
 * The balance check and the debit happen in ONE conditional update, so the wallet can
 * never go negative: previously they were separate steps, which let two concurrent
 * orders both read the same balance, both pass the check, and both deduct.
 *
 * Accepts an optional `session` so callers can make the debit roll back with the order
 * it pays for — without that, a failure after the debit charged a customer for an order
 * that was never created.
 *
 * @param {string} userId
 * @param {number} amountInr
 * @param {string} description
 * @param {object} metadata
 * @param {object} [options]
 * @param {import('mongoose').ClientSession} [options.session]
 */
export const deductWalletBalance = async (userId, amountInr, description = 'Order payment', metadata = {}, options = {}) => {
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new ValidationError('Invalid deduction amount');
    }

    const id = String(userId || '');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('User not found');
    }
    const oid = new mongoose.Types.ObjectId(id);
    const session = options?.session || null;

    // Make sure a wallet document exists before the conditional debit, otherwise a
    // first-time user would read as "insufficient balance" rather than "no funds".
    await FoodUserWallet.updateOne(
        { userId: oid },
        { $setOnInsert: { userId: oid, balance: 0, transactions: [] } },
        { upsert: true, ...(session ? { session } : {}) }
    );

    const entry = {
        type: 'deduction',
        amount,
        status: 'Completed',
        description,
        metadata: { source: 'order_payment', ...(metadata || {}) }
    };

    const updated = await FoodUserWallet.findOneAndUpdate(
        { userId: oid, balance: { $gte: amount } },
        {
            $inc: { balance: -amount },
            $push: { transactions: { $each: [entry], $position: 0 } }
        },
        { new: true, ...(session ? { session } : {}) }
    );

    // No document matched means the balance was below the amount at the moment of the
    // write — not merely at the moment we read it.
    if (!updated) {
        throw new ValidationError('Insufficient wallet balance');
    }

    await FoodUser.updateOne(
        { _id: oid },
        { $set: { walletBalance: Math.max(0, Number(updated.balance) || 0) } },
        session ? { session } : {}
    );

    const io = getIO();
    if (io && rooms && !session) {
        io.to(rooms.user(oid)).emit('wallet_updated', {
            balance: Math.max(0, Number(updated.balance) || 0)
        });
    }

    return { wallet: session ? updated : await getUserWallet(userId) };
};

/**
 * Credit a refund to the user's wallet.
 *
 * Accepts an optional `session` so callers that already run inside a Mongo transaction
 * (the returns flow, for example) can have the money movement roll back with the rest of
 * their work. Without it, an abort after this point left the customer credited while the
 * refund was marked pending again — so a retry paid them twice.
 *
 * Uses an atomic `$inc` rather than read-modify-write, so concurrent credits cannot
 * overwrite each other.
 *
 * @param {string} userId
 * @param {number} amountInr
 * @param {string} description
 * @param {object} metadata
 * @param {object} [options]
 * @param {import('mongoose').ClientSession} [options.session]
 */
export const refundWalletBalance = async (userId, amountInr, description = 'Order refund', metadata = {}, options = {}) => {
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        return { wallet: await getUserWallet(userId) };
    }

    const id = String(userId || '');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('User not found');
    }
    const oid = new mongoose.Types.ObjectId(id);
    const session = options?.session || null;

    const entry = {
        type: 'refund',
        amount,
        status: 'Completed',
        description,
        metadata: { source: 'order_refund', ...(metadata || {}) }
    };

    const updated = await FoodUserWallet.findOneAndUpdate(
        { userId: oid },
        {
            $inc: { balance: amount },
            $push: { transactions: { $each: [entry], $position: 0 } },
            $setOnInsert: { userId: oid }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true, ...(session ? { session } : {}) }
    );

    await FoodUser.updateOne(
        { _id: oid },
        { $set: { walletBalance: Math.max(0, Number(updated?.balance) || 0) } },
        session ? { session } : {}
    );

    // Socket notification is a side effect, not part of the money movement — emitting it
    // inside the transaction would announce a balance that may still roll back.
    const emitBalance = Math.max(0, Number(updated?.balance) || 0);
    const io = getIO();
    if (io && rooms && !session) {
        io.to(rooms.user(oid)).emit('wallet_updated', { balance: emitBalance });
    }

    return { wallet: session ? updated : await getUserWallet(userId) };
};

