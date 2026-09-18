import React, { useEffect, useState } from 'react';
import axiosInstance from '@core/api/axios';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Plus, ChevronRight, MessageSquare, Clock, CheckCircle, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SupportList() {
    const navigate = useNavigate();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('All');
    const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1 });

    const fetchTickets = async (page = 1) => {
        setLoading(true);
        try {
            const res = await axiosInstance.get(`/hrms/support/tickets?page=${page}&limit=${pagination.limit}&status=${statusFilter}`);
            setTickets(res.data?.data?.tickets || []);
            if (res.data?.data?.pagination) {
                setPagination(res.data.data.pagination);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load support requests');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets(1);
    }, [statusFilter]);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchTickets(newPage);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Open': return 'bg-[#f7f3fc] text-[#550fa8] border-[#d8c4f1]';
            case 'In Progress': return 'bg-amber-50 text-amber-600 border-amber-200';
            case 'Waiting for Employee': return 'bg-amber-50 text-amber-600 border-amber-200';
            case 'Resolved': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
            case 'Closed': return 'bg-slate-50 text-slate-600 border-slate-200';
            default: return 'bg-slate-50 text-slate-600 border-slate-200';
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'Low': return 'text-slate-500 bg-slate-100';
            case 'Urgent': return 'text-red-600 bg-red-100';
            case 'High': return 'text-amber-600 bg-amber-100';
            case 'Medium': return 'text-[#6412c6] bg-[#f0e7f9]';
            default: return 'text-slate-500 bg-slate-100';
        }
    };

    const StatusIcon = ({ status, className }) => {
        switch (status) {
            case 'Open': return <HelpCircle className={className} />;
            case 'In Progress': return <Clock className={className} />;
            case 'Waiting for Employee': return <MessageSquare className={className} />;
            case 'Resolved': case 'Closed': return <CheckCircle className={className} />;
            default: return <HelpCircle className={className} />;
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">My Support Requests</h1>
                    <p className="text-sm text-slate-500 mt-1">Track and manage your IT and HR support tickets</p>
                </div>
                <button
                    onClick={() => navigate('/hrms/support/create')}
                    className="flex items-center gap-2 bg-[#6412c6] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#550fa8] transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Raise Request
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#d8c4f1] [&::-webkit-scrollbar-thumb]:rounded-full">
                {['All', 'Open', 'In Progress', 'Waiting for Employee', 'Resolved', 'Closed'].map(status => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
                            statusFilter === status
                                ? 'bg-[#6412c6] text-white shadow-md shadow-[#6412c6]/20'
                                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                        }`}
                    >
                        {status}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-[#6412c6]" />
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="text-center py-20 px-6">
                        <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-slate-700">No requests found</h3>
                        <p className="text-slate-500 mt-1">You haven't raised any support requests matching this filter.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {tickets.map(ticket => (
                            <div
                                key={ticket._id}
                                onClick={() => navigate(`/hrms/support/${ticket._id}`)}
                                className="p-4 sm:p-5 hover:bg-[#f7f3fc]/30 transition-colors cursor-pointer group flex items-start gap-4"
                            >
                                <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center mt-1 border ${getStatusColor(ticket.status)}`}>
                                    <StatusIcon status={ticket.status} className="w-5 h-5" />
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">{ticket.ticketId}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${getPriorityColor(ticket.priority)}`}>
                                            {ticket.priority}
                                        </span>
                                        {ticket.unreadByEmployee && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-red-100 text-red-600">
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                                New Reply
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-base font-semibold text-slate-800 truncate group-hover:text-[#550fa8] transition-colors">
                                        {ticket.subject}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-slate-500">
                                        <span>Category: <span className="font-medium text-slate-700">{ticket.category}</span></span>
                                        <span className="hidden sm:inline text-slate-300">•</span>
                                        <span>Updated: {new Date(ticket.updatedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <div className="hidden sm:flex items-center self-center shrink-0">
                                    <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(ticket.status)}`}>
                                        {ticket.status}
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300 ml-4 group-hover:text-[#9359d7] transition-colors" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                        <p className="text-sm text-slate-500">
                            Page <span className="font-medium text-slate-700">{pagination.page}</span> of <span className="font-medium text-slate-700">{pagination.totalPages}</span>
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={pagination.page === 1}
                                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={pagination.page === pagination.totalPages}
                                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
