import React, { useEffect, useState } from 'react';
import axiosInstance from '@core/api/axios';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, Filter, ChevronRight, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SupportRequests() {
    const navigate = useNavigate();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ status: 'All', priority: 'All', category: 'All', search: '' });
    const [pagination, setPagination] = useState({ page: 1, limit: 15, totalPages: 1 });

    const fetchTickets = async (page = 1) => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                page,
                limit: pagination.limit,
                status: filters.status,
                priority: filters.priority,
                category: filters.category,
                search: filters.search
            }).toString();
            const res = await axiosInstance.get(`/hrms/support/admin/tickets?${query}`);
            setTickets(res.data?.data?.tickets || []);
            if (res.data?.data?.pagination) {
                setPagination(res.data.data.pagination);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load tickets');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchTickets(1);
        }, 300); // debounce search
        return () => clearTimeout(timer);
    }, [filters.status, filters.priority, filters.category, filters.search]);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchTickets(newPage);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Support Requests</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage and resolve employee tickets</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search ticket ID or subject..."
                        value={filters.search}
                        onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0e7f9] focus:border-[#9359d7]"
                    />
                </div>
                
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
                        className="py-2 pl-3 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#9359d7]"
                    >
                        <option value="All">All Statuses</option>
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Waiting for Employee">Waiting for Employee</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                    </select>

                    <select
                        value={filters.priority}
                        onChange={(e) => setFilters(f => ({ ...f, priority: e.target.value }))}
                        className="py-2 pl-3 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#9359d7]"
                    >
                        <option value="All">All Priorities</option>
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                <th className="px-5 py-4">Ticket</th>
                                <th className="px-5 py-4">Employee</th>
                                <th className="px-5 py-4">Category</th>
                                <th className="px-5 py-4">Status</th>
                                <th className="px-5 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-5 py-10 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-[#6412c6] mx-auto" />
                                    </td>
                                </tr>
                            ) : tickets.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-5 py-10 text-center text-slate-500">
                                        <MessageSquare className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                                        No tickets found.
                                    </td>
                                </tr>
                            ) : (
                                tickets.map(ticket => (
                                    <tr key={ticket._id} className="hover:bg-[#f7f3fc]/30 transition-colors group">
                                        <td className="px-5 py-4 align-top">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase">{ticket.ticketId}</span>
                                                    {ticket.unreadByAdmin && (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600 uppercase">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                                            New
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="font-semibold text-slate-800 line-clamp-1 group-hover:text-[#550fa8] transition-colors">{ticket.subject}</span>
                                                <span className="text-xs text-slate-400">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 align-top">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-medium text-slate-700">{ticket.employeeId?.adminId?.name || 'Unknown'}</span>
                                                <span className="text-xs text-slate-400">{ticket.employeeId?.adminId?.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 align-top">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-slate-600">{ticket.category}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded w-max uppercase ${
                                                    ticket.priority === 'Urgent' ? 'bg-red-100 text-red-600' :
                                                    ticket.priority === 'High' ? 'bg-amber-100 text-amber-600' :
                                                    ticket.priority === 'Medium' ? 'bg-[#f0e7f9] text-[#550fa8]' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {ticket.priority}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 align-top">
                                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase ${
                                                ticket.status === 'Open' ? 'bg-[#f7f3fc] text-[#550fa8] border border-[#d8c4f1]' :
                                                ticket.status === 'In Progress' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                                                ticket.status === 'Waiting for Employee' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                                                ticket.status === 'Resolved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                                                'bg-slate-100 text-slate-600 border border-slate-200'
                                            }`}>
                                                {ticket.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 align-top text-right">
                                            <button
                                                onClick={() => navigate(`/ecs/hrms/support/requests/${ticket._id}`)}
                                                className="inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-600 hover:text-[#550fa8] hover:border-[#c1a0e8] px-3 py-1.5 rounded-lg transition-colors font-medium text-xs"
                                            >
                                                View <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

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
