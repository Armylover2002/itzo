import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'react-hot-toast';
import { Target, TrendingUp, RefreshCw, BarChart2, Star, CheckCircle, Clock } from 'lucide-react';

export default function EmployeePerformance() {
    const [performanceData, setPerformanceData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const fetchPerformance = async (force = false) => {
        setLoading(true);
        try {
            const res = await axiosInstance.get(`/hrms/performance/my-performance?period=${period}&forceRecalculate=${force}`);
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

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
        if (score >= 50) return 'text-orange-600 bg-orange-50 border-orange-200';
        return 'text-red-600 bg-red-50 border-red-200';
    };

    const getProgressColor = (score) => {
        if (score >= 80) return 'bg-green-500';
        if (score >= 50) return 'bg-orange-500';
        return 'bg-red-500';
    };

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Target className="w-6 h-6 text-orange-500" />
                        My Performance
                    </h1>
                    <p className="text-sm text-slate-500">View your KPI progress and monthly performance score</p>
                </div>
                <div className="flex items-center gap-3">
                    <input 
                        type="month" 
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500/30 outline-none shadow-sm"
                    />
                    <button onClick={() => fetchPerformance(true)} className="flex items-center gap-2 px-4 py-2 bg-white border shadow-sm text-slate-600 hover:text-orange-500 hover:border-orange-200 rounded-lg transition-colors">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>
            ) : !performanceData ? (
                <div className="text-center py-12 text-slate-500">No performance data available.</div>
            ) : (
                <>
                    {/* Final Score Card */}
                    <div className={`p-6 rounded-2xl border ${getScoreColor(performanceData.finalScore)} shadow-sm flex flex-col md:flex-row items-center justify-between gap-6`}>
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/60 rounded-full shadow-sm">
                                <Star className="w-8 h-8 opacity-80" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold opacity-90">Overall Performance Score</h2>
                                <p className="text-sm opacity-80">Weighted average based on {performanceData.results?.length} active KPIs</p>
                            </div>
                        </div>
                        <div className="text-center md:text-right">
                            <div className="text-5xl font-black drop-shadow-sm">{performanceData.finalScore}%</div>
                            <p className="text-sm font-medium mt-1 opacity-80">Target Achievement</p>
                        </div>
                    </div>

                    {/* KPI Detail Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {performanceData.results?.map((kpiData, idx) => (
                            <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-slate-800">{kpiData.kpi.name}</h3>
                                        <p className="text-xs text-slate-400 mt-0.5">{kpiData.kpi.description}</p>
                                    </div>
                                    <span className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-500 rounded-lg">
                                        Weight: {kpiData.kpi.weightage}%
                                    </span>
                                </div>
                                
                                <div className="mt-auto space-y-4">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-sm text-slate-500 mb-1">Achieved</p>
                                            <p className="text-2xl font-bold text-slate-800">
                                                {kpiData.result.achievedValue}
                                                <span className="text-sm font-normal text-slate-400 ml-1">
                                                    / {kpiData.result.targetValue} {kpiData.kpi.targetType === 'Percentage' ? '%' : ''}
                                                </span>
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-slate-500 mb-1">Score</p>
                                            <p className={`text-xl font-bold ${kpiData.result.scorePercentage >= 80 ? 'text-green-600' : kpiData.result.scorePercentage >= 50 ? 'text-orange-500' : 'text-red-500'}`}>
                                                {kpiData.result.scorePercentage.toFixed(1)}%
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* Progress Bar */}
                                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-1000 ${getProgressColor(kpiData.result.scorePercentage)}`}
                                            style={{ width: `${Math.min(100, kpiData.result.scorePercentage)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
