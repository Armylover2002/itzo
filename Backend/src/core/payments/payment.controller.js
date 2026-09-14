import { sendResponse, sendError } from '../../utils/response.js';
import { getPaymentsByOrder } from './payment.service.js';
import { getTransactionsByOrder, getTransactionsByEntity } from './transaction.service.js';
import { getWalletBalance, getWalletWithTransactions, getUserWalletForFrontend } from './wallet.service.js';
import { getRefundsByOrder, listRefunds } from './refund.service.js';
import {
    createSettlement,
    processSettlement,
    listSettlements,
    RESTAURANT_PAYOUT_SUCCESSORS,
} from './settlement.service.js';
import mongoose from 'mongoose';

/** Canonical restaurant payout / Hub Finance path (order earnings). */
const RESTAURANT_FINANCE_SUCCESSOR = '/api/v1/food/restaurant/finance';
/** Canonical restaurant subscription wallet path. */
const RESTAURANT_SUBSCRIPTION_WALLET_SUCCESSOR = '/api/v1/food/restaurant/subscription-wallet';

function setRestaurantWalletDeprecationHeaders(res) {
    res.set('Deprecation', 'true');
    res.set(
        'Link',
        `<${RESTAURANT_FINANCE_SUCCESSOR}>; rel="successor-version", <${RESTAURANT_SUBSCRIPTION_WALLET_SUCCESSOR}>; rel="alternate"`
    );
    res.set(
        'Warning',
        '299 - "GET /food/payments/restaurant/:id/wallet is deprecated; use GET /food/restaurant/finance for payouts and GET /food/restaurant/subscription-wallet for subscription balance"'
    );
}

// ─── User Endpoints ───

export const getPaymentHistoryController = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const payments = await getPaymentsByOrder(orderId);
        return sendResponse(res, 200, 'Payment history fetched', { payments });
    } catch (err) {
        next(err);
    }
};

export const getOrderTransactionsController = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const transactions = await getTransactionsByOrder(orderId);
        return sendResponse(res, 200, 'Transactions fetched', { transactions });
    } catch (err) {
        next(err);
    }
};

export const getUserWalletBalanceController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const data = await getWalletBalance('user', userId);
        return sendResponse(res, 200, 'Balance fetched', data);
    } catch (err) {
        next(err);
    }
};

export const getUserWalletTransactionsController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const data = await getWalletWithTransactions('user', userId, { page, limit });
        return sendResponse(res, 200, 'Wallet transactions fetched', data);
    } catch (err) {
        next(err);
    }
};

// ─── Restaurant Endpoints ───

/**
 * @deprecated Prefer GET /food/restaurant/finance (order payouts) and
 * GET /food/restaurant/subscription-wallet (subscription balance).
 * Kept for backward compatibility; does not upsert an empty wallet row.
 */
export const getRestaurantWalletController = async (req, res, next) => {
    try {
        setRestaurantWalletDeprecationHeaders(res);

        const restaurantId = req.user?.restaurantId || req.params.restaurantId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
            return sendResponse(res, 200, 'Restaurant wallet endpoint deprecated', {
                deprecated: true,
                useInstead: {
                    finance: RESTAURANT_FINANCE_SUCCESSOR,
                    subscriptionWallet: RESTAURANT_SUBSCRIPTION_WALLET_SUCCESSOR,
                },
                balance: 0,
                lockedAmount: 0,
                availableBalance: 0,
                transactions: [],
                total: 0,
                page,
                limit,
                totalPages: 0,
                ledger: 'referral_subscription',
                orderPayout: null,
            });
        }

        const rid = new mongoose.Types.ObjectId(String(restaurantId));
        const { FoodRestaurantWallet } = await import(
            '../../modules/food/restaurant/models/restaurantWallet.model.js'
        );

        // Read-only — do not ensureWallet/upsert (avoids creating empty docs from a dead client).
        const [wallet, txns, orderPayoutModule] = await Promise.all([
            FoodRestaurantWallet.findOne({ restaurantId: rid })
                .select('balance lockedAmount referralEarnings totalEarnings subscriptionBalance totalSettled')
                .lean(),
            getTransactionsByEntity('restaurant', String(restaurantId), { page, limit }),
            import('../../modules/food/restaurant/services/restaurantFinance.service.js'),
        ]);

        const {
            getRestaurantAvailableWithdrawalBalance,
            getRestaurantLifetimeOrderEarnings,
        } = orderPayoutModule;
        const [orderPayout, totalOrderEarnings] = await Promise.all([
            getRestaurantAvailableWithdrawalBalance(restaurantId),
            getRestaurantLifetimeOrderEarnings(restaurantId),
        ]);

        const balance = Number(wallet?.balance) || 0;
        const lockedAmount = Number(wallet?.lockedAmount) || 0;

        return sendResponse(
            res,
            200,
            'Deprecated: use /food/restaurant/finance for payouts and /food/restaurant/subscription-wallet for subscription balance',
            {
                deprecated: true,
                useInstead: {
                    finance: RESTAURANT_FINANCE_SUCCESSOR,
                    subscriptionWallet: RESTAURANT_SUBSCRIPTION_WALLET_SUCCESSOR,
                },
                balance,
                lockedAmount,
                availableBalance: balance - lockedAmount,
                referralEarnings: Number(wallet?.referralEarnings) || 0,
                totalEarnings: Number(wallet?.totalEarnings) || 0,
                subscriptionBalance: Number(wallet?.subscriptionBalance) || 0,
                totalSettled: Number(wallet?.totalSettled) || 0,
                ...txns,
                ledger: 'referral_subscription',
                orderPayout: {
                    availableBalance: orderPayout.availableBalance,
                    pendingOrderShare: orderPayout.globalEstimatedPayout,
                    referralEarnings: orderPayout.referralBalance,
                    totalOrderEarnings,
                    totalPendingWithdrawals: orderPayout.totalPendingWithdrawals,
                    source: 'food_transactions',
                },
            }
        );
    } catch (err) {
        next(err);
    }
};

// ─── Delivery Partner Endpoints ───

export const getDeliveryWalletController = async (req, res, next) => {
    try {
        const deliveryPartnerId = req.user?.deliveryPartnerId || req.params.deliveryPartnerId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const data = await getWalletWithTransactions('deliveryBoy', deliveryPartnerId, { page, limit });
        return sendResponse(res, 200, 'Delivery wallet fetched', data);
    } catch (err) {
        next(err);
    }
};

// ─── Admin Endpoints ───

export const getAdminWalletController = async (req, res, next) => {
    try {
        const data = await getWalletBalance('admin', 'platform');
        return sendResponse(res, 200, 'Admin wallet fetched', data);
    } catch (err) {
        next(err);
    }
};

export const getAdminFinanceSummaryController = async (req, res, next) => {
    try {
        const { FoodAdminWallet } = await import('../../modules/food/admin/models/adminWallet.model.js');
        const adminWallet = await FoodAdminWallet.findOne({ key: 'platform' }).lean();
        const pendingSettlements = await listSettlements({ status: 'pending', limit: 100 });
        const pendingRefunds = await listRefunds({ status: 'pending', limit: 100 });

        return sendResponse(res, 200, 'Finance summary', {
            platform: {
                balance: adminWallet?.balance || 0,
                totalRevenue: adminWallet?.totalRevenue || 0,
                totalPayouts: adminWallet?.totalPayouts || 0,
                totalRefunds: adminWallet?.totalRefunds || 0
            },
            pendingSettlements: {
                count: pendingSettlements.total,
                totalAmount: pendingSettlements.settlements.reduce((s, v) => s + (v.amount || 0), 0)
            },
            pendingRefunds: {
                count: pendingRefunds.total,
                totalAmount: pendingRefunds.refunds.reduce((s, v) => s + (v.amount || 0), 0)
            }
        });
    } catch (err) {
        next(err);
    }
};

export const listSettlementsController = async (req, res, next) => {
    try {
        const { entityType, entityId, status } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        res.set('Deprecation', 'true');
        res.set(
            'Warning',
            '299 - "Legacy settlements API. Food restaurant payouts use /food/restaurant/withdraw and /food/admin/withdrawals"'
        );
        const data = await listSettlements({ entityType, entityId, status, page, limit });
        return sendResponse(res, 200, 'Settlements fetched (legacy)', data);
    } catch (err) {
        next(err);
    }
};

export const createSettlementController = async (req, res, next) => {
    try {
        const { entityType, entityId, amount, notes, periodStart, periodEnd } = req.body;

        if (String(entityType || '').trim() === 'restaurant') {
            res.set('Deprecation', 'true');
            return sendError(
                res,
                410,
                'Restaurant settlements via this API are deprecated. Use POST /food/restaurant/withdraw and PATCH /food/admin/withdrawals/:id'
            );
        }

        const settlement = await createSettlement({
            entityType,
            entityId,
            amount,
            notes,
            periodStart,
            periodEnd,
        });
        return sendResponse(res, 201, 'Settlement created', {
            settlement,
            restaurantPayoutUseInstead: RESTAURANT_PAYOUT_SUCCESSORS,
        });
    } catch (err) {
        if (err?.code === 'RESTAURANT_SETTLEMENT_DEPRECATED' || err?.statusCode === 410) {
            return res.status(410).json({
                success: false,
                message: err.message,
                code: 'RESTAURANT_SETTLEMENT_DEPRECATED',
                useInstead: err.useInstead || RESTAURANT_PAYOUT_SUCCESSORS,
            });
        }
        next(err);
    }
};

export const processSettlementController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const adminId = req.user?.userId;
        const { payoutRef } = req.body;
        const settlement = await processSettlement(id, { processedBy: adminId, payoutRef });
        return sendResponse(res, 200, 'Settlement processed', { settlement });
    } catch (err) {
        if (err?.code === 'RESTAURANT_SETTLEMENT_DEPRECATED' || err?.statusCode === 410) {
            return res.status(410).json({
                success: false,
                message: err.message,
                code: 'RESTAURANT_SETTLEMENT_DEPRECATED',
                useInstead: err.useInstead || RESTAURANT_PAYOUT_SUCCESSORS,
            });
        }
        next(err);
    }
};

export const listRefundsController = async (req, res, next) => {
    try {
        const { status } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const data = await listRefunds({ status, page, limit });
        return sendResponse(res, 200, 'Refunds fetched', data);
    } catch (err) {
        next(err);
    }
};

export const getRefundsByOrderController = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const refunds = await getRefundsByOrder(orderId);
        return sendResponse(res, 200, 'Refunds fetched', { refunds });
    } catch (err) {
        next(err);
    }
};
