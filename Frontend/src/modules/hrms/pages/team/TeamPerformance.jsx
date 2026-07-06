import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'react-hot-toast';
import { Target, Users, RefreshCw, BarChart2, ChevronRight, Trophy, AlertTriangle, Award, DollarSign, TrendingUp, X, Sparkles, ShieldCheck } from 'lucide-react';

export default function TeamPerformance() {
    const [teamData, setTeamData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedMember, setSelectedMember] = useState(null);
    const [memberPerformance, setMemberPerformance] = useState(null);
    const [loadingMember, setLoadingMember] = useState(false);
    
    const [period, setPeriod] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const fetchPerformance = async (force = false) => {
        setLoading(true);
        try {
            const res = await axiosInstance.get(`/hrms/performance/team-performance?period=${period}&forceRecalculate=${force}`);
            setTeamData(res.data?.data || null);
        } catch (error) {
            toast.error('Failed to load team performance data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPerformance();
    }, [period]);

    const handleViewMember = async (memberId) => {
        setSelectedMember(memberId);
        setLoadingMember(true);
        try {
            const res = await axiosInstance.get(`/hrms/performance/employee-performance/${memberId}?period=${period}`);
            setMemberPerformance(res.data?.data || null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error loading employee scorecard');
            setSelectedMember(null);
        } finally {
            setLoadingMember(false);
        }
    };

    const formatCurrency = (val) => {
        return `₹${Number(val || 0).toLocaleString('en-IN')}`;
    };

    const getLevelBadge = (levelName, color) => {
        return (
            <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-sm"
                style={{
                    backgroundColor: `${color || '#3b82f6'}15`,
                    color: color || '#3b82f6',
                    borderColor: `${color || '#3b82f6'}30`,
                    borderWidth: '1px'
                }}
            >
                <Award className="w-3.5 h-3.5" />
                {levelName || 'Average'}
            </span>
        );
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-3xl text-white shadow-xl">
                <div>
                    <div className="flex items-center gap-2 text-orange-400 font-bold text-xs tracking-wider uppercase mb-1">
                        <Trophy className="w-4 h-4" /> Manager Portal Suite
                    </div>
                    <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
                        <Users className="w-7 h-7 text-orange-500" />
                        Team Performance & KPI Analytics
                    </h1>
                    <p className="text-sm text-slate-300 mt-1">
                        Monitor team achievement, revenue generation, operational profit, and individual employee scorecards.
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
                        Recalculate
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col justify-center items-center py-24">
                    <RefreshCw className="w-10 h-10 text-orange-500 animate-spin mb-3" />
                    <p className="text-slate-500 font-bold text-sm">Evaluating Team KPIs...</p>
                </div>
            ) : !teamData ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-sm">
                    <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600 font-bold text-lg">No team data found for {period}.</p>
                    <p className="text-xs text-slate-400 mt-1">Check your period filter or make sure team members are assigned to you.</p>
                </div>
            ) : (
                <>
                    {/* Team Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Team Size</p>
                                <p className="text-3xl font-extrabold text-slate-800 mt-1">{teamData.teamSize} <span className="text-sm font-normal text-slate-500">members</span></p>
                            </div>
                            <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                                <Users className="w-6 h-6" />
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Team Average Score</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-3xl font-extrabold text-slate-800">{teamData.averageTeamScore} <span className="text-sm font-normal text-slate-500">/ 100</span></p>
                                </div>
                                <div className="mt-2">
                                    {getLevelBadge(teamData.performanceLevel?.levelName, teamData.performanceLevel?.color)}
                                </div>
                            </div>
                            <div className="w-12 h-12 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
                                <BarChart2 className="w-6 h-6" />
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Team Gross Revenue</p>
                                <p className="text-2xl font-extrabold text-emerald-600 mt-1">{formatCurrency(teamData.financialBreakdown?.grossRevenue)}</p>
                                <span className="text-[11px] text-slate-400 block mt-1">From delivered orders</span>
                            </div>
                            <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                                <DollarSign className="w-6 h-6" />
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Team Net Profit</p>
                                <p className="text-2xl font-extrabold text-amber-600 mt-1">{formatCurrency(teamData.financialBreakdown?.netProfit)}</p>
                                <span className="text-[11px] text-slate-400 block mt-1">After GST & incentives</span>
                            </div>
                            <div className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                        </div>
                    </div>

                    {/* Spotlight: Top vs Lowest Performer */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {teamData.topPerformer && (
                            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-800 bg-amber-200/60 px-3 py-1 rounded-full">
                                        <Trophy className="w-3.5 h-3.5 text-amber-600" /> Team Star Performer
                                    </span>
                                    <h3 className="text-lg font-extrabold text-slate-800 pt-2">
                                        {teamData.topPerformer.member?.adminId?.name || teamData.topPerformer.member?.employeeId}
                                    </h3>
                                    <p className="text-xs text-slate-600">
                                        {teamData.topPerformer.member?.designation} • {teamData.topPerformer.member?.department}
                                    </p>
                                    <div className="pt-2 flex items-center gap-3">
                                        <span className="text-2xl font-extrabold text-amber-600">{teamData.topPerformer.performance?.finalScore} pts</span>
                                        {getLevelBadge(teamData.topPerformer.performance?.performanceLevel?.levelName, teamData.topPerformer.performance?.performanceLevel?.color)}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleViewMember(teamData.topPerformer.member?._id)}
                                    className="px-4 py-2.5 bg-white hover:bg-amber-100 text-amber-900 rounded-xl font-bold text-xs shadow-sm border border-amber-200 transition-colors"
                                >
                                    View Scorecard
                                </button>
                            </div>
                        )}

                        {teamData.lowestPerformer && teamData.teamSize > 1 && (
                            <div className="bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200/80 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-rose-800 bg-rose-200/60 px-3 py-1 rounded-full">
                                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Coaching Priority
                                    </span>
                                    <h3 className="text-lg font-extrabold text-slate-800 pt-2">
                                        {teamData.lowestPerformer.member?.adminId?.name || teamData.lowestPerformer.member?.employeeId}
                                    </h3>
                                    <p className="text-xs text-slate-600">
                                        {teamData.lowestPerformer.member?.designation} • {teamData.lowestPerformer.member?.department}
                                    </p>
                                    <div className="pt-2 flex items-center gap-3">
                                        <span className="text-2xl font-extrabold text-rose-600">{teamData.lowestPerformer.performance?.finalScore} pts</span>
                                        {getLevelBadge(teamData.lowestPerformer.performance?.performanceLevel?.levelName, teamData.lowestPerformer.performance?.performanceLevel?.color)}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleViewMember(teamData.lowestPerformer.member?._id)}
                                    className="px-4 py-2.5 bg-white hover:bg-rose-100 text-rose-900 rounded-xl font-bold text-xs shadow-sm border border-rose-200 transition-colors"
                                >
                                    View Scorecard
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Team Members List */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="font-extrabold text-slate-800 text-lg">Team Members Leaderboard & Scorecards</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Click View Details to drill down into individual metrics, financial contributions, and strengths.</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 text-[11px] font-extrabold uppercase text-slate-400 tracking-wider bg-slate-50">
                                        <th className="py-3.5 px-6">Rank</th>
                                        <th className="py-3.5 px-6">Employee</th>
                                        <th className="py-3.5 px-6">Department & Zone</th>
                                        <th className="py-3.5 px-6 text-right">Gross Revenue</th>
                                        <th className="py-3.5 px-6 text-right">Net Profit</th>
                                        <th className="py-3.5 px-6 text-right">Score</th>
                                        <th className="py-3.5 px-6 text-center">Level Badge</th>
                                        <th className="py-3.5 px-6 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {teamData.teamMembersPerformance?.map((item, idx) => (
                                        <tr key={item.member?._id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-4 px-6 font-extrabold text-slate-400">
                                                #{idx + 1}
                                            </td>
                                            <td className="py-4 px-6 font-bold text-slate-800">
                                                <div>
                                                    <span className="text-sm font-extrabold text-slate-900">{item.member?.adminId?.name || item.member?.employeeId}</span>
                                                    <span className="block text-[11px] font-normal text-slate-500">{item.member?.designation}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-slate-600">
                                                <span className="font-semibold text-slate-800">{item.member?.department}</span>
                                                <span className="block text-[11px] text-slate-400">{item.member?.zone || 'Central'}</span>
                                            </td>
                                            <td className="py-4 px-6 text-right font-mono text-emerald-600 font-bold">
                                                {formatCurrency(item.performance?.financialBreakdown?.grossRevenue)}
                                            </td>
                                            <td className="py-4 px-6 text-right font-mono text-amber-600 font-bold">
                                                {formatCurrency(item.performance?.financialBreakdown?.netProfit)}
                                            </td>
                                            <td className="py-4 px-6 text-right font-extrabold text-slate-900 text-sm">
                                                {item.performance?.finalScore} pts
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                {getLevelBadge(item.performance?.performanceLevel?.levelName, item.performance?.performanceLevel?.color)}
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <button
                                                    onClick={() => handleViewMember(item.member?._id)}
                                                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-orange-50 hover:text-orange-600 text-slate-700 rounded-xl font-bold text-xs transition-colors flex items-center gap-1 ml-auto"
                                                >
                                                    View Details <ChevronRight className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* EMPLOYEE SCORECARD MODAL */}
            {selectedMember && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 bg-slate-900 text-white flex-shrink-0">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">Employee Scorecard Drill-down</span>
                                <h3 className="text-xl font-extrabold text-white mt-0.5">
                                    {memberPerformance?.employeeDetails?.name || 'Employee Scorecard'}
                                </h3>
                                <p className="text-xs text-slate-400">
                                    {memberPerformance?.employeeDetails?.designation} • {memberPerformance?.employeeDetails?.department}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedMember(null)}
                                className="p-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {loadingMember ? (
                                <div className="flex justify-center items-center py-20">
                                    <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
                                </div>
                            ) : !memberPerformance ? (
                                <p className="text-center py-10 text-slate-500 font-semibold">Failed to load scorecard.</p>
                            ) : (
                                <>
                                    {/* Overall Score Banner */}
                                    <div className="flex items-center justify-between bg-gradient-to-r from-orange-50 to-amber-50 p-5 rounded-2xl border border-orange-200">
                                        <div>
                                            <span className="text-xs font-bold text-orange-800 uppercase tracking-wider">Overall Performance Score</span>
                                            <h4 className="text-3xl font-extrabold text-slate-900 mt-1">{memberPerformance.finalScore} <span className="text-sm font-normal text-slate-500">/ 100</span></h4>
                                        </div>
                                        <div>
                                            {getLevelBadge(memberPerformance.performanceLevel?.levelName, memberPerformance.performanceLevel?.color)}
                                        </div>
                                    </div>

                                    {/* Financial Breakdown */}
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Financial & Operational Contribution</h4>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                                                <span className="text-[10px] text-slate-400 block font-semibold">Gross Revenue</span>
                                                <span className="text-sm font-extrabold text-emerald-600">{formatCurrency(memberPerformance.financialBreakdown?.grossRevenue)}</span>
                                            </div>
                                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                                                <span className="text-[10px] text-slate-400 block font-semibold">Approved Expenses</span>
                                                <span className="text-sm font-extrabold text-amber-600">{formatCurrency(memberPerformance.financialBreakdown?.approvedExpenses)}</span>
                                            </div>
                                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                                                <span className="text-[10px] text-slate-400 block font-semibold">Net Profit Contribution</span>
                                                <span className="text-sm font-extrabold text-blue-600">{formatCurrency(memberPerformance.financialBreakdown?.netProfit)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* KPI Breakdown Table */}
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">KPI Evaluation Breakdown</h4>
                                        <div className="border border-slate-200 rounded-2xl overflow-hidden">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold">
                                                    <tr>
                                                        <th className="py-3 px-4">KPI Metric</th>
                                                        <th className="py-3 px-4 text-right">Target</th>
                                                        <th className="py-3 px-4 text-right">Achieved</th>
                                                        <th className="py-3 px-4 text-right">Weight</th>
                                                        <th className="py-3 px-4 text-right">Score</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {memberPerformance.results?.map((resItem, i) => (
                                                        <tr key={i} className="hover:bg-slate-50/50">
                                                            <td className="py-3 px-4 font-bold text-slate-800">
                                                                {resItem.kpi?.name}
                                                                <span className="block text-[10px] font-normal text-slate-400">{resItem.kpi?.categoryId?.name || 'General'}</span>
                                                            </td>
                                                            <td className="py-3 px-4 text-right font-semibold text-slate-600">
                                                                {resItem.kpi?.targetType === 'Currency' ? '₹' : ''}{resItem.result?.targetValue}{resItem.kpi?.targetType === 'Percentage' ? '%' : ''}
                                                            </td>
                                                            <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                                                                {resItem.kpi?.targetType === 'Currency' ? '₹' : ''}{resItem.result?.achievedValue}{resItem.kpi?.targetType === 'Percentage' ? '%' : ''}
                                                            </td>
                                                            <td className="py-3 px-4 text-right text-slate-500 font-semibold">
                                                                {resItem.kpi?.weightage}%
                                                            </td>
                                                            <td className="py-3 px-4 text-right font-extrabold text-orange-600">
                                                                {resItem.result?.scorePercentage}%
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => setSelectedMember(null)}
                                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition-colors"
                            >
                                Close Scorecard
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
