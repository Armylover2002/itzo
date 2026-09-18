import React, { useEffect, useState } from 'react';
import axiosInstance from '@core/api/axios';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, Search, Filter, ChevronRight, FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReportList() {
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('All');
    const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1 });

    const fetchReports = async (page = 1) => {
        setLoading(true);
        try {
            const res = await axiosInstance.get(`/hrms/daily-reports/me?page=${page}&limit=${pagination.limit}&status=${statusFilter}`);
            setReports(res.data?.data?.reports || []);
            if (res.data?.data?.pagination) {
                setPagination(res.data.data.pagination);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load reports');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports(1);
    }, [statusFilter]);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchReports(newPage);
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Approved': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
            case 'Rejected': return 'bg-red-50 text-red-600 border-red-200';
            case 'Draft': return 'bg-slate-100 text-slate-600 border-slate-200';
            case 'Revision Requested': return 'bg-amber-50 text-amber-600 border-amber-200';
            default: return 'bg-[#f7f3fc] text-[#550fa8] border-[#d8c4f1]'; // Submitted, Under Review
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Daily Work Reports</h1>
                    <p className="text-sm text-slate-500 mt-1">Submit and track your daily performance and tasks</p>
                </div>
                <button
                    onClick={() => navigate('/hrms/reports/create')}
                    className="w-full sm:w-auto bg-[#6412c6] hover:bg-[#550fa8] text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg shadow-[#6412c6]/20 transition-all flex items-center justify-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Submit Report
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 ml-auto">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="py-2 pl-3 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#9359d7]"
                    >
                        <option value="All">All Statuses</option>
                        <option value="Draft">Draft</option>
                        <option value="Submitted">Submitted</option>
                        <option value="Under Review">Under Review</option>
                        <option value="Revision Requested">Revision Requested</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                <th className="px-5 py-4">Report Date</th>
                                <th className="px-5 py-4">Manager</th>
                                <th className="px-5 py-4">Status</th>
                                <th className="px-5 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="px-5 py-10 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-[#6412c6] mx-auto" />
                                    </td>
                                </tr>
                            ) : reports.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-5 py-10 text-center text-slate-500">
                                        <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                                        No reports found.
                                    </td>
                                </tr>
                            ) : (
                                reports.map(report => (
                                    <tr key={report._id} className="hover:bg-[#f7f3fc]/30 transition-colors group">
                                        <td className="px-5 py-4 align-top">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-semibold text-slate-800 line-clamp-1 group-hover:text-[#550fa8] transition-colors">
                                                    {new Date(report.reportDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                                <span className="text-xs text-slate-400">{report.tasks?.length || 0} tasks reported</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 align-middle">
                                            <span className="text-slate-600">{report.managerId?.adminId?.name || 'Unassigned'}</span>
                                        </td>
                                        <td className="px-5 py-4 align-middle">
                                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase border ${getStatusStyle(report.status)}`}>
                                                {report.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 align-middle text-right">
                                            <button
                                                onClick={() => navigate(report.status === 'Draft' || report.status === 'Revision Requested' ? `/hrms/reports/create?id=${report._id}` : `/hrms/reports/${report._id}`)}
                                                className="inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-600 hover:text-[#550fa8] hover:border-[#c1a0e8] px-3 py-1.5 rounded-lg transition-colors font-medium text-xs"
                                            >
                                                {report.status === 'Draft' || report.status === 'Revision Requested' ? 'Edit' : 'View'} <ChevronRight className="w-3.5 h-3.5" />
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
