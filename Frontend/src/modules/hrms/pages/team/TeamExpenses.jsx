import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { Receipt, Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp, Calendar } from 'lucide-react';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function TeamExpenses() {
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [expandedBatch, setExpandedBatch] = useState(null);

    // Filters
    const [statusFilter, setStatusFilter] = useState('Pending');
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

    const fetchBatches = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page,
                limit: pagination.limit,
                status: statusFilter
            });

            const res = await axiosInstance.get(`/hrms/expenses/monthly?${params}`);
            setBatches(res.data?.data?.batches || []);
            setPagination(res.data?.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
        } catch (error) {
            toast.error('Failed to load team expenses');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, pagination.limit]);

    useEffect(() => {
        fetchBatches(1);
    }, [fetchBatches]);

    const handleApproveBatch = async (id, action, currentTotal) => {
        let rejectionReason = '';
        let approvedAmount = currentTotal;

        if (action === 'Rejected') {
            rejectionReason = window.prompt("Reason for rejection:");
            if (rejectionReason === null) return;
            if (!rejectionReason.trim()) return toast.error("Rejection reason is required.");
        } else {
            const amountStr = window.prompt(`Approve Monthly Expense Batch. Total claimed is ₹${currentTotal}.\\n\\nEnter approved amount:`, currentTotal);
            if (amountStr === null) return;
            approvedAmount = Number(amountStr);
            if (isNaN(approvedAmount) || approvedAmount < 0) return toast.error("Invalid amount.");
        }

        setActionLoading(true);
        try {
            await axiosInstance.post(`/hrms/expenses/monthly/${id}/action`, { action, rejectionReason, approvedAmount });
            toast.success(`Expense batch ${action.toLowerCase()}`);
            fetchBatches(pagination.page);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to process request');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading && batches.length === 0) {
        return (
            <div className="flex-1 p-6 lg:p-8 flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Team Expenses</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage and approve monthly travel expense claims</p>
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
                                    ? 'bg-white text-emerald-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Batch List */}
            <div className="space-y-4">
                {batches.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                        <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">No Expense Claims</h3>
                        <p className="text-slate-500 text-sm">There are no {statusFilter.toLowerCase()} monthly expense claims at this time.</p>
                    </div>
                ) : (
                    batches.map(batch => {
                        const isExpanded = expandedBatch === batch._id;
                        const monthLabel = MONTH_NAMES[(batch.month || 1) - 1];
                        const empName = batch.employeeId?.adminId?.name || 'Employee';
                        const empId = batch.employeeId?.employeeId || '';

                        return (
                            <div key={batch._id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                {/* Header */}
                                <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 overflow-hidden">
                                            {empName[0] || 'E'}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900 text-sm">{empName}</p>
                                            <p className="text-xs text-slate-500 font-mono">{empId}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className={`px-2.5 py-1 rounded-md text-xs font-semibold border
                                            ${batch.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                                            ${batch.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
                                            ${batch.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                                        `}>
                                            {batch.status}
                                        </div>
                                    </div>
                                </div>

                                {/* Batch Summary */}
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <Calendar className="w-5 h-5 text-orange-400" />
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-900">{monthLabel} {batch.year}</h3>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {batch.entries?.length || 0} {(batch.entries?.length || 0) === 1 ? 'visit entry' : 'visit entries'}
                                                    {batch.isLegacy && <span className="ml-2 text-amber-500 font-medium">(Migrated)</span>}
                                                    {batch.resubmissionCount > 0 && <span className="ml-2 text-blue-500 font-medium">Resubmitted ×{batch.resubmissionCount}</span>}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">Total Claimed</span>
                                            <p className="text-lg font-bold text-slate-900">₹{(batch.totalAmount || 0).toLocaleString()}</p>
                                        </div>
                                    </div>

                                    {/* Expandable entries */}
                                    <button
                                        onClick={() => setExpandedBatch(isExpanded ? null : batch._id)}
                                        className="w-full flex items-center justify-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium py-2 rounded-lg hover:bg-orange-50 transition-colors"
                                    >
                                        {isExpanded ? 'Hide' : 'View'} Entries
                                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </button>

                                    {isExpanded && (
                                        <div className="mt-3 overflow-x-auto">
                                            {batch.resubmissionNote && (
                                                <div className="mb-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                                                    <p className="text-xs font-semibold text-blue-700">Resubmission Note:</p>
                                                    <p className="text-xs text-blue-600 mt-0.5">{batch.resubmissionNote}</p>
                                                </div>
                                            )}
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b border-slate-200">
                                                        <th className="px-2 py-2 text-left font-semibold text-slate-600 uppercase">Date</th>
                                                        <th className="px-2 py-2 text-left font-semibold text-slate-600 uppercase">Purpose</th>
                                                        <th className="px-2 py-2 text-right font-semibold text-slate-600 uppercase">Travel</th>
                                                        <th className="px-2 py-2 text-right font-semibold text-slate-600 uppercase">Hotel</th>
                                                        <th className="px-2 py-2 text-right font-semibold text-slate-600 uppercase">Food</th>
                                                        <th className="px-2 py-2 text-right font-semibold text-slate-600 uppercase">Other</th>
                                                        <th className="px-2 py-2 text-right font-semibold text-slate-600 uppercase">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(batch.entries || []).map((entry, idx) => (
                                                        <tr key={entry._id || idx} className="border-b border-slate-100 last:border-0">
                                                            <td className="px-2 py-2 font-medium text-slate-900">
                                                                {new Date(entry.visitDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                            </td>
                                                            <td className="px-2 py-2 text-slate-600 max-w-[150px] truncate">{entry.purpose}</td>
                                                            <td className="px-2 py-2 text-slate-600 text-right tabular-nums">₹{(entry.travelCost || 0).toLocaleString()}</td>
                                                            <td className="px-2 py-2 text-slate-600 text-right tabular-nums">₹{(entry.hotelCost || 0).toLocaleString()}</td>
                                                            <td className="px-2 py-2 text-slate-600 text-right tabular-nums">₹{(entry.foodCost || 0).toLocaleString()}</td>
                                                            <td className="px-2 py-2 text-slate-600 text-right tabular-nums">₹{(entry.otherExpenses || 0).toLocaleString()}</td>
                                                            <td className="px-2 py-2 font-bold text-slate-900 text-right tabular-nums">₹{(entry.entryTotal || 0).toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Action buttons */}
                                <div className="p-5 border-t border-slate-100 bg-slate-50">
                                    {batch.status === 'Pending' ? (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleApproveBatch(batch._id, 'Approved', batch.totalAmount)}
                                                disabled={actionLoading}
                                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                                            >
                                                <CheckCircle className="w-4 h-4" /> Approve Batch
                                            </button>
                                            <button
                                                onClick={() => handleApproveBatch(batch._id, 'Rejected', batch.totalAmount)}
                                                disabled={actionLoading}
                                                className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-red-600 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                                            >
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-sm">
                                            <span className="text-slate-500">Processed by: </span>
                                            <span className="font-medium text-slate-900">{batch.approvedBy?.adminId?.name || 'Admin'}</span>
                                            {batch.status === 'Approved' && batch.approvedAmount !== undefined && (
                                                <p className="mt-1 text-emerald-600 font-semibold">Approved Amount: ₹{batch.approvedAmount?.toLocaleString()}</p>
                                            )}
                                            {batch.status === 'Rejected' && batch.rejectionReason && (
                                                <p className="mt-1 text-red-600">Reason: {batch.rejectionReason}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
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
                            onClick={() => fetchBatches(pagination.page - 1)}
                            disabled={pagination.page === 1 || loading}
                            className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => fetchBatches(pagination.page + 1)}
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
