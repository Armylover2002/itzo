import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import { FoodUserWallet } from '../models/userWallet.model.js';
import { createRazorpayOrder, getRazorpayKeyId, isRazorpayConfigured, verifyPaymentSignature } from '../../orders/helpers/razorpay.helper.js';
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
    const wallet = await ensureWallet(userId);
    wallet.transactions.unshift({
        type: 'addition',
        amount,
        status: 'Completed',
        description: 'Referral reward',
        metadata: { source: 'referral_reward', ...(metadata || {}) }
    });
    wallet.balance = Number(wallet.balance || 0) + amount;
    wallet.referralEarnings = Number(wallet.referralEarnings || 0) + amount;
    await wallet.save();
    await syncUserWalletBalance(userId, wallet.balance);
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
    const amount = Number(payload?.amount);

    if (!orderId) throw new ValidationError('razorpayOrderId is required');
    if (!paymentId) throw new ValidationError('razorpayPaymentId is required');
    if (!signature) throw new ValidationError('razorpaySignature is required');
    if (!Number.isFinite(amount) || amount <= 0) throw new ValidationError('amount is required');

    const wallet = await ensureWallet(userId);
    const existing = wallet.transactions.find((t) => String(t.razorpayOrderId || '') === orderId);
    if (existing && String(existing.status).toLowerCase() === 'completed') {
        return { wallet: await getUserWallet(userId) };
    }

    // If razorpay not configured (dev), accept and credit wallet.
    const ok = isRazorpayConfigured()
        ? verifyPaymentSignature(orderId, paymentId, signature)
        : true;
    if (!ok) {
        throw new ValidationError('Payment verification failed');
    }

    // Store ONLY after payment is verified.
    wallet.transactions.unshift({
        type: 'addition',
        amount,
        status: 'Completed',
        description: isRazorpayConfigured() ? 'Wallet top-up' : 'Wallet top-up (dev)',
        metadata: { source: 'wallet_topup', mode: isRazorpayConfigured() ? 'razorpay' : 'dev' },
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature
    });

    wallet.balance = Number(wallet.balance || 0) + amount;
    await wallet.save();
    await syncUserWalletBalance(userId, wallet.balance);

    return { wallet: await getUserWallet(userId) };
};

export const deductWalletBalance = async (userId, amountInr, description = 'Order payment', metadata = {}) => {
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new ValidationError('Invalid deduction amount');
    }

    const wallet = await ensureWallet(userId);
    if (wallet.balance < amount) {
        throw new ValidationError('Insufficient wallet balance');
    }

    wallet.transactions.unshift({
        type: 'deduction',
        amount,
        status: 'Completed',
        description,
        metadata: { source: 'order_payment', ...(metadata || {}) }
    });

    wallet.balance = Number(wallet.balance) - amount;
    await wallet.save();
    await syncUserWalletBalance(userId, wallet.balance);

    return { wallet: await getUserWallet(userId) };
};

export const refundWalletBalance = async (userId, amountInr, description = 'Order refund', metadata = {}) => {
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        return { wallet: await getUserWallet(userId) };
    }

    const wallet = await ensureWallet(userId);
    wallet.transactions.unshift({
        type: 'refund',
        amount,
        status: 'Completed',
        description,
        metadata: { source: 'order_refund', ...(metadata || {}) }
    });

    wallet.balance = Number(wallet.balance) + amount;
    await wallet.save();
    await syncUserWalletBalance(userId, wallet.balance);

    return { wallet: await getUserWallet(userId) };
};

