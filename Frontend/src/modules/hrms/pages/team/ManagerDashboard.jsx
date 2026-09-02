import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { 
    LayoutDashboard, Users, Clock, CalendarDays, Receipt, 
    ClipboardList, CheckCircle, XCircle, ChevronRight, Loader2,
    AlertCircle, TrendingUp
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const score = data.score;
        return (
            <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-xl border border-slate-800 min-w-[180px] z-50">
                <p className="font-bold text-sm text-slate-100">{data.name}</p>
                <p className="text-xs text-slate-400 mb-2">{data.designation}</p>
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 mt-1">
                    <span className="text-xs text-slate-400">Score:</span>
                    <span className={`text-sm font-extrabold ${
                        score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-rose-400'
                    }`}>
                        {score} / 100
                    </span>
                </div>
            </div>
        );
    }
    return null;
};

export default function ManagerDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        try {
            // We use the admin stats endpoints which are scoped to the manager's team on the backend
            const [reportStats, leaveRes, expenseRes, perfRes] = await Promise.all([
                axiosInstance.get('/hrms/daily-reports/admin/dashboard').catch(() => ({ data: { data: {} } })),
                axiosInstance.get('/hrms/leaves', { params: { status: 'Pending', limit: 10 } }).catch(() => ({ data: { data: { leaves: [], pagination: { total: 0 } } } })),
                axiosInstance.get('/hrms/expenses', { params: { status: 'Pending', limit: 10 } }).catch(() => ({ data: { data: { expenses: [], pagination: { total: 0 } } } })),
                axiosInstance.get('/hrms/performance/team-performance').catch(() => ({ data: { data: { teamMembersPerformance: [], averageTeamScore: 0 } } }))
            ]);

            const perfMembers = perfRes.data?.data?.teamMembersPerformance || [];
            const performanceData = perfMembers.map(item => ({
                name: item.member?.adminId?.name || item.member?.employeeId || 'Employee',
                score: Math.round(Number(item.performance?.finalScore || 0)),
                designation: item.member?.designation || 'Team Member'
            }));

            setStats({
                reports: reportStats.data?.data || {},
                pendingLeaves: leaveRes.data?.data?.pagination?.total || leaveRes.data?.data?.total || 0,
                pendingExpenses: expenseRes.data?.data?.pagination?.total || expenseRes.data?.data?.total || 0,
                recentLeaves: leaveRes.data?.data?.leaves || [],
                recentExpenses: expenseRes.data?.data?.expenses || [],
                performanceData,
                averageTeamScore: Math.round(Number(perfRes.data?.data?.averageTeamScore || 0))
            });
        } catch (error) {
            toast.error('Failed to load dashboard statistics');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    if (loading) {
        return (
            <div className="flex-1 p-6 lg:p-8 flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-[#6412c6]" />
            </div>
        );
    }

    const statCards = [
        { title: 'Pending Leaves', value: stats?.pendingLeaves || 0, icon: CalendarDays, color: 'bg-[#6412c6]', link: '/hrms/team/leaves' },
        { title: 'Pending Expenses', value: stats?.pendingExpenses || 0, icon: Receipt, color: 'bg-emerald-500', link: '/hrms/team/expenses' },
        { title: 'Reports Today', value: stats?.reports?.todayCount || 0, icon: ClipboardList, color: 'bg-[#6412c6]', link: '/hrms/team/reports' },
    ];

    return (
        <div className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Team Dashboard</h1>
                <p className="text-sm text-slate-500 mt-1">Overview of your team's activities and pending approvals</p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {statCards.map((card, idx) => (
                    <div key={idx} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div>
                                <p className="text-sm font-medium text-slate-500 mb-1">{card.title}</p>
                                <h3 className="text-3xl font-bold text-slate-900">{card.value}</h3>
                            </div>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${card.color} shadow-lg shadow-${card.color.split('-')[1]}-500/30`}>
                                <card.icon className="w-6 h-6" />
                            </div>
                        </div>
                        <Link to={card.link} className="flex items-center text-sm font-medium text-[#550fa8] hover:text-[#460d8b] transition-colors mt-4 relative z-10">
                            View Details <ChevronRight className="w-4 h-4 ml-1" />
                        </Link>
                    </div>
                ))}
            </div>

            {/* Team Performance Graph Section */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 lg:p-8 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-[#f7f3fc] text-[#550fa8] rounded-xl">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-900">Team Performance Overview</h2>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">Monthly performance scores based on attendance, daily reports, and task execution</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-200/60 flex items-center gap-3">
                            <span className="text-xs font-medium text-slate-500">Team Avg:</span>
                            <span className="text-sm font-bold text-slate-900">{stats?.averageTeamScore || 0} pts</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                (stats?.averageTeamScore || 0) >= 80 ? 'bg-emerald-100 text-emerald-800' :
                                (stats?.averageTeamScore || 0) >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                                {(stats?.averageTeamScore || 0) >= 80 ? 'Excellent' : (stats?.averageTeamScore || 0) >= 60 ? 'Good' : 'Needs Focus'}
                            </span>
                        </div>
                        <Link to="/hrms/team/performance" className="text-sm font-semibold text-[#550fa8] hover:text-[#460d8b] flex items-center gap-1 bg-[#f7f3fc] hover:bg-[#f0e7f9]/80 px-3 py-2 rounded-xl transition-colors">
                            Detailed View <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>

                {/* Graph or Empty State */}
                {!stats?.performanceData || stats.performanceData.length === 0 ? (
                    <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                        <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-600 font-medium">No Performance Data Yet</p>
                        <p className="text-sm text-slate-400 mt-1">Performance scores will generate as team members submit reports and check in.</p>
                    </div>
                ) : (
                    <div className="h-[320px] w-full pt-4">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}>
                            <BarChart data={stats.performanceData} margin={{ top: 10, right: 20, left: -10, bottom: 40 }}>
                                <defs>
                                    <linearGradient id="scoreGradientHigh" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.95}/>
                                        <stop offset="100%" stopColor="#059669" stopOpacity={0.75}/>
                                    </linearGradient>
                                    <linearGradient id="scoreGradientMid" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.95}/>
                                        <stop offset="100%" stopColor="#d97706" stopOpacity={0.75}/>
                                    </linearGradient>
                                    <linearGradient id="scoreGradientLow" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.95}/>
                                        <stop offset="100%" stopColor="#dc2626" stopOpacity={0.75}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="name" 
                                    tickLine={false} 
                                    axisLine={false} 
                                    tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }} 
                                    interval={0} 
                                    angle={-20} 
                                    textAnchor="end"
                                    height={60}
                                />
                                <YAxis 
                                    domain={[0, 100]} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    tick={{ fill: '#64748b', fontSize: 12 }} 
                                    unit=""
                                    ticks={[0, 25, 50, 75, 100]}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', opacity: 0.8 }} />
                                <Bar dataKey="score" radius={[8, 8, 0, 0]} barSize={42} animationDuration={1200}>
                                    {stats.performanceData.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={entry.score >= 80 ? "url(#scoreGradientHigh)" : entry.score >= 60 ? "url(#scoreGradientMid)" : "url(#scoreGradientLow)"} 
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pending Leaves */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="w-5 h-5 text-slate-400" />
                            <h2 className="text-lg font-bold text-slate-900">Pending Leaves</h2>
                        </div>
                        <Link to="/hrms/team/leaves" className="text-sm font-medium text-[#550fa8] hover:text-[#460d8b]">View All</Link>
                    </div>
                    <div className="p-0 flex-1 overflow-y-auto max-h-[400px]">
                        {stats?.recentLeaves.length === 0 ? (
                            <div className="p-8 text-center">
                                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                                <p className="text-slate-600 font-medium">All Caught Up!</p>
                                <p className="text-sm text-slate-400">No pending leave requests.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {stats?.recentLeaves.map(leave => (
                                    <div key={leave._id} className="p-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-semibold text-sm text-slate-900">{leave.employeeId?.adminId?.name}</div>
                                            <div className="text-xs font-medium px-2 py-1 bg-[#f7f3fc] text-[#460d8b] rounded-md border border-[#f0e7f9]">{leave.leaveType}</div>
                                        </div>
                                        <div className="text-xs text-slate-500 mb-2">
                                            {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()} ({leave.totalDays} Days)
                                        </div>
                                        <p className="text-sm text-slate-600 line-clamp-2">{leave.reason}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Pending Expenses */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Receipt className="w-5 h-5 text-slate-400" />
                            <h2 className="text-lg font-bold text-slate-900">Pending Expenses</h2>
                        </div>
                        <Link to="/hrms/team/expenses" className="text-sm font-medium text-[#550fa8] hover:text-[#460d8b]">View All</Link>
                    </div>
                    <div className="p-0 flex-1 overflow-y-auto max-h-[400px]">
                        {stats?.recentExpenses.length === 0 ? (
                            <div className="p-8 text-center">
                                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                                <p className="text-slate-600 font-medium">All Caught Up!</p>
                                <p className="text-sm text-slate-400">No pending expense claims.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {stats?.recentExpenses.map(expense => (
                                    <div key={expense._id} className="p-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-semibold text-sm text-slate-900">{expense.employeeId?.adminId?.name}</div>
                                            <div className="text-sm font-bold text-slate-900">₹{expense.totalAmount}</div>
                                        </div>
                                        <div className="text-xs text-slate-500 mb-2">
                                            {expense.category} • {new Date(expense.visitDate).toLocaleDateString()}
                                        </div>
                                        <p className="text-sm text-slate-600 line-clamp-1">{expense.purpose}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
