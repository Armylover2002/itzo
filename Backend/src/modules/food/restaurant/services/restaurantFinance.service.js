import mongoose from 'mongoose';
import { FoodOrder } from '../../orders/models/order.model.js';
import { FoodTransaction } from '../../orders/models/foodTransaction.model.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { FoodRestaurantWallet } from '../models/restaurantWallet.model.js';
import { FoodRestaurantWithdrawal } from '../models/foodRestaurantWithdrawal.model.js';
import { FoodDailyPass } from '../../subscriptions/models/foodDailyPass.model.js';
import { FoodWalletLedger } from '../../subscriptions/models/foodWalletLedger.model.js';
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

export async function getRestaurantFinance(restaurantId, query = {}) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) return null;
    const rid = new mongoose.Types.ObjectId(restaurantId);

    // Fetch restaurant profile for header display.
    const restaurant = await FoodRestaurant.findById(rid)
        .select('restaurantName addressLine1 addressLine2 area city state pincode location')
        .lean();

    const address =
        restaurant?.location?.formattedAddress ||
        (restaurant?.addressLine1
            ? [restaurant.addressLine1, restaurant.addressLine2, restaurant.area].filter(Boolean).join(', ')
            : restaurant?.addressLine1 || '');

    const nowWindow = getFixedCurrentCycleWindow(new Date());

    // Current cycle: sum ledger payouts in the fixed window.
    const currentTransactions = await FoodTransaction.find({
        restaurantId: rid,
        status: { $in: ['captured', 'authorized'] },
        createdAt: { $gte: nowWindow.start, $lte: nowWindow.end }
    })
        .populate('orderId', 'orderId createdAt items pricing deliveryState orderStatus')
        .sort({ createdAt: -1 })
        .lean();

    const currentCycleOrders = currentTransactions.map((tx) => {
        const order = tx.orderId || {};
        const items = Array.isArray(order.items) ? order.items : [];
        const foodNames = items.map((it) => it?.name).filter(Boolean).join(', ');
        const orderTotalExclTax = Math.max(
            0,
            Number(order?.pricing?.total ?? 0) - Number(order?.pricing?.tax ?? 0) || 0
        );
        return {
            orderId: order?.orderId || tx.orderReadableId,
            createdAt: tx.createdAt,
            items,
            foodNames,
            orderTotal: orderTotalExclTax,
            totalAmount: tx.amounts?.totalCustomerPaid || 0,
            payout: tx.amounts?.restaurantShare || 0,
            commission: 0,
            paymentMethod: tx.paymentMethod || order?.payment?.method,
            orderStatus: order?.orderStatus || order?.deliveryState?.currentPhase || order?.deliveryState?.status,
            status: tx.status
        };
    });

    const currentCycleEstimatedPayout = currentCycleOrders.reduce(
        (sum, o) => sum + (Number(o.payout) || 0),
        0
    );

    // Calculate global estimated payout (all unsettled transactions)
    const allUnsettledTransactions = await FoodTransaction.find({
        restaurantId: rid,
        status: { $in: ['captured', 'authorized'] },
        'settlement.isRestaurantSettled': { $ne: true }
    }).select('amounts.restaurantShare').lean();

    const globalEstimatedPayout = allUnsettledTransactions.reduce(
        (sum, tx) => sum + (Number(tx.amounts?.restaurantShare) || 0),
        0
    );

    // Fetch referral earnings from wallet for withdrawal eligibility
    const wallet = await FoodRestaurantWallet.findOne({ restaurantId: rid })
        .select('balance referralEarnings totalEarnings')
        .lean();

    const referralBalance = Number(wallet?.referralEarnings || 0);
    // FoodRestaurantWallet.balance is the universal wallet ledger's balance —
    // currently populated exclusively by Dining bill payouts (creditWallet in
    // diningBill.service.js). Order-based earnings are tracked separately via
    // FoodTransaction.amounts.restaurantShare above, so this never double-counts.
    const diningBalance = Number(wallet?.balance || 0);

    // Block only pending withdrawals from available balance.
    // Approved/rejected requests are processed records and should not keep locking payout.
    const pendingWithdrawalsAgg = await FoodRestaurantWithdrawal.aggregate([
        {
            $match: {
                restaurantId: rid,
                $expr: {
                    $eq: [{ $toLower: { $trim: { input: '$status' } } }, 'pending']
                }
            }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalPendingWithdrawals = Number(pendingWithdrawalsAgg?.[0]?.total || 0);
    const availableBalance = Math.max(0, globalEstimatedPayout + referralBalance + diningBalance - totalPendingWithdrawals);

    const currentCycle = {
        start: { ...nowWindow.startMeta },
        end: { ...nowWindow.endMeta },
        totalEarnings: currentCycleEstimatedPayout, // We still show current cycle earnings label
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
        const pastTransactions = await FoodTransaction.find({
            restaurantId: rid,
            status: { $in: ['captured', 'authorized'] },
            createdAt: { $gte: startDate, $lte: endDate }
        })
            .populate('orderId', 'orderId createdAt items pricing deliveryState orderStatus')
            .sort({ createdAt: -1 })
            .lean();

        const pastCycleOrders = pastTransactions.map((tx) => {
            const order = tx.orderId || {};
            const items = Array.isArray(order.items) ? order.items : [];
            const foodNames = items.map((it) => it?.name).filter(Boolean).join(', ');
            const orderTotalExclTax = Math.max(
                0,
                Number(order?.pricing?.total ?? 0) - Number(order?.pricing?.tax ?? 0) || 0
            );

            return {
                orderId: order?.orderId || tx.orderReadableId,
                createdAt: tx.createdAt,
                items,
                foodNames,
                orderTotal: orderTotalExclTax,
                totalAmount: tx.amounts?.totalCustomerPaid || 0,
                payout: tx.amounts?.restaurantShare || 0,
                commission: 0,
                paymentMethod: tx.paymentMethod || order?.payment?.method,
                orderStatus: order?.orderStatus || order?.deliveryState?.currentPhase || order?.deliveryState?.status,
                status: tx.status
            };
        });

        pastCyclesResult = {
            orders: pastCycleOrders,
            totalOrders: pastCycleOrders.length
        };
    }

    return {
        restaurant: {
            name: restaurant?.restaurantName || '',
            restaurantId: restaurant?._id ? `REST${restaurant._id.toString().slice(-6).padStart(6, '0')}` : 'N/A',
            address
        },
        earnings: {
            availableBalance: availableBalance,
            pendingPayout: globalEstimatedPayout,
            referralEarnings: referralBalance,
            diningEarnings: diningBalance,
            totalEarnings: Number(wallet?.totalEarnings || 0)
        },
        currentCycle,
        invoiceSummary,
        pastCycles: pastCyclesResult
    };
}

export async function getRestaurantSubscriptionWallet(restaurantId) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) return null;
    const rid = new mongoose.Types.ObjectId(restaurantId);

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

    return {
        subscriptionBalance: Number(wallet?.subscriptionBalance || 0),
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


