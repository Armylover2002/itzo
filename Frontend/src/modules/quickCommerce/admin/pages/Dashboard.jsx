import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import PageHeader from '@shared/components/ui/PageHeader';
import StatCard from '@shared/components/ui/StatCard';
import Badge from '@shared/components/ui/Badge';
import { adminApi } from '../services/adminApi';
import {
    Users,
    Store,
    Truck,
    BarChart3,
    Activity,
    Database,
    RotateCw,
    Loader2
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [statsData, setStatsData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await adminApi.getStats();
                if (res.data.success) {
                    setStatsData(res.data.result);
                }
            } catch (error) {
                console.error("Dashboard Stats Error:", error);
                toast.error("Failed to fetch dashboard data");
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="h-[80vh] flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Synchronizing Data...</p>
            </div>
        );
    }

    const overview = statsData?.overview || {};
    const chartData = statsData?.revenueHistory || [];

    // Calculate dynamic growth percentages
    const calcGrowth = (current, previous) => {
        if (!previous || previous === 0) return current > 0 ? '+100%' : '0%';
        const pct = ((current - previous) / previous) * 100;
        return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    };

    // Use last 2 months of revenue history for revenue growth
    const currentMonthRevenue = chartData.length >= 1 ? (chartData[chartData.length - 1]?.revenue || 0) : 0;
    const prevMonthRevenue = chartData.length >= 2 ? (chartData[chartData.length - 2]?.revenue || 0) : 0;
    const revenueGrowth = calcGrowth(currentMonthRevenue, prevMonthRevenue);

    // For other metrics, use overview growth fields if available, else compute from revenueHistory trend
    const usersGrowth = overview.usersGrowth || overview.usersTrend || calcGrowth(overview.totalUsers, overview.prevTotalUsers) || '+0%';
    const sellersGrowth = overview.sellersGrowth || overview.sellersTrend || calcGrowth(overview.activeSellers, overview.prevActiveSellers) || '+0%';
    const ordersGrowth = overview.ordersGrowth || overview.ordersTrend || calcGrowth(overview.totalOrders, overview.prevTotalOrders) || '+0%';

    const stats = [
        {
            label: 'Total Users',
            value: overview.totalUsers?.toLocaleString() || '0',
            icon: Users,
            color: 'text-orange-600',
            bg: 'bg-orange-50',
            trend: usersGrowth,
            description: 'Active this month'
        },
        {
            label: 'Active Sellers',
            value: overview.activeSellers?.toLocaleString() || '0',
            icon: Store,
            color: 'text-orange-600',
            bg: 'bg-orange-50',
            trend: sellersGrowth,
            description: 'Verified stores'
        },
        {
            label: 'Total Orders',
            value: overview.totalOrders?.toLocaleString() || '0',
            icon: Truck,
            color: 'text-orange-600',
            bg: 'bg-orange-50',
            trend: ordersGrowth,
            description: 'Last 30 days'
        },
        {
            label: 'Revenue',
            value: `₹${overview.totalRevenue?.toLocaleString() || '0'}`,
            icon: BarChart3,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            trend: revenueGrowth,
            description: 'Net earnings'
        },
    ];

    const categoryData = statsData?.categoryData || [];
    const recentOrders = statsData?.recentOrders || [];
    const topProducts = statsData?.topProducts || [];

    const handleDownloadReport = () => {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-IN');
        const timeStr = now.toLocaleTimeString('en-IN');

        const rows = [];

        // Header
        rows.push(['QUICK COMMERCE DASHBOARD REPORT']);
        rows.push([`Generated on: ${dateStr} ${timeStr}`]);
        rows.push([]);

        // Overview Stats
        rows.push(['OVERVIEW']);
        rows.push(['Metric', 'Value']);
        rows.push(['Total Users', overview.totalUsers || 0]);
        rows.push(['Active Sellers', overview.activeSellers || 0]);
        rows.push(['Total Orders', overview.totalOrders || 0]);
        rows.push(['Total Revenue (₹)', overview.totalRevenue || 0]);
        rows.push([]);

        // Recent Orders
        if (recentOrders.length > 0) {
            rows.push(['RECENT ORDERS']);
            rows.push(['Order ID', 'Customer', 'Status', 'Amount (₹)', 'Time']);
            recentOrders.forEach((order) => {
                rows.push([
                    order.orderId || order.id || '',
                    order.customer || order.customerName || 'Guest',
                    order.status || '',
                    order.amount || order.total || 0,
                    order.time || order.createdAt || '',
                ]);
            });
            rows.push([]);
        }

        // Revenue History
        if (chartData.length > 0) {
            rows.push(['MONTHLY REVENUE TRENDS']);
            rows.push(['Month', 'Revenue (₹)']);
            chartData.forEach((item) => {
                rows.push([item.month || item.name || '', item.revenue || item.value || 0]);
            });
            rows.push([]);
        }

        // Top Categories
        if (categoryData.length > 0) {
            rows.push(['TOP CATEGORIES']);
            rows.push(['Category', 'Value (%)']);
            categoryData.forEach((item) => {
                rows.push([item.name || '', item.value || 0]);
            });
            rows.push([]);
        }

        // Top Products
        if (topProducts.length > 0) {
            rows.push(['TOP PRODUCTS']);
            rows.push(['Product', 'Sales', 'Revenue (₹)']);
            topProducts.forEach((item) => {
                rows.push([item.name || '', item.sales || 0, item.revenue || 0]);
            });
        }

        // Convert to CSV
        const csvContent = rows
            .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dashboard-report-${now.toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Report downloaded successfully');
    };

    return (
        <div className="ds-section-spacing">
            <PageHeader
                title="Dashboard"
                description="Overview of your platform's performance."
                actions={
                    <>
                        <Badge variant="outline" className="ds-badge ds-badge-gray">
                            Last Update: Today, 12:45 PM
                        </Badge>
                        <button onClick={handleDownloadReport} className="ds-btn ds-btn-md bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-500/20 hover:scale-105 active:scale-95">
                            Download Report
                        </button>
                    </>
                }
            />

            {/* Main Stats Grid */}
            <div className="ds-grid-stats">
                {stats.map((stat) => (
                    <StatCard
                        key={stat.label}
                        label={stat.label}
                        value={stat.value}
                        icon={stat.icon}
                        trend={stat.trend}
                        description={stat.description}
                        color={stat.color}
                        bg={stat.bg}
                        className={cn("ring-1 ring-gray-100", stat.bg + "/30")}
                    />
                ))}
            </div>

            <div className="ds-grid-cards-3">
                {/* Revenue Analytics */}
                <div className="lg:col-span-2">
                    <Card
                        title="Earnings"
                        subtitle="Monthly revenue trends"
                        className="h-full"
                    >
                        <div className="ds-chart-container min-h-[250px]">
                            <ResponsiveContainer width="100%" height={250}>
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#FE5502" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#FE5502" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                                        dy={8}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                                        tickFormatter={(value) => `₹${value}`}
                                    />
                                    <Tooltip
                                        formatter={(value) => [`₹${value}`, "Revenue"]}
                                        contentStyle={{
                                            borderRadius: '12px',
                                            border: 'none',
                                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                            padding: '8px',
                                            fontSize: '11px'
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="revenue"
                                        stroke="#FE5502"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorRevenue)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>

                {/* Categories Distribution */}
                <div className="lg:col-span-1">
                    <Card
                        title="Top Categories"
                        subtitle="Sales breakdown by category"
                        className="h-full border-none shadow-sm ring-1 ring-gray-100"
                    >
                        <div className="h-[250px] min-h-[250px] relative">
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={categoryData}

                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={8}
                                        dataKey="value"
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-2xl font-bold text-gray-900">72%</span>
                                <span className="text-[10px] text-gray-400 font-semibold uppercase">Growth</span>
                            </div>
                        </div>
                        <div className="space-y-3 mt-4">
                            {categoryData.map((cat) => (
                                <div key={cat.name} className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                                        <span className="text-sm font-semibold text-gray-600">{cat.name}</span>
                                    </div>
                                    <span className="text-sm font-bold text-gray-900">{cat.value}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Orders */}
                <div className="lg:col-span-2">
                    <Card
                        title="Recent Orders"
                        subtitle="Track the latest customer orders"
                        className="border-none shadow-sm ring-1 ring-gray-100 h-full"
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left border-b border-gray-100">
                                        <th className="admin-table-header">Order ID</th>
                                        <th className="admin-table-header">Customer</th>
                                        <th className="admin-table-header">Status</th>
                                        <th className="admin-table-header">Amount</th>
                                        <th className="admin-table-header">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {recentOrders.map((order) => (
                                        <tr key={order.id} className="group hover:bg-gray-50/50 transition-all">
                                            <td className="py-4 text-sm font-semibold text-orange-600">{order.id}</td>
                                            <td className="py-4">
                                                <div className="flex items-center space-x-2">
                                                    <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-semibold text-gray-500 ring-2 ring-white shadow-sm uppercase">
                                                        {order.customer?.[0] || "?"}
                                                    </div>
                                                    <span className="text-sm font-semibold text-gray-700">{order.customer}</span>
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                <Badge variant={order.status} className="rounded-full px-3 py-0.5 text-[10px] font-bold tracking-tight uppercase">
                                                    {order.statusText}
                                                </Badge>
                                            </td>
                                            <td className="py-4 text-sm font-bold text-gray-900">{order.amount}</td>
                                            <td className="py-4 text-xs font-semibold text-gray-400">{order.time}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <button
                            onClick={() => navigate('/ecs/quick-commerce/orders/all')}
                            className="w-full mt-6 py-3 rounded-xl bg-gray-50 text-xs font-bold text-gray-500 hover:bg-orange-600 hover:text-white transition-all">
                            VIEW ALL ORDERS
                        </button>
                    </Card>
                </div>

                {/* Top Products */}
                <div className="lg:col-span-1">
                    <Card
                        title="Top Products"
                        subtitle="Best selling items this week"
                        className="border-none shadow-sm ring-1 ring-gray-100 h-full"
                    >
                        <div className="space-y-4">
                            {topProducts.length > 0 ? topProducts.map((product, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100 group">
                                    <div className="flex items-center space-x-3">
                                        <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform", product.color)}>
                                            {product.icon}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 leading-none">{product.name}</p>
                                            <p className="text-[10px] text-gray-400 font-semibold uppercase mt-1.5">{product.cat}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-gray-900">{product.rev}</p>
                                        <p className="text-[10px] text-emerald-600 font-bold">{product.trend}</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-12 text-center text-slate-300 italic text-xs">No sales data yet</div>
                            )}
                        </div>
                        <button onClick={() => navigate('/ecs/quick-commerce/products')} className="w-full mt-6 py-3 border-2 border-dashed border-gray-100 rounded-xl text-xs font-bold text-gray-400 hover:border-orange-600 hover:text-orange-600 transition-all">
                            VIEW ALL PRODUCTS
                        </button>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;

