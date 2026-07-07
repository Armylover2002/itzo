import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { ClipboardList, Search, Loader2, MessageSquare, ChevronRight } from 'lucide-react';

export default function TeamReports() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [statusFilter, setStatusFilter] = useState('All');
    const [dateFilter, setDateFilter] = useState('');
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

    const fetchReports = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page,
                limit: pagination.limit,
                status: statusFilter
            });
            if (dateFilter) params.append('date', dateFilter);
            
            const res = await axiosInstance.get(`/hrms/daily-reports/admin/all?${params}`);
            setReports(res.data?.data?.reports || []);
            setPagination(res.data?.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
        } catch (error) {
            toast.error('Failed to load team reports');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, dateFilter, pagination.limit]);

    useEffect(() => {
        fetchReports(1);
    }, [fetchReports]);

    if (loading && reports.length === 0) {
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
                    <h1 className="text-2xl font-bold text-slate-900">Team Daily Reports</h1>
                    <p className="text-sm text-slate-500 mt-1">Review end of day reports submitted by your team</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
                <div>
                    <input 
                        type="date"
                        value={dateFilter}
                        onChange={e => setDateFilter(e.target.value)}
                        className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    />
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    {['All', 'Submitted', 'Reviewed'].map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                statusFilter === status 
                                    ? 'bg-white text-orange-600 shadow-sm' 
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
                {reports.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                        <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">No Reports Found</h3>
                        <p className="text-slate-500 text-sm">Your team has not submitted any reports matching the filters.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {reports.map(report => (
                            <Link 
                                key={report._id} 
                                to={`/hrms/reports/${report._id}`}
                                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-orange-200 transition-all group block"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 overflow-hidden">
                                            {report.employeeId?.adminId?.name?.[0] || 'E'}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-900 text-sm group-hover:text-orange-600 transition-colors">{report.employeeId?.adminId?.name}</h3>
                                            <p className="text-xs text-slate-500">{new Date(report.reportDate).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                                        </div>
                                    </div>
                                    <div className={`px-2.5 py-1 rounded-md text-xs font-semibold border
                                        ${report.status === 'Submitted' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                                        ${report.status === 'Reviewed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
                                    `}>
                                        {report.status}
                                    </div>
                                </div>
                                
                                <div className="space-y-3 mb-4 text-sm">
                                    <div>
                                        <span className="text-slate-400 text-xs block mb-0.5">Summary</span>
                                        <p className="text-slate-700 line-clamp-2">{report.summary || '—'}</p>
                                    </div>
                                    <div className="flex gap-4">
                                        <div>
                                            <span className="text-slate-400 text-xs block mb-0.5">Tasks Completed</span>
                                            <p className="font-semibold text-slate-900">{report.tasks?.filter(t => t.status === 'Completed').length || 0} / {report.tasks?.length || 0}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-slate-400">
                                    <div className="flex items-center gap-1.5 text-xs font-medium">
                                        <MessageSquare className="w-3.5 h-3.5" /> Reply / View
                                    </div>
                                    <ChevronRight className="w-4 h-4 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                                </div>
                            </Link>
                        ))}
                    </div>
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
                            onClick={() => fetchReports(pagination.page - 1)}
                            disabled={pagination.page === 1 || loading}
                            className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => fetchReports(pagination.page + 1)}
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
