import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { Clock, Search, Loader2, CheckCircle, XCircle, FileText } from 'lucide-react';

export default function TeamAttendance() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    
    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]); // Today by default
    
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });

    const fetchAttendance = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page,
                limit: pagination.limit,
            });
            if (dateFilter) params.append('date', dateFilter);
            
            const res = await axiosInstance.get(`/hrms/attendance/admin?${params}`);
            setRecords(res.data?.data?.records || []);
            setPagination(res.data?.data?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
        } catch (error) {
            toast.error('Failed to load team attendance');
        } finally {
            setLoading(false);
        }
    }, [dateFilter, pagination.limit]);

    useEffect(() => {
        fetchAttendance(1);
    }, [fetchAttendance]);

    const handleApproveRegularization = async (id, action) => {
        if (action === 'Rejected') {
            const reason = window.prompt("Reason for rejection:");
            if (reason === null) return;
            if (!reason.trim()) return toast.error("Rejection reason is required.");
            
            setActionLoading(true);
            try {
                await axiosInstance.post(`/hrms/attendance/admin/regularize/${id}`, { action: 'Rejected', rejectionReason: reason });
                toast.success('Regularization rejected');
                fetchAttendance(pagination.page);
            } catch (e) {
                toast.error(e.response?.data?.message || 'Failed to reject');
            } finally {
                setActionLoading(false);
            }
        } else {
            if (!window.confirm("Approve this regularization request?")) return;
            setActionLoading(true);
            try {
                await axiosInstance.post(`/hrms/attendance/admin/regularize/${id}`, { action: 'Approved' });
                toast.success('Regularization approved');
                fetchAttendance(pagination.page);
            } catch (e) {
                toast.error(e.response?.data?.message || 'Failed to approve');
            } finally {
                setActionLoading(false);
            }
        }
    };

    // Client side filtering for search & status
    const filteredRecords = records.filter(r => {
        if (statusFilter !== 'All' && r.status !== statusFilter) return false;
        if (search) {
            const q = search.toLowerCase();
            return (
                r.employeeId?.adminId?.name?.toLowerCase().includes(q) ||
                r.employeeId?.employeeId?.toLowerCase().includes(q)
            );
        }
        return true;
    });

    const formatTime = (timeString) => {
        if (!timeString) return '—';
        return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (loading && records.length === 0) {
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
                    <h1 className="text-2xl font-bold text-slate-900">Team Attendance</h1>
                    <p className="text-sm text-slate-500 mt-1">View attendance and manage regularization requests</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search employee..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6412c6]/30"
                    />
                </div>
                <div>
                    <input 
                        type="date"
                        value={dateFilter}
                        onChange={e => setDateFilter(e.target.value)}
                        className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6412c6]/30"
                    />
                </div>
                <select 
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6412c6]/30"
                >
                    <option value="All">All Statuses</option>
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                    <option value="Late">Late</option>
                    <option value="Half_Day">Half Day</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                            <tr>
                                <th className="px-6 py-4">Employee</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Check In</th>
                                <th className="px-6 py-4">Check Out</th>
                                <th className="px-6 py-4">Work Hrs</th>
                                <th className="px-6 py-4">Regularization</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                        No attendance records found.
                                    </td>
                                </tr>
                            ) : (
                                filteredRecords.map(record => (
                                    <tr key={record._id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 overflow-hidden shrink-0">
                                                    {record.employeeId?.adminId?.name?.[0] || 'E'}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-900">{record.employeeId?.adminId?.name}</p>
                                                    <p className="text-xs text-slate-500 font-mono">{record.employeeId?.employeeId}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold
                                                ${record.status === 'Present' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : ''}
                                                ${record.status === 'Absent' ? 'bg-red-50 text-red-700 border border-red-200' : ''}
                                                ${record.status === 'Late' ? 'bg-amber-50 text-amber-700 border border-amber-200' : ''}
                                                ${record.status === 'Half_Day' ? 'bg-[#f7f3fc] text-[#460d8b] border border-[#d8c4f1]' : ''}
                                                ${record.status === 'Week_Off' ? 'bg-slate-100 text-slate-600 border border-slate-200' : ''}
                                                ${record.status === 'Holiday' ? 'bg-purple-50 text-purple-700 border border-purple-200' : ''}
                                            `}>
                                                {record.status?.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {formatTime(record.checkInTime)}
                                            {record.lateMinutes > 0 && <span className="block text-xs text-amber-600 mt-0.5">{record.lateMinutes}m late</span>}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {formatTime(record.checkOutTime)}
                                            {record.earlyLeaveMinutes > 0 && <span className="block text-xs text-amber-600 mt-0.5">{record.earlyLeaveMinutes}m early</span>}
                                        </td>
                                        <td className="px-6 py-4 text-slate-900 font-medium">
                                            {record.workingHours > 0 ? `${record.workingHours}h` : '—'}
                                            {record.shortHours > 0 && <span className="block text-xs text-red-500 mt-0.5">-{record.shortHours}h short</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            {record.regularization?.isRequested ? (
                                                <div className="flex flex-col gap-1.5">
                                                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-max
                                                        ${record.regularization.status === 'Pending' ? 'bg-amber-100 text-amber-700' : ''}
                                                        ${record.regularization.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : ''}
                                                        ${record.regularization.status === 'Rejected' ? 'bg-red-100 text-red-700' : ''}
                                                    `}>
                                                        {record.regularization.status}
                                                    </span>
                                                    
                                                    {record.regularization.status === 'Pending' && (
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <button 
                                                                onClick={() => handleApproveRegularization(record._id, 'Approved')}
                                                                disabled={actionLoading}
                                                                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded transition-colors tooltip-trigger"
                                                                title="Approve Request"
                                                            >
                                                                <CheckCircle className="w-3.5 h-3.5" /> Approve
                                                            </button>
                                                            <button 
                                                                onClick={() => handleApproveRegularization(record._id, 'Rejected')}
                                                                disabled={actionLoading}
                                                                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors tooltip-trigger"
                                                                title="Reject Request"
                                                            >
                                                                <XCircle className="w-3.5 h-3.5" /> Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                    {record.regularization.reason && (
                                                        <p className="text-[11px] text-slate-500 max-w-[200px] truncate" title={record.regularization.reason}>
                                                            "{record.regularization.reason}"
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-xs">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                        <p className="text-sm text-slate-500">
                            Showing page <span className="font-semibold text-slate-900">{pagination.page}</span> of <span className="font-semibold text-slate-900">{pagination.totalPages}</span>
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => fetchAttendance(pagination.page - 1)}
                                disabled={pagination.page === 1 || loading}
                                className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => fetchAttendance(pagination.page + 1)}
                                disabled={pagination.page === pagination.totalPages || loading}
                                className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
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
