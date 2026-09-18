import React, { useEffect, useState } from 'react';
import axiosInstance from '@core/api/axios';
import { useNavigate } from 'react-router-dom';
import { Loader2, Ticket, CheckCircle, Clock, AlertCircle, TrendingUp, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SupportDashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axiosInstance.get('/hrms/support/admin/dashboard');
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[500px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#6412c6]" />
            </div>
        );
    }

    const { counts, recentTickets } = stats || { counts: {}, recentTickets: [] };

    const cards = [
        { title: 'Total Tickets', value: counts.total || 0, icon: Ticket, color: 'text-[#550fa8] bg-[#f7f3fc]' },
        { title: 'Open', value: counts.open || 0, icon: AlertCircle, color: 'text-amber-600 bg-amber-50' },
        { title: 'In Progress', value: counts.inProgress || 0, icon: Clock, color: 'text-[#550fa8] bg-[#f7f3fc]' },
        { title: 'Resolved', value: (counts.resolved || 0) + (counts.closed || 0), icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
        { title: 'High Priority', value: counts.highPriority || 0, icon: TrendingUp, color: 'text-red-600 bg-red-50' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Support Dashboard</h1>
                <p className="text-sm text-slate-500 mt-1">Overview of HRMS support operations</p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {cards.map((c, i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${c.color}`}>
                            <c.icon className="w-5 h-5" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800">{c.value}</h3>
                        <p className="text-sm font-medium text-slate-500 mt-1">{c.title}</p>
                    </div>
                ))}
            </div>

            {/* Recent Activities */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800">Recent Tickets</h2>
                    <button
                        onClick={() => navigate('/ecs/hrms/support/requests')}
                        className="text-sm font-semibold text-[#550fa8] hover:text-[#460d8b] transition-colors"
                    >
                        View All
                    </button>
                </div>
                
                <div className="divide-y divide-slate-100">
                    {recentTickets.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            No recent tickets.
                        </div>
                    ) : (
                        recentTickets.map(ticket => (
                            <div key={ticket._id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                                        ticket.priority === 'Urgent' ? 'bg-red-500' :
                                        ticket.priority === 'High' ? 'bg-amber-500' :
                                        ticket.priority === 'Medium' ? 'bg-[#6412c6]' :
                                        'bg-slate-300'
                                    }`} />
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 truncate">{ticket.subject}</p>
                                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                                            <span className="font-medium text-slate-600">{ticket.ticketId}</span> • 
                                            {ticket.employeeId?.adminId?.name || 'Unknown'} • 
                                            {ticket.category}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 shrink-0 pl-4">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                        ticket.status === 'Open' ? 'bg-[#f0e7f9] text-[#460d8b]' :
                                        ticket.status === 'Resolved' || ticket.status === 'Closed' ? 'bg-emerald-100 text-emerald-700' :
                                        'bg-slate-100 text-slate-700'
                                    }`}>
                                        {ticket.status}
                                    </span>
                                    <button
                                        onClick={() => navigate(`/ecs/hrms/support/requests/${ticket._id}`)}
                                        className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-lg transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
