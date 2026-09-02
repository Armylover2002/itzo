import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'react-hot-toast';
import { Target, Users, RefreshCw, BarChart2, ChevronRight, Trophy, AlertTriangle, Award, DollarSign, TrendingUp, X } from 'lucide-react';

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
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-[#f7f3fc] flex items-center justify-center">
                            <Users className="w-5 h-5 text-[#550fa8]" />
                        </div>
                        Team Performance
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 ml-[52px]">
                        Monitor team achievements, revenue contributions, and individual scorecards.
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
                    <p className="text-slate-400 font-medium text-sm">Loading team data...</p>
                </div>
            ) : !teamData ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-700 font-semibold text-lg">No team data for {period}</p>
                    <p className="text-sm text-slate-400 mt-1">Check your period filter or ensure team members are assigned.</p>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-slate-500">Team Size</p>
                                <p className="text-2xl font-bold text-slate-900 mt-0.5">{teamData.teamSize} <span className="text-sm font-normal text-slate-400">members</span></p>
                            </div>
                            <div className="w-10 h-10 bg-[#f7f3fc] rounded-xl flex items-center justify-center text-[#550fa8]">
                                <Users className="w-5 h-5" />
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-slate-500">Average Score</p>
                                    <p className="text-2xl font-bold text-slate-900 mt-0.5">{teamData.averageTeamScore} <span className="text-sm font-normal text-slate-400">/ 100</span></p>
                                </div>
                                <div className="w-10 h-10 bg-[#f7f3fc] rounded-xl flex items-center justify-center text-[#550fa8]">
                                    <BarChart2 className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="mt-2">
                                {getLevelBadge(teamData.performanceLevel?.levelName, teamData.performanceLevel?.color)}
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-slate-500">Gross Revenue</p>
                                <p className="text-xl font-bold text-emerald-600 mt-0.5">{formatCurrency(teamData.financialBreakdown?.grossRevenue)}</p>
                                <span className="text-xs text-slate-400">From delivered orders</span>
                            </div>
                            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                                <DollarSign className="w-5 h-5" />
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-slate-500">Net Profit</p>
                                <p className="text-xl font-bold text-amber-600 mt-0.5">{formatCurrency(teamData.financialBreakdown?.netProfit)}</p>
                                <span className="text-xs text-slate-400">After deductions</span>
                            </div>
                            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                        </div>
                    </div>

                    {/* Spotlight: Top vs Lowest */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {teamData.topPerformer && (
                            <div className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                                        <Trophy className="w-3.5 h-3.5" /> Top Performer
                                    </span>
                                    <h3 className="text-base font-bold text-slate-900 pt-1">
                                        {teamData.topPerformer.member?.adminId?.name || teamData.topPerformer.member?.employeeId}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        {teamData.topPerformer.member?.designation} • {teamData.topPerformer.member?.department}
                                    </p>
                                    <div className="pt-1.5 flex items-center gap-3">
                                        <span className="text-xl font-bold text-emerald-600">{teamData.topPerformer.performance?.finalScore} pts</span>
                                        {getLevelBadge(teamData.topPerformer.performance?.performanceLevel?.levelName, teamData.topPerformer.performance?.performanceLevel?.color)}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleViewMember(teamData.topPerformer.member?._id)}
                                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-semibold text-xs border border-emerald-200 transition-colors"
                                >
                                    View
                                </button>
                            </div>
                        )}

                        {teamData.lowestPerformer && teamData.teamSize > 1 && (
                            <div className="bg-white border border-red-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-full">
                                        <AlertTriangle className="w-3.5 h-3.5" /> Needs Coaching
                                    </span>
                                    <h3 className="text-base font-bold text-slate-900 pt-1">
                                        {teamData.lowestPerformer.member?.adminId?.name || teamData.lowestPerformer.member?.employeeId}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        {teamData.lowestPerformer.member?.designation} • {teamData.lowestPerformer.member?.department}
                                    </p>
                                    <div className="pt-1.5 flex items-center gap-3">
                                        <span className="text-xl font-bold text-red-600">{teamData.lowestPerformer.performance?.finalScore} pts</span>
                                        {getLevelBadge(teamData.lowestPerformer.performance?.performanceLevel?.levelName, teamData.lowestPerformer.performance?.performanceLevel?.color)}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleViewMember(teamData.lowestPerformer.member?._id)}
                                    className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-semibold text-xs border border-red-200 transition-colors"
                                >
                                    View
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Team Members Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-5 border-b border-slate-100">
                            <h3 className="font-bold text-slate-900 text-base">Team Leaderboard</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Click "View" to see individual KPI breakdown and financials.</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-500 tracking-wider bg-slate-50">
                                        <th className="py-3 px-5">Rank</th>
                                        <th className="py-3 px-5">Employee</th>
                                        <th className="py-3 px-5">Department</th>
                                        <th className="py-3 px-5 text-right">Revenue</th>
                                        <th className="py-3 px-5 text-right">Net Profit</th>
                                        <th className="py-3 px-5 text-right">Score</th>
                                        <th className="py-3 px-5 text-center">Rating</th>
                                        <th className="py-3 px-5 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {teamData.teamMembersPerformance?.map((item, idx) => (
                                        <tr key={item.member?._id} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-3.5 px-5 font-bold text-slate-400 text-xs">
                                                #{idx + 1}
                                            </td>
                                            <td className="py-3.5 px-5">
                                                <span className="font-semibold text-slate-900">{item.member?.adminId?.name || item.member?.employeeId}</span>
                                                <span className="block text-xs text-slate-500">{item.member?.designation}</span>
                                            </td>
                                            <td className="py-3.5 px-5 text-slate-600">
                                                <span className="font-medium">{item.member?.department}</span>
                                                <span className="block text-xs text-slate-400">{item.member?.zone || 'Central'}</span>
                                            </td>
                                            <td className="py-3.5 px-5 text-right font-semibold text-emerald-600">
                                                {formatCurrency(item.performance?.financialBreakdown?.grossRevenue)}
                                            </td>
                                            <td className="py-3.5 px-5 text-right font-semibold text-amber-600">
                                                {formatCurrency(item.performance?.financialBreakdown?.netProfit)}
                                            </td>
                                            <td className="py-3.5 px-5 text-right font-bold text-slate-900">
                                                {item.performance?.finalScore} pts
                                            </td>
                                            <td className="py-3.5 px-5 text-center">
                                                {getLevelBadge(item.performance?.performanceLevel?.levelName, item.performance?.performanceLevel?.color)}
                                            </td>
                                            <td className="py-3.5 px-5 text-right">
                                                <button
                                                    onClick={() => handleViewMember(item.member?._id)}
                                                    className="px-3 py-1.5 bg-slate-50 hover:bg-[#f7f3fc] hover:text-[#550fa8] text-slate-600 rounded-lg font-semibold text-xs transition-colors flex items-center gap-1 ml-auto"
                                                >
                                                    View <ChevronRight className="w-3.5 h-3.5" />
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
                            <div>
                                <span className="text-xs font-semibold text-[#550fa8]">Employee Scorecard</span>
                                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                                    {memberPerformance?.employeeDetails?.name || 'Employee'}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    {memberPerformance?.employeeDetails?.designation} • {memberPerformance?.employeeDetails?.department}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedMember(null)}
                                className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto flex-1 space-y-5">
                            {loadingMember ? (
                                <div className="flex justify-center items-center py-20">
                                    <RefreshCw className="w-7 h-7 text-[#6412c6] animate-spin" />
                                </div>
                            ) : !memberPerformance ? (
                                <p className="text-center py-10 text-slate-400 font-medium">Failed to load scorecard.</p>
                            ) : (
                                <>
                                    {/* Overall Score */}
                                    <div className="flex items-center justify-between bg-slate-50 p-5 rounded-xl border border-slate-200">
                                        <div>
                                            <span className="text-xs font-medium text-slate-500">Performance Score</span>
                                            <h4 className="text-3xl font-black text-slate-900 mt-0.5">{memberPerformance.finalScore} <span className="text-sm font-normal text-slate-400">/ 100</span></h4>
                                        </div>
                                        {getLevelBadge(memberPerformance.performanceLevel?.levelName, memberPerformance.performanceLevel?.color)}
                                    </div>

                                    {/* Financial Summary */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                                            <span className="text-xs text-slate-400 block font-medium">Revenue</span>
                                            <span className="text-sm font-bold text-emerald-600">{formatCurrency(memberPerformance.financialBreakdown?.grossRevenue)}</span>
                                        </div>
                                        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                                            <span className="text-xs text-slate-400 block font-medium">Expenses</span>
                                            <span className="text-sm font-bold text-amber-600">{formatCurrency(memberPerformance.financialBreakdown?.approvedExpenses)}</span>
                                        </div>
                                        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                                            <span className="text-xs text-slate-400 block font-medium">Net Profit</span>
                                            <span className="text-sm font-bold text-[#550fa8]">{formatCurrency(memberPerformance.financialBreakdown?.netProfit)}</span>
                                        </div>
                                    </div>

                                    {/* KPI Breakdown */}
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                                                <tr>
                                                    <th className="py-3 px-4">KPI</th>
                                                    <th className="py-3 px-4 text-right">Target</th>
                                                    <th className="py-3 px-4 text-right">Achieved</th>
                                                    <th className="py-3 px-4 text-right">Weight</th>
                                                    <th className="py-3 px-4 text-right">Score</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {memberPerformance.results?.map((resItem, i) => (
                                                    <tr key={i} className="hover:bg-slate-50">
                                                        <td className="py-3 px-4 font-semibold text-slate-800">
                                                            {resItem.kpi?.name}
                                                            <span className="block text-[10px] font-normal text-slate-400">{resItem.kpi?.categoryId?.name || 'General'}</span>
                                                        </td>
                                                        <td className="py-3 px-4 text-right text-slate-600">
                                                            {resItem.kpi?.targetType === 'Currency' ? '₹' : ''}{resItem.result?.targetValue}{resItem.kpi?.targetType === 'Percentage' ? '%' : ''}
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                                                            {resItem.kpi?.targetType === 'Currency' ? '₹' : ''}{resItem.result?.achievedValue}{resItem.kpi?.targetType === 'Percentage' ? '%' : ''}
                                                        </td>
                                                        <td className="py-3 px-4 text-right text-slate-500">
                                                            {resItem.kpi?.weightage}%
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-bold text-[#550fa8]">
                                                            {resItem.result?.scorePercentage}%
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setSelectedMember(null)}
                                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold text-xs transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
