/**
 * Restaurant finance (Hub / payouts) — reads order earnings from `food_transactions`,
 * not from `food_restaurant_wallets.balance`.
 *
 * Available withdrawal = sum(unsettled delivered `restaurantShare`) + wallet
 * `referralEarnings` − pending/processing withdrawals.
 *
 * An empty `food_restaurant_wallets` collection after orders-only activity is
 * expected for legacy restaurants; new ones get a zero-balance row on register/
 * approve. Wallet balances still do not hold order earnings.
 *
 * On Hub Finance / withdrawal reads, `selfHealRestaurantFinanceLedger` repairs
 * missed capture + Quick Share on food_transactions (never creditWallet order earnings).
 */
import mongoose from 'mongoose';
import { FoodTransaction } from '../../orders/models/foodTransaction.model.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { FoodRestaurantWallet, ensureRestaurantWallet } from '../models/restaurantWallet.model.js';
import { FoodRestaurantWithdrawal } from '../models/foodRestaurantWithdrawal.model.js';
import { FoodDailyPass } from '../../subscriptions/models/foodDailyPass.model.js';
import { FoodWalletLedger } from '../../subscriptions/models/foodWalletLedger.model.js';
import { getRestaurantWithdrawalLimitSettings } from '../../admin/services/admin.service.js';
import { realizeFoodQuickRestaurantShare } from '../../orders/services/foodTransaction.service.js';
import { logger } from '../../../../utils/logger.js';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);
const IST_TIMEZONE = 'Asia/Kolkata';

function toTwoDigitYearString(dateObj) {
    const y = String(dateObj.getFullYear());
    return y.slice(-2);
}

function monthShort(monthIndex) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[monthIndex] || 'Jan';
}

function getFixedCurrentCycleWindow(now = new Date()) {
    const startDay = 15;
    
    let year = now.getFullYear();
    let month = now.getMonth();

    // If before start day, settlement belongs to previous month cycle.
    if (now.getDate() < startDay) {
        month = month - 1;
        if (month < 0) {
            month = 11;
            year -= 1;
        }
    }

    const start = new Date(year, month, startDay, 0, 0, 0, 0);
    // End should be either fixed 21 or now, let's make it more inclusive for "Current Cycle"
    // Users want to see their active earnings, so we extend it to 'now'
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    return {
        start,
        end,
        startMeta: { day: String(startDay), month: monthShort(month), year: toTwoDigitYearString(new Date(year, month, startDay)) },
        endMeta: { day: String(now.getDate()), month: monthShort(now.getMonth()), year: toTwoDigitYearString(now) }
    };
}

function parseISODateParam(v) {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
}

function parseISODateParamEnd(v) {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(23, 59, 59, 999);
    return d;
}

/** Only delivered orders may contribute to restaurant payout eligibility. */
function isDeliveredOrderForPayout(orderLike) {
    if (!orderLike || typeof orderLike !== 'object') return false;
    const status = String(orderLike.orderStatus || '').trim().toLowerCase();
    if (status === 'delivered') return true;
    const phase = String(
        orderLike.deliveryState?.currentPhase || orderLike.deliveryState?.status || ''
    )
        .trim()
        .toLowerCase();
    return phase === 'delivered';
}

/**
 * Self-heal restaurant finance ledger (Option A — not wallet.balance credits).
 *
 * Mirrors delivery wallet self-heal, but repairs `food_transactions`:
 * 1. Ensure zero-balance wallet row exists
 * 2. Mark delivered-order txs as `captured` if still pending/authorized
 * 3. Realize missed Quick Restaurant Share into restaurantShare
 *
 * Never calls creditWallet for restaurant order earnings.
 */
export async function selfHealRestaurantFinanceLedger(restaurantId) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        return { healedCapture: 0, healedQuickShare: 0 };
    }

    const rid = new mongoose.Types.ObjectId(String(restaurantId));
    let healedCapture = 0;
    let healedQuickShare = 0;

    try {
        await ensureRestaurantWallet(rid);

        const candidates = await FoodTransaction.find({
            restaurantId: rid,
            $or: [
                { status: { $in: ['pending', 'authorized'] } },
                { 'amounts.quickRestaurantShareRealized': { $ne: true } },
            ],
        })
            .populate('orderId', 'orderStatus deliveryState pricing.quickRestaurantShare orderId')
            .select('orderId status amounts.quickRestaurantShareRealized amounts.quickRestaurantShare')
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();

        for (const tx of candidates) {
            const order = tx.orderId;
            if (!isDeliveredOrderForPayout(order)) continue;

            const status = String(tx.status || '').trim().toLowerCase();
            if (status === 'pending' || status === 'authorized') {
                const captured = await FoodTransaction.updateOne(
                    {
                        _id: tx._id,
                        status: { $in: ['pending', 'authorized'] },
                    },
                    {
                        $set: { status: 'captured' },
                        $push: {
                            history: {
                                kind: 'payment_snapshot_sync',
                                at: new Date(),
                                note: 'Self-heal: delivered order transaction marked captured',
                            },
                        },
                    }
                );
                if (captured.modifiedCount > 0) {
                    healedCapture += 1;
                    logger.info(
                        `[RestaurantFinance] Self-healed capture for tx ${tx._id} restaurant ${rid}`
                    );
                }
            }

            const share =
                Math.round(
                    (Number(
                        order?.pricing?.quickRestaurantShare ??
                            tx.amounts?.quickRestaurantShare ??
                            0
                    ) || 0) * 100
                ) / 100;

            if (!(share > 0) || tx.amounts?.quickRestaurantShareRealized === true) {
                continue;
            }

            try {
                const updated = await realizeFoodQuickRestaurantShare({
                    _id: order?._id || tx.orderId,
                    pricing: {
                        quickRestaurantShare: share,
                    },
                    amounts: {
                        quickRestaurantShare: share,
                    },
                });
                if (updated) {
                    healedQuickShare += 1;
                    logger.info(
                        `[RestaurantFinance] Self-healed Quick Share ₹${share} for order ${order?.orderId || order?._id}`
                    );
                }
            } catch (err) {
                logger.warn(
                    `[RestaurantFinance] Quick Share self-heal failed for ${tx._id}: ${err?.message || err}`
                );
            }
        }
    } catch (err) {
        logger.error(
            `[RestaurantFinance] Self-heal failed for restaurant ${restaurantId}: ${err?.message || err}`
        );
    }

    return { healedCapture, healedQuickShare };
}

/**
 * Available withdrawal balance for a restaurant.
 * Computed from `food_transactions` (delivered + captured, unsettled share) plus
 * wallet `referralEarnings`, minus pending withdrawals — not from wallet.balance.
 * Pass `session` so create-withdrawal can evaluate balance inside the same txn.
 */
export async function getRestaurantAvailableWithdrawalBalance(
    restaurantId,
    { session = null, skipSelfHeal = false } = {}
) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
        return { availableBalance: 0, globalEstimatedPayout: 0, referralBalance: 0, totalPendingWithdrawals: 0 };
    }

    // Self-heal outside Mongo sessions (withdrawal txn must not nest heal writes).
    if (!session && !skipSelfHeal) {
        await selfHealRestaurantFinanceLedger(restaurantId);
    }

    const rid = new mongoose.Types.ObjectId(restaurantId);

    let unsettledQuery = FoodTransaction.find({
        restaurantId: rid,
        status: { $in: ['captured'] },
        'settlement.isRestaurantSettled': { $ne: true },
    })
        .populate('orderId', 'orderStatus deliveryState')
        .select('amounts.restaurantShare settlement.restaurantSettledAmount orderId')
        .lean();
    if (session) unsettledQuery = unsettledQuery.session(session);

    let walletQuery = FoodRestaurantWallet.findOne({ restaurantId: rid })
        .select('referralEarnings')
        .lean();
    if (session) walletQuery = walletQuery.session(session);

    const pendingAgg = FoodRestaurantWithdrawal.aggregate(
        [
            {
                $match: {
                    restaurantId: rid,
                    $expr: {
                        $in: [
                            { $toLower: { $trim: { input: '$status' } } },
                            ['pending', 'processing'],
                        ],
                    },
                },
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ],
        session ? { session } : undefined
    );

    const [allUnsettledTransactionsRaw, wallet, pendingWithdrawalsAgg] =
        await Promise.all([unsettledQuery, walletQuery, pendingAgg]);

    const allUnsettledTransactions = allUnsettledTransactionsRaw.filter((tx) =>
        isDeliveredOrderForPayout(tx.orderId)
    );

    const globalEstimatedPayout = allUnsettledTransactions.reduce((sum, tx) => {
        const share = Number(tx.amounts?.restaurantShare) || 0;
        const settled = Number(tx.settlement?.restaurantSettledAmount) || 0;
        return sum + Math.max(0, share - settled);
    }, 0);

    const referralBalance = Number(wallet?.referralEarnings || 0);
    const totalPendingWithdrawals = Number(pendingWithdrawalsAgg?.[0]?.total || 0);
    const availableBalance = Math.max(
        0,
        globalEstimatedPayout + referralBalance - totalPendingWithdrawals
    );

    return {
        availableBalance,
        globalEstimatedPayout,
        referralBalance,
        totalPendingWithdrawals,
    };
}

/**
 * Lifetime restaurant order earnings from `food_transactions` (delivered + captured).
 * Does not read `food_restaurant_wallets.balance` / `totalEarnings`.
 */
export async function getRestaurantLifetimeOrderEarnings(
    restaurantId,
    { session = null } = {}
) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
        return 0;
    }
    const rid = new mongoose.Types.ObjectId(restaurantId);

    let query = FoodTransaction.find({
        restaurantId: rid,
        status: { $in: ['captured'] },
    })
        .populate('orderId', 'orderStatus deliveryState')
        .select('amounts.restaurantShare orderId')
        .lean();
    if (session) query = query.session(session);

    const txs = await query;
    const total = txs
        .filter((tx) => isDeliveredOrderForPayout(tx.orderId))
        .reduce((sum, tx) => sum + (Number(tx.amounts?.restaurantShare) || 0), 0);

    return Math.round(total * 100) / 100;
}

function mapTransactionToCycleOrder(tx) {
    const order = tx.orderId || {};
    const items = Array.isArray(order.items) ? order.items : [];
    const foodNames = items.map((it) => it?.name).filter(Boolean).join(', ');
    const itemQuantities = items
        .map((it) => Number(it?.quantity) || 1)
        .join(', ');
    const totalQty = items.reduce((sum, it) => sum + (Number(it?.quantity) || 1), 0);
    const orderTotalExclTax = Math.max(
        0,
        Number(order?.pricing?.total ?? 0) - Number(order?.pricing?.tax ?? 0) || 0
    );
    /**
     * Restaurant-owned gross: item subtotal + packaging only.
     * Delivery/platform fees are platform revenue and must never appear here,
     * so this stays equal to restaurantShare + restaurantCommission.
     */
    const restaurantGross = Math.max(
        0,
        Number(order?.pricing?.subtotal ?? 0) + Number(order?.pricing?.packagingFee ?? 0)
    );
    const restaurantShare = Number(tx.amounts?.restaurantShare) || 0;
    const customerPaid = Number(tx.amounts?.totalCustomerPaid) || 0;
    const commission =
        Number(tx.amounts?.restaurantCommission) ||
        Number(tx.pricing?.restaurantCommission) ||
        Math.max(0, customerPaid - restaurantShare) ||
        0;
    return {
        orderId: order?.orderId || tx.orderReadableId,
        createdAt: order?.createdAt || tx.createdAt,
        deliveredAt: order?.deliveryState?.deliveredAt || null,
        items,
        foodNames,
        itemQuantities,
        totalQty,
        /** Full customer order value excl. tax (includes delivery + platform fees) */
        orderTotal: orderTotalExclTax,
        /** Restaurant gross = item subtotal + packaging (excludes platform/delivery fees) */
        restaurantGross,
        /** What the customer paid (incl. tax / fees when present on ledger) */
        totalAmount: customerPaid,
        /** Restaurant earning / share — correct payout field */
        payout: restaurantShare,
        restaurantEarning: restaurantShare,
        commission,
        paymentMethod: tx.paymentMethod || order?.payment?.method || 'N/A',
        orderStatus: order?.orderStatus || order?.deliveryState?.currentPhase || order?.deliveryState?.status || 'N/A',
        status: tx.status
    };
}

export async function getRestaurantFinance(restaurantId, query = {}) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) return null;
    const rid = new mongoose.Types.ObjectId(restaurantId);

    // Repair missed capture / Quick Share before reading Hub balances.
    await selfHealRestaurantFinanceLedger(restaurantId);

    // Fetch restaurant profile for header display.
    const restaurant = await FoodRestaurant.findById(rid)
        .select('restaurantId restaurantName addressLine1 addressLine2 area city state pincode location')
        .lean();

    const address =
        restaurant?.location?.formattedAddress ||
        (restaurant?.addressLine1
            ? [restaurant.addressLine1, restaurant.addressLine2, restaurant.area].filter(Boolean).join(', ')
            : restaurant?.addressLine1 || '');

    const nowWindow = getFixedCurrentCycleWindow(new Date());

    // Current cycle: sum ledger payouts in the fixed window (delivered orders only).
    const currentTransactionsRaw = await FoodTransaction.find({
        restaurantId: rid,
        status: { $in: ['captured'] },
        createdAt: { $gte: nowWindow.start, $lte: nowWindow.end }
    })
        .populate('orderId', 'orderId createdAt items pricing deliveryState orderStatus payment')
        .sort({ createdAt: -1 })
        .lean();

    const currentTransactions = currentTransactionsRaw.filter((tx) =>
        isDeliveredOrderForPayout(tx.orderId)
    );

    const currentCycleOrders = currentTransactions.map(mapTransactionToCycleOrder);

    const currentCycleEstimatedPayout = currentCycleOrders.reduce(
        (sum, o) => sum + (Number(o.payout) || 0),
        0
    );

    // Global estimated payout: unsettled + delivered only (excludes cancelled / in-progress).
    // Lifetime order earnings from food_transactions (not wallet.totalEarnings).
    const [
        {
            availableBalance,
            globalEstimatedPayout,
            referralBalance,
            totalPendingWithdrawals,
        },
        totalOrderEarnings,
        wallet,
    ] = await Promise.all([
        getRestaurantAvailableWithdrawalBalance(restaurantId, { skipSelfHeal: true }),
        getRestaurantLifetimeOrderEarnings(restaurantId),
        FoodRestaurantWallet.findOne({ restaurantId: rid })
            .select('balance referralEarnings totalEarnings')
            .lean(),
    ]);

    const referralLifetimeEarnings = Number(wallet?.totalEarnings || 0);
    const totalEarnings =
        Math.round((totalOrderEarnings + referralLifetimeEarnings) * 100) / 100;

    const currentCycle = {
        start: { ...nowWindow.startMeta },
        end: { ...nowWindow.endMeta },
        /** Cycle-scoped order payout (not lifetime — see earnings.totalEarnings) */
        totalEarnings: currentCycleEstimatedPayout,
        totalWithdrawn: totalPendingWithdrawals,
        estimatedPayout: availableBalance, // This is what UI shows as "Estimated Payout" (Available Balance)
        totalOrders: currentCycleOrders.length,
        payoutDate: null,
        orders: currentCycleOrders
    };

    // Invoice Summary (derived from current cycle or broader if needed)
    const invoiceSummary = {
        count: currentCycleOrders.length,
        subtotal: currentCycleOrders.reduce((sum, o) => sum + (Number(o.orderTotal) || 0), 0),
        taxes: currentCycleOrders.reduce((sum, o) => sum + Math.max(0, (Number(o.totalAmount) || 0) - (Number(o.orderTotal) || 0)), 0),
        gross: currentCycleOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)
    };

    // Past cycles: build from provided startDate/endDate query.
    const startDate = parseISODateParam(query.startDate);
    const endDate = parseISODateParamEnd(query.endDate);

    let pastCyclesResult = { orders: [], totalOrders: 0 };
    if (startDate && endDate) {
        const pastTransactionsRaw = await FoodTransaction.find({
            restaurantId: rid,
            status: { $in: ['captured'] },
            createdAt: { $gte: startDate, $lte: endDate }
        })
            .populate('orderId', 'orderId createdAt items pricing deliveryState orderStatus payment')
            .sort({ createdAt: -1 })
            .lean();

        const pastCycleOrders = pastTransactionsRaw
            .filter((tx) => isDeliveredOrderForPayout(tx.orderId))
            .map(mapTransactionToCycleOrder);

        pastCyclesResult = {
            orders: pastCycleOrders,
            totalOrders: pastCycleOrders.length
        };
    }

    const limitSettings = await getRestaurantWithdrawalLimitSettings();
    const restaurantMinWithdrawalLimit = Number(limitSettings.restaurantMinWithdrawalLimit) || 1;
    const restaurantMaxWithdrawalLimit =
        limitSettings.restaurantMaxWithdrawalLimit != null &&
        Number(limitSettings.restaurantMaxWithdrawalLimit) > 0
            ? Number(limitSettings.restaurantMaxWithdrawalLimit)
            : null;

    return {
        restaurant: {
            name: restaurant?.restaurantName || '',
            restaurantId: restaurant?.restaurantId || (restaurant?._id ? `REST${restaurant._id.toString().slice(-6).padStart(6, '0')}` : 'N/A'),
            address
        },
        earnings: {
            availableBalance: availableBalance,
            pendingPayout: globalEstimatedPayout,
            referralEarnings: referralBalance,
            /** Lifetime delivered order share from food_transactions */
            totalOrderEarnings,
            /**
             * Lifetime total = order ledger + referral credits on wallet.
             * Not wallet.totalEarnings alone (that field excludes order share).
             */
            totalEarnings,
            /** Dual-ledger snapshot — referral/subscription wallet only */
            walletLedger: {
                balance: Number(wallet?.balance || 0),
                referralEarnings: Number(wallet?.referralEarnings || 0),
                totalEarnings: referralLifetimeEarnings,
            },
        },
        withdrawalLimits: {
            min: restaurantMinWithdrawalLimit,
            max: restaurantMaxWithdrawalLimit
        },
        currentCycle,
        invoiceSummary,
        pastCycles: pastCyclesResult
    };
}

export async function getRestaurantSubscriptionWallet(restaurantId) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) return null;
    const rid = new mongoose.Types.ObjectId(restaurantId);

    await ensureRestaurantWallet(rid);

    const todayIST = dayjs().tz(IST_TIMEZONE).format('YYYY-MM-DD');
    const [wallet, activePass, recentLedger] = await Promise.all([
        FoodRestaurantWallet.findOne({ restaurantId: rid })
            .select('subscriptionBalance')
            .lean(),
        FoodDailyPass.findOne({ 
            userId: rid, 
            userType: 'RESTAURANT', 
            date: todayIST,
            expiresAt: { $gt: new Date() }
        }).lean(),
        FoodWalletLedger.find({ 
            ownerId: String(rid), 
            ownerType: 'RESTAURANT' 
        })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean()
    ]);

    const subscriptionBalance = Number(wallet?.subscriptionBalance || 0);
    const minBalance = 1000;
    const requiredTopup = Math.max(0, minBalance - subscriptionBalance);

    return {
        subscriptionBalance,
        minBalance,
        requiredTopup,
        topupRequired: requiredTopup > 0,
        activePass: activePass ? {
            id: activePass._id,
            date: activePass.date,
            expiresAt: activePass.expiresAt,
            amountDeducted: activePass.amountDeducted
        } : null,
        ledger: recentLedger.map(l => ({
            id: l._id,
            type: l.type,
            amount: l.amount,
            beforeBalance: l.beforeBalance,
            afterBalance: l.afterBalance,
            createdAt: l.createdAt,
            referenceId: l.referenceId
        }))
    };
}


