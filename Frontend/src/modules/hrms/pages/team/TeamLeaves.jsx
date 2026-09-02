import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { CalendarDays, Search, Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function TeamLeaves() {
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    
    // Filters
    const [statusFilter, setStatusFilter] = useState('Pending');
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

    const fetchLeaves = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page,
                limit: pagination.limit,
                status: statusFilter
            });
            
            const res = await axiosInstance.get(`/hrms/leaves/admin?${params}`);
            setLeaves(res.data?.data?.leaves || []);
            setPagination(res.data?.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
        } catch (error) {
            toast.error('Failed to load team leaves');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, pagination.limit]);

    useEffect(() => {
        fetchLeaves(1);
    }, [fetchLeaves]);

    const handleApproveLeave = async (id, action) => {
        let rejectionReason = '';
        if (action === 'Rejected') {
            rejectionReason = window.prompt("Reason for rejection:");
            if (rejectionReason === null) return;
            if (!rejectionReason.trim()) return toast.error("Rejection reason is required.");
        } else {
            if (!window.confirm("Approve this leave request?")) return;
        }

        setActionLoading(true);
        try {
            await axiosInstance.post(`/hrms/leaves/admin/${id}/approve`, { action, rejectionReason });
            toast.success(`Leave ${action.toLowerCase()}`);
            fetchLeaves(pagination.page);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to process request');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading && leaves.length === 0) {
        return (
            <div className="flex-1 p-6 lg:p-8 flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-[#6412c6]" />
            </div>
        );
    }

    return (
        <div className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Team Leaves</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage and approve leave requests from your team</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    {['Pending', 'Approved', 'Rejected'].map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                statusFilter === status 
                                    ? 'bg-white text-[#550fa8] shadow-sm' 
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="grid gap-4">
                {leaves.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                        <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">No Leave Requests</h3>
                        <p className="text-slate-500 text-sm">There are no {statusFilter.toLowerCase()} leave requests at this time.</p>
                    </div>
                ) : (
                    leaves.map(leave => (
                        <div key={leave._id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                            <div className="flex flex-col md:flex-row gap-4 justify-between items-start">
                                
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 overflow-hidden shrink-0 mt-1">
                                        {leave.employeeId?.adminId?.name?.[0] || 'E'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-slate-900 text-base">{leave.employeeId?.adminId?.name}</h3>
                                            <span className="text-xs font-mono text-slate-500">({leave.employeeId?.employeeId})</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#f7f3fc] text-[#460d8b] border border-[#f0e7f9]">
                                                {leave.leaveType}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium border
                                                ${leave.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                                                ${leave.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
                                                ${leave.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                                            `}>
                                                {leave.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-700 mb-1">
                                            <span className="font-medium text-slate-900">{new Date(leave.startDate).toLocaleDateString('en-IN')}</span>
                                            <span className="text-slate-400 mx-2">to</span>
                                            <span className="font-medium text-slate-900">{new Date(leave.endDate).toLocaleDateString('en-IN')}</span>
                                            <span className="text-slate-500 ml-2">({leave.totalDays} Days)</span>
                                        </p>
                                        <p className="text-sm text-slate-600 italic">"{leave.reason}"</p>
                                    </div>
                                </div>

                                {leave.status === 'Pending' && (
                                    <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-4 md:pt-0 w-full md:w-auto">
                                        <button 
                                            onClick={() => handleApproveLeave(leave._id, 'Approved')}
                                            disabled={actionLoading}
                                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                                        >
                                            <CheckCircle className="w-4 h-4" /> Approve
                                        </button>
                                        <button 
                                            onClick={() => handleApproveLeave(leave._id, 'Rejected')}
                                            disabled={actionLoading}
                                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                                        >
                                            <XCircle className="w-4 h-4" /> Reject
                                        </button>
                                    </div>
                                )}
                                
                                {leave.status !== 'Pending' && leave.approvedBy && (
                                    <div className="text-right text-xs text-slate-500 mt-2 md:mt-0">
                                        <p>{leave.status} by <span className="font-medium text-slate-700">{leave.approvedBy?.adminId?.name}</span></p>
                                        {leave.rejectionReason && <p className="text-red-600 mt-1 max-w-[200px] truncate" title={leave.rejectionReason}>Reason: {leave.rejectionReason}</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="py-4 flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                        Showing page <span className="font-semibold text-slate-900">{pagination.page}</span> of <span className="font-semibold text-slate-900">{pagination.totalPages}</span>
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fetchLeaves(pagination.page - 1)}
                            disabled={pagination.page === 1 || loading}
                            className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => fetchLeaves(pagination.page + 1)}
                            disabled={pagination.page === pagination.totalPages || loading}
                            className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
