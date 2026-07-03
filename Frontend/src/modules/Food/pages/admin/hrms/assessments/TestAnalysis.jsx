import React, { useState, useEffect } from 'react';
import { Search, Loader2, RefreshCw, FileText, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';

export default function TestAnalysis() {
    const [attempts, setAttempts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    
    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchAttempts = async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get('/hrms/assessments/attempts', {
                params: { search: searchTerm, status: statusFilter, page, limit: 20 }
            });
            setAttempts(res.data?.data?.attempts || []);
            setTotalPages(res.data?.data?.pages || 1);
        } catch (error) {
            toast.error('Failed to fetch test results');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAttempts();
    }, [searchTerm, statusFilter, page]);

    const handleReset = async (id) => {
        if (!window.confirm('Are you sure you want to reset this attempt? The applicant will be able to retake the test.')) return;
        try {
            await axiosInstance.post(`/hrms/assessments/attempts/${id}/reset`);
            toast.success('Attempt reset successfully');
            fetchAttempts();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to reset attempt');
        }
    };

    const formatDuration = (seconds) => {
        if (!seconds) return '—';
        const m = Math.floor(seconds / 60);
        return `${m} min`;
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Test Analysis</h1>
                    <p className="text-slate-500 text-sm mt-1">Review applicant assessment results and performance</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[60vh]">
                {/* Filters */}
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-4">
                    <div className="relative flex-1 min-w-[250px]">
                        <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search by name, email, phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        />
                    </div>
                    <div className="relative w-full sm:w-64">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        >
                            <option value="">All Statuses</option>
                            <option value="Completed">Completed</option>
                            <option value="In_Progress">In Progress</option>
                            <option value="Timeout">Timeout</option>
                            <option value="Reset">Reset</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-64 text-slate-500">
                            <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                    ) : attempts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                            <FileText className="w-12 h-12 text-slate-300 mb-3" />
                            <p>No assessment attempts found.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Applicant</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Score</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Result</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Time Taken</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {attempts.map(attempt => (
                                    <tr key={attempt._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-bold text-slate-900">{attempt.applicantName}</p>
                                            <p className="text-xs text-slate-500">{attempt.applicantEmail}</p>
                                            <p className="text-xs text-slate-500">{attempt.applicantPhone}</p>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                attempt.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' :
                                                attempt.status === 'In_Progress' ? 'bg-blue-50 text-blue-700' :
                                                attempt.status === 'Timeout' ? 'bg-orange-50 text-orange-700' :
                                                'bg-slate-100 text-slate-700'
                                            }`}>
                                                {attempt.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {attempt.status === 'Completed' || attempt.status === 'Timeout' ? (
                                                <div>
                                                    <p className="text-lg font-bold text-slate-900">{attempt.score}</p>
                                                    <p className="text-xs text-slate-500">{attempt.percentage?.toFixed(1)}%</p>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {attempt.status === 'Completed' || attempt.status === 'Timeout' ? (
                                                attempt.isPassed ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-sm">
                                                        <CheckCircle2 className="w-4 h-4" /> Pass
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-sm">
                                                        <XCircle className="w-4 h-4" /> Fail
                                                    </span>
                                                )
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                                                <Clock className="w-4 h-4 text-slate-400" />
                                                {formatDuration(attempt.durationSeconds)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                            {new Date(attempt.createdAt).toLocaleDateString('en-GB')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <button 
                                                onClick={() => handleReset(attempt._id)} 
                                                disabled={attempt.status === 'Reset'}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:text-orange-600 transition-colors disabled:opacity-50"
                                                title="Reset attempt so applicant can take test again"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5" /> Reset
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between">
                        <button 
                            onClick={() => setPage(p => Math.max(1, p - 1))} 
                            disabled={page === 1}
                            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
                        <button 
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                            disabled={page === totalPages}
                            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
