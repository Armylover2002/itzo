import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'react-hot-toast';
import { 
    TrendingUp, Users, Activity, BarChart2, Star, AlertTriangle, RefreshCw, 
    Download, Filter, DollarSign, Award, Trophy, ShieldAlert, UserCheck, 
    Layers, MapPin, Building2, ChevronRight, Search, FileText, FileSpreadsheet
} from 'lucide-react';

export default function HrmsAdminPerformance() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // overview | leaderboard | risk | departments | directory
    
    // Filters
    const [period, setPeriod] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [department, setDepartment] = useState('All');
    const [zone, setZone] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [exporting, setExporting] = useState(false);

    const fetchAnalytics = async (force = false) => {
        setLoading(true);
        try {
            const res = await axiosInstance.get(`/hrms/performance/analytics-overview?period=${period}&department=${department}&zone=${zone}&forceRecalculate=${force}`);
            setData(res.data?.data || null);
        } catch (error) {
            toast.error('Failed to load performance analytics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [period, department, zone]);

    const handleExport = async (reportType, format) => {
        setExporting(true);
        try {
            const res = await axiosInstance.get(`/hrms/performance/export?reportType=${reportType}&format=${format}&period=${period}&department=${department}&zone=${zone}`);
            const exportData = res.data?.data;
            
            if (format === 'csv' || format === 'excel') {
                // Generate CSV string
                const rows = exportData?.rows || [];
                if (rows.length === 0) {
                    toast.error('No data available to export');
                    return;
                }
                const headers = Object.keys(rows[0]).join(',');
                const csvContent = "data:text/csv;charset=utf-8," + [
                    headers,
                    ...rows.map(row => Object.values(row).map(val => `"${val}"`).join(','))
                ].join('\n');

                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `ItzoFood_${reportType}_Performance_${period}.${format === 'excel' ? 'xls' : 'csv'}`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success(`Exported ${reportType} Report (${format.toUpperCase()})`);
            } else {
                toast.success(`Report generated: ${exportData?.totalRecords} records ready`);
            }
        } catch (error) {
            toast.error('Export failed');
        } finally {
            setExporting(false);
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
                    backgroundColor: `${color || '#3b82f6'}20`,
                    color: color || '#3b82f6',
                    borderColor: `${color || '#3b82f6'}40`,
                    borderWidth: '1px'
                }}
            >
                <Award className="w-3.5 h-3.5" />
                {levelName || 'Average'}
            </span>
        );
    };

    const filteredDirectory = data?.allPerformances?.filter(item => {
        if (!searchQuery) return true;
        const name = item.employee?.adminId?.name || item.employee?.employeeId || '';
        const dept = item.employee?.department || '';
        const zn = item.employee?.zone || '';
        return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
               dept.toLowerCase().includes(searchQuery.toLowerCase()) ||
               zn.toLowerCase().includes(searchQuery.toLowerCase());
    }) || [];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 bg-slate-950 min-h-screen text-slate-100">
            {/* Top Banner */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 p-6 rounded-3xl border border-slate-800 shadow-2xl">
                <div>
                    <div className="flex items-center gap-2 text-orange-400 font-bold text-xs tracking-wider uppercase mb-1">
                        <Trophy className="w-4 h-4" /> Executive BI Dashboard
                    </div>
                    <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
                        <BarChart2 className="w-8 h-8 text-orange-500" />
                        Enterprise Performance & KPI Analytics
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Real-time scorecards, revenue contributions, operational profit breakdowns, and AI-ready risk detection.
                    </p>
                </div>

                {/* Filter Controls Suite */}
                <div className="flex flex-wrap items-center gap-3 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-2">
                        <input
                            type="month"
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
                        />
                    </div>

                    <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:border-orange-500"
                    >
                        <option value="All">All Departments</option>
                        <option value="Sales">Sales</option>
                        <option value="Operations">Operations</option>
                        <option value="Delivery">Delivery</option>
                        <option value="HR">HR & Admin</option>
                    </select>

                    <select
                        value={zone}
                        onChange={(e) => setZone(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:border-orange-500"
                    >
                        <option value="All">All Zones</option>
                        <option value="North">North Zone</option>
                        <option value="South">South Zone</option>
                        <option value="East">East Zone</option>
                        <option value="West">West Zone</option>
                        <option value="Central">Central</option>
                    </select>

                    <button
                        onClick={() => fetchAnalytics(true)}
                        className="p-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-500/20 transition-all"
                        title="Force Recalculate All KPIs"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>

                    {/* Export Dropdown */}
                    <div className="relative group">
                        <button
                            disabled={exporting}
                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-all"
                        >
                            <Download className="w-4 h-4 text-emerald-400" />
                            <span>Export</span>
                        </button>
                        <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl py-2 hidden group-hover:block z-50">
                            <button
                                onClick={() => handleExport('Employee', 'csv')}
                                className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"
                            >
                                <FileText className="w-4 h-4 text-blue-400" /> Export Scorecards (CSV)
                            </button>
                            <button
                                onClick={() => handleExport('Revenue', 'excel')}
                                className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"
                            >
                                <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export Financials (Excel)
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
                {[
                    { id: 'overview', label: 'Executive Overview', icon: Activity },
                    { id: 'leaderboard', label: 'Leaderboard & Top Performers', icon: Trophy },
                    { id: 'risk', label: 'Risk & Intervention Alert', icon: ShieldAlert, count: (data?.riskEmployees?.length || 0) + (data?.inactiveEmployees?.length || 0) },
                    { id: 'directory', label: 'All Employees Scorecards', icon: Users, count: data?.totalEvaluated || 0 }
                ].map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all ${
                                activeTab === tab.id
                                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20'
                                    : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            <span>{tab.label}</span>
                            {tab.count !== undefined && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                    activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                                }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* TAB CONTENT */}
            {loading ? (
                <div className="flex flex-col justify-center items-center py-24">
                    <RefreshCw className="w-10 h-10 text-orange-500 animate-spin mb-3" />
                    <p className="text-slate-400 font-bold text-sm">Evaluating Enterprise KPIs...</p>
                </div>
            ) : !data ? (
                <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-slate-800">
                    <Activity className="w-16 h-16 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-300 font-bold text-lg">No performance data found for {period}.</p>
                    <p className="text-xs text-slate-500 mt-1">Try changing your filter period or clicking Force Recalculate.</p>
                </div>
            ) : (
                <>
                    {/* TAB 1: EXECUTIVE OVERVIEW */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            {/* KPI Metrics Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                                <div className="bg-gradient-to-br from-slate-900 to-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400">
                                            <Users className="w-6 h-6" />
                                        </div>
                                        <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">Active Force</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Evaluated</p>
                                    <h3 className="text-3xl font-extrabold text-white mt-1">{data.totalEvaluated} <span className="text-sm font-normal text-slate-500">staff</span></h3>
                                </div>

                                <div className="bg-gradient-to-br from-slate-900 to-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-orange-400">
                                            <Activity className="w-6 h-6" />
                                        </div>
                                        {getLevelBadge(data.performanceLevel?.levelName, data.performanceLevel?.color)}
                                    </div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Company Average Score</p>
                                    <h3 className="text-3xl font-extrabold text-white mt-1">{data.averageScore} <span className="text-sm font-normal text-slate-500">/ 100</span></h3>
                                </div>

                                <div className="bg-gradient-to-br from-slate-900 to-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
                                            <DollarSign className="w-6 h-6" />
                                        </div>
                                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">Gross Revenue</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Revenue Contribution</p>
                                    <h3 className="text-2xl font-extrabold text-emerald-400 mt-1">{formatCurrency(data.financialBreakdown?.grossRevenue)}</h3>
                                </div>

                                <div className="bg-gradient-to-br from-slate-900 to-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
                                            <TrendingUp className="w-6 h-6" />
                                        </div>
                                        <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">Net Margin</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Net Profit Contribution</p>
                                    <h3 className="text-2xl font-extrabold text-amber-400 mt-1">{formatCurrency(data.financialBreakdown?.netProfit)}</h3>
                                </div>
                            </div>

                            {/* Financial Breakdown Detailed Card */}
                            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <DollarSign className="w-5 h-5 text-emerald-400" /> Enterprise Financial & Operational Deduction Breakdown
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase block">Gross Revenue</span>
                                        <span className="text-lg font-extrabold text-white mt-1 block">{formatCurrency(data.financialBreakdown?.grossRevenue)}</span>
                                    </div>
                                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase block">Platform Cost (5%)</span>
                                        <span className="text-lg font-extrabold text-rose-400 mt-1 block">-{formatCurrency(data.financialBreakdown?.platformCharges)}</span>
                                    </div>
                                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase block">GST Amount (5%)</span>
                                        <span className="text-lg font-extrabold text-rose-400 mt-1 block">-{formatCurrency(data.financialBreakdown?.gstAmount)}</span>
                                    </div>
                                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase block">Staff Incentives</span>
                                        <span className="text-lg font-extrabold text-amber-400 mt-1 block">-{formatCurrency(data.financialBreakdown?.employeeIncentive)}</span>
                                    </div>
                                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase block">Approved Expenses</span>
                                        <span className="text-lg font-extrabold text-amber-400 mt-1 block">-{formatCurrency(data.financialBreakdown?.approvedExpenses)}</span>
                                    </div>
                                    <div className="bg-gradient-to-br from-emerald-950/40 to-slate-950 p-4 rounded-2xl border border-emerald-500/30">
                                        <span className="text-[11px] font-bold text-emerald-400 uppercase block">Net Profit Contribution</span>
                                        <span className="text-lg font-extrabold text-emerald-400 mt-1 block">{formatCurrency(data.financialBreakdown?.netProfit)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: LEADERBOARD & TOP PERFORMERS */}
                    {activeTab === 'leaderboard' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
                            {/* Top 10 Performers */}
                            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
                                <div className="flex items-center justify-between mb-5">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Trophy className="w-5 h-5 text-amber-400" /> Top 10 Enterprise Leaderboard
                                    </h3>
                                    <span className="text-xs text-slate-400 font-semibold bg-slate-800 px-3 py-1 rounded-full">Ranked by Score</span>
                                </div>
                                <div className="space-y-3">
                                    {data.topPerformers?.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl hover:border-orange-500/30 transition-all">
                                            <div className="flex items-center gap-3">
                                                <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-sm ${
                                                    idx === 0 ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' :
                                                    idx === 1 ? 'bg-slate-300 text-slate-900' :
                                                    idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'
                                                }`}>
                                                    #{idx + 1}
                                                </span>
                                                <div>
                                                    <h4 className="font-bold text-white text-sm">{item.employee?.adminId?.name || item.employee?.employeeId}</h4>
                                                    <span className="text-[11px] text-slate-400">{item.employee?.designation} • {item.employee?.department}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <span className="text-base font-extrabold text-white block">{item.performance?.finalScore} pts</span>
                                                    <span className="text-[10px] text-emerald-400 font-mono">Rev: {formatCurrency(item.performance?.financialBreakdown?.grossRevenue)}</span>
                                                </div>
                                                {getLevelBadge(item.performance?.performanceLevel?.levelName, item.performance?.performanceLevel?.color)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Bottom Performers */}
                            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
                                <div className="flex items-center justify-between mb-5">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-rose-400" /> Lowest Performers (Focus Required)
                                    </h3>
                                    <span className="text-xs text-slate-400 font-semibold bg-slate-800 px-3 py-1 rounded-full">Coaching Priority</span>
                                </div>
                                <div className="space-y-3">
                                    {data.bottomPerformers?.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl hover:border-rose-500/30 transition-all">
                                            <div className="flex items-center gap-3">
                                                <span className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xs">
                                                    !
                                                </span>
                                                <div>
                                                    <h4 className="font-bold text-white text-sm">{item.employee?.adminId?.name || item.employee?.employeeId}</h4>
                                                    <span className="text-[11px] text-slate-400">{item.employee?.designation} • {item.employee?.department}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <span className="text-base font-extrabold text-white block">{item.performance?.finalScore} pts</span>
                                                    <span className="text-[10px] text-slate-500 font-mono">Rev: {formatCurrency(item.performance?.financialBreakdown?.grossRevenue)}</span>
                                                </div>
                                                {getLevelBadge(item.performance?.performanceLevel?.levelName, item.performance?.performanceLevel?.color)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: RISK & INACTIVE ALERT */}
                    {activeTab === 'risk' && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-3xl flex items-center gap-4 text-rose-300">
                                <ShieldAlert className="w-8 h-8 flex-shrink-0 text-rose-400" />
                                <div>
                                    <h4 className="font-bold text-base text-white">AI-Ready Risk & Intervention Engine</h4>
                                    <p className="text-xs text-rose-200/80 mt-0.5">
                                        Identifies employees with critical score drops (&lt;50 pts), high attrition risk, or zero achieved metrics across all KPIs.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
                                    <h3 className="font-bold text-white text-base mb-4 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-rose-400" /> Critical Risk Staff ({data.riskEmployees?.length || 0})
                                    </h3>
                                    {data.riskEmployees?.length === 0 ? (
                                        <p className="text-xs text-slate-500 py-6 text-center">No high-risk employees detected.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {data.riskEmployees?.map((item, idx) => (
                                                <div key={idx} className="p-4 bg-slate-950 border border-rose-500/20 rounded-2xl flex justify-between items-center">
                                                    <div>
                                                        <h4 className="font-bold text-white text-sm">{item.employee?.adminId?.name || item.employee?.employeeId}</h4>
                                                        <span className="text-[11px] text-slate-400">{item.employee?.department} • {item.employee?.designation}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-sm font-extrabold text-rose-400 block">{item.score} pts</span>
                                                        <span className="text-[10px] bg-rose-500/10 text-rose-300 px-2 py-0.5 rounded font-semibold">Needs Coaching</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
                                    <h3 className="font-bold text-white text-base mb-4 flex items-center gap-2">
                                        <UserCheck className="w-4 h-4 text-amber-400" /> Inactive / Zero-Metric Staff ({data.inactiveEmployees?.length || 0})
                                    </h3>
                                    {data.inactiveEmployees?.length === 0 ? (
                                        <p className="text-xs text-slate-500 py-6 text-center">All active employees have recorded metric activity.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {data.inactiveEmployees?.map((item, idx) => (
                                                <div key={idx} className="p-4 bg-slate-950 border border-amber-500/20 rounded-2xl flex justify-between items-center">
                                                    <div>
                                                        <h4 className="font-bold text-white text-sm">{item.employee?.adminId?.name || item.employee?.employeeId}</h4>
                                                        <span className="text-[11px] text-slate-400">{item.employee?.department} • {item.employee?.designation}</span>
                                                    </div>
                                                    <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl">0 Metrics Achieved</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: DIRECTORY & SCORECARDS */}
                    {activeTab === 'directory' && (
                        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 animate-in fade-in duration-200">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Users className="w-5 h-5 text-orange-400" /> All Employee Performance Directory ({filteredDirectory.length})
                                </h3>
                                <div className="relative w-full md:w-72">
                                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search employee, department, zone..."
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-white focus:outline-none focus:border-orange-500"
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-800 text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
                                            <th className="py-3 px-4">Employee</th>
                                            <th className="py-3 px-4">Department & Zone</th>
                                            <th className="py-3 px-4 text-right">Gross Revenue</th>
                                            <th className="py-3 px-4 text-right">Net Profit</th>
                                            <th className="py-3 px-4 text-right">Score</th>
                                            <th className="py-3 px-4 text-center">Level Badge</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60 text-xs">
                                        {filteredDirectory.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-950/60 transition-colors">
                                                <td className="py-3.5 px-4 font-bold text-white">
                                                    <div>
                                                        <span>{item.employee?.adminId?.name || item.employee?.employeeId}</span>
                                                        <span className="block text-[10px] font-normal text-slate-500">{item.employee?.designation}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4 text-slate-300">
                                                    <span className="font-semibold">{item.employee?.department}</span>
                                                    <span className="block text-[10px] text-slate-500">{item.employee?.zone || 'Central'}</span>
                                                </td>
                                                <td className="py-3.5 px-4 text-right font-mono text-emerald-400 font-bold">
                                                    {formatCurrency(item.performance?.financialBreakdown?.grossRevenue)}
                                                </td>
                                                <td className="py-3.5 px-4 text-right font-mono text-amber-400 font-bold">
                                                    {formatCurrency(item.performance?.financialBreakdown?.netProfit)}
                                                </td>
                                                <td className="py-3.5 px-4 text-right font-extrabold text-white text-sm">
                                                    {item.performance?.finalScore} pts
                                                </td>
                                                <td className="py-3.5 px-4 text-center">
                                                    {getLevelBadge(item.performance?.performanceLevel?.levelName, item.performance?.performanceLevel?.color)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
