import React, { useEffect, useState } from 'react';
import axiosInstance from '@core/api/axios';
import { Loader2, FileText, CheckCircle, AlertCircle, Clock, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminReportDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axiosInstance.get('/hrms/daily-reports/admin/dashboard');
                setStats(res.data?.data);
            } catch (error) {
                console.error(error);
                toast.error('Failed to load dashboard stats');
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-[#6412c6]" /></div>;

    const cards = [
        { label: 'Submitted Today', value: stats?.todaySubmitted || 0, icon: FileText, color: 'text-[#6412c6]', bg: 'bg-[#f7f3fc]' },
        { label: 'Pending Review', value: stats?.pending || 0, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
        { label: 'Approved', value: stats?.approved || 0, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50' },
        { label: 'Rejected', value: stats?.rejected || 0, icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' }
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Daily Reports Dashboard</h1>
                <p className="text-sm text-slate-500 mt-1">Overview of employee daily work reports</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((card, i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-500 mb-1">{card.label}</p>
                                <h3 className="text-2xl font-bold text-slate-900">{card.value}</h3>
                            </div>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.bg}`}>
                                <card.icon className={`w-6 h-6 ${card.color}`} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col items-center justify-center min-h-[300px]">
                    <TrendingUp className="w-12 h-12 text-slate-300 mb-3" />
                    <h3 className="font-semibold text-slate-700">Analytics Coming Soon</h3>
                    <p className="text-sm text-slate-500 text-center max-w-sm mt-2">Charts and detailed performance metrics based on reports will be displayed here in future updates.</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">Recent Activity</h3>
                    <div className="text-sm text-slate-500 text-center py-10">
                        Activity timeline will be integrated with the notification system.
                    </div>
                </div>
            </div>
        </div>
    );
}
