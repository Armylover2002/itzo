import React, { useState } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    HiOutlineArrowTrendingUp,
    HiOutlineArrowTrendingDown,
    HiOutlineShoppingBag,
    HiOutlineUsers,
    HiOutlineBanknotes,
    HiOutlineClock,
    HiOutlineGlobeAsiaAustralia,
    HiOutlineFunnel,
    HiOutlineCalendarDays,
    HiOutlineArrowDownTray,
    HiOutlineBolt
} from 'react-icons/hi2';
import { useToast } from '@shared/components/ui/Toast';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line
} from 'recharts';
import { cn } from '@/lib/utils';

const AdvancedAnalytics = () => {
    const { showToast } = useToast();
    const [timeRange, setTimeRange] = useState('7d');

    // Mock functions
    const handleDownloadReport = () => {
        showToast(`Preparing ${timeRange} performance report...`, 'info');
        setTimeout(() => {
            showToast('Report downloaded successfully', 'success');
        }, 2000);
    };

    const handleViewSegmentation = () => {
        showToast('Loading detailed customer segmentation data...', 'info');
    };

    // Mock Data
    const salesData = [
        { name: 'Mon', revenue: 45000, orders: 120 },
        { name: 'Tue', revenue: 52000, orders: 145 },
        { name: 'Wed', revenue: 48000, orders: 132 },
        { name: 'Thu', revenue: 61000, orders: 168 },
        { name: 'Fri', revenue: 55000, orders: 154 },
        { name: 'Sat', revenue: 82000, orders: 210 },
        { name: 'Sun', revenue: 95000, orders: 245 },
    ];

    const categoryData = [
        { name: 'Grocery', value: 45, color: '#6366f1' },
        { name: 'Electronics', value: 25, color: '#f59e0b' },
        { name: 'Daily Needs', value: 20, color: '#10b981' },
        { name: 'Bakery', value: 10, color: '#f43f5e' },
    ];

    const hourlyHeatmap = [
        { hour: '08:00', load: 30 },
        { hour: '10:00', load: 65 },
        { hour: '12:00', load: 85 },
        { hour: '14:00', load: 45 },
        { hour: '16:00', load: 55 },
        { hour: '18:00', load: 95 },
        { hour: '20:00', load: 75 },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="admin-h1 flex items-center gap-2">
                        Business Intel Hub
                        <Badge variant="blue" className="text-[10px] font-black uppercase tracking-tighter">Enterprise v2.0</Badge>
                    </h1>
                    <p className="admin-description mt-1">Deep granular insights and real-time performance metrics.</p>
                </div>
                <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl shadow-sm ring-1 ring-slate-200">
                    {['24h', '7d', '30d', '90d'].map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={cn(
                                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                timeRange === range ? "bg-red-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                            )}
                        >
                            {range}
                        </button>
                    ))}
                    <div className="w-px h-6 bg-slate-200 mx-1" />
                    <button className="p-2 text-slate-400 hover:text-primary transition-colors">
                        <HiOutlineCalendarDays className="h-5 w-5" />
                    </button>
                    <button
                        onClick={handleDownloadReport}
                        className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all"
                    >
                        <HiOutlineArrowDownTray className="h-4 w-4" />
                        REPORT
                    </button>
                </div>
            </div>

            {/* Goals Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Gross Revenue', value: '₹5,42,000', trend: '+12.5%', icon: HiOutlineBanknotes, color: 'indigo' },
                    { label: 'Total Orders', value: '1,248', trend: '+8.2%', icon: HiOutlineShoppingBag, color: 'emerald' },
                    { label: 'Active Sellers', value: '84', trend: '+2', icon: HiOutlineUsers, color: 'amber' },
                    { label: 'Avg Order Value', value: '₹434', trend: '-2.1%', icon: HiOutlineBolt, color: 'rose' },
                ].map((goal, i) => (
                    <Card key={i} className="p-6 border-none shadow-xl ring-1 ring-slate-100 bg-white group hover:scale-[1.02] transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className={cn("p-2.5 rounded-2xl",
                                goal.color === 'indigo' && "bg-indigo-50 text-indigo-600",
                                goal.color === 'emerald' && "bg-emerald-50 text-emerald-600",
                                goal.color === 'amber' && "bg-amber-50 text-amber-600",
                                goal.color === 'rose' && "bg-rose-50 text-rose-600",
                            )}>
                                <goal.icon className="h-6 w-6" />
                            </div>
                            <div className={cn("flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black",
                                goal.trend.startsWith('+') ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                            )}>
                                {goal.trend.startsWith('+') ? <HiOutlineArrowTrendingUp className="h-3 w-3" /> : <HiOutlineArrowTrendingDown className="h-3 w-3" />}
                                {goal.trend}
                            </div>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{goal.label}</p>
                        <h3 className="text-2xl font-black text-slate-900 leading-none">{goal.value}</h3>
                        <div className="mt-4 h-1 w-full bg-slate-50 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full animate-progress",
                                goal.color === 'indigo' && "bg-indigo-500",
                                goal.color === 'emerald' && "bg-emerald-500",
                                goal.color === 'amber' && "bg-amber-500",
                                goal.color === 'rose' && "bg-rose-500",
                            )} style={{ width: '70%' }} />
                        </div>
                    </Card>
                ))}
            </div>

            {/* Main Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Revenue & Growth Trend */}
                <Card className="lg:col-span-2 border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-[32px] p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Financial Performance Trend</h4>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">Revenue and order volume metrics over time.</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                                <span className="text-[10px] font-black text-slate-600">REVENUE</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full bg-indigo-100" />
                                <span className="text-[10px] font-black text-slate-600">BENCHMARK</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                                    tickFormatter={(value) => `₹${value / 1000}k`}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', background: '#fff' }}
                                    itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#6366f1"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorRev)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Category Mix */}
                <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-[32px] p-8">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-8">Category Revenue Mix</h4>
                    <div className="h-[250px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={8}
                                    dataKey="value"
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-[10px] font-black text-slate-400 uppercase">Top category</span>
                            <span className="text-xl font-black text-slate-900">Grocery</span>
                        </div>
                    </div>
                    <div className="mt-8 space-y-4">
                        {categoryData.map((cat, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                                    <span className="text-[11px] font-bold text-slate-600 uppercase">{cat.name}</span>
                                </div>
                                <span className="text-[11px] font-black text-slate-900">{cat.value}%</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Bottom Row Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Delivery Performance Heatmap (Simple representation) */}
                <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-[32px] p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Delivery Load Pulse</h4>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">Peak traffic hours monitoring.</p>
                        </div>
                        <HiOutlineClock className="h-5 w-5 text-indigo-500" />
                    </div>
                    <div className="space-y-6">
                        {hourlyHeatmap.map((item, i) => (
                            <div key={i} className="space-y-1.5">
                                <div className="flex justify-between items-end">
                                    <span className="text-[10px] font-black text-slate-500">{item.hour}</span>
                                    <span className="text-[10px] font-black text-slate-900">{item.load}% CAPACITY</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                                    <div
                                        className={cn("h-full rounded-full transition-all duration-1000",
                                            item.load > 80 ? "bg-rose-500" : item.load > 60 ? "bg-amber-500" : "bg-emerald-500"
                                        )}
                                        style={{ width: `${item.load}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Customer Keeping Metrics */}
                <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-red-600 rounded-[32px] p-8 text-white overflow-hidden relative group">
                    <div className="relative z-10">
                        <h4 className="text-sm font-black opacity-60 uppercase tracking-tight mb-8">Keeping Customers</h4>
                        <div className="space-y-8">
                            <div>
                                <div className="flex items-end justify-between mb-2">
                                    <h5 className="text-3xl font-black">78.4%</h5>
                                    <Badge variant="success" className="bg-emerald-500/20 text-emerald-400 border-none">+4.2%</Badge>
                                </div>
                                <p className="text-[10px] font-black opacity-50 uppercase tracking-[0.2em]">Customers Who Return</p>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <h6 className="text-lg font-black">₹2.4k</h6>
                                    <p className="text-[9px] font-black opacity-50 uppercase tracking-widest mt-1">Average Spent</p>
                                </div>
                                <div>
                                    <h6 className="text-lg font-black">12m</h6>
                                    <p className="text-[9px] font-black opacity-50 uppercase tracking-widest mt-1">Avg Life Span</p>
                                </div>
                            </div>

                            <button
                                onClick={handleViewSegmentation}
                                className="w-full py-4 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                            >
                                VIEW SEGMENTATION
                            </button>
                        </div>
                    </div>
                    <HiOutlineArrowTrendingUp className="absolute -bottom-10 -right-10 h-48 w-48 opacity-5 group-hover:scale-110 transition-transform duration-1000" />
                </Card>

                {/* Best Performing Zones */}
                <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-[32px] p-8">
                    <div className="flex items-center justify-between mb-8">
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Top Growth Regions</h4>
                        <HiOutlineGlobeAsiaAustralia className="h-5 w-5 text-sky-500" />
                    </div>
                    <div className="space-y-3">
                        {[
                            { name: 'Powai, Mumbai', sales: '₹1.2M', growth: '+22%', status: 'Hot' },
                            { name: 'Koramangala, BLR', sales: '₹850k', growth: '+15%', status: 'Stable' },
                            { name: 'Whitefield, BLR', sales: '₹620k', growth: '+34%', status: 'Burst' },
                            { name: 'Hitech City, HYD', sales: '₹410k', growth: '+12%', status: 'Steady' },
                        ].map((zone, i) => (
                            <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-red-600 hover:text-white transition-all">
                                <div>
                                    <p className="text-[11px] font-black uppercase">{zone.name}</p>
                                    <p className="text-[9px] font-bold text-slate-400 group-hover:text-white/50">{zone.sales} Total GMV</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-black text-emerald-500 group-hover:text-emerald-400">{zone.growth}</p>
                                    <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">{zone.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default AdvancedAnalytics;
