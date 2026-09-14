import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import { FoodUserWallet } from '../models/userWallet.model.js';
import {
    createRazorpayOrder,
    fetchRazorpayPayment,
    getRazorpayKeyId,
    isRazorpayConfigured,
    verifyPaymentSignature,
} from '../../orders/helpers/razorpay.helper.js';

const syncUserWalletBalance = async (userId, balance) => {
    const numericBalance = Math.max(0, Number(balance) || 0);
    await FoodUser.updateOne(
        { _id: userId },
        { $set: { walletBalance: numericBalance } }
    );
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
    const referralLogId = metadata?.referralLogId ? String(metadata.referralLogId) : '';
    const rewardType = metadata?.type ? String(metadata.type) : '';

    // Idempotent retry: skip if this referral log side was already credited.
    if (referralLogId && Array.isArray(wallet.transactions)) {
        const alreadyCredited = wallet.transactions.some((tx) => {
            const meta = tx?.metadata || {};
            return (
                String(meta.source || '') === 'referral_reward' &&
                String(meta.referralLogId || '') === referralLogId &&
                (!rewardType || String(meta.type || '') === rewardType)
            );
        });
        if (alreadyCredited) {
            return { wallet: await getUserWallet(userId) };
        }
    }

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

    if (!orderId) throw new ValidationError('razorpayOrderId is required');
    if (!paymentId) throw new ValidationError('razorpayPaymentId is required');
    if (!signature) throw new ValidationError('razorpaySignature is required');

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

    let creditedAmount = Number(payload?.amount);
    if (isRazorpayConfigured()) {
        const fetchedPayment = await fetchRazorpayPayment(paymentId);
        const fetchedOrderId = String(fetchedPayment?.order_id || '').trim();
        const fetchedStatus = String(fetchedPayment?.status || '').toLowerCase();
        const fetchedAmount = Number(fetchedPayment?.amount || 0) / 100;

        if (fetchedOrderId !== orderId) {
            throw new ValidationError('Payment order mismatch');
        }
        if (fetchedStatus !== 'captured') {
            throw new ValidationError('Payment not captured');
        }
        if (!Number.isFinite(fetchedAmount) || fetchedAmount <= 0) {
            throw new ValidationError('Invalid payment amount');
        }
        creditedAmount = fetchedAmount;
    } else if (!Number.isFinite(creditedAmount) || creditedAmount <= 0) {
        throw new ValidationError('amount is required');
    }

    // Store ONLY after payment is verified.
    wallet.transactions.unshift({
        type: 'addition',
        amount: creditedAmount,
        status: 'Completed',
        description: isRazorpayConfigured() ? 'Wallet top-up' : 'Wallet top-up (dev)',
        metadata: { source: 'wallet_topup', mode: isRazorpayConfigured() ? 'razorpay' : 'dev' },
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature
    });

    wallet.balance = Number(wallet.balance || 0) + creditedAmount;
    await wallet.save();
    await syncUserWalletBalance(userId, wallet.balance);

    return { wallet: await getUserWallet(userId) };
};

/** Auto-cancel / compensation refund sources — at most one successful credit per order. */
const AUTO_WALLET_REFUND_SOURCES = [
    'user_cancel_refund',
    'restaurant_cancel_refund',
    'admin_auto_refund',
    'order_save_compensation',
];

/**
 * Atomically debit wallet when balance is sufficient.
 * Idempotent for the same metadata.orderId (retries after partial place-order failures).
 */
export const deductWalletBalance = async (userId, amountInr, description = 'Order payment', metadata = {}) => {
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new ValidationError('Invalid deduction amount');
    }

    await ensureWallet(userId);
    const oid = new mongoose.Types.ObjectId(String(userId));
    const orderIdKey = String(metadata?.orderId || '').trim();
    const sourceKey = String(metadata?.source || 'food_order_payment').trim();

    if (orderIdKey) {
        const alreadyDebited = await FoodUserWallet.findOne({
            userId: oid,
            transactions: {
                $elemMatch: {
                    type: 'deduction',
                    'metadata.orderId': orderIdKey,
                },
            },
        })
            .select('_id')
            .lean();
        if (alreadyDebited) {
            return { wallet: await getUserWallet(userId), alreadyProcessed: true };
        }
    }

    const txn = {
        type: 'deduction',
        amount,
        status: 'Completed',
        description,
        metadata: { ...(metadata || {}), source: sourceKey },
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const debitFilter = {
        userId: oid,
        balance: { $gte: amount },
    };
    if (orderIdKey) {
        debitFilter.transactions = {
            $not: {
                $elemMatch: {
                    type: 'deduction',
                    'metadata.orderId': orderIdKey,
                },
            },
        };
    }

    const updated = await FoodUserWallet.findOneAndUpdate(
        debitFilter,
        {
            $inc: { balance: -amount },
            $push: { transactions: { $each: [txn], $position: 0 } },
        },
        { new: true }
    );

    if (!updated) {
        // Race: another request already deducted for this orderId
        if (orderIdKey) {
            const raced = await FoodUserWallet.findOne({
                userId: oid,
                transactions: {
                    $elemMatch: {
                        type: 'deduction',
                        'metadata.orderId': orderIdKey,
                    },
                },
            })
                .select('_id')
                .lean();
            if (raced) {
                return { wallet: await getUserWallet(userId), alreadyProcessed: true };
            }
        }
        throw new ValidationError('Insufficient wallet balance');
    }

    await syncUserWalletBalance(userId, updated.balance);
    return { wallet: await getUserWallet(userId) };
};

/**
 * Credit wallet for order refunds.
 * Idempotent on returnId / refundTransactionId, or orderId+source+amount
 * (auto-cancel sources: one refund per orderId across those sources).
 */
export const refundWalletBalance = async (userId, amountInr, description = 'Order refund', metadata = {}) => {
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        return { wallet: await getUserWallet(userId) };
    }

    await ensureWallet(userId);
    const oid = new mongoose.Types.ObjectId(String(userId));
    const returnId = String(metadata?.returnId || '').trim();
    const refundTransactionId = String(metadata?.refundTransactionId || '').trim();
    const orderIdKey = String(metadata?.orderId || '').trim();
    const sourceKey = String(metadata?.source || 'order_refund').trim();
    const isAutoSource = AUTO_WALLET_REFUND_SOURCES.includes(sourceKey);

    const duplicateOr = [];
    if (returnId) {
        duplicateOr.push({
            transactions: {
                $elemMatch: { type: 'refund', 'metadata.returnId': returnId },
            },
        });
    }
    if (refundTransactionId) {
        duplicateOr.push({
            transactions: {
                $elemMatch: {
                    type: 'refund',
                    'metadata.refundTransactionId': refundTransactionId,
                },
            },
        });
    }
    if (orderIdKey && isAutoSource) {
        duplicateOr.push({
            transactions: {
                $elemMatch: {
                    type: 'refund',
                    'metadata.orderId': orderIdKey,
                    'metadata.source': { $in: AUTO_WALLET_REFUND_SOURCES },
                },
            },
        });
    } else if (orderIdKey) {
        duplicateOr.push({
            transactions: {
                $elemMatch: {
                    type: 'refund',
                    'metadata.orderId': orderIdKey,
                    'metadata.source': sourceKey,
                    amount,
                },
            },
        });
    }

    if (duplicateOr.length) {
        const existingRefund = await FoodUserWallet.findOne({
            userId: oid,
            $or: duplicateOr,
        })
            .select('_id')
            .lean();
        if (existingRefund) {
            return { wallet: await getUserWallet(userId), alreadyProcessed: true };
        }
    }

    const txn = {
        type: 'refund',
        amount,
        status: 'Completed',
        description,
        metadata: { ...(metadata || {}), source: sourceKey },
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const creditFilter = { userId: oid };
    if (orderIdKey && isAutoSource) {
        creditFilter.transactions = {
            $not: {
                $elemMatch: {
                    type: 'refund',
                    'metadata.orderId': orderIdKey,
                    'metadata.source': { $in: AUTO_WALLET_REFUND_SOURCES },
                },
            },
        };
    } else if (orderIdKey) {
        creditFilter.transactions = {
            $not: {
                $elemMatch: {
                    type: 'refund',
                    'metadata.orderId': orderIdKey,
                    'metadata.source': sourceKey,
                    amount,
                },
            },
        };
    } else if (refundTransactionId) {
        creditFilter.transactions = {
            $not: {
                $elemMatch: {
                    type: 'refund',
                    'metadata.refundTransactionId': refundTransactionId,
                },
            },
        };
    } else if (returnId) {
        creditFilter.transactions = {
            $not: {
                $elemMatch: {
                    type: 'refund',
                    'metadata.returnId': returnId,
                },
            },
        };
    }

    const updated = await FoodUserWallet.findOneAndUpdate(
        creditFilter,
        {
            $inc: { balance: amount },
            $push: { transactions: { $each: [txn], $position: 0 } },
        },
        { new: true }
    );

    if (!updated) {
        // Concurrent duplicate refund attempt — treat as already processed.
        return { wallet: await getUserWallet(userId), alreadyProcessed: true };
    }

    await syncUserWalletBalance(userId, updated.balance);
    return { wallet: await getUserWallet(userId) };
};

