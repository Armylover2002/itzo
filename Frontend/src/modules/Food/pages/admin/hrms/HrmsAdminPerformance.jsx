import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'react-hot-toast';
import { 
    TrendingUp, Users, Activity, BarChart2, AlertTriangle, RefreshCw, 
    Download, DollarSign, Award, Trophy, ShieldAlert, UserCheck, 
    Search, FileText, FileSpreadsheet
} from 'lucide-react';

export default function HrmsAdminPerformance() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // overview | leaderboard | risk | directory
    
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

    const filteredDirectory = data?.allPerformances?.filter(item => {
        if (!searchQuery) return true;
        const name = item.employee?.adminId?.name || item.employee?.employeeId || '';
        const dept = item.employee?.department || '';
        const zn = item.employee?.zone || '';
        return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
               dept.toLowerCase().includes(searchQuery.toLowerCase()) ||
               zn.toLowerCase().includes(searchQuery.toLowerCase());
    }) || [];

    const tabs = [
        { id: 'overview', label: 'Overview', icon: Activity },
        { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
        { id: 'risk', label: 'Needs Attention', icon: ShieldAlert, count: (data?.riskEmployees?.length || 0) + (data?.inactiveEmployees?.length || 0) },
        { id: 'directory', label: 'All Employees', icon: Users, count: data?.totalEvaluated || 0 }
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 min-h-screen">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                            <BarChart2 className="w-5 h-5 text-orange-600" />
                        </div>
                        Performance Overview
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 ml-[52px]">
                        View employee performance scores, rankings, and financial contributions.
                    </p>
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap items-center gap-2.5">
                    <input
                        type="month"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                    <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    >
                        <option value="All">All Zones</option>
                        <option value="North">North</option>
                        <option value="South">South</option>
                        <option value="East">East</option>
                        <option value="West">West</option>
                        <option value="Central">Central</option>
                    </select>
                    <button
                        onClick={() => fetchAnalytics(true)}
                        className="p-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-colors"
                        title="Recalculate All"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>

                    {/* Export Dropdown */}
                    <div className="relative group">
                        <button
                            disabled={exporting}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors"
                        >
                            <Download className="w-4 h-4 text-orange-500" />
                            Export
                        </button>
                        <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 hidden group-hover:block z-50">
                            <button
                                onClick={() => handleExport('Employee', 'csv')}
                                className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                                <FileText className="w-4 h-4 text-blue-500" /> Export Scorecards (CSV)
                            </button>
                            <button
                                onClick={() => handleExport('Revenue', 'excel')}
                                className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                                <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Export Financials (Excel)
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 pb-0">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm transition-all border-b-2 -mb-px ${
                                activeTab === tab.id
                                    ? 'border-orange-500 text-orange-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            <span>{tab.label}</span>
                            {tab.count !== undefined && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    activeTab === tab.id ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
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
                    <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mb-3" />
                    <p className="text-slate-400 font-medium text-sm">Loading performance data...</p>
                </div>
            ) : !data ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                    <Activity className="w-14 h-14 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-700 font-semibold text-lg">No performance data for {period}</p>
                    <p className="text-sm text-slate-400 mt-1">Try changing the period filter or click Recalculate.</p>
                </div>
            ) : (
                <>
                    {/* TAB 1: OVERVIEW */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                            <Users className="w-5 h-5 text-blue-600" />
                                        </div>
                                    </div>
                                    <p className="text-xs font-medium text-slate-500">Total Evaluated</p>
                                    <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{data.totalEvaluated} <span className="text-sm font-normal text-slate-400">employees</span></h3>
                                </div>

                                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                                            <Activity className="w-5 h-5 text-orange-600" />
                                        </div>
                                        {getLevelBadge(data.performanceLevel?.levelName, data.performanceLevel?.color)}
                                    </div>
                                    <p className="text-xs font-medium text-slate-500">Average Score</p>
                                    <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{data.averageScore} <span className="text-sm font-normal text-slate-400">/ 100</span></h3>
                                </div>

                                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                                            <DollarSign className="w-5 h-5 text-emerald-600" />
                                        </div>
                                    </div>
                                    <p className="text-xs font-medium text-slate-500">Net Revenue</p>
                                    <h3 className="text-xl font-bold text-emerald-600 mt-0.5">{formatCurrency(data.financialBreakdown?.grossRevenue)}</h3>
                                </div>

                                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                                            <TrendingUp className="w-5 h-5 text-amber-600" />
                                        </div>
                                    </div>
                                    <p className="text-xs font-medium text-slate-500">Net Profit</p>
                                    <h3 className="text-xl font-bold text-amber-600 mt-0.5">{formatCurrency(data.financialBreakdown?.netProfit)}</h3>
                                </div>
                            </div>

                            {/* Financial Breakdown */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <DollarSign className="w-5 h-5 text-emerald-500" /> Financial Breakdown
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                    <div className="bg-slate-50 p-4 rounded-xl">
                                        <span className="text-xs font-medium text-slate-500 block">Net Revenue</span>
                                        <span className="text-base font-bold text-slate-900 mt-1 block">{formatCurrency(data.financialBreakdown?.grossRevenue)}</span>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl">
                                        <span className="text-xs font-medium text-slate-500 block">Platform Cost (5%)</span>
                                        <span className="text-base font-bold text-red-500 mt-1 block">-{formatCurrency(data.financialBreakdown?.platformCharges)}</span>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl">
                                        <span className="text-xs font-medium text-slate-500 block">GST (5%)</span>
                                        <span className="text-base font-bold text-red-500 mt-1 block">-{formatCurrency(data.financialBreakdown?.gstAmount)}</span>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl">
                                        <span className="text-xs font-medium text-slate-500 block">Staff Incentives</span>
                                        <span className="text-base font-bold text-amber-600 mt-1 block">-{formatCurrency(data.financialBreakdown?.employeeIncentive)}</span>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl">
                                        <span className="text-xs font-medium text-slate-500 block">Approved Expenses</span>
                                        <span className="text-base font-bold text-amber-600 mt-1 block">-{formatCurrency(data.financialBreakdown?.approvedExpenses)}</span>
                                    </div>
                                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                                        <span className="text-xs font-semibold text-emerald-700 block">Net Profit</span>
                                        <span className="text-base font-bold text-emerald-700 mt-1 block">{formatCurrency(data.financialBreakdown?.netProfit)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: LEADERBOARD */}
                    {activeTab === 'leaderboard' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* Top Performers */}
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                        <Trophy className="w-5 h-5 text-amber-500" /> Top Performers
                                    </h3>
                                    <span className="text-xs text-slate-400 font-medium bg-slate-50 px-3 py-1 rounded-full">Ranked by Score</span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {data.topPerformers?.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                                                    idx === 0 ? 'bg-amber-500 text-white' :
                                                    idx === 1 ? 'bg-slate-300 text-slate-800' :
                                                    idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    #{idx + 1}
                                                </span>
                                                <div>
                                                    <h4 className="font-semibold text-slate-900 text-sm">{item.employee?.adminId?.name || item.employee?.employeeId}</h4>
                                                    <span className="text-xs text-slate-500">{item.employee?.designation} • {item.employee?.department}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <span className="text-sm font-bold text-slate-900 block">{item.performance?.finalScore} pts</span>
                                                    <span className="text-[10px] text-emerald-600 font-medium">{formatCurrency(item.performance?.financialBreakdown?.grossRevenue)}</span>
                                                </div>
                                                {getLevelBadge(item.performance?.performanceLevel?.levelName, item.performance?.performanceLevel?.color)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Bottom Performers */}
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-red-500" /> Needs Improvement
                                    </h3>
                                    <span className="text-xs text-slate-400 font-medium bg-slate-50 px-3 py-1 rounded-full">Coaching Priority</span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {data.bottomPerformers?.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <span className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center font-bold text-xs border border-red-200">
                                                    !
                                                </span>
                                                <div>
                                                    <h4 className="font-semibold text-slate-900 text-sm">{item.employee?.adminId?.name || item.employee?.employeeId}</h4>
                                                    <span className="text-xs text-slate-500">{item.employee?.designation} • {item.employee?.department}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <span className="text-sm font-bold text-slate-900 block">{item.performance?.finalScore} pts</span>
                                                    <span className="text-[10px] text-slate-400 font-medium">{formatCurrency(item.performance?.financialBreakdown?.grossRevenue)}</span>
                                                </div>
                                                {getLevelBadge(item.performance?.performanceLevel?.levelName, item.performance?.performanceLevel?.color)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: NEEDS ATTENTION */}
                    {activeTab === 'risk' && (
                        <div className="space-y-5">
                            <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3">
                                <ShieldAlert className="w-6 h-6 text-red-500 flex-shrink-0" />
                                <div>
                                    <h4 className="font-semibold text-sm text-slate-900">Employees Requiring Attention</h4>
                                    <p className="text-xs text-slate-600 mt-0.5">
                                        Employees with critical score drops (&lt;50 pts), high risk, or zero achieved metrics.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                    <div className="p-5 border-b border-slate-100">
                                        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4 text-red-500" /> Critical Risk ({data.riskEmployees?.length || 0})
                                        </h3>
                                    </div>
                                    {data.riskEmployees?.length === 0 ? (
                                        <p className="text-sm text-slate-400 py-8 text-center">No high-risk employees detected.</p>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {data.riskEmployees?.map((item, idx) => (
                                                <div key={idx} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                                    <div>
                                                        <h4 className="font-semibold text-slate-900 text-sm">{item.employee?.adminId?.name || item.employee?.employeeId}</h4>
                                                        <span className="text-xs text-slate-500">{item.employee?.department} • {item.employee?.designation}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-sm font-bold text-red-600 block">{item.score} pts</span>
                                                        <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded font-medium border border-red-200">Needs Coaching</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                    <div className="p-5 border-b border-slate-100">
                                        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                            <UserCheck className="w-4 h-4 text-amber-500" /> Inactive / No Activity ({data.inactiveEmployees?.length || 0})
                                        </h3>
                                    </div>
                                    {data.inactiveEmployees?.length === 0 ? (
                                        <p className="text-sm text-slate-400 py-8 text-center">All employees have recorded activity.</p>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {data.inactiveEmployees?.map((item, idx) => (
                                                <div key={idx} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                                    <div>
                                                        <h4 className="font-semibold text-slate-900 text-sm">{item.employee?.adminId?.name || item.employee?.employeeId}</h4>
                                                        <span className="text-xs text-slate-500">{item.employee?.department} • {item.employee?.designation}</span>
                                                    </div>
                                                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">No Activity</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: ALL EMPLOYEES */}
                    {activeTab === 'directory' && (
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 border-b border-slate-100">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-orange-500" /> All Employees ({filteredDirectory.length})
                                </h3>
                                <div className="relative w-full md:w-72">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search employee, department, zone..."
                                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                                            <th className="py-3 px-5">Employee</th>
                                            <th className="py-3 px-5">Department & Zone</th>
                                            <th className="py-3 px-5 text-right">Net Revenue</th>
                                            <th className="py-3 px-5 text-right">Net Profit</th>
                                            <th className="py-3 px-5 text-right">Score</th>
                                            <th className="py-3 px-5 text-center">Rating</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm">
                                        {filteredDirectory.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="py-3.5 px-5">
                                                    <span className="font-semibold text-slate-900">{item.employee?.adminId?.name || item.employee?.employeeId}</span>
                                                    <span className="block text-xs text-slate-500">{item.employee?.designation}</span>
                                                </td>
                                                <td className="py-3.5 px-5 text-slate-600">
                                                    <span className="font-medium">{item.employee?.department}</span>
                                                    <span className="block text-xs text-slate-400">{item.employee?.zone || 'Central'}</span>
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
