import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'react-hot-toast';
import { TrendingUp, Users, Activity, BarChart2, Star, AlertTriangle, RefreshCw } from 'lucide-react';

export default function HrmsAdminPerformance() {
    const [performanceData, setPerformanceData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const fetchPerformance = async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get(`/hrms/performance/company-performance?period=${period}`);
            setPerformanceData(res.data?.data);
        } catch (error) {
            toast.error('Failed to load performance data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPerformance();
    }, [period]);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <BarChart2 className="w-6 h-6 text-orange-500" />
                        Company Performance Overview
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Enterprise-wide KPI evaluations and leaderboards</p>
                </div>
                <div className="flex items-center gap-3">
                    <input 
                        type="month" 
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500/30 outline-none"
                    />
                    <button onClick={fetchPerformance} className="p-2 text-slate-500 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors">
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>
            ) : !performanceData ? (
                <div className="text-center py-12 text-slate-500">No performance data available for this period.</div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Employees Evaluated</p>
                                <p className="text-2xl font-bold text-slate-800">{performanceData.totalEvaluated}</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                                <Star className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Top Performers</p>
                                <p className="text-2xl font-bold text-slate-800">{performanceData.topPerformers?.length || 0}</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
                            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Needs Improvement</p>
                                <p className="text-2xl font-bold text-slate-800">{performanceData.lowPerformers?.length || 0}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Top Performers */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-5 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                                <TrendingUp className="w-5 h-5 text-green-500" />
                                <h3 className="font-bold text-slate-800">Company Leaderboard</h3>
                            </div>
                            <div className="p-0">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-white border-b text-left text-slate-500">
                                            <th className="px-5 py-3 font-medium">Employee</th>
                                            <th className="px-5 py-3 font-medium text-right">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {performanceData.topPerformers?.map((perf, i) => (
                                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-5 py-3 font-medium text-slate-800 flex items-center gap-3">
                                                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                                                    {perf.employee?.adminId?.name || 'Unknown'} 
                                                    <span className="text-xs text-slate-400 font-normal">({perf.employee?.employeeId})</span>
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${perf.performance?.finalScore >= 80 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {perf.performance?.finalScore}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Needs Improvement */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-5 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                                <h3 className="font-bold text-slate-800">Needs Improvement (Bottom 5)</h3>
                            </div>
                            <div className="p-0">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-white border-b text-left text-slate-500">
                                            <th className="px-5 py-3 font-medium">Employee</th>
                                            <th className="px-5 py-3 font-medium text-right">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {performanceData.lowPerformers?.map((perf, i) => (
                                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-5 py-3 font-medium text-slate-800 flex items-center gap-3">
                                                    {perf.employee?.adminId?.name || 'Unknown'}
                                                    <span className="text-xs text-slate-400 font-normal">({perf.employee?.employeeId})</span>
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${perf.performance?.finalScore < 50 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        {perf.performance?.finalScore}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
