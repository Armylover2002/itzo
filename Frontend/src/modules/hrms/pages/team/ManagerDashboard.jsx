import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { 
    LayoutDashboard, Users, Clock, CalendarDays, Receipt, 
    ClipboardList, CheckCircle, XCircle, ChevronRight, Loader2,
    AlertCircle, TrendingUp
} from 'lucide-react';

export default function ManagerDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        try {
            // We use the admin stats endpoints which are scoped to the manager's team on the backend
            const [reportStats, leaveRes, expenseRes] = await Promise.all([
                axiosInstance.get('/hrms/daily-reports/admin/stats').catch(() => ({ data: { data: {} } })),
                axiosInstance.get('/hrms/leaves/admin', { params: { status: 'Pending', limit: 10 } }).catch(() => ({ data: { data: { leaves: [], total: 0 } } })),
                axiosInstance.get('/hrms/expenses/admin', { params: { status: 'Pending', limit: 10 } }).catch(() => ({ data: { data: { expenses: [], total: 0 } } }))
            ]);

            setStats({
                reports: reportStats.data?.data || {},
                pendingLeaves: leaveRes.data?.data?.total || 0,
                pendingExpenses: expenseRes.data?.data?.total || 0,
                recentLeaves: leaveRes.data?.data?.leaves || [],
                recentExpenses: expenseRes.data?.data?.expenses || []
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
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    const statCards = [
        { title: 'Pending Leaves', value: stats?.pendingLeaves || 0, icon: CalendarDays, color: 'bg-blue-500', link: '/hrms/team/leaves' },
        { title: 'Pending Expenses', value: stats?.pendingExpenses || 0, icon: Receipt, color: 'bg-emerald-500', link: '/hrms/team/expenses' },
        { title: 'Reports Today', value: stats?.reports?.todayCount || 0, icon: ClipboardList, color: 'bg-orange-500', link: '/hrms/team/reports' },
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
                        <Link to={card.link} className="flex items-center text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors mt-4 relative z-10">
                            View Details <ChevronRight className="w-4 h-4 ml-1" />
                        </Link>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pending Leaves */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="w-5 h-5 text-slate-400" />
                            <h2 className="text-lg font-bold text-slate-900">Pending Leaves</h2>
                        </div>
                        <Link to="/hrms/team/leaves" className="text-sm font-medium text-orange-600 hover:text-orange-700">View All</Link>
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
                                            <div className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-100">{leave.leaveType}</div>
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
                        <Link to="/hrms/team/expenses" className="text-sm font-medium text-orange-600 hover:text-orange-700">View All</Link>
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
