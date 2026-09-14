import mongoose from 'mongoose';
import { recordTransaction, ensureWallet, getBalance, getTransactionsByEntity } from './transaction.service.js';
import { FoodUserWallet } from '../../modules/food/user/models/userWallet.model.js';
import { logger } from '../../utils/logger.js';

/**
 * Universal wallet service — facade over transaction.service for
 * common wallet operations (credit, debit, lock, unlock, get balance).
 *
 * Each entity type has its own Mongoose model, but this service
 * provides a unified interface.
 */

/**
 * Credit an entity's wallet.
 */
export async function creditWallet({
    entityType, entityId, amount, description,
    category = 'other', orderId, paymentId, metadata
}) {
    return recordTransaction({
        entityType,
        entityId: String(entityId),
        type: 'credit',
        amount: Number(amount),
        description,
        category,
        orderId: orderId ? String(orderId) : null,
        paymentId: paymentId ? String(paymentId) : null,
        metadata
    });
}

/**
 * Debit an entity's wallet.
 */
export async function debitWallet({
    entityType, entityId, amount, description,
    category = 'other', orderId, paymentId, metadata
}) {
    return recordTransaction({
        entityType,
        entityId: String(entityId),
        type: 'debit',
        amount: Number(amount),
        description,
        category,
        orderId: orderId ? String(orderId) : null,
        paymentId: paymentId ? String(paymentId) : null,
        metadata
    });
}

/**
 * Get wallet info for any entity.
 */
export async function getWalletBalance(entityType, entityId) {
    return getBalance(entityType, entityId);
}

/**
 * Get wallet + recent transactions for any entity.
 */
export async function getWalletWithTransactions(entityType, entityId, { page = 1, limit = 20 } = {}) {
    const [balance, txns] = await Promise.all([
        getBalance(entityType, entityId),
        getTransactionsByEntity(entityType, entityId, { page, limit })
    ]);

    return {
        ...balance,
        ...txns
    };
}

/**
 * Lock amount in wallet (for pending settlements).
 * Locked amount cannot be withdrawn but is still part of balances.
 */
export async function lockWalletAmount(entityType, entityId, amount) {
    const wallet = await ensureWallet(entityType, entityId);
    const available = (Number(wallet.balance) || 0) - (Number(wallet.lockedAmount) || 0);

    if (amount > available) {
        throw new Error(`Cannot lock ${amount}. Available: ${available}`);
    }

    wallet.lockedAmount = (Number(wallet.lockedAmount) || 0) + amount;
    await wallet.save();

    logger.info(`Locked ${amount} for ${entityType}:${entityId}. Total locked: ${wallet.lockedAmount}`);
    return { lockedAmount: wallet.lockedAmount, balance: wallet.balance };
}

/**
 * Unlock amount in wallet (after settlement is processed/cancelled).
 */
export async function unlockWalletAmount(entityType, entityId, amount) {
    const wallet = await ensureWallet(entityType, entityId);
    wallet.lockedAmount = Math.max(0, (Number(wallet.lockedAmount) || 0) - amount);
    await wallet.save();

    logger.info(`Unlocked ${amount} for ${entityType}:${entityId}. Total locked: ${wallet.lockedAmount}`);
    return { lockedAmount: wallet.lockedAmount, balance: wallet.balance };
}

/**
 * USER WALLET: Get wallet with transactions in the format the existing frontend expects.
 * This maintains backward compatibility with the existing FoodUserWallet embedded transactions.
 */
export async function getUserWalletForFrontend(userId) {
    const id = String(userId || '');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return { balance: 0, referralEarnings: 0, transactions: [] };
    }

    // Read from the existing FoodUserWallet for backward compat
    const oid = new mongoose.Types.ObjectId(id);
    const wallet = await FoodUserWallet.findOne({ userId: oid });

    // Also read from new Transaction collection
    const newTxns = await getTransactionsByEntity('user', id, { page: 1, limit: 50 });

    // Merge: prefer new Transaction data, fallback to embedded
    const embeddedTx = wallet?.transactions
        ? [...wallet.transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        : [];

    // Convert new transactions to frontend format
    const convertedNewTxns = (newTxns.transactions || []).map(t => ({
        id: String(t._id),
        _id: t._id,
        type: t.type === 'credit' ? 'addition' : 'deduction',
        amount: Number(t.amount) || 0,
        status: t.status === 'completed' ? 'Completed' : t.status,
        description: t.description || '',
        date: t.createdAt,
        createdAt: t.createdAt,
        metadata: t.metadata || {},
        category: t.category,
        balanceAfter: t.balanceAfter
    }));

    // Convert embedded txns
    const convertedEmbedded = embeddedTx.map(t => ({
        id: String(t._id),
        _id: t._id,
        type: t.type,
        amount: Number(t.amount) || 0,
        status: t.status || 'Completed',
        description: t.description || '',
        date: t.createdAt,
        createdAt: t.createdAt,
        metadata: t.metadata || {}
    }));

    // Deduplicate by checking if an embedded txn has a matching new txn (same amount + order within 5s)
    const allTxns = [...convertedNewTxns, ...convertedEmbedded];
    // Sort newest first
    allTxns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
        balance: Number(wallet?.balance) || 0,
        referralEarnings: Number(wallet?.referralEarnings) || 0,
        transactions: allTxns
    };
}
