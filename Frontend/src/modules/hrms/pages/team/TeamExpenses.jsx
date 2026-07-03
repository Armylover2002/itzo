import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { Receipt, Search, Loader2, CheckCircle, XCircle, FileImage } from 'lucide-react';

export default function TeamExpenses() {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    
    // Filters
    const [statusFilter, setStatusFilter] = useState('Pending');
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

    const fetchExpenses = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page,
                limit: pagination.limit,
                status: statusFilter
            });
            
            const res = await axiosInstance.get(`/hrms/expenses/admin?${params}`);
            setExpenses(res.data?.data?.expenses || []);
            setPagination(res.data?.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
        } catch (error) {
            toast.error('Failed to load team expenses');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, pagination.limit]);

    useEffect(() => {
        fetchExpenses(1);
    }, [fetchExpenses]);

    const handleApproveExpense = async (id, action, currentTotal) => {
        let rejectionReason = '';
        let approvedAmount = currentTotal;

        if (action === 'Rejected') {
            rejectionReason = window.prompt("Reason for rejection:");
            if (rejectionReason === null) return;
            if (!rejectionReason.trim()) return toast.error("Rejection reason is required.");
        } else {
            const amountStr = window.prompt(`Approve Expense. Total claimed is ₹${currentTotal}.\n\nEnter approved amount:`, currentTotal);
            if (amountStr === null) return;
            approvedAmount = Number(amountStr);
            if (isNaN(approvedAmount) || approvedAmount < 0) return toast.error("Invalid amount.");
        }

        setActionLoading(true);
        try {
            await axiosInstance.post(`/hrms/expenses/admin/${id}/approve`, { action, rejectionReason, approvedAmount });
            toast.success(`Expense ${action.toLowerCase()}`);
            fetchExpenses(pagination.page);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to process request');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading && expenses.length === 0) {
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
                    <p className="text-sm text-slate-500 mt-1">Manage and approve travel and expense claims</p>
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

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {expenses.length === 0 ? (
                    <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center">
                        <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">No Expense Claims</h3>
                        <p className="text-slate-500 text-sm">There are no {statusFilter.toLowerCase()} expense claims at this time.</p>
                    </div>
                ) : (
                    expenses.map(expense => (
                        <div key={expense._id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 overflow-hidden">
                                        {expense.employeeId?.adminId?.name?.[0] || 'E'}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-900 text-sm">{expense.employeeId?.adminId?.name}</p>
                                        <p className="text-xs text-slate-500 font-mono">{expense.employeeId?.employeeId}</p>
                                    </div>
                                </div>
                                <div className={`px-2.5 py-1 rounded-md text-xs font-semibold border
                                    ${expense.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                                    ${expense.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
                                    ${expense.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                                `}>
                                    {expense.status}
                                </div>
                            </div>
                            
                            <div className="p-5 flex-1">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900">{expense.category}</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">{new Date(expense.visitDate).toLocaleDateString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">Claimed</span>
                                        <p className="text-lg font-bold text-slate-900">₹{expense.totalAmount}</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-3 text-sm">
                                    {expense.merchantName && (
                                        <div>
                                            <span className="text-slate-400 block text-xs">Merchant</span>
                                            <p className="text-slate-700 font-medium">{expense.merchantName}</p>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-slate-400 block text-xs">Purpose</span>
                                        <p className="text-slate-700">{expense.purpose || '—'}</p>
                                    </div>
                                </div>

                                {expense.billReceiptUrl && (
                                    <div className="mt-4">
                                        <a 
                                            href={expense.billReceiptUrl} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-xs font-medium"
                                        >
                                            <FileImage className="w-3.5 h-3.5" /> View Receipt
                                        </a>
                                    </div>
                                )}
                            </div>
                            
                            <div className="p-5 border-t border-slate-100 bg-slate-50">
                                {expense.status === 'Pending' ? (
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleApproveExpense(expense._id, 'Approved', expense.totalAmount)}
                                            disabled={actionLoading}
                                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                                        >
                                            <CheckCircle className="w-4 h-4" /> Approve
                                        </button>
                                        <button 
                                            onClick={() => handleApproveExpense(expense._id, 'Rejected', expense.totalAmount)}
                                            disabled={actionLoading}
                                            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-red-600 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                                        >
                                            <XCircle className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-sm">
                                        <span className="text-slate-500">Processed by: </span>
                                        <span className="font-medium text-slate-900">{expense.approvedBy?.adminId?.name || 'Admin'}</span>
                                        {expense.status === 'Approved' && expense.approvedAmount !== undefined && (
                                            <p className="mt-1 text-emerald-600 font-semibold">Approved Amount: ₹{expense.approvedAmount}</p>
                                        )}
                                        {expense.status === 'Rejected' && expense.rejectionReason && (
                                            <p className="mt-1 text-red-600">Reason: {expense.rejectionReason}</p>
                                        )}
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
                            onClick={() => fetchExpenses(pagination.page - 1)}
                            disabled={pagination.page === 1 || loading}
                            className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => fetchExpenses(pagination.page + 1)}
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
