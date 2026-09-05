import mongoose from 'mongoose';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { FoodOrder } from '../../orders/models/order.model.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { FoodAddon } from '../models/foodAddon.model.js';
import { FoodSupportTicket } from '../../user/models/supportTicket.model.js';
import { FoodRestaurantWallet } from '../models/restaurantWallet.model.js';
import { getRestaurantFinance } from './restaurantFinance.service.js';

const CANCELLED_ORDER_STATUSES = [
    'cancelled_by_user',
    'cancelled_by_restaurant',
    'cancelled_by_admin',
    'cancelled'
];

const PENDING_ORDER_STATUSES = ['placed', 'created', 'scheduled'];

const PROCESSING_ORDER_STATUSES = [
    'confirmed',
    'preparing',
    'ready_for_pickup',
    'picked_up'
];

/**
 * Convert period string to start & end Date objects in IST
 */
function getDateRangeByPeriod(periodRaw) {
    const period = String(periodRaw || 'month').trim().toLowerCase();
    if (!period || period === 'overall' || period === 'all') return null;

    const now = new Date();

    if (period === 'today') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    if (period === 'week') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - 6);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    if (period === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { start, end };
    }

    if (period === 'year') {
        const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        return { start, end };
    }

    return null;
}

export async function getRestaurantDashboardStats(restaurantId, query = {}) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new Error('Invalid restaurant id');
    }

    const rid = new mongoose.Types.ObjectId(String(restaurantId));
    const period = String(query.period || 'month').trim().toLowerCase();
    const periodRange = getDateRangeByPeriod(period);

    // Filter for orders in the selected period
    const orderMatch = {
        restaurantId: rid,
        $or: [
            { 'payment.method': { $in: ['cash', 'wallet'] } },
            { 'payment.status': { $in: ['paid', 'authorized', 'captured', 'settled', 'refunded', 'cod_pending'] } },
            { payment: { $exists: false } }
        ]
    };
    if (periodRange) {
        orderMatch.createdAt = { $gte: periodRange.start, $lte: periodRange.end };
    }

    // Today filter (independent of selected period)
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const todayMatch = {
        restaurantId: rid,
        createdAt: { $gte: startOfToday, $lte: endOfToday },
        $or: [
            { 'payment.method': { $in: ['cash', 'wallet'] } },
            { 'payment.status': { $in: ['paid', 'authorized', 'captured', 'settled', 'refunded', 'cod_pending'] } },
            { payment: { $exists: false } }
        ]
    };

    // Parallel aggregate queries for speed and efficiency
    const [
        periodAggResult,
        todayOrdersCount,
        activePendingCount,
        activeProcessingCount,
        restaurantDoc,
        menuItemsTotal,
        activeMenuItemsTotal,
        addonsTotal,
        complaintsCount,
        recentOrdersRaw,
        topItemsAgg,
        trendAgg,
        monthlyAgg
    ] = await Promise.all([
        // 1. Period totals aggregation
        FoodOrder.aggregate([
            { $match: orderMatch },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    deliveredOrders: {
                        $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] }
                    },
                    cancelledOrders: {
                        $sum: { $cond: [{ $in: ['$orderStatus', CANCELLED_ORDER_STATUSES] }, 1, 0] }
                    },
                    pendingOrders: {
                        $sum: { $cond: [{ $in: ['$orderStatus', PENDING_ORDER_STATUSES] }, 1, 0] }
                    },
                    processingOrders: {
                        $sum: { $cond: [{ $in: ['$orderStatus', PROCESSING_ORDER_STATUSES] }, 1, 0] }
                    },
                    totalRevenue: {
                        $sum: {
                            $cond: [{ $eq: ['$orderStatus', 'delivered'] }, { $ifNull: ['$pricing.total', 0] }, 0]
                        }
                    }
                }
            }
        ]),

        // 2. Orders placed today
        FoodOrder.countDocuments(todayMatch),

        // 3. Active queue: pending orders
        FoodOrder.countDocuments({
            restaurantId: rid,
            orderStatus: { $in: PENDING_ORDER_STATUSES }
        }),

        // 4. Active queue: processing orders
        FoodOrder.countDocuments({
            restaurantId: rid,
            orderStatus: { $in: PROCESSING_ORDER_STATUSES }
        }),

        // 5. Restaurant profile doc
        FoodRestaurant.findById(rid)
            .select('restaurantName isAcceptingOrders rating totalRatings profileImage')
            .lean(),

        // 6. Menu items count
        FoodItem.countDocuments({ restaurantId: rid }),

        // 7. Active menu items count
        FoodItem.countDocuments({
            restaurantId: rid,
            isAvailable: { $ne: false },
            approvalStatus: 'approved'
        }),

        // 8. Add-ons count
        FoodAddon.countDocuments({
            restaurantId: rid,
            isDeleted: { $ne: true }
        }),

        // 9. Open complaints count
        FoodSupportTicket.countDocuments({
            restaurantId: rid,
            status: { $in: ['open', 'in-progress'] }
        }).catch(() => 0),

        // 10. Recent 10 orders
        FoodOrder.find({
            restaurantId: rid,
            $or: [
                { 'payment.method': { $in: ['cash', 'wallet'] } },
                { 'payment.status': { $in: ['paid', 'authorized', 'captured', 'settled', 'refunded', 'cod_pending'] } },
                { payment: { $exists: false } }
            ]
        })
            .sort({ createdAt: -1 })
            .limit(10)
            .select('orderId createdAt pricing orderStatus items')
            .lean(),

        // 11. Top dishes in period
        FoodOrder.aggregate([
            {
                $match: {
                    ...orderMatch,
                    orderStatus: { $in: ['delivered', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up'] }
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: { $toLower: { $trim: { input: '$items.name' } } },
                    name: { $first: '$items.name' },
                    orders: { $sum: '$items.quantity' },
                    revenue: {
                        $sum: {
                            $multiply: [
                                { $ifNull: ['$items.price', 0] },
                                { $ifNull: ['$items.quantity', 1] }
                            ]
                        }
                    }
                }
            },
            { $sort: { orders: -1, revenue: -1 } },
            { $limit: 5 }
        ]),

        // 12. 14-day daily trend for the revenue & orders area chart
        FoodOrder.aggregate([
            {
                $match: {
                    restaurantId: rid,
                    createdAt: {
                        $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
                        $lte: now
                    },
                    $or: [
                        { 'payment.method': { $in: ['cash', 'wallet'] } },
                        { 'payment.status': { $in: ['paid', 'authorized', 'captured', 'settled', 'refunded', 'cod_pending'] } },
                        { payment: { $exists: false } }
                    ]
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' }
                    },
                    revenue: {
                        $sum: {
                            $cond: [{ $eq: ['$orderStatus', 'delivered'] }, { $ifNull: ['$pricing.total', 0] }, 0]
                        }
                    },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]),

        // 13. Monthly trend for current year
        FoodOrder.aggregate([
            {
                $match: {
                    restaurantId: rid,
                    createdAt: {
                        $gte: new Date(new Date().getFullYear(), 0, 1),
                        $lte: now
                    },
                    $or: [
                        { 'payment.method': { $in: ['cash', 'wallet'] } },
                        { 'payment.status': { $in: ['paid', 'authorized', 'captured', 'settled', 'refunded', 'cod_pending'] } },
                        { payment: { $exists: false } }
                    ]
                }
            },
            {
                $group: {
                    _id: {
                        month: { $month: { date: '$createdAt', timezone: 'Asia/Kolkata' } }
                    },
                    revenue: {
                        $sum: {
                            $cond: [{ $eq: ['$orderStatus', 'delivered'] }, { $ifNull: ['$pricing.total', 0] }, 0]
                        }
                    },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { '_id.month': 1 } }
        ])
    ]);

    // Financial balance & cycle earnings
    let availableBalance = 0;
    let cycleEarnings = 0;
    try {
        const financeData = await getRestaurantFinance(restaurantId);
        if (financeData?.currentCycle) {
            cycleEarnings = Math.round(Number(financeData.currentCycle.totalEarnings || 0));
            availableBalance = Math.round(Number(financeData.currentCycle.estimatedPayout || 0));
        }
        const walletDoc = await FoodRestaurantWallet.findOne({ restaurantId: rid }).lean();
        if (walletDoc && Number(walletDoc.balance || 0) > availableBalance) {
            availableBalance = Math.round(Number(walletDoc.balance));
        }
    } catch {
        // Fallback gracefully if finance calculations encounter any issues
    }

    // Process period totals
    const pAgg = periodAggResult?.[0] || {};
    const totalOrders = Number(pAgg.totalOrders || 0);
    const deliveredOrders = Number(pAgg.deliveredOrders || 0);
    const cancelledOrders = Number(pAgg.cancelledOrders || 0);
    const totalRevenue = Math.round(Number(pAgg.totalRevenue || 0));

    const completionRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;
    const cancellationRate = totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0;
    const averageOrderValue = deliveredOrders > 0 ? Math.round(totalRevenue / deliveredOrders) : 0;

    // Monthly trend formatted
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrendMap = new Map((monthlyAgg || []).map((m) => [m._id.month, m]));
    const monthlyTrend = monthNames.map((mName, idx) => {
        const mNum = idx + 1;
        const entry = monthlyTrendMap.get(mNum);
        return {
            date: mName,
            month: mName,
            revenue: Math.round(Number(entry?.revenue || 0)),
            orders: Number(entry?.orders || 0)
        };
    });

    // 14-day / 30-day daily trend for week / month periods
    const trendMap = new Map((trendAgg || []).map((t) => [t._id, t]));
    const dailyTrend = [];
    for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
        const label = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
        const existing = trendMap.get(dateStr);
        dailyTrend.push({
            date: label,
            revenue: Math.round(Number(existing?.revenue || 0)),
            orders: Number(existing?.orders || 0)
        });
    }

    // If period is overall or year, chart displays monthly progress; otherwise daily trend
    const revenueTrend = (period === 'overall' || period === 'year') ? monthlyTrend : dailyTrend;

    // Order status breakdown for Donut chart
    const statusCounts = {
        delivered: deliveredOrders,
        processing: Number(pAgg.processingOrders || 0),
        pending: Number(pAgg.pendingOrders || 0),
        cancelled: cancelledOrders
    };

    const orderStatusBreakdown = [
        { label: 'Delivered', value: statusCounts.delivered, color: '#10b981' },
        { label: 'Processing', value: statusCounts.processing, color: '#3b82f6' },
        { label: 'Pending', value: statusCounts.pending, color: '#f59e0b' },
        { label: 'Cancelled', value: statusCounts.cancelled, color: '#ef4444' }
    ].filter((item) => item.value > 0);

    // Top selling items
    const topItems = (topItemsAgg || []).map((it) => ({
        name: it.name || 'Special Dish',
        orders: Number(it.orders || 0),
        revenue: Math.round(Number(it.revenue || 0))
    }));

    // Recent orders formatted
    const recentOrders = (recentOrdersRaw || []).map((o) => ({
        orderId: o.orderId,
        createdAt: o.createdAt,
        total: Math.round(Number(o.pricing?.total || 0)),
        status: o.orderStatus || 'created'
    }));

    return {
        restaurant: {
            id: restaurantDoc?._id ? String(restaurantDoc._id) : String(restaurantId),
            name: restaurantDoc?.restaurantName || 'Dashboard',
            isOnline: restaurantDoc?.isAcceptingOrders !== false,
            rating: Number(restaurantDoc?.rating || 0),
            totalRatings: Number(restaurantDoc?.totalRatings || 0)
        },
        kpis: {
            totalRevenue,
            deliveredOrders,
            todayOrders: Number(todayOrdersCount || 0),
            pendingOrders: Number(activePendingCount || 0),
            processingOrders: Number(activeProcessingCount || 0),
            availableBalance,
            cycleEarnings,
            averageRating: Number(restaurantDoc?.rating || 0),
            totalRatings: Number(restaurantDoc?.totalRatings || 0),
            totalOrders,
            completionRate,
            averageOrderValue,
            menuItems: Number(menuItemsTotal || 0),
            activeMenuItems: Number(activeMenuItemsTotal || 0),
            addons: Number(addonsTotal || 0),
            cancelledOrders,
            cancellationRate,
            complaints: Number(complaintsCount || 0)
        },
        revenueTrend,
        orderStatusBreakdown,
        monthlyTrend,
        topItems,
        recentOrders
    };
}
