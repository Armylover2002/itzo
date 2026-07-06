import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'react-hot-toast';
import { Target, TrendingUp, RefreshCw, BarChart2, Star, CheckCircle, Clock, Award, Trophy, DollarSign, AlertCircle, ShieldCheck, Sparkles, Zap, CheckCircle2, XCircle } from 'lucide-react';

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
                className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-extrabold shadow-sm"
                style={{
                    backgroundColor: `${color || '#3b82f6'}20`,
                    color: color || '#3b82f6',
                    borderColor: `${color || '#3b82f6'}40`,
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
            {/* Header Suite */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-orange-950/40 p-6 rounded-3xl text-white shadow-xl border border-slate-800">
                <div>
                    <div className="flex items-center gap-2 text-orange-400 font-bold text-xs tracking-wider uppercase mb-1">
                        <Sparkles className="w-4 h-4" /> Personal Scorecard & Growth Engine
                    </div>
                    <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
                        <Target className="w-7 h-7 text-orange-500" />
                        My Performance & KPI Scorecard
                    </h1>
                    <p className="text-sm text-slate-300 mt-1">
                        Track your monthly achievement, financial contributions, strengths, and target progression.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <input 
                        type="month" 
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-xl text-xs font-bold focus:outline-none focus:border-orange-500 shadow-sm"
                    />
                    <button
                        onClick={() => fetchPerformance(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl shadow-lg shadow-orange-500/20 font-bold text-xs transition-all"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col justify-center items-center py-24">
                    <RefreshCw className="w-10 h-10 text-orange-500 animate-spin mb-3" />
                    <p className="text-slate-500 font-bold text-sm">Evaluating Personal Scorecard...</p>
                </div>
            ) : !performanceData ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-sm">
                    <Target className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600 font-bold text-lg">No performance scorecard found for {period}.</p>
                    <p className="text-xs text-slate-400 mt-1">Check back once your manager assigns KPIs or orders are generated.</p>
                </div>
            ) : (
                <>
                    {/* Overall Score & Badge Card */}
                    <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/60 rounded-3xl border border-slate-800 p-8 shadow-2xl text-white flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 flex-shrink-0">
                                <Trophy className="w-8 h-8" />
                            </div>
                            <div>
                                <span className="text-xs font-bold text-orange-400 uppercase tracking-wider block mb-1">
                                    Overall Monthly Evaluation
                                </span>
                                <h2 className="text-2xl font-extrabold text-white">
                                    {performanceData.performanceLevel?.levelName || 'Evaluated Performer'}
                                </h2>
                                <p className="text-xs text-slate-400 mt-1 max-w-md">
                                    {performanceData.performanceLevel?.description || 'Your score reflects weighted KPI achievements across operations and discipline.'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-slate-800 w-full md:w-auto justify-between md:justify-end">
                            <div className="text-right">
                                <span className="text-xs text-slate-400 uppercase font-bold block">Final Score</span>
                                <div className="text-5xl font-black text-white tracking-tight mt-0.5">
                                    {performanceData.finalScore} <span className="text-lg font-normal text-slate-500">/ 100</span>
                                </div>
                            </div>
                            <div className="pl-4 border-l border-slate-800">
                                {getLevelBadge(performanceData.performanceLevel?.levelName, performanceData.performanceLevel?.color)}
                            </div>
                        </div>
                    </div>

                    {/* Financial & Operational Contributions */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Gross Revenue Generated</span>
                                <span className="text-2xl font-extrabold text-emerald-600 mt-1 block">
                                    {formatCurrency(performanceData.financialBreakdown?.grossRevenue)}
                                </span>
                                <span className="text-[11px] text-slate-500 mt-0.5 block">From your onboarded & assigned restaurants</span>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                                <DollarSign className="w-6 h-6" />
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Approved Expenses</span>
                                <span className="text-2xl font-extrabold text-amber-600 mt-1 block">
                                    {formatCurrency(performanceData.financialBreakdown?.approvedExpenses)}
                                </span>
                                <span className="text-[11px] text-slate-500 mt-0.5 block">Travel, food & hotel claims</span>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Net Profit Contribution</span>
                                <span className="text-2xl font-extrabold text-blue-600 mt-1 block">
                                    {formatCurrency(performanceData.financialBreakdown?.netProfit)}
                                </span>
                                <span className="text-[11px] text-slate-500 mt-0.5 block">After platform charges & deductions</span>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                                <Zap className="w-6 h-6" />
                            </div>
                        </div>
                    </div>

                    {/* Strengths & Improvement Areas Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gradient-to-br from-emerald-50/50 to-white border border-emerald-200/80 rounded-3xl p-6 shadow-sm">
                            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Core Strengths (Exceeding Targets)
                            </h3>
                            {strengths.length === 0 ? (
                                <p className="text-xs text-slate-500 py-4">Keep pushing! Achieve 80%+ on any KPI to unlock a strength badge.</p>
                            ) : (
                                <div className="space-y-3">
                                    {strengths.map((s, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-emerald-100 shadow-sm">
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm">{s.kpi?.name}</h4>
                                                <span className="text-[11px] text-slate-500">Target: {s.result?.targetValue} • Weight: {s.kpi?.weightage}%</span>
                                            </div>
                                            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 font-extrabold text-xs rounded-full border border-emerald-200">
                                                {s.result?.scorePercentage}% Achieved
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-gradient-to-br from-amber-50/50 to-white border border-amber-200/80 rounded-3xl p-6 shadow-sm">
                            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
                                <AlertCircle className="w-5 h-5 text-amber-600" /> Areas for Growth (&lt;60% Score)
                            </h3>
                            {improvements.length === 0 ? (
                                <p className="text-xs text-emerald-600 font-semibold py-4">Excellent! None of your KPIs are in the needs-improvement zone.</p>
                            ) : (
                                <div className="space-y-3">
                                    {improvements.map((s, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-amber-100 shadow-sm">
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm">{s.kpi?.name}</h4>
                                                <span className="text-[11px] text-slate-500">Target: {s.result?.targetValue} • Achieved: {s.result?.achievedValue}</span>
                                            </div>
                                            <span className="px-3 py-1 bg-amber-500/10 text-amber-600 font-extrabold text-xs rounded-full border border-amber-200">
                                                {s.result?.scorePercentage}% Score
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* KPI Detail Cards */}
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Detailed KPI Breakdown & Progress</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {performanceData.results?.map((kpiData, idx) => (
                                <div key={idx} className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:border-orange-500/30 transition-all duration-300">
                                    <div>
                                        <div className="flex justify-between items-start mb-3 gap-2">
                                            <div>
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-500 bg-orange-50 px-2 py-0.5 rounded border border-orange-100">
                                                    {kpiData.kpi?.categoryId?.name || 'General KPI'}
                                                </span>
                                                <h4 className="font-extrabold text-slate-800 text-base mt-2">{kpiData.kpi.name}</h4>
                                            </div>
                                            <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-xl flex-shrink-0">
                                                Weight: {kpiData.kpi.weightage}%
                                            </span>
                                        </div>
                                        
                                        <p className="text-xs text-slate-500 line-clamp-2 mb-6">
                                            {kpiData.kpi.description || 'No description provided.'}
                                        </p>
                                    </div>
                                    
                                    <div className="space-y-4 pt-4 border-t border-slate-100">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <span className="text-[11px] text-slate-400 font-semibold block mb-0.5">Achieved / Target</span>
                                                <span className="text-xl font-extrabold text-slate-800">
                                                    {kpiData.kpi.targetType === 'Currency' ? '₹' : ''}{kpiData.result.achievedValue}
                                                    <span className="text-xs font-semibold text-slate-400 ml-1">
                                                        / {kpiData.kpi.targetType === 'Currency' ? '₹' : ''}{kpiData.result.targetValue} {kpiData.kpi.targetType === 'Percentage' ? '%' : ''}
                                                    </span>
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[11px] text-slate-400 font-semibold block mb-0.5">Score Rate</span>
                                                <span className={`text-lg font-extrabold ${
                                                    kpiData.result.scorePercentage >= 80 ? 'text-emerald-600' : kpiData.result.scorePercentage >= 50 ? 'text-orange-500' : 'text-rose-500'
                                                }`}>
                                                    {kpiData.result.scorePercentage}%
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {/* Progress Bar */}
                                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-1000 ${
                                                    kpiData.result.scorePercentage >= 80 ? 'bg-emerald-500' : kpiData.result.scorePercentage >= 50 ? 'bg-orange-500' : 'bg-rose-500'
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
