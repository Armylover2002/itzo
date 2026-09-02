import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'react-hot-toast';
import { Target, TrendingUp, RefreshCw, Award, Trophy, DollarSign, AlertCircle, CheckCircle2, Zap } from 'lucide-react';

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
            setPerformanceData(res.data?.data || null);
        } catch (error) {
            toast.error('Failed to load performance scorecard');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPerformance();
    }, [period]);

    const formatCurrency = (val) => {
        return `₹${Number(val || 0).toLocaleString('en-IN')}`;
    };

    const getLevelBadge = (levelName, color) => {
        return (
            <span
                className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold"
                style={{
                    backgroundColor: `${color || '#3b82f6'}15`,
                    color: color || '#3b82f6',
                    borderColor: `${color || '#3b82f6'}30`,
                    borderWidth: '1px'
                }}
            >
                <Award className="w-4 h-4" />
                {levelName || 'Average'}
            </span>
        );
    };

    const strengths = performanceData?.results?.filter(item => item.result?.scorePercentage >= 80) || [];
    const improvements = performanceData?.results?.filter(item => item.result?.scorePercentage < 60) || [];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-[#f7f3fc] flex items-center justify-center">
                            <Target className="w-5 h-5 text-[#550fa8]" />
                        </div>
                        My Performance
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 ml-[52px]">
                        Track your monthly achievements, targets, and growth areas.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <input 
                        type="month" 
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#6412c6]/20 focus:border-[#6412c6]"
                    />
                    <button
                        onClick={() => fetchPerformance(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#6412c6] hover:bg-[#550fa8] text-white rounded-xl font-semibold text-xs transition-colors"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col justify-center items-center py-24">
                    <RefreshCw className="w-8 h-8 text-[#6412c6] animate-spin mb-3" />
                    <p className="text-slate-400 font-medium text-sm">Loading your scorecard...</p>
                </div>
            ) : !performanceData ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                    <Target className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-700 font-semibold text-lg">No scorecard found for {period}</p>
                    <p className="text-sm text-slate-400 mt-1">Check back once KPIs are assigned and data is available.</p>
                </div>
            ) : (
                <>
                    {/* Overall Score Card */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-[#f7f3fc] flex items-center justify-center flex-shrink-0">
                                <Trophy className="w-7 h-7 text-[#6412c6]" />
                            </div>
                            <div>
                                <span className="text-xs font-semibold text-[#550fa8] block mb-1">
                                    Monthly Performance
                                </span>
                                <h2 className="text-xl font-bold text-slate-900">
                                    {performanceData.performanceLevel?.levelName || 'Evaluated'}
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5 max-w-md">
                                    {performanceData.performanceLevel?.description || 'Your score reflects weighted KPI achievements across operations and discipline.'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-5 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100 w-full md:w-auto justify-between md:justify-end">
                            <div className="text-right">
                                <span className="text-xs text-slate-500 font-medium block">Score</span>
                                <div className="text-4xl font-black text-slate-900 tracking-tight mt-0.5">
                                    {performanceData.finalScore} <span className="text-base font-normal text-slate-400">/ 100</span>
                                </div>
                            </div>
                            <div className="pl-4 border-l border-slate-200">
                                {getLevelBadge(performanceData.performanceLevel?.levelName, performanceData.performanceLevel?.color)}
                            </div>
                        </div>
                    </div>

                    {/* Financial Contributions */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-xs font-medium text-slate-500 block">Gross Revenue</span>
                                <span className="text-xl font-bold text-emerald-600 mt-0.5 block">
                                    {formatCurrency(performanceData.financialBreakdown?.grossRevenue)}
                                </span>
                                <span className="text-xs text-slate-400 mt-0.5 block">From your restaurants</span>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                                <DollarSign className="w-5 h-5" />
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-xs font-medium text-slate-500 block">Approved Expenses</span>
                                <span className="text-xl font-bold text-amber-600 mt-0.5 block">
                                    {formatCurrency(performanceData.financialBreakdown?.approvedExpenses)}
                                </span>
                                <span className="text-xs text-slate-400 mt-0.5 block">Travel, food & hotel</span>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-xs font-medium text-slate-500 block">Net Profit Contribution</span>
                                <span className="text-xl font-bold text-[#550fa8] mt-0.5 block">
                                    {formatCurrency(performanceData.financialBreakdown?.netProfit)}
                                </span>
                                <span className="text-xs text-slate-400 mt-0.5 block">After all deductions</span>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-[#f7f3fc] flex items-center justify-center text-[#550fa8]">
                                <Zap className="w-5 h-5" />
                            </div>
                        </div>
                    </div>

                    {/* Strengths & Improvement Areas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Strengths
                            </h3>
                            {strengths.length === 0 ? (
                                <p className="text-sm text-slate-400 py-3">Achieve 80%+ on any KPI to see your strengths here.</p>
                            ) : (
                                <div className="space-y-2.5">
                                    {strengths.map((s, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                            <div>
                                                <h4 className="font-semibold text-slate-800 text-sm">{s.kpi?.name}</h4>
                                                <span className="text-xs text-slate-500">Target: {s.result?.targetValue} • Weight: {s.kpi?.weightage}%</span>
                                            </div>
                                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 font-bold text-xs rounded-full">
                                                {s.result?.scorePercentage}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
                                <AlertCircle className="w-5 h-5 text-amber-500" /> Areas to Improve
                            </h3>
                            {improvements.length === 0 ? (
                                <p className="text-sm text-emerald-600 font-medium py-3">Great! All your KPIs are above the improvement threshold.</p>
                            ) : (
                                <div className="space-y-2.5">
                                    {improvements.map((s, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                                            <div>
                                                <h4 className="font-semibold text-slate-800 text-sm">{s.kpi?.name}</h4>
                                                <span className="text-xs text-slate-500">Target: {s.result?.targetValue} • Achieved: {s.result?.achievedValue}</span>
                                            </div>
                                            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 font-bold text-xs rounded-full">
                                                {s.result?.scorePercentage}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* KPI Detail Cards */}
                    <div>
                        <h3 className="text-base font-bold text-slate-900 mb-4">KPI Breakdown</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {performanceData.results?.map((kpiData, idx) => (
                                <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between hover:border-[#d8c4f1] transition-all duration-200">
                                    <div>
                                        <div className="flex justify-between items-start mb-3 gap-2">
                                            <div>
                                                <span className="text-[11px] font-semibold text-[#550fa8] bg-[#f7f3fc] px-2 py-0.5 rounded-md">
                                                    {kpiData.kpi?.categoryId?.name || 'General'}
                                                </span>
                                                <h4 className="font-semibold text-slate-900 text-sm mt-1.5">{kpiData.kpi.name}</h4>
                                            </div>
                                            <span className="text-xs font-medium px-2 py-1 bg-slate-50 text-slate-500 rounded-lg flex-shrink-0">
                                                {kpiData.kpi.weightage}%
                                            </span>
                                        </div>
                                        
                                        <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                                            {kpiData.kpi.description || 'No description.'}
                                        </p>
                                    </div>
                                    
                                    <div className="space-y-3 pt-3 border-t border-slate-100">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <span className="text-xs text-slate-400 block mb-0.5">Achieved / Target</span>
                                                <span className="text-lg font-bold text-slate-900">
                                                    {kpiData.kpi.targetType === 'Currency' ? '₹' : ''}{kpiData.result.achievedValue}
                                                    <span className="text-xs font-medium text-slate-400 ml-1">
                                                        / {kpiData.kpi.targetType === 'Currency' ? '₹' : ''}{kpiData.result.targetValue}{kpiData.kpi.targetType === 'Percentage' ? '%' : ''}
                                                    </span>
                                                </span>
                                            </div>
                                            <span className={`text-lg font-bold ${
                                                kpiData.result.scorePercentage >= 80 ? 'text-emerald-600' : kpiData.result.scorePercentage >= 50 ? 'text-[#6412c6]' : 'text-red-500'
                                            }`}>
                                                {kpiData.result.scorePercentage}%
                                            </span>
                                        </div>
                                        
                                        {/* Progress Bar */}
                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-1000 ${
                                                    kpiData.result.scorePercentage >= 80 ? 'bg-emerald-500' : kpiData.result.scorePercentage >= 50 ? 'bg-[#6412c6]' : 'bg-red-500'
                                                }`}
                                                style={{ width: `${Math.min(100, kpiData.result.scorePercentage)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
